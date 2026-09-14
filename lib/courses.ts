import { asc, eq } from 'drizzle-orm';
import { Db } from './db/client';
import { courses, Course } from './db/schema';

export function listCourses(db: Db): Course[] {
  return db.select().from(courses).orderBy(asc(courses.code)).all();
}

export function listActiveCourses(db: Db): Course[] {
  return db.select().from(courses).where(eq(courses.isActive, 1)).orderBy(asc(courses.code)).all();
}

export function createCourse(db: Db, input: { code: string; name: string; teacher: string }): Course {
  if (input.code.length !== 15) throw new Error('科號必須為 15 碼');
  const exists = db.select().from(courses).where(eq(courses.code, input.code)).get();
  if (exists) throw new Error('課程代碼已存在');
  const row: Course = { ...input, isActive: 1, createdAt: new Date().toISOString() };
  db.insert(courses).values(row).run();
  return row;
}

export function setCourseActive(db: Db, code: string, isActive: boolean): void {
  db.update(courses).set({ isActive: isActive ? 1 : 0 }).where(eq(courses.code, code)).run();
}
