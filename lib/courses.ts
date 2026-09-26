import { asc, eq } from 'drizzle-orm';
import { Executor } from './db/client';
import { courses, Course } from './db/schema';
import { AppError, msg } from './messages';

export async function listCourses(db: Executor): Promise<Course[]> {
  return db.select().from(courses).orderBy(asc(courses.code)).all();
}

export async function listActiveCourses(db: Executor): Promise<Course[]> {
  return db.select().from(courses).where(eq(courses.isActive, 1)).orderBy(asc(courses.code)).all();
}

export const COURSE_CODE_RE = /^(?! )[0-9A-Za-z ]{15}(?<! )$/;
export const COURSE_CODE_ERROR = msg('zh', 'courseCodeFormat');

export async function createCourse(db: Executor, input: { code: string; name: string; teacher: string; time: string; nameEn?: string; note?: string }): Promise<Course> {
  if (!COURSE_CODE_RE.test(input.code)) throw new AppError('courseCodeFormat');
  if (!input.time.trim()) throw new AppError('timeRequired');
  const exists = await db.select().from(courses).where(eq(courses.code, input.code)).get();
  if (exists) throw new AppError('courseExists');
  const row: Course = {
    code: input.code, name: input.name, nameEn: input.nameEn ?? '', teacher: input.teacher,
    time: input.time.trim(), note: input.note?.trim() ?? '', isActive: 1, createdAt: new Date().toISOString(),
  };
  await db.insert(courses).values(row).run();
  return row;
}

export async function setCourseActive(db: Executor, code: string, isActive: boolean): Promise<void> {
  await db.update(courses).set({ isActive: isActive ? 1 : 0 }).where(eq(courses.code, code)).run();
}
