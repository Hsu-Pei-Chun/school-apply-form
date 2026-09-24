import { sqliteTable, text, integer, check, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { DEGREES } from '../degrees';

export const courses = sqliteTable(
  'courses',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    nameEn: text('name_en').notNull().default(''),
    teacher: text('teacher').notNull(),
    time: text('time').notNull(),
    note: text('note').notNull().default(''),
    isActive: integer('is_active').notNull().default(1),
    createdAt: text('created_at').notNull(),
  },
  (t) => [check('courses_code_len', sql`length(${t.code}) = 15`)]
);

// 申請人資料由申請人自行填寫，直接存在申請單上（不再對照學生名單）。
export const applications = sqliteTable(
  'applications',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id').notNull(),
    studentName: text('student_name').notNull(),
    department: text('department').notNull(),
    degree: text('degree', { enum: DEGREES }).notNull(),
    courseBCode: text('course_b_code').notNull().references(() => courses.code),
    barcode: text('barcode').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    check('applications_student_id_len', sql`length(${t.studentId}) = 9`),
    check('applications_degree_check', sql.raw(`"degree" IN (${DEGREES.map(d => `'${d}'`).join(', ')})`)),
    check('applications_barcode_len', sql`length(${t.barcode}) = 27`),
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

export type Course = typeof courses.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type ApplicationCourseA = typeof applicationCoursesA.$inferSelect;
