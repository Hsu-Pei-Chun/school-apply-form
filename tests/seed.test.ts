import { describe, it, expect } from 'vitest';
import { createDb } from '@/lib/db/client';
import { students, courses } from '@/lib/db/schema';
import { seed } from '@/lib/seed';

describe('seed', () => {
  it('空 DB 執行會寫入 2000 學生，回傳 seeded', () => {
    const db = createDb(':memory:');
    const result = seed(db, { ifEmpty: true });
    expect(result).toBe('seeded');
    expect(db.select().from(students).all().length).toBe(2000);
  });

  it('ifEmpty: true 且已有資料時略過，回傳 skipped', () => {
    const db = createDb(':memory:');
    seed(db, { ifEmpty: true });
    const result = seed(db, { ifEmpty: true });
    expect(result).toBe('skipped');
    expect(db.select().from(students).all().length).toBe(2000);
  });

  it('ifEmpty: false 即使已有資料也會重置重寫，不會重複累加', () => {
    const db = createDb(':memory:');
    seed(db, { ifEmpty: true });
    const result = seed(db, { ifEmpty: false });
    expect(result).toBe('seeded');
    expect(db.select().from(students).all().length).toBe(2000);
  });

  it('學號 9 碼、科號 15 碼', () => {
    const db = createDb(':memory:');
    seed(db, { ifEmpty: false });
    expect(db.select().from(students).limit(1).get()?.id).toBe('113000001');
    expect(db.select().from(courses).all().every(c => c.code.length === 15)).toBe(true);
  });
});
