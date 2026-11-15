import { eq, notInArray, or, sql, asc } from 'drizzle-orm';
import { Db } from '../db/client';
import { formSettings, syllabi, Syllabus } from '../db/schema';
import { compactText, findHits, KeywordHits, likePattern, parseKeywords } from './search';
import type { SyllabusEntry } from './parse';

// 校方「全部課程大綱」總表頁：學期更新時管理員可在 /admin/syllabus 改成新網址
export const DEFAULT_SYLLABUS_INDEX_URL = 'https://curricul.site.nthu.edu.tw/var/file/208/1208/img/4645/11510all_syllabus_pdf.htm';
const URL_KEY = 'syllabusIndexUrl';
const LAST_RUN_KEY = 'syllabusLastRun';

export type LastRun = {
  url: string;
  finishedAt: string;
  total: number;
  updated: number;
  unchanged: number;
  failed: number;
  removed: number;
};

async function getSetting(db: Db, key: string): Promise<string | undefined> {
  return (await db.select().from(formSettings).where(eq(formSettings.key, key)).get())?.value;
}

async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.insert(formSettings).values({ key, value }).onConflictDoUpdate({ target: formSettings.key, set: { value } }).run();
}

/** 只接受 http(s) 網址，避免被拿去讀伺服器本機檔案或其他協定。 */
export function normalizeIndexUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export async function getSyllabusIndexUrl(db: Db): Promise<string> {
  return (await getSetting(db, URL_KEY)) ?? DEFAULT_SYLLABUS_INDEX_URL;
}

export async function saveSyllabusIndexUrl(db: Db, url: string): Promise<void> {
  await setSetting(db, URL_KEY, url);
}

export async function getLastRun(db: Db): Promise<LastRun | null> {
  const v = await getSetting(db, LAST_RUN_KEY);
  if (!v) return null;
  try { return JSON.parse(v) as LastRun; } catch { return null; }
}

export async function saveLastRun(db: Db, run: LastRun): Promise<void> {
  await setSetting(db, LAST_RUN_KEY, JSON.stringify(run));
}

export type StoredMeta = Pick<Syllabus, 'code' | 'name' | 'nameEn' | 'teacher' | 'time' | 'pdfUrl' | 'etag' | 'lastModified' | 'error'>;

export async function listSyllabusMeta(db: Db): Promise<Map<string, StoredMeta>> {
  const rows = await db.select({
    code: syllabi.code, name: syllabi.name, nameEn: syllabi.nameEn, teacher: syllabi.teacher, time: syllabi.time,
    pdfUrl: syllabi.pdfUrl, etag: syllabi.etag, lastModified: syllabi.lastModified, error: syllabi.error,
  }).from(syllabi).all();
  return new Map(rows.map(r => [r.code, r]));
}

export type PdfContent = { etag: string; lastModified: string; pages: number; text: string; error: string };

/** 寫入（或覆蓋）一門課的課綱文字。標題、教師也放進 compact，用課名或教師名搜尋也找得到。 */
export async function upsertSyllabus(db: Db, entry: SyllabusEntry, content: PdfContent, now = new Date()): Promise<void> {
  const row = {
    ...entry, ...content,
    compact: compactText([entry.code, entry.name, entry.nameEn, entry.teacher, content.text].join('\n')),
    indexedAt: now.toISOString(),
  };
  const { code: _code, ...set } = row;
  await db.insert(syllabi).values(row).onConflictDoUpdate({ target: syllabi.code, set }).run();
}

/** PDF 沒變、只有總表上的課名／教師等資料變了時，只更新這些欄位。 */
export async function updateSyllabusMeta(db: Db, entry: SyllabusEntry): Promise<void> {
  const { code, ...set } = entry;
  await db.update(syllabi).set(set).where(eq(syllabi.code, code)).run();
}

/** 下載或擷取失敗：記下原因（下次更新會重抓），保留上次成功的文字讓搜尋仍可用。 */
export async function markSyllabusError(db: Db, entry: SyllabusEntry, message: string): Promise<void> {
  const { code, ...set } = entry;
  await db.update(syllabi).set({ ...set, error: message }).where(eq(syllabi.code, code)).run();
}

/** 刪除總表上已經沒有的課（回傳刪除筆數）。 */
export async function removeSyllabiNotIn(db: Db, codes: string[]): Promise<number> {
  if (codes.length === 0) return 0;
  const res = await db.delete(syllabi).where(notInArray(syllabi.code, codes)).run();
  return res.rowsAffected;
}

export type SyllabusStats = { total: number; noText: number; failed: number };

export async function getSyllabusStats(db: Db): Promise<SyllabusStats> {
  const r = await db.select({
    total: sql<number>`count(*)`,
    noText: sql<number>`sum(case when ${syllabi.error} = '' and length(trim(${syllabi.text})) = 0 then 1 else 0 end)`,
    failed: sql<number>`sum(case when ${syllabi.error} <> '' then 1 else 0 end)`,
  }).from(syllabi).get();
  return { total: Number(r?.total ?? 0), noText: Number(r?.noText ?? 0), failed: Number(r?.failed ?? 0) };
}

export type SearchResult = Pick<Syllabus, 'code' | 'name' | 'nameEn' | 'teacher' | 'time' | 'pdfUrl'> & {
  total: number;
  hits: KeywordHits[];
};

/** 找出包含任一關鍵字的課綱，依命中次數多到少排序。 */
export async function searchSyllabi(db: Db, q: string): Promise<{ keywords: string[]; results: SearchResult[] }> {
  const keywords = parseKeywords(q);
  if (keywords.length === 0) return { keywords, results: [] };
  const rows = await db.select({
    code: syllabi.code, name: syllabi.name, nameEn: syllabi.nameEn, teacher: syllabi.teacher, time: syllabi.time,
    pdfUrl: syllabi.pdfUrl, text: syllabi.text,
  }).from(syllabi)
    .where(or(...keywords.map(k => sql`${syllabi.compact} like ${likePattern(k)} escape '\\'`)))
    .orderBy(asc(syllabi.code))
    .all();

  const results = rows.map(({ text, ...meta }) => {
    const searchable = [meta.code, meta.name, meta.nameEn, meta.teacher, text].join('\n');
    const hits = keywords.map(k => findHits(searchable, k));
    return { ...meta, hits, total: hits.reduce((n, h) => n + h.count, 0) };
  });
  // 資料庫初篩是子字串比對（compact LIKE），英數關鍵字要再以完整單字過濾：只出現在單字中間的不列出
  const matched = results.filter(r => r.total > 0);
  matched.sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
  return { keywords, results: matched };
}
