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
});
