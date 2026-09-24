import { describe, it, expect } from 'vitest';
import { createDb } from '@/lib/db/client';
import { courses, applications, applicationCoursesA } from '@/lib/db/schema';

const SID = '113000001';
const CODE = '11510EECS200101';
const BARCODE = `${SID}-${CODE}-B`;
const APPLICANT = { studentId: SID, studentName: '學生一', department: '資工系', degree: '大學部' as const };

function fixtures(db: ReturnType<typeof createDb>) {
  db.insert(courses).values({ code: CODE, name: '數學', teacher: '王教授', time: 'M1M2', createdAt: '2026-01-01' }).run();
}

describe('createDb', () => {
  it('建立三張表且可查詢', () => {
    const db = createDb(':memory:');
    expect(db.select().from(courses).all()).toEqual([]);
    expect(db.select().from(applications).all()).toEqual([]);
    expect(db.select().from(applicationCoursesA).all()).toEqual([]);
  });

  it('courses.code 必須 15 碼', () => {
    const db = createDb(':memory:');
    expect(() => db.insert(courses).values({ code: 'C001', name: 'x', teacher: 'y', time: 'M1M2', createdAt: 'z' }).run()).toThrow();
  });

  it('courses insert 不必給 nameEn、note（有 default）', () => {
    const db = createDb(':memory:');
    db.insert(courses).values({ code: CODE, name: 'x', teacher: 'y', time: 'M1M2', createdAt: 'z' }).run();
    const c = db.select().from(courses).all()[0];
    expect(c.nameEn).toBe('');
    expect(c.note).toBe('');
  });

  it('courses.code 可含空格補位', () => {
    const db = createDb(':memory:');
    db.insert(courses).values({ code: '11510CS  110400', name: 'x', teacher: 'y', time: 'M1M2', createdAt: 'z' }).run();
    expect(db.select().from(courses).all()[0].code).toBe('11510CS  110400');
  });

  it('applications.student_id 必須 9 碼', () => {
    const db = createDb(':memory:');
    fixtures(db);
    expect(() =>
      db.insert(applications).values({ id: 'A000001', ...APPLICANT, studentId: '11300000', courseBCode: CODE, barcode: BARCODE, createdAt: 'z' }).run()
    ).toThrow();
  });

  it('applications.degree 只允許四種學部別', () => {
    const db = createDb(':memory:');
    fixtures(db);
    expect(() =>
      db.insert(applications).values({ id: 'A000001', ...APPLICANT, degree: 'bogus' as any, courseBCode: CODE, barcode: BARCODE, createdAt: 'z' }).run()
    ).toThrow();
  });

  it('applications.barcode 必須 27 碼', () => {
    const db = createDb(':memory:');
    fixtures(db);
    expect(() =>
      db.insert(applications).values({ id: 'A000001', ...APPLICANT, courseBCode: CODE, barcode: SID + CODE, createdAt: 'z' }).run()
    ).toThrow();
  });

  it('同學號同課程第二筆違反 UNIQUE', () => {
    const db = createDb(':memory:');
    fixtures(db);
    const row = { ...APPLICANT, courseBCode: CODE, barcode: BARCODE, createdAt: '2026-01-01' };
    db.insert(applications).values({ id: 'A000001', ...row }).run();
    expect(() => db.insert(applications).values({ id: 'A000002', ...row }).run()).toThrow();
  });
});
