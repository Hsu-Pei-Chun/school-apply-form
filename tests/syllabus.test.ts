import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createDb, Db } from '@/lib/db/client';
import { decodeHtml, parseSyllabusIndex, SyllabusEntry } from '@/lib/syllabus/parse';
import { compactText, findHits, likePattern, parseKeywords } from '@/lib/syllabus/search';
import {
  DEFAULT_SYLLABUS_INDEX_URL, getSyllabusIndexUrl, saveSyllabusIndexUrl, normalizeIndexUrl, upsertSyllabus,
  searchSyllabi, removeSyllabiNotIn, getSyllabusStats, markSyllabusError, listSyllabusMeta,
} from '@/lib/syllabus/store';
import { resetFormSettings, saveFormSettings } from '@/lib/form-settings';

const PAGE_URL = 'https://curricul.site.nthu.edu.tw/var/file/208/1208/img/4645/11510all_syllabus_pdf.htm';

describe('課綱總表解析', () => {
  const bytes = new Uint8Array(readFileSync(path.join(__dirname, 'fixtures/syllabus-index-big5.htm')));

  it('沒有宣告編碼的 Big5 頁面能正確解碼', () => {
    const html = decodeHtml(bytes);
    expect(html).toContain('環境微生物學');
    expect(html).not.toContain('�');
  });

  it('UTF-8 頁面照 UTF-8 解碼', () => {
    expect(decodeHtml(new TextEncoder().encode('<p>課綱</p>'))).toBe('<p>課綱</p>');
  });

  it('解析出每門課的科號、課名、教師、時間與 PDF 絕對網址（依 <base href> 解析、空格編碼）', () => {
    const entries = parseSyllabusIndex(decodeHtml(bytes), PAGE_URL);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      code: '11510AES 450100', name: '環境微生物學', nameEn: 'Environmental Microbiology',
      teacher: '李清福', time: 'W2W3W4',
      pdfUrl: 'https://www.ccxp.nthu.edu.tw/ccxp/INQUIRE/JH/output/6_6.1_6.1.12/11510AES%20450100.pdf',
    });
  });

  it('科號內連續的補位空格要原樣保留', () => {
    const html = `<td>科號&nbsp;Course Number：11510FL  404701</td><td>中文名稱&nbsp;Course Title：高級日語一</td>
      <a href='/x/11510FL  404701.pdf'>Syllabus</a>`;
    expect(parseSyllabusIndex(html, 'https://a.example/list.htm')[0].code).toBe('11510FL  404701');
  });

  it('同一科號重複出現只取第一筆；沒有 PDF 連結的課略過', () => {
    const block = (code: string, link: string) => `<td>科號&nbsp;Course Number：${code}</td>${link}`;
    const html = block('A', "<a href='a.pdf'>x</a>") + block('A', "<a href='a2.pdf'>x</a>") + block('B', '');
    const entries = parseSyllabusIndex(html, 'https://a.example/dir/list.htm');
    expect(entries.map(e => [e.code, e.pdfUrl])).toEqual([['A', 'https://a.example/dir/a.pdf']]);
  });

  it('別種格式的頁面：抓出所有 PDF 連結，以檔名當科號', () => {
    const html = '<a href="files/EE%20101.pdf">EE</a> <a href="https://b.example/c.PDF?v=2">C</a> <a href="x.doc">no</a>';
    const entries = parseSyllabusIndex(html, 'https://a.example/list.htm');
    expect(entries.map(e => e.code)).toEqual(['EE 101', 'c']);
    expect(entries[0].pdfUrl).toBe('https://a.example/files/EE%20101.pdf');
  });
});

describe('關鍵字比對', () => {
  it('以逗號、頓號、換行分隔多個關鍵字，去除重複與空白', () => {
    expect(parseKeywords(' 人工智慧、AI ,ai，\n 永續 ')).toEqual(['人工智慧', 'AI', '永續']);
    expect(parseKeywords('  ')).toEqual([]);
  });

  it('忽略 PDF 文字中的斷行、空白、全形與大小寫', () => {
    const text = '本課程介紹人工\n智慧與 Ｍachine  Learning，人 工 智 慧 的應用。';
    expect(findHits(text, '人工智慧').count).toBe(2);
    expect(findHits(text, 'machine learning').count).toBe(1);
    expect(compactText('Ｍachine  Learning')).toBe('machinelearning');
  });

  it('片段標出命中文字並帶前後文', () => {
    const { snippets } = findHits('前文'.repeat(30) + '永續發展' + '後文'.repeat(30), '永續');
    expect(snippets).toHaveLength(1);
    expect(snippets[0][1]).toEqual({ text: '永續', hit: true });
    expect(snippets[0][0].text.startsWith('…')).toBe(true);
    expect(snippets[0][2].text.endsWith('…')).toBe(true);
  });

  it('正規表示式特殊字元與 LIKE 萬用字元會被跳脫', () => {
    expect(findHits('使用 C++ 與 C#', 'c++').count).toBe(1);
    expect(likePattern('100%_a')).toBe('%100\\%\\_a%');
  });
});

describe('課綱資料庫', () => {
  let db: Db;
  beforeEach(async () => { db = await createDb(':memory:'); });

  const entry = (code: string, extra: Partial<SyllabusEntry> = {}): SyllabusEntry => ({
    code, name: `課程${code}`, nameEn: '', teacher: '王老師', time: 'M1', pdfUrl: `https://a.example/${code}.pdf`, ...extra,
  });
  const content = (text: string) => ({ etag: '"e1"', lastModified: '', pages: 1, text, error: '' });

  it('總表網址預設為校方網址，可儲存新網址；只接受 http(s)', async () => {
    expect(await getSyllabusIndexUrl(db)).toBe(DEFAULT_SYLLABUS_INDEX_URL);
    await saveSyllabusIndexUrl(db, 'https://new.example/all.htm');
    expect(await getSyllabusIndexUrl(db)).toBe('https://new.example/all.htm');
    expect(normalizeIndexUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeIndexUrl('not a url')).toBeNull();
    expect(normalizeIndexUrl(' https://a.example/x y.htm ')).toBe('https://a.example/x%20y.htm');
  });

  it('還原申請表預設文字時不會清掉課綱網址', async () => {
    await saveSyllabusIndexUrl(db, 'https://new.example/all.htm');
    await saveFormSettings(db, { termsZh: 'a', termsEn: 'b', submitNoteZh: '', submitNoteEn: '' });
    await resetFormSettings(db);
    expect(await getSyllabusIndexUrl(db)).toBe('https://new.example/all.htm');
  });

  it('搜尋任一關鍵字，依命中次數排序，課名與教師也能搜', async () => {
    await upsertSyllabus(db, entry('A'), content('介紹機器學習。'));
    await upsertSyllabus(db, entry('B'), content('機器 學習、機器學習，以及永續。'));
    await upsertSyllabus(db, entry('C', { teacher: '李清福' }), content('與本次無關'));

    const r = await searchSyllabi(db, '機器學習、永續');
    expect(r.results.map(x => x.code)).toEqual(['B', 'A']);
    expect(r.results[0].total).toBe(3);
    expect(r.results[0].hits.map(h => h.count)).toEqual([2, 1]);

    expect((await searchSyllabi(db, '李清福')).results.map(x => x.code)).toEqual(['C']);
    expect((await searchSyllabi(db, '')).results).toEqual([]);
    expect((await searchSyllabi(db, '%')).results).toEqual([]);
  });

  it('重新寫入會覆蓋舊文字；失敗時保留舊文字並記下原因', async () => {
    await upsertSyllabus(db, entry('A'), content('舊內容'));
    await upsertSyllabus(db, entry('A'), content('新內容'));
    expect((await searchSyllabi(db, '舊內容')).results).toHaveLength(0);
    await markSyllabusError(db, entry('A'), 'HTTP 500');
    expect((await searchSyllabi(db, '新內容')).results).toHaveLength(1);
    expect((await listSyllabusMeta(db)).get('A')?.error).toBe('HTTP 500');
    expect(await getSyllabusStats(db)).toEqual({ total: 1, noText: 0, failed: 1 });
  });

  it('移除總表上已不存在的課；統計讀不到文字的課綱', async () => {
    await upsertSyllabus(db, entry('A'), content('x'));
    await upsertSyllabus(db, entry('B'), content(''));
    await upsertSyllabus(db, entry('C'), content('y'));
    expect(await getSyllabusStats(db)).toEqual({ total: 3, noText: 1, failed: 0 });
    expect(await removeSyllabiNotIn(db, ['A', 'B'])).toBe(1);
    expect([...(await listSyllabusMeta(db)).keys()].sort()).toEqual(['A', 'B']);
  });
});
