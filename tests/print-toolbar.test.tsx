import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintToolbar from '@/app/apply/[id]/PrintToolbar';

describe('PrintToolbar', () => {
  it('列印時應隱藏（帶 no-print class）且含列印與回申請頁動作', () => {
    const html = renderToStaticMarkup(<PrintToolbar />);
    expect(html).toContain('no-print');
    expect(html).toContain('列印申請表');
    expect(html).toContain('href="/apply"');
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
