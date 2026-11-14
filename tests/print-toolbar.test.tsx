import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintToolbar from '@/app/apply/[id]/PrintToolbar';
import { fitToA4, pdfFilename } from '@/lib/pdf-export';

describe('PrintToolbar', () => {
  it('列印時應隱藏（帶 no-print class）且含列印與回申請頁動作', () => {
    const html = renderToStaticMarkup(<PrintToolbar />);
    expect(html).toContain('no-print');
    expect(html).toContain('列印申請表');
    expect(html).toContain('href="/apply"');
  });

  it('提示接下來的三個步驟：列印、簽章、送交課務組', () => {
    const html = renderToStaticMarkup(<PrintToolbar barcode="112000001-X-B" />);
    expect(html).toContain('接下來請完成');
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toContain('送交課務組');
    expect(html).toContain('112000001-X-B');
  });

  it('回申請頁連結最小可點擊高度需達 44px（min-h-11）', () => {
    const html = renderToStaticMarkup(<PrintToolbar />);
    const linkMatch = html.match(/<a[^>]*href="\/apply"[^>]*>/);
    expect(linkMatch).not.toBeNull();
    expect(linkMatch![0]).toContain('min-h-11');
  });
});

describe('print.css @media print 區塊', () => {
  it('不可用裸 header 選擇器隱藏列印頁自己的抬頭（會連 .sheet-head 一起藏起來）', () => {
    const css = readFileSync(
      path.join(__dirname, '../app/apply/[id]/print.css'),
      'utf-8'
    );
    const printBlockMatch = css.match(/@media print\s*{([\s\S]*)}\s*$/);
    expect(printBlockMatch).not.toBeNull();
    const printBlock = printBlockMatch![1];
    // 注意：刻意收斂為「,」「{」或行首（可接空白）才視為裸選擇器起點，
    // 避免誤判合法的 `body > header`（組合子選擇器，只鎖定站台導覽列，不會誤傷列印頁自己的抬頭）。
    expect(printBlock).not.toMatch(/(^|[,{])\s*header\s*[,{]/m);
  });
});

describe('下載 PDF', () => {
  it('工具列有下載 PDF 按鈕，英文版也有', () => {
    expect(renderToStaticMarkup(<PrintToolbar />)).toContain('下載 PDF');
    expect(renderToStaticMarkup(<PrintToolbar locale="en" />)).toContain('Download PDF');
  });

  it('檔名去掉空格與不合法字元', () => {
    expect(pdfFilename('申請表', '112000001-11510AES 450100-B')).toBe('申請表-112000001-11510AES_450100-B.pdf');
    expect(pdfFilename('a', 'x/y:z')).toBe('a-x_y_z.pdf');
  });

  it('圖片寬度貼滿 A4；太高時等比縮小到一頁並置中', () => {
    expect(fitToA4(2100, 2970)).toEqual({ x: 0, y: 0, w: 210, h: 297 });
    expect(fitToA4(1000, 1000)).toEqual({ x: 0, y: 0, w: 210, h: 210 });
    const tall = fitToA4(1000, 2970);
    expect(tall.h).toBe(297);
    expect(tall.w).toBeCloseTo(100);
    expect(tall.x).toBeCloseTo(55);
  });

  it('表格固定欄寬並允許任意處斷行：長串無空格的課程欄位不可把表格撐出紙張', () => {
    const css = readFileSync(path.join(__dirname, '../app/apply/[id]/print.css'), 'utf-8');
    expect(css).toMatch(/\.sheet table\s*{[^}]*table-layout:\s*fixed/);
    expect(css).toMatch(/\.sheet th, \.sheet td\s*{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/\.sheet \.code, \.barcode \.human\s*{[^}]*white-space:\s*pre-wrap/);
  });

  it('緊湊版面 .dense 規則在 @media 外且排在 .pdf-mode 之後（同權重才蓋得過）', () => {
    const css = readFileSync(path.join(__dirname, '../app/apply/[id]/print.css'), 'utf-8');
    const outside = css.replace(/@media[^{]*{(?:[^{}]*{[^{}]*})*[^{}]*}/g, '');
    expect(outside).toMatch(/\.sheet\.dense\s*{[^}]*font-size/);
    expect(css.lastIndexOf('.sheet.dense')).toBeGreaterThan(css.lastIndexOf('.sheet.pdf-mode'));
  });

  it('pdf-mode 規則不可放在 @media 區塊內（手機寬度下也必須套用 A4 版面）', () => {
    const css = readFileSync(path.join(__dirname, '../app/apply/[id]/print.css'), 'utf-8');
    const outside = css.replace(/@media[^{]*{(?:[^{}]*{[^{}]*})*[^{}]*}/g, '');
    expect(outside).toMatch(/\.sheet\.pdf-mode\s*{[^}]*width:\s*210mm/);
    expect(outside).toMatch(/\.sheet\.pdf-mode \.sheet-head\s*{[^}]*flex-direction:\s*row/);
  });
});
