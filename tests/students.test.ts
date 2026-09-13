import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { students } from '@/lib/db/schema';
import { findStudent } from '@/lib/students';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  db.insert(students).values({ id: 'S0001', name: '王小明', department: '資工系 二年級' }).run();
});

describe('findStudent', () => {
  it('找到存在的學生', () => {
    expect(findStudent(db, 'S0001')?.name).toBe('王小明');
  });
  it('學號不存在回傳 undefined', () => {
    expect(findStudent(db, 'S9999')).toBeUndefined();
  });
});
