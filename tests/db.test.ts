import { describe, it, expect } from 'vitest';
import { createDb } from '@/lib/db/client';
import { students, courses, applications, applicationCoursesA } from '@/lib/db/schema';

const SID = '113000001';
const CODE = '11510EECS200101';

function fixtures(db: ReturnType<typeof createDb>) {
  db.insert(students).values({ id: SID, name: '學生一', department: '資工系 一年級' }).run();
  db.insert(courses).values({ code: CODE, name: '數學', teacher: '王教授', time: 'M1M2', createdAt: '2026-01-01' }).run();
}

describe('createDb', () => {
  it('建立四張表且可查詢', () => {
    const db = createDb(':memory:');
    expect(db.select().from(students).all()).toEqual([]);
    expect(db.select().from(courses).all()).toEqual([]);
    expect(db.select().from(applications).all()).toEqual([]);
    expect(db.select().from(applicationCoursesA).all()).toEqual([]);
  });

  it('students.id 必須 9 碼', () => {
    const db = createDb(':memory:');
    expect(() => db.insert(students).values({ id: 'S0001', name: 'x', department: 'y' }).run()).toThrow();
  });

  it('courses.code 必須 15 碼', () => {
    const db = createDb(':memory:');
    expect(() => db.insert(courses).values({ code: 'C001', name: 'x', teacher: 'y', time: 'M1M2', createdAt: 'z' }).run()).toThrow();
  });

  it('applications.status 只允許 printed 或 received', () => {
    const db = createDb(':memory:');
    fixtures(db);
    expect(() =>
      db.insert(applications).values({ id: 'A000001', studentId: SID, courseBCode: CODE, barcode: SID + CODE, status: 'bogus' as any, createdAt: '2026-01-01' }).run()
    ).toThrow();
  });

  it('同學生同課程第二筆違反 UNIQUE', () => {
    const db = createDb(':memory:');
    fixtures(db);
    const row = { studentId: SID, courseBCode: CODE, barcode: SID + CODE, createdAt: '2026-01-01' };
    db.insert(applications).values({ id: 'A000001', ...row }).run();
    expect(() => db.insert(applications).values({ id: 'A000002', ...row }).run()).toThrow();
  });
});
