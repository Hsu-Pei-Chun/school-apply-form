import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function hmac(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  // 先各自 hash 成等長，避免長度不同時 timingSafeEqual 直接拋錯、也避免以長度洩漏資訊
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(input: string, expected: string): boolean {
  return expected.length > 0 && safeEqual(input, expected);
}

/** session token：`<到期時間 ms>.<HMAC>`，不存任何可被竄改的身分資訊，到期或簽章不符即失效。 */
export function createAdminToken(secret: string, now: number = Date.now()): string {
  const exp = String(now + ADMIN_SESSION_TTL_MS);
  return `${exp}.${hmac(secret, `admin:${exp}`)}`;
}

export function verifyAdminToken(secret: string, token: string | undefined, now: number = Date.now()): boolean {
  if (!secret || !token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) <= now) return false;
  return safeEqual(sig, hmac(secret, `admin:${exp}`));
}

/**
 * 站內導頁白名單：只允許以單一 `/` 開頭、不含任何反斜線的路徑，
 * 避免 `//evil.com`（protocol-relative）或 `/\evil.com`（瀏覽器會把 `\` 正規化成 `/`）造成開放式轉址。
 */
export function safeNext(v: unknown): string {
  if (typeof v !== 'string') return '/admin/courses';
  if (v.includes('\\')) return '/admin/courses';
  if (!/^\/[^/\\]/.test(v)) return '/admin/courses';
  return v;
}
