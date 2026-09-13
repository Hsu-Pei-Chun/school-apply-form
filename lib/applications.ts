import { eq, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { Db } from './db/client';
import { applications, students, courses, Application } from './db/schema';
import { findStudent } from './students';

export type ApplicationDetail = Application & {
  studentName: string;
  department: string;
  courseAName: string;
  courseBName: string;
  courseBTeacher: string;
};

export type CreateApplicationInput = {
  studentId: string;
  courseACode: string;
  courseAStatus: string;
  courseBCode: string;
};

export function nextApplicationId(db: Db): string {
  const last = db.select({ id: applications.id }).from(applications).orderBy(desc(applications.id)).limit(1).get();
  const n = last ? parseInt(last.id.slice(1), 10) + 1 : 1;
  return 'A' + String(n).padStart(6, '0');
}

function assertActiveCourse(db: Db, code: string): void {
  const c = db.select().from(courses).where(eq(courses.code, code)).get();
  if (!c || c.isActive !== 1) throw new Error('課程不存在或已停用');
}

export function createApplication(db: Db, input: CreateApplicationInput): Application {
  if (!findStudent(db, input.studentId)) throw new Error('查無此學號');
  if (input.courseACode === input.courseBCode) throw new Error('一般課程與 X-Class 課程不可相同');
  assertActiveCourse(db, input.courseACode);
  assertActiveCourse(db, input.courseBCode);

  const row: Application = {
    id: nextApplicationId(db),
    studentId: input.studentId,
    courseACode: input.courseACode,
    courseAStatus: input.courseAStatus,
    courseBCode: input.courseBCode,
    status: 'printed',
    createdAt: new Date().toISOString(),
    receivedAt: null,
  };
  db.insert(applications).values(row).run();
  return row;
}

export function getApplication(db: Db, id: string): ApplicationDetail | undefined {
  const courseA = alias(courses, 'course_a');
  const courseB = alias(courses, 'course_b');
  const row = db
    .select({
      id: applications.id,
      studentId: applications.studentId,
      courseACode: applications.courseACode,
      courseAStatus: applications.courseAStatus,
      courseBCode: applications.courseBCode,
      status: applications.status,
      createdAt: applications.createdAt,
      receivedAt: applications.receivedAt,
      studentName: students.name,
      department: students.department,
      courseAName: courseA.name,
      courseBName: courseB.name,
      courseBTeacher: courseB.teacher,
    })
    .from(applications)
    .innerJoin(students, eq(applications.studentId, students.id))
    .innerJoin(courseA, eq(applications.courseACode, courseA.code))
    .innerJoin(courseB, eq(applications.courseBCode, courseB.code))
    .where(eq(applications.id, id))
    .get();
  return row ?? undefined;
}

export type ReceiveResult =
  | { kind: 'received'; detail: ApplicationDetail }
  | { kind: 'already'; detail: ApplicationDetail }
  | { kind: 'not_found' };

export function receiveApplication(db: Db, id: string): ReceiveResult {
  const detail = getApplication(db, id);
  if (!detail) return { kind: 'not_found' };
  if (detail.status === 'received') return { kind: 'already', detail };

  const receivedAt = new Date().toISOString();
  db.update(applications).set({ status: 'received', receivedAt }).where(eq(applications.id, id)).run();
  return { kind: 'received', detail: { ...detail, status: 'received', receivedAt } };
}
