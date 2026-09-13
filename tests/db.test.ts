import { describe, it, expect } from 'vitest';
import { createDb } from '@/lib/db/client';
import { students, courses, applications } from '@/lib/db/schema';

describe('createDb', () => {
  it('建立三張表且可查詢', () => {
    const db = createDb(':memory:');
    expect(db.select().from(students).all()).toEqual([]);
    expect(db.select().from(courses).all()).toEqual([]);
    expect(db.select().from(applications).all()).toEqual([]);
  });

  it('applications.status 只允許 printed 或 received', () => {
    const db = createDb(':memory:');
    db.insert(students).values({ id: 's1', name: '學生一', department: '資工系 一年級' }).run();
    db.insert(courses).values({ code: 'C001', name: '數學', teacher: '王教授', createdAt: '2026-01-01' }).run();

    expect(() =>
      db
        .insert(applications)
        .values({
          id: 'a1',
          studentId: 's1',
          courseACode: 'C001',
          courseAStatus: '已選上',
          courseBCode: 'C001',
          status: 'bogus' as any,
          createdAt: '2026-01-01',
        })
        .run()
    ).toThrow();
  });
});
