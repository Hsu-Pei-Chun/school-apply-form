import 'server-only';
import { getDb, Db } from '../db/client';
import { decodeHtml, parseSyllabusIndex, SyllabusEntry } from './parse';
import {
  listSyllabusMeta, upsertSyllabus, updateSyllabusMeta, markSyllabusError, removeSyllabiNotIn, saveLastRun, StoredMeta, PdfContent,
} from './store';

// 背景更新課綱索引：讀總表頁 → 逐一下載 PDF → 擷取文字存進資料庫。
// 一千多個 PDF 要跑好幾分鐘，所以不在 request 裡等它跑完，而是在背景執行、進度放在記憶體，畫面輪詢 getIndexStatus()。
// 已經存過、伺服器回報沒更新（ETag／Last-Modified → 304）的 PDF 會略過，第二次之後只下載有變的檔案。
// 每個 PDF 處理完就寫進資料庫，中途被中斷（伺服器重啟、休眠）再按一次會從沒做完的地方接著做。

export type IndexStatus = {
  state: 'idle' | 'running' | 'done' | 'error';
  url: string;
  startedAt: string;
  finishedAt: string;
  total: number;
  processed: number;
  updated: number;
  unchanged: number;
  failed: number;
  removed: number;
  message: string;
  failures: { code: string; error: string }[];
};

const IDLE: IndexStatus = {
  state: 'idle', url: '', startedAt: '', finishedAt: '', total: 0, processed: 0,
  updated: 0, unchanged: 0, failed: 0, removed: 0, message: '', failures: [],
};

const g = globalThis as { __syllabusIndex?: IndexStatus };

export function getIndexStatus(): IndexStatus {
  return g.__syllabusIndex ?? IDLE;
}

// Render 免費方案只有 512MB 記憶體，同時處理的 PDF 不宜太多
const CONCURRENCY = 2;
const PAGE_TIMEOUT_MS = 60_000;
const PDF_TIMEOUT_MS = 45_000;
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_FAILURES_SHOWN = 50;
const UA = 'Mozilla/5.0 (compatible; school-apply-form syllabus indexer)';

export async function fetchIndex(url: string): Promise<SyllabusEntry[]> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(PAGE_TIMEOUT_MS), redirect: 'follow' });
  if (!res.ok) throw new Error(`總表頁讀取失敗（HTTP ${res.status}）`);
  const html = decodeHtml(new Uint8Array(await res.arrayBuffer()), res.headers.get('content-type') ?? '');
  return parseSyllabusIndex(html, res.url || url);
}

export async function extractPdfText(bytes: Uint8Array): Promise<{ pages: number; text: string }> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  // verbosity 0：不要把 pdf.js 的字型警告（TT: undefined function…）灌進伺服器 log
  const pdf = await getDocumentProxy(bytes, { verbosity: 0 });
  try {
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    return { pages: totalPages, text: text.replace(/\u0000/g, '').trim() };
  } finally {
    await pdf.loadingTask.destroy(); // 釋放 pdf.js 佔用的記憶體（一千多個檔案逐一處理）
  }
}

type Outcome = 'updated' | 'unchanged';

async function fetchPdf(entry: SyllabusEntry, prev: StoredMeta | undefined): Promise<PdfContent | 'not-modified'> {
  const headers: Record<string, string> = { 'User-Agent': UA };
  // 只有上次成功、且網址相同時才用條件式請求；上次失敗的要整個重抓
  if (prev && prev.pdfUrl === entry.pdfUrl && !prev.error) {
    if (prev.etag) headers['If-None-Match'] = prev.etag;
    if (prev.lastModified) headers['If-Modified-Since'] = prev.lastModified;
  }
  const res = await fetch(entry.pdfUrl, { headers, signal: AbortSignal.timeout(PDF_TIMEOUT_MS), redirect: 'follow' });
  if (res.status === 304) return 'not-modified';
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_PDF_BYTES) throw new Error('檔案過大');
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error('檔案過大');
  const meta = { etag: res.headers.get('etag') ?? '', lastModified: res.headers.get('last-modified') ?? '' };
  if (new TextDecoder('latin1').decode(bytes.slice(0, 1024)).indexOf('%PDF') < 0) {
    throw new Error('不是 PDF 檔');
  }
  const { pages, text } = await extractPdfText(bytes);
  return { ...meta, pages, text, error: '' };
}

function metaChanged(entry: SyllabusEntry, prev: StoredMeta): boolean {
  return entry.name !== prev.name || entry.nameEn !== prev.nameEn || entry.teacher !== prev.teacher || entry.time !== prev.time;
}

async function processEntry(db: Db, entry: SyllabusEntry, prev: StoredMeta | undefined): Promise<Outcome> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await fetchPdf(entry, prev);
      if (content === 'not-modified') {
        if (prev && metaChanged(entry, prev)) await updateSyllabusMeta(db, entry);
        return 'unchanged';
      }
      await upsertSyllabus(db, entry, content);
      return 'updated';
    } catch (e) {
      lastError = e;
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  // 記下失敗，下次更新會重抓；保留舊的文字讓搜尋仍可用
  if (!prev) await upsertSyllabus(db, entry, { etag: '', lastModified: '', pages: 0, text: '', error: message });
  else await markSyllabusError(db, entry, message);
  throw new Error(message);
}

async function run(url: string, status: IndexStatus): Promise<void> {
  const db = await getDb();
  const entries = await fetchIndex(url);
  if (entries.length === 0) throw new Error('總表頁上找不到任何 PDF 連結，請確認網址是否正確');
  status.total = entries.length;
  const existing = await listSyllabusMeta(db);

  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      const entry = entries[next++];
      try {
        const outcome = await processEntry(db, entry, existing.get(entry.code));
        status[outcome]++;
      } catch (e) {
        status.failed++;
        if (status.failures.length < MAX_FAILURES_SHOWN) {
          status.failures.push({ code: entry.code, error: e instanceof Error ? e.message : String(e) });
        }
      } finally {
        status.processed++;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  status.removed = await removeSyllabiNotIn(db, entries.map(e => e.code));
  status.finishedAt = new Date().toISOString();
  await saveLastRun(db, {
    url, finishedAt: status.finishedAt, total: status.total, updated: status.updated,
    unchanged: status.unchanged, failed: status.failed, removed: status.removed,
  });
}

/** 開始更新；已經在跑時不重複啟動，回傳目前狀態。 */
export function startIndexing(url: string): IndexStatus {
  const current = g.__syllabusIndex;
  if (current?.state === 'running') return current;
  const status: IndexStatus = { ...IDLE, failures: [], state: 'running', url, startedAt: new Date().toISOString() };
  g.__syllabusIndex = status;
  run(url, status)
    .then(() => { status.state = 'done'; })
    .catch((e) => {
      console.error('[syllabus] 更新索引失敗', e);
      status.state = 'error';
      status.message = e instanceof Error ? e.message : String(e);
      status.finishedAt = new Date().toISOString();
    });
  return status;
}
