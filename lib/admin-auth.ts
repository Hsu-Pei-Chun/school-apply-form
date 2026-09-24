import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_MS, createAdminToken, verifyAdminToken, passwordMatches } from './admin-auth-core';

/** 管理員密碼來自環境變數 ADMIN_PASSWORD；未設定時無法登入（開發環境預設 admin 方便本機測試）。 */
function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'admin');
}

// 簽章金鑰可另設 ADMIN_SESSION_SECRET；未設時沿用密碼，改密碼即讓所有既有 session 失效。
function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || adminPassword();
}

export function isAdminConfigured(): boolean {
  return adminPassword().length > 0;
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifyAdminToken(sessionSecret(), jar.get(ADMIN_COOKIE)?.value);
}

/** 頁面與 server action 皆須呼叫：server action 可被直接 POST，不能只靠頁面擋。 */
export async function requireAdmin(next = '/admin/courses'): Promise<void> {
  if (!(await isAdmin())) redirect(`/login?next=${encodeURIComponent(next)}`);
}

export async function loginAdmin(password: string): Promise<boolean> {
  if (!passwordMatches(password, adminPassword())) return false;
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, createAdminToken(sessionSecret()), {
    httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  });
  return true;
}

export async function logoutAdmin(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}
