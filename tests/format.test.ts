import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from '@/lib/format';

describe('formatDate', () => {
  it('將 UTC ISO 字串轉為台北時區日期', () => {
    expect(formatDate('2026-09-12T18:00:00.000Z')).toBe('2026-09-13');
  });
});

describe('formatDateTime', () => {
  it('將 UTC ISO 字串轉為台北時區日期時間（24h）', () => {
    expect(formatDateTime('2026-09-12T18:05:00.000Z')).toBe('2026-09-13 02:05');
  });
});
