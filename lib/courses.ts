import { asc, eq, inArray } from 'drizzle-orm';
import { Db, Executor } from './db/client';
import { applications, courses, Course } from './db/schema';
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

/**
 * 批次刪除課程。已有申請單選為 Course B 的課程受外鍵保護不能刪，會略過並回傳於 inUse（請改用停用）。
 */
export async function deleteCourses(db: Db, codes: string[]): Promise<{ deleted: string[]; inUse: string[] }> {
  const unique = [...new Set(codes)];
  if (unique.length === 0) return { deleted: [], inUse: [] };
  return db.transaction(async (tx) => {
    const used = await tx.selectDistinct({ code: applications.courseBCode }).from(applications)
      .where(inArray(applications.courseBCode, unique)).all();
    const inUse = used.map(r => r.code).sort();
    const deletable = unique.filter(c => !inUse.includes(c));
    const deleted = deletable.length
      ? (await tx.delete(courses).where(inArray(courses.code, deletable)).returning({ code: courses.code }).all()).map(r => r.code).sort()
      : [];
    return { deleted, inUse };
  });
}
