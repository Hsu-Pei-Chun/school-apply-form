// 解析校方「全部課程大綱」總表頁（純函式，不連網，方便測試）。
// 總表頁格式：每門課一個區塊，含「科號 Course Number：…」「中文名稱 Course Title：…」等欄位，
// 以及一個指向課綱 PDF 的連結。若網址換成別種格式的頁面，退而求其次：抓出頁面上所有 .pdf 連結。

export type SyllabusEntry = {
  code: string;
  name: string;
  nameEn: string;
  teacher: string;
  time: string;
  pdfUrl: string;
};

/** 依 HTTP 標頭或 <meta charset> 決定編碼；都沒寫時先試 UTF-8，不合法再用 Big5（清大舊系統的總表是 Big5）。 */
export function decodeHtml(bytes: Uint8Array, contentType = ''): string {
  const declared = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]
    ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(new TextDecoder('latin1').decode(bytes.slice(0, 2048)))?.[1];
  if (declared) {
    try { return new TextDecoder(declared.toLowerCase()).decode(bytes); } catch { /* 不認得的編碼名稱，往下猜 */ }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('big5').decode(bytes);
  }
}

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(td|tr|p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}

function field(text: string, label: string, keepSpaces = false): string {
  const m = new RegExp(`${label}\\s*[：:][ \\t]*([^\\n]*)`).exec(text);
  const v = (m?.[1] ?? '').trim();
  return keepSpaces ? v : v.replace(/\s+/g, ' ');
}

function pdfLinks(html: string): string[] {
  return [...html.matchAll(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
    .map(m => (m[1] ?? m[2] ?? m[3]).trim())
    .filter(h => /\.pdf(?:[?#].*)?$/i.test(h));
}

function resolver(html: string, pageUrl: string): (href: string) => string {
  const baseHref = /<base[^>]+href\s*=\s*["']?([^"'\s>]+)/i.exec(html)?.[1];
  const base = baseHref ? new URL(baseHref, pageUrl).href : pageUrl;
  return (href) => new URL(href.replace(/&amp;/g, '&'), base).href;
}

export function parseSyllabusIndex(html: string, pageUrl: string): SyllabusEntry[] {
  const resolve = resolver(html, pageUrl);
  const seen = new Set<string>();
  const out: SyllabusEntry[] = [];
  const push = (e: SyllabusEntry) => {
    if (!e.code || seen.has(e.code)) return;
    seen.add(e.code);
    out.push(e);
  };

  // 以「Course Number」切出每門課的區塊（區塊內才有該課的 PDF 連結）
  const blocks = html.split(/(?=科號(?:&nbsp;|\s)*Course Number)/i).slice(1);
  for (const block of blocks) {
    const link = pdfLinks(block)[0];
    if (!link) continue;
    const text = htmlToText(block);
    push({
      code: field(text, 'Course Number', true), // 科號內的空格是補位，需原樣保留（與課程管理的科號一致）
      name: field(text, 'Course Title'),
      nameEn: field(text, 'Course English Title'),
      teacher: field(text, 'Instructor'),
      time: field(text, 'Time'),
      pdfUrl: resolve(link),
    });
  }
  if (out.length > 0) return out;

  // 其他格式：只有 PDF 連結，用檔名當作科號
  for (const link of pdfLinks(html)) {
    const pdfUrl = resolve(link);
    const file = decodeURIComponent(new URL(pdfUrl).pathname.split('/').pop() ?? '').replace(/\.pdf$/i, '');
    push({ code: file || pdfUrl, name: '', nameEn: '', teacher: '', time: '', pdfUrl });
  }
  return out;
}
