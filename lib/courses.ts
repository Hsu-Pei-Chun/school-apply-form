import { asc, eq } from 'drizzle-orm';
import { Db } from './db/client';
import { courses, Course } from './db/schema';
import { AppError, msg } from './messages';

export function listCourses(db: Db): Course[] {
  return db.select().from(courses).orderBy(asc(courses.code)).all();
}

export function listActiveCourses(db: Db): Course[] {
  return db.select().from(courses).where(eq(courses.isActive, 1)).orderBy(asc(courses.code)).all();
}

export const COURSE_CODE_RE = /^(?! )[0-9A-Za-z ]{15}(?<! )$/;
export const COURSE_CODE_ERROR = msg('zh', 'courseCodeFormat');

export function createCourse(db: Db, input: { code: string; name: string; teacher: string; time: string; nameEn?: string; note?: string }): Course {
  if (!COURSE_CODE_RE.test(input.code)) throw new AppError('courseCodeFormat');
  if (!input.time.trim()) throw new AppError('timeRequired');
  const exists = db.select().from(courses).where(eq(courses.code, input.code)).get();
  if (exists) throw new AppError('courseExists');
  const row: Course = {
    code: input.code, name: input.name, nameEn: input.nameEn ?? '', teacher: input.teacher,
    time: input.time.trim(), note: input.note?.trim() ?? '', isActive: 1, createdAt: new Date().toISOString(),
  };
  db.insert(courses).values(row).run();
  return row;
}

export function setCourseActive(db: Db, code: string, isActive: boolean): void {
  db.update(courses).set({ isActive: isActive ? 1 : 0 }).where(eq(courses.code, code)).run();
}
