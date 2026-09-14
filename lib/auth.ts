import 'server-only';
import { cookies } from 'next/headers';
import { getDb } from './db/client';
import { Student } from './db/schema';
import { findStudent } from './students';
import { CookieStore, resolveStudent, setSession, clearSession } from './auth-core';

async function nextCookieStore(): Promise<CookieStore> {
  const jar = await cookies();
  return {
    get: (n) => jar.get(n)?.value,
    set: (n, v) => { jar.set(n, v, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' }); },
    delete: (n) => { jar.delete(n); },
  };
}

export async function getCurrentStudent(): Promise<Student | null> {
  return resolveStudent(getDb(), await nextCookieStore());
}

/** Demo 假登入：只驗學號存在且啟用，不驗密碼。正式環境以 SSO 取代此函式。 */
export async function login(studentId: string): Promise<Student | null> {
  const s = findStudent(getDb(), studentId.trim());
  if (!s || s.isActive !== 1) return null;
  setSession(await nextCookieStore(), s.id);
  return s;
}

export async function logout(): Promise<void> {
  clearSession(await nextCookieStore());
}
