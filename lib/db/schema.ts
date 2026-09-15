import { sqliteTable, text, integer, check, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const students = sqliteTable(
  'students',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    department: text('department').notNull(),
    isActive: integer('is_active').notNull().default(1),
  },
  (t) => [check('students_id_len', sql`length(${t.id}) = 9`)]
);

export const courses = sqliteTable(
  'courses',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    teacher: text('teacher').notNull(),
    time: text('time').notNull(),
    isActive: integer('is_active').notNull().default(1),
    createdAt: text('created_at').notNull(),
  },
  (t) => [check('courses_code_len', sql`length(${t.code}) = 15`)]
);

export const applications = sqliteTable(
  'applications',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id').notNull().references(() => students.id),
    courseBCode: text('course_b_code').notNull().references(() => courses.code),
    barcode: text('barcode').notNull(),
    status: text('status', { enum: ['printed', 'received'] }).notNull().default('printed'),
    createdAt: text('created_at').notNull(),
    receivedAt: text('received_at'),
  },
  (t) => [
    check('applications_status_check', sql`${t.status} IN ('printed', 'received')`),
    check('applications_barcode_len', sql`length(${t.barcode}) = 24`),
    uniqueIndex('applications_barcode_uq').on(t.barcode),
    uniqueIndex('applications_student_course_uq').on(t.studentId, t.courseBCode),
  ]
);

export const applicationCoursesA = sqliteTable(
  'application_courses_a',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    applicationId: text('application_id').notNull().references(() => applications.id),
    seq: integer('seq').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    time: text('time').notNull(),
    teacher: text('teacher').notNull(),
  },
  (t) => [
    uniqueIndex('application_courses_a_seq_uq').on(t.applicationId, t.seq),
    index('application_courses_a_app_idx').on(t.applicationId),
  ]
);

export type Student = typeof students.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type ApplicationCourseA = typeof applicationCoursesA.$inferSelect;
