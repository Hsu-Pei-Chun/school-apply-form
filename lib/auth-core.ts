import { Db } from './db/client';
import { Student } from './db/schema';
import { findStudent } from './students';

export const SESSION_COOKIE = 'sid';

export interface CookieStore {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  delete(name: string): void;
}

export function resolveStudent(db: Db, store: CookieStore): Student | null {
  const sid = store.get(SESSION_COOKIE);
  if (!sid) return null;
  const s = findStudent(db, sid);
  return s && s.isActive === 1 ? s : null;
}

export function setSession(store: CookieStore, studentId: string): void {
  store.set(SESSION_COOKIE, studentId);
}

export function clearSession(store: CookieStore): void {
  store.delete(SESSION_COOKIE);
}
