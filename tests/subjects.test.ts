import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { createSubject, listSubjects, listActiveSubjects, setSubjectActive } from '@/lib/subjects';

let db: Db;
beforeEach(() => { db = createDb(':memory:'); });

describe('subjects', () => {
  it('新增後可列出', () => {
    const s = createSubject(db, { code: 'C001', name: '國文' });
    expect(s.isActive).toBe(1);
    expect(listSubjects(db).map(x => x.code)).toEqual(['C001']);
  });

  it('代碼重複拋錯', () => {
    createSubject(db, { code: 'C001', name: '國文' });
    expect(() => createSubject(db, { code: 'C001', name: '數學' })).toThrow('科目代碼已存在');
  });

  it('停用後不在 active 清單但仍在完整清單', () => {
    createSubject(db, { code: 'C001', name: '國文' });
    createSubject(db, { code: 'C002', name: '數學' });
    setSubjectActive(db, 'C001', false);
    expect(listActiveSubjects(db).map(x => x.code)).toEqual(['C002']);
    expect(listSubjects(db).map(x => x.code)).toEqual(['C001', 'C002']);
  });
});
