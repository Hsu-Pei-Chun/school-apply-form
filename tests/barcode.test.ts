import { describe, it, expect } from 'vitest';
import { renderCode128Svg } from '@/lib/barcode';

describe('renderCode128Svg', () => {
  it('回傳 svg 字串', () => {
    const svg = renderCode128Svg('A000001');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
  });
  it('不同內容產生不同 svg', () => {
    expect(renderCode128Svg('11300000111510EECS200101')).not.toBe(renderCode128Svg('11300000211510EECS200101'));
  });
});
