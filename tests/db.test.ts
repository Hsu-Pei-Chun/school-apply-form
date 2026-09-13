import { describe, it, expect } from 'vitest';
import { createDb } from '@/lib/db/client';
import { students, subjects, applications } from '@/lib/db/schema';

describe('createDb', () => {
  it('建立三張表且可查詢', () => {
    const db = createDb(':memory:');
    expect(db.select().from(students).all()).toEqual([]);
    expect(db.select().from(subjects).all()).toEqual([]);
    expect(db.select().from(applications).all()).toEqual([]);
  });

  it('applications.status 只允許 printed 或 received', () => {
    const db = createDb(':memory:');
    db.insert(students).values({ id: 's1', name: '學生一', className: '101' }).run();
    db.insert(subjects).values({ code: 'math', name: '數學', createdAt: '2026-01-01' }).run();

    expect(() =>
      db
        .insert(applications)
        .values({
          id: 'a1',
          studentId: 's1',
          subjectCode: 'math',
          status: 'bogus' as any,
          createdAt: '2026-01-01',
        })
        .run()
    ).toThrow();
  });
});
