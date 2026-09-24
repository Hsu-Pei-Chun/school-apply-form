import { describe, it, expect } from 'vitest';
import { createAdminToken, verifyAdminToken, passwordMatches, safeNext, ADMIN_SESSION_TTL_MS } from '@/lib/admin-auth-core';

const SECRET = 's3cret';
const NOW = 1_800_000_000_000;

describe('passwordMatches', () => {
  it('相符才通過；長度不同不拋錯', () => {
    expect(passwordMatches('s3cret', 's3cret')).toBe(true);
    expect(passwordMatches('wrong', 's3cret')).toBe(false);
    expect(passwordMatches('s3cret-longer', 's3cret')).toBe(false);
  });
  it('未設定密碼（空字串）時一律拒絕，連空密碼也不行', () => {
    expect(passwordMatches('', '')).toBe(false);
    expect(passwordMatches('anything', '')).toBe(false);
  });
});

describe('admin token', () => {
  it('同金鑰、未到期 → 有效', () => {
    expect(verifyAdminToken(SECRET, createAdminToken(SECRET, NOW), NOW + 1000)).toBe(true);
  });
  it('超過 TTL → 失效', () => {
    expect(verifyAdminToken(SECRET, createAdminToken(SECRET, NOW), NOW + ADMIN_SESSION_TTL_MS)).toBe(false);
  });
  it('換金鑰（改密碼）→ 失效', () => {
    expect(verifyAdminToken('other', createAdminToken(SECRET, NOW), NOW)).toBe(false);
  });
  it('竄改到期時間 → 簽章不符而失效', () => {
    const [, sig] = createAdminToken(SECRET, NOW).split('.');
    expect(verifyAdminToken(SECRET, `${NOW + 10 * ADMIN_SESSION_TTL_MS}.${sig}`, NOW)).toBe(false);
  });
  it('空值、亂碼、空金鑰 → 失效', () => {
    expect(verifyAdminToken(SECRET, undefined, NOW)).toBe(false);
    expect(verifyAdminToken(SECRET, 'garbage', NOW)).toBe(false);
    expect(verifyAdminToken(SECRET, 'abc.def', NOW)).toBe(false);
    expect(verifyAdminToken('', createAdminToken('', NOW), NOW)).toBe(false);
  });
});

describe('safeNext', () => {
  it('合法站內路徑原樣放行', () => {
    expect(safeNext('/admin/courses')).toBe('/admin/courses');
    expect(safeNext('/admin/courses?x=1')).toBe('/admin/courses?x=1');
  });
  it('protocol-relative、反斜線混淆、外部網址、空值皆回退 /admin/courses', () => {
    for (const v of ['//evil.com', '/\\evil.com', '/x\\y', 'https://evil.com', '', undefined, 42]) {
      expect(safeNext(v)).toBe('/admin/courses');
    }
  });
});
