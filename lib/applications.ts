import { eq, desc, asc, and, SQL } from 'drizzle-orm';
import { Db, Executor, isUniqueViolation } from './db/client';
import { applications, applicationCoursesA, courses, Application, ApplicationCourseA } from './db/schema';
import { DEGREES, Degree } from './degrees';
import { AppError } from './messages';

export type CourseAInput = { code: string; name: string; time: string; teacher: string };

export type ApplicantInput = { studentId: string; studentName: string; department: string; degree: string };

export type CreateApplicationInput = ApplicantInput & {
  coursesA: CourseAInput[];
  courseBCode: string;
};

export type ApplicationDetail = Application & {
  courseBName: string;
  courseBNameEn: string;
  courseBTeacher: string;
  courseBTime: string;
  courseBNote: string;
  coursesA: ApplicationCourseA[];
};

export class DuplicateApplicationError extends AppError {
  constructor(public readonly existingId: string) {
    super('duplicateApplication');
    this.name = 'DuplicateApplicationError';
  }
}

export const MAX_COURSES_A = 5;
export const MAX_APPLICANT_FIELD = 50;
export const STUDENT_ID_RE = /^\d{9}$/;

export async function nextApplicationId(db: Executor): Promise<string> {
  const last = await db.select({ id: applications.id }).from(applications).orderBy(desc(applications.id)).limit(1).get();
  const n = last ? parseInt(last.id.slice(1), 10) + 1 : 1;
  return 'A' + String(n).padStart(6, '0');
}

/** 條碼格式：學號-科號-B（9 + 1 + 15 + 1 + 1 = 27 碼）；科號內的補位空格原樣保留。 */
export function makeBarcode(studentId: string, courseBCode: string): string {
  return `${studentId}-${courseBCode}-B`;
}

async function assertActiveCourse(db: Executor, code: string): Promise<void> {
  const c = await db.select().from(courses).where(eq(courses.code, code)).get();
  if (!c || c.isActive !== 1) throw new AppError('courseUnavailable');
}

function normalizeApplicant(input: ApplicantInput): ApplicantInput & { degree: Degree } {
  const a = {
    studentId: input.studentId.trim(), studentName: input.studentName.trim(),
    department: input.department.trim(), degree: input.degree.trim(),
  };
  if (!STUDENT_ID_RE.test(a.studentId)) throw new AppError('studentIdFormat');
  if (!a.studentName || !a.department) throw new AppError('applicantRequired');
  if (a.studentName.length > MAX_APPLICANT_FIELD || a.department.length > MAX_APPLICANT_FIELD) {
    throw new AppError('applicantTooLong', { n: MAX_APPLICANT_FIELD });
  }
  if (!(DEGREES as readonly string[]).includes(a.degree)) throw new AppError('degreeRequired');
  return { ...a, degree: a.degree as Degree };
}

function normalizeCoursesA(input: CourseAInput[]): CourseAInput[] {
  const rows = input.map(c => ({
    code: c.code.trim(), name: c.name.trim(), time: c.time.trim(), teacher: c.teacher.trim(),
  }));
  if (rows.length === 0 || rows.some(r => !r.code || !r.name || !r.time || !r.teacher)) {
    throw new AppError('courseARequired');
  }
  if (rows.length > MAX_COURSES_A) throw new AppError('courseATooMany');
  if (rows.some(r => r.code.length > 100 || r.name.length > 100 || r.time.length > 100 || r.teacher.length > 100)) {
    throw new AppError('courseATooLong');
  }
  return rows;
}

async function findExistingId(db: Executor, studentId: string, courseBCode: string): Promise<string | undefined> {
  const row = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.studentId, studentId), eq(applications.courseBCode, courseBCode)))
    .get();
  return row?.id;
}

export async function createApplication(db: Db, input: CreateApplicationInput): Promise<Application> {
  const applicant = normalizeApplicant(input);
  const coursesA = normalizeCoursesA(input.coursesA);
  await assertActiveCourse(db, input.courseBCode);

  const existing = await findExistingId(db, applicant.studentId, input.courseBCode);
  if (existing) throw new DuplicateApplicationError(existing);

  try {
    // libsql 交易預設為寫入模式（BEGIN IMMEDIATE），流水號在鎖內取得，不會兩筆拿到同一號
    return await db.transaction(async (tx) => {
      const row: Application = {
        id: await nextApplicationId(tx),
        ...applicant,
        courseBCode: input.courseBCode,
        barcode: makeBarcode(applicant.studentId, input.courseBCode),
        createdAt: new Date().toISOString(),
      };
      await tx.insert(applications).values(row).run();
      await tx.insert(applicationCoursesA).values(coursesA.map((c, i) => ({ applicationId: row.id, seq: i + 1, ...c }))).run();
      return row;
    });
  } catch (e) {
    // 兩個請求同時通過上面的 existing 檢查、幾乎同時 insert 時，其中一個會在這裡撞到
    // applications_student_course_uq（或 applications_barcode_uq）。此時重新查一次既有
    // id，轉成跟一般重複申請同樣的 DuplicateApplicationError，而不是讓資料庫錯誤外洩。
    if (isUniqueViolation(e)) {
      const raced = await findExistingId(db, applicant.studentId, input.courseBCode);
      if (raced) throw new DuplicateApplicationError(raced);
    }
    throw e;
  }
}

async function loadDetail(db: Db, where: SQL): Promise<ApplicationDetail | undefined> {
  const row = await db
    .select({
      id: applications.id,
      studentId: applications.studentId,
      studentName: applications.studentName,
      department: applications.department,
      degree: applications.degree,
      courseBCode: applications.courseBCode,
      barcode: applications.barcode,
      createdAt: applications.createdAt,
      courseBName: courses.name,
      courseBNameEn: courses.nameEn,
      courseBTeacher: courses.teacher,
      courseBTime: courses.time,
      courseBNote: courses.note,
    })
    .from(applications)
    .innerJoin(courses, eq(applications.courseBCode, courses.code))
    .where(where)
    .get();
  if (!row) return undefined;
  const coursesA = await db.select().from(applicationCoursesA)
    .where(eq(applicationCoursesA.applicationId, row.id)).orderBy(asc(applicationCoursesA.seq)).all();
  return { ...row, coursesA };
}

export async function getApplication(db: Db, id: string): Promise<ApplicationDetail | undefined> {
  return loadDetail(db, eq(applications.id, id));
}
