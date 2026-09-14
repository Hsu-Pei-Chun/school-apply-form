import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { students } from '@/lib/db/schema';
import { CookieStore, SESSION_COOKIE, resolveStudent, setSession, clearSession } from '@/lib/auth-core';

function memStore(): CookieStore & { jar: Map<string, string> } {
  const jar = new Map<string, string>();
  return { jar, get: n => jar.get(n), set: (n, v) => { jar.set(n, v); }, delete: n => { jar.delete(n); } };
}

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  db.insert(students).values({ id: '113000001', name: '王小明', department: '資工系 二年級' }).run();
  db.insert(students).values({ id: '113000002', name: '停用生', department: 'x', isActive: 0 }).run();
});

describe('auth-core', () => {
  it('setSession 寫入 sid，resolveStudent 讀回學生', () => {
    const store = memStore();
    setSession(store, '113000001');
    expect(store.jar.get(SESSION_COOKIE)).toBe('113000001');
    expect(resolveStudent(db, store)?.name).toBe('王小明');
  });
  it('無 cookie → null', () => {
    expect(resolveStudent(db, memStore())).toBeNull();
  });
  it('cookie 指向不存在或停用的學生 → null', () => {
    const s1 = memStore(); s1.set(SESSION_COOKIE, '999999999');
    expect(resolveStudent(db, s1)).toBeNull();
    const s2 = memStore(); s2.set(SESSION_COOKIE, '113000002');
    expect(resolveStudent(db, s2)).toBeNull();
  });
  it('clearSession 刪除 cookie', () => {
    const store = memStore();
    setSession(store, '113000001');
    clearSession(store);
    expect(store.jar.has(SESSION_COOKIE)).toBe(false);
  });
});
