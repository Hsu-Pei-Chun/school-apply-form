import { eq, desc, asc, and, SQL } from 'drizzle-orm';
import { Db } from './db/client';
import { applications, applicationCoursesA, students, courses, Application, ApplicationCourseA } from './db/schema';
import { findStudent } from './students';

export type CourseAInput = { code: string; name: string; time: string; teacher: string };

export type CreateApplicationInput = {
  studentId: string;
  coursesA: CourseAInput[];
  courseBCode: string;
};

export type ApplicationDetail = Application & {
  studentName: string;
  department: string;
  courseBName: string;
  courseBTeacher: string;
  courseBTime: string;
  coursesA: ApplicationCourseA[];
};

export type ApplicationSummary = {
  id: string;
  courseBCode: string;
  courseBName: string;
  courseBTeacher: string;
  courseBTime: string;
  status: Application['status'];
  createdAt: string;
  receivedAt: string | null;
};

export class DuplicateApplicationError extends Error {
  constructor(public readonly existingId: string) {
    super('你已申請過此 X-Class 課程');
    this.name = 'DuplicateApplicationError';
  }
}

export const MAX_COURSES_A = 5;
export const BARCODE_LENGTH = 24;
const SERIAL_RE = /^A\d{6}$/;
const BARCODE_RE = /^[0-9A-Za-z ]{24}$/;

export function nextApplicationId(db: Db): string {
  const last = db.select({ id: applications.id }).from(applications).orderBy(desc(applications.id)).limit(1).get();
  const n = last ? parseInt(last.id.slice(1), 10) + 1 : 1;
  return 'A' + String(n).padStart(6, '0');
}

function assertActiveCourse(db: Db, code: string): void {
  const c = db.select().from(courses).where(eq(courses.code, code)).get();
  if (!c || c.isActive !== 1) throw new Error('課程不存在或已停用');
}

function normalizeCoursesA(input: CourseAInput[]): CourseAInput[] {
  const rows = input.map(c => ({
    code: c.code.trim(), name: c.name.trim(), time: c.time.trim(), teacher: c.teacher.trim(),
  }));
  if (rows.length === 0 || rows.some(r => !r.code || !r.name || !r.time || !r.teacher)) {
    throw new Error('一般課程至少一門，且每門四欄皆必填');
  }
  if (rows.length > MAX_COURSES_A) throw new Error('一般課程最多五門');
  if (rows.some(r => r.code.length > 100 || r.name.length > 100 || r.time.length > 100 || r.teacher.length > 100)) {
    throw new Error('一般課程欄位最多 100 字');
  }
  return rows;
}

export function createApplication(db: Db, input: CreateApplicationInput): Application {
  if (!findStudent(db, input.studentId)) throw new Error('查無此學號');
  const coursesA = normalizeCoursesA(input.coursesA);
  assertActiveCourse(db, input.courseBCode);

  const existing = db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.studentId, input.studentId), eq(applications.courseBCode, input.courseBCode)))
    .get();
  if (existing) throw new DuplicateApplicationError(existing.id);

  try {
    return db.transaction((tx) => {
      const row: Application = {
        id: nextApplicationId(tx),
        studentId: input.studentId,
        courseBCode: input.courseBCode,
        barcode: input.studentId + input.courseBCode,
        status: 'printed',
        createdAt: new Date().toISOString(),
        receivedAt: null,
      };
      tx.insert(applications).values(row).run();
      tx.insert(applicationCoursesA).values(coursesA.map((c, i) => ({ applicationId: row.id, seq: i + 1, ...c }))).run();
      return row;
    });
  } catch (e) {
    // 兩個請求同時通過上面的 existing 檢查、幾乎同時 insert 時，其中一個會在這裡撞到
    // applications_student_course_uq（或 applications_barcode_uq）。此時重新查一次既有
    // id，轉成跟一般重複申請同樣的 DuplicateApplicationError，而不是讓 SqliteError 外洩。
    if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const raced = db
        .select({ id: applications.id })
        .from(applications)
        .where(and(eq(applications.studentId, input.studentId), eq(applications.courseBCode, input.courseBCode)))
        .get();
      if (raced) throw new DuplicateApplicationError(raced.id);
    }
    throw e;
  }
}

function loadDetail(db: Db, where: SQL): ApplicationDetail | undefined {
  const row = db
    .select({
      id: applications.id,
      studentId: applications.studentId,
      courseBCode: applications.courseBCode,
      barcode: applications.barcode,
      status: applications.status,
      createdAt: applications.createdAt,
      receivedAt: applications.receivedAt,
      studentName: students.name,
      department: students.department,
      courseBName: courses.name,
      courseBTeacher: courses.teacher,
      courseBTime: courses.time,
    })
    .from(applications)
    .innerJoin(students, eq(applications.studentId, students.id))
    .innerJoin(courses, eq(applications.courseBCode, courses.code))
    .where(where)
    .get();
  if (!row) return undefined;
  const coursesA = db.select().from(applicationCoursesA)
    .where(eq(applicationCoursesA.applicationId, row.id)).orderBy(asc(applicationCoursesA.seq)).all();
  return { ...row, coursesA };
}

export function getApplication(db: Db, id: string): ApplicationDetail | undefined {
  return loadDetail(db, eq(applications.id, id));
}

export function findApplicationByBarcode(db: Db, barcode: string): ApplicationDetail | undefined {
  return loadDetail(db, eq(applications.barcode, barcode));
}

export function listApplicationsByStudent(db: Db, studentId: string): ApplicationSummary[] {
  return db
    .select({
      id: applications.id,
      courseBCode: applications.courseBCode,
      courseBName: courses.name,
      courseBTeacher: courses.teacher,
      courseBTime: courses.time,
      status: applications.status,
      createdAt: applications.createdAt,
      receivedAt: applications.receivedAt,
    })
    .from(applications)
    .innerJoin(courses, eq(applications.courseBCode, courses.code))
    .where(eq(applications.studentId, studentId))
    .orderBy(desc(applications.createdAt), desc(applications.id))
    .all();
}

export type ReceiveResult =
  | { kind: 'received'; detail: ApplicationDetail }
  | { kind: 'already'; detail: ApplicationDetail }
  | { kind: 'not_found' }
  | { kind: 'bad_format' };

function markReceived(db: Db, detail: ApplicationDetail): ReceiveResult {
  if (detail.status === 'received') return { kind: 'already', detail };
  const receivedAt = new Date().toISOString();
  db.update(applications).set({ status: 'received', receivedAt }).where(eq(applications.id, detail.id)).run();
  return { kind: 'received', detail: { ...detail, status: 'received', receivedAt } };
}

export function receiveApplication(db: Db, id: string): ReceiveResult {
  const detail = getApplication(db, id);
  if (!detail) return { kind: 'not_found' };
  return markReceived(db, detail);
}

export function receiveByInput(db: Db, raw: string): ReceiveResult {
  const s = raw.trim();
  if (SERIAL_RE.test(s)) return receiveApplication(db, s);
  if (BARCODE_RE.test(s)) {
    const detail = findApplicationByBarcode(db, s);
    if (!detail) return { kind: 'not_found' };
    return markReceived(db, detail);
  }
  return { kind: 'bad_format' };
}
