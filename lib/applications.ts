import { eq, desc } from 'drizzle-orm';
import { Db } from './db/client';
import { applications, students, subjects, Application } from './db/schema';
import { findStudent } from './students';

export type ApplicationDetail = Application & {
  studentName: string;
  className: string;
  subjectName: string;
};

export function nextApplicationId(db: Db): string {
  const last = db.select({ id: applications.id }).from(applications).orderBy(desc(applications.id)).limit(1).get();
  const n = last ? parseInt(last.id.slice(1), 10) + 1 : 1;
  return 'A' + String(n).padStart(6, '0');
}

export function createApplication(db: Db, input: { studentId: string; subjectCode: string }): Application {
  if (!findStudent(db, input.studentId)) throw new Error('查無此學號');
  const subject = db.select().from(subjects).where(eq(subjects.code, input.subjectCode)).get();
  if (!subject || subject.isActive !== 1) throw new Error('科目不存在或已停用');

  const row: Application = {
    id: nextApplicationId(db),
    studentId: input.studentId,
    subjectCode: input.subjectCode,
    status: 'printed',
    createdAt: new Date().toISOString(),
    receivedAt: null,
  };
  db.insert(applications).values(row).run();
  return row;
}

export function getApplication(db: Db, id: string): ApplicationDetail | undefined {
  const row = db
    .select({
      id: applications.id,
      studentId: applications.studentId,
      subjectCode: applications.subjectCode,
      status: applications.status,
      createdAt: applications.createdAt,
      receivedAt: applications.receivedAt,
      studentName: students.name,
      className: students.className,
      subjectName: subjects.name,
    })
    .from(applications)
    .innerJoin(students, eq(applications.studentId, students.id))
    .innerJoin(subjects, eq(applications.subjectCode, subjects.code))
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
