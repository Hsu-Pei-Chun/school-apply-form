import { describe, it, expect } from 'vitest';
import { createDb } from '@/lib/db/client';
import { students, courses, applications, applicationCoursesA } from '@/lib/db/schema';
import { seed } from '@/lib/seed';
import { createApplication } from '@/lib/applications';

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
    expect(db.select().from(courses).all().every(c => c.time.length > 0)).toBe(true);
  });

  it('seed 後已有申請紀錄時，重新 seed（ifEmpty:false）不因外鍵約束拋錯，且申請相關表清空', () => {
    const db = createDb(':memory:');
    seed(db, { ifEmpty: true });
    const studentId = db.select().from(students).limit(1).get()!.id;
    const courseCode = db.select().from(courses).limit(1).get()!.code;
    createApplication(db, {
      studentId,
      coursesA: [
        { code: 'EE2010', name: '電路學', time: 'M3M4', teacher: '林教授' },
        { code: 'CS1010', name: '計概', time: 'T5T6', teacher: '陳教授' },
      ],
      courseBCode: courseCode,
    });

    expect(() => seed(db, { ifEmpty: false })).not.toThrow();

    expect(db.select().from(applications).all().length).toBe(0);
    expect(db.select().from(applicationCoursesA).all().length).toBe(0);
  });
});
