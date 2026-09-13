import { asc, eq } from 'drizzle-orm';
import { Db } from './db/client';
import { subjects, Subject } from './db/schema';

export function listSubjects(db: Db): Subject[] {
  return db.select().from(subjects).orderBy(asc(subjects.code)).all();
}

export function listActiveSubjects(db: Db): Subject[] {
  return db.select().from(subjects).where(eq(subjects.isActive, 1)).orderBy(asc(subjects.code)).all();
}

export function createSubject(db: Db, input: { code: string; name: string }): Subject {
  const exists = db.select().from(subjects).where(eq(subjects.code, input.code)).get();
  if (exists) throw new Error('科目代碼已存在');
  const row = { code: input.code, name: input.name, isActive: 1, createdAt: new Date().toISOString() };
  db.insert(subjects).values(row).run();
  return row;
}

export function setSubjectActive(db: Db, code: string, isActive: boolean): void {
  db.update(subjects).set({ isActive: isActive ? 1 : 0 }).where(eq(subjects.code, code)).run();
}
