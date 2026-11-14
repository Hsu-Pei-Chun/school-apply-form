// 課綱關鍵字搜尋的純函式（不碰資料庫，方便測試）。
// PDF 擷取出的文字常在詞中間斷行或插入空白（例如「人工\n智慧」「人 工 智 慧」），
// 所以比對時一律忽略空白、全形半形與大小寫。

export const MAX_KEYWORDS = 10;

/** 搜尋用的正規化：全形轉半形（NFKC）、轉小寫、去掉所有空白。 */
export function compactText(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

/** 以逗號、頓號、分號或換行分隔多個關鍵字（同一個關鍵字內的空格會被忽略）。 */
export function parseKeywords(q: string): string[] {
  const out: string[] = [];
  for (const raw of q.split(/[,，、;；\n]+/)) {
    const k = raw.trim();
    if (k && compactText(k) && !out.some(o => compactText(o) === compactText(k))) out.push(k);
  }
  return out.slice(0, MAX_KEYWORDS);
}

function keywordRegex(keyword: string): RegExp {
  const chars = [...compactText(keyword)].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(chars.join('\\s*'), 'giu');
}

export type Segment = { text: string; hit: boolean };
export type KeywordHits = { keyword: string; count: number; snippets: Segment[][] };

const CONTEXT = 40;

/**
 * 在原文中找出關鍵字出現次數與前後文片段（每個關鍵字最多 maxSnippets 段）。
 * 片段切成 { text, hit } 陣列，交給畫面用 <mark> 標出，不必用 dangerouslySetInnerHTML。
 */
export function findHits(text: string, keyword: string, maxSnippets = 3): KeywordHits {
  // NFKC 可能改變字串長度，所以在正規化後的文字上找、也從它切片段（只用來顯示）
  const source = text.normalize('NFKC');
  const re = keywordRegex(keyword);
  const snippets: Segment[][] = [];
  let count = 0;
  let lastEnd = -1;
  for (const m of source.matchAll(re)) {
    count++;
    const start = m.index;
    const end = start + m[0].length;
    if (snippets.length >= maxSnippets || start < lastEnd) continue;
    const from = Math.max(0, start - CONTEXT);
    const to = Math.min(source.length, end + CONTEXT);
    lastEnd = to;
    const clean = (s: string) => s.replace(/\s+/g, ' ');
    snippets.push([
      { text: (from > 0 ? '…' : '') + clean(source.slice(from, start)), hit: false },
      { text: clean(m[0]), hit: true },
      { text: clean(source.slice(end, to)) + (to < source.length ? '…' : ''), hit: false },
    ]);
  }
  return { keyword, count, snippets };
}

/** SQL LIKE 的萬用字元跳脫（搭配 ESCAPE '\'）。 */
export function likePattern(keyword: string): string {
  return `%${compactText(keyword).replace(/[\\%_]/g, '\\$&')}%`;
}
