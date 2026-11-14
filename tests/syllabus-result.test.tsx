import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SyllabusResult from '@/app/admin/syllabus/SyllabusResult';
import type { SearchResult } from '@/lib/syllabus/store';

const seg = (before: string, hit: string, after: string) => [
  { text: before, hit: false }, { text: hit, hit: true }, { text: after, hit: false },
];

const result: SearchResult = {
  code: '11510CS  110400', name: '人工智慧導論', nameEn: 'Intro to AI', teacher: '王教授', time: 'M3M4',
  pdfUrl: 'https://example.edu/a.pdf', total: 5,
  hits: [
    { keyword: 'AI', count: 4, snippets: [seg('…談 ', 'AI', ' 倫理…'), seg('…', 'AI', ' 應用…'), seg('…', 'AI', ' 歷史…')] },
    { keyword: '永續', count: 0, snippets: [] },
  ],
};

describe('SyllabusResult', () => {
  it('課名為標題，科號／教師／時間在下一行，並附開啟 PDF 連結', () => {
    const html = renderToStaticMarkup(<SyllabusResult r={result} locale="zh" />);
    expect(html).toMatch(/<h3[^>]*>人工智慧導論<\/h3>/);
    expect(html).toContain('11510CS  110400');
    expect(html).toContain('王教授');
    expect(html).toContain('href="https://example.edu/a.pdf"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('只列出有命中的關鍵字，並以 <mark> 標出命中處', () => {
    const html = renderToStaticMarkup(<SyllabusResult r={result} locale="zh" />);
    expect(html).toContain('AI · 4 處');
    expect(html).not.toContain('永續');
    expect(html).toContain('<mark');
  });

  it('每個關鍵字先顯示第一段前後文，其餘收進 details，長清單才好讀', () => {
    const html = renderToStaticMarkup(<SyllabusResult r={result} locale="zh" />);
    expect(html).toContain('<details');
    expect(html).toContain('再顯示 2 段');
  });

  it('英文版優先顯示英文課名', () => {
    expect(renderToStaticMarkup(<SyllabusResult r={result} locale="en" />)).toMatch(/<h3[^>]*>Intro to AI<\/h3>/);
  });
});
