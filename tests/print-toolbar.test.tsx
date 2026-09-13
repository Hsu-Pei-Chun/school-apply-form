import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintToolbar from '@/app/apply/[id]/PrintToolbar';

describe('PrintToolbar', () => {
  it('列印時應隱藏（帶 no-print class）且含列印與回申請頁動作', () => {
    const html = renderToStaticMarkup(<PrintToolbar />);
    expect(html).toContain('no-print');
    expect(html).toContain('列印申請表');
    expect(html).toContain('href="/apply"');
  });
});
