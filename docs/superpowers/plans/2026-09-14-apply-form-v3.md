# 課程申請表系統 v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依校方回饋：A 課程改學生手填 1–5 門、條碼改「學號 9 碼 + X-Class 科號 15 碼」置於右上、假登入帶出學號、同學生同 X-Class 不可重複申請、申請頁下半部顯示申請紀錄。

**Architecture:** 資料層先改（新增 `application_courses_a` 子表、`barcode` 欄位與 UNIQUE、9/15 碼 CHECK、migration 重產、seed v3），並把「取得目前登入學生」收斂到 `lib/auth.ts`（可注入 cookie store 以便測試）；然後逐頁改 `app/`：登入頁、申請頁（動態 A 課程列 + 申請紀錄）、列印頁（條碼右上）、掃描頁（24 碼解析）。最後更新文件並在 Render 驗證。

**Tech Stack:** Next.js 15.5 (App Router), React 19, Tailwind v4, better-sqlite3 + drizzle-orm 0.45, bwip-js, Vitest

**Spec:** `docs/superpowers/specs/2026-09-13-apply-form-design.md`（v3）

## Global Constraints

- Node 22；SQLite；測試用 `createDb(':memory:')`
- **v2 → v3 為破壞性 schema 變更**：`rm -rf drizzle data && npx drizzle-kit generate` 重產 `0000_*`；`data/` 不進 git
- 學號固定 9 碼數字（DB CHECK `length(id) = 9`）；X-Class 科號固定 15 碼（DB CHECK `length(code) = 15`）
- `applications.barcode` = `student_id || course_b_code`（24 碼，CHECK `length = 24`，UNIQUE）；`UNIQUE(student_id, course_b_code)`
- A 課程 1–5 門，四欄（`code, name, time, teacher`）皆必填；`seq` 1..N
- 流水號 `A` + 6 位數字仍為 `applications.id`（內部 PK）
- 錯誤訊息逐字：`查無此學號`、`課程不存在或已停用`、`課程代碼已存在`、`科號必須為 15 碼`、`一般課程至少一門，且每門四欄皆必填`、`一般課程最多五門`、`你已申請過此 X-Class 課程`
- 認證：cookie 名 `sid`、httpOnly、value = 學號；`lib/auth.ts` 是接 SSO 的唯一替換點
- UI：token 只在 `globals.css`；元件無 raw hex；圖示只用 inline SVG；互動元素 `min-h-11`；每個 input 有 `<label htmlFor>`；錯誤 `role="alert"`；繁體中文
- 子代理驗證時只能 kill 自己啟動的 PID，**禁止 `pkill`/`killall`**；port 3100 屬控制器
- 每個 Task 結束 `npm test` 必過；Task 2 起 `npx tsc --noEmit && npm run build` 也必過（Task 1 允許 `app/` 暫時不編譯）
- Commit message 說明「為什麼」；不得 `--no-verify`

---

## File Structure

```
lib/
  db/schema.ts              v3：students/courses CHECK、applications barcode+UNIQUE、application_courses_a
  applications.ts           createApplication(含 coursesA、transaction、重複檢查)、getApplication(含 coursesA)、
                            listApplicationsByStudent、findApplicationByBarcode、receiveApplication、receiveByInput
  auth-core.ts              純函式：CookieStore 介面、resolveStudent / setSession / clearSession
  auth.ts                   next/headers 包裝：getCurrentStudent / login / logout
  courses.ts                createCourse 加 15 碼驗證
  seed.ts                   9 碼學號、15 碼科號
app/
  login/page.tsx, LoginForm.tsx, actions.ts
  apply/page.tsx            gate + 唯讀學生卡 + ApplyForm + MyApplications
  apply/ApplyForm.tsx       A 課程動態列 + B 下拉
  apply/CourseARows.tsx     A 課程列（client）
  apply/MyApplications.tsx  申請紀錄表（server）
  apply/actions.ts          submitApplication 解析 courseA[i][field]
  apply/[id]/page.tsx       抬頭右側條碼、A 表格、頁尾流水號
  apply/[id]/print.css
  admin/scan/actions.ts     scan(input) 支援 24 碼 / 流水號
  admin/scan/ScanForm.tsx   A 課程多列顯示、格式錯誤 vs 查無
  admin/courses/actions.ts  科號 15 碼錯誤訊息
components/Nav.tsx          已登入顯示學號姓名 + 登出
tests/
  db.test.ts, applications.test.ts, courses.test.ts, seed.test.ts, auth.test.ts, barcode.test.ts（更新）
README.md
```

---

### Task 1: 資料層 v3

**Files:**
- Modify: `lib/db/schema.ts`、`lib/applications.ts`、`lib/courses.ts`、`lib/seed.ts`
- Delete + regenerate: `drizzle/`
- Modify tests: `tests/db.test.ts`、`tests/applications.test.ts`、`tests/courses.test.ts`、`tests/seed.test.ts`、`tests/students.test.ts`、`tests/barcode.test.ts`

**Interfaces:**
- Produces:
  - `schema.applicationCoursesA`；型別 `ApplicationCourseA`
  - `CourseAInput = { code: string; name: string; time: string; teacher: string }`
  - `CreateApplicationInput = { studentId: string; coursesA: CourseAInput[]; courseBCode: string }`
  - `class DuplicateApplicationError extends Error { existingId: string }`（message `你已申請過此 X-Class 課程`）
  - `createApplication(db, input): Application`（`Application` 含 `barcode`）
  - `ApplicationDetail = Application & { studentName, department, courseBName, courseBTeacher, coursesA: ApplicationCourseA[] }`
  - `getApplication(db, id): ApplicationDetail | undefined`
  - `findApplicationByBarcode(db, barcode): ApplicationDetail | undefined`
  - `listApplicationsByStudent(db, studentId): Array<{ id, courseBCode, courseBName, courseBTeacher, status, createdAt, receivedAt }>`（新→舊）
  - `ReceiveResult = { kind:'received'|'already', detail } | { kind:'not_found' } | { kind:'bad_format' }`
  - `receiveByInput(db, raw: string): ReceiveResult` — 24 碼走 barcode、`A\d{6}` 走 id、其他 `bad_format`
  - `receiveApplication(db, id)` 保留
  - `createCourse` 對非 15 碼 throw `科號必須為 15 碼`
  - seed：學號 `113000001`–`113002000`；科號 `11510` + 系所 4 碼 + 6 碼課號

- [ ] **Step 1: schema**

`lib/db/schema.ts` 全檔替換：
```ts
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
```

- [ ] **Step 2: 重產 migration**

```bash
rm -rf drizzle data && npx drizzle-kit generate && ls drizzle && grep -c "CREATE TABLE" drizzle/0000_*.sql
```
Expected：一個 `0000_*.sql`，4 個 CREATE TABLE。

- [ ] **Step 3: 更新 db / students / courses / barcode 測試（先寫、看失敗）**

`tests/db.test.ts` 全檔替換：
```ts
import { describe, it, expect } from 'vitest';
import { createDb } from '@/lib/db/client';
import { students, courses, applications, applicationCoursesA } from '@/lib/db/schema';

const SID = '113000001';
const CODE = '11510EECS200101';

function fixtures(db: ReturnType<typeof createDb>) {
  db.insert(students).values({ id: SID, name: '學生一', department: '資工系 一年級' }).run();
  db.insert(courses).values({ code: CODE, name: '數學', teacher: '王教授', createdAt: '2026-01-01' }).run();
}

describe('createDb', () => {
  it('建立四張表且可查詢', () => {
    const db = createDb(':memory:');
    expect(db.select().from(students).all()).toEqual([]);
    expect(db.select().from(courses).all()).toEqual([]);
    expect(db.select().from(applications).all()).toEqual([]);
    expect(db.select().from(applicationCoursesA).all()).toEqual([]);
  });

  it('students.id 必須 9 碼', () => {
    const db = createDb(':memory:');
    expect(() => db.insert(students).values({ id: 'S0001', name: 'x', department: 'y' }).run()).toThrow();
  });

  it('courses.code 必須 15 碼', () => {
    const db = createDb(':memory:');
    expect(() => db.insert(courses).values({ code: 'C001', name: 'x', teacher: 'y', createdAt: 'z' }).run()).toThrow();
  });

  it('applications.status 只允許 printed 或 received', () => {
    const db = createDb(':memory:');
    fixtures(db);
    expect(() =>
      db.insert(applications).values({ id: 'A000001', studentId: SID, courseBCode: CODE, barcode: SID + CODE, status: 'bogus' as any, createdAt: '2026-01-01' }).run()
    ).toThrow();
  });

  it('同學生同課程第二筆違反 UNIQUE', () => {
    const db = createDb(':memory:');
    fixtures(db);
    const row = { studentId: SID, courseBCode: CODE, barcode: SID + CODE, createdAt: '2026-01-01' };
    db.insert(applications).values({ id: 'A000001', ...row }).run();
    expect(() => db.insert(applications).values({ id: 'A000002', ...row }).run()).toThrow();
  });
});
```

`tests/students.test.ts`：`beforeEach` 插入改為 `{ id: '113000001', name: '王小明', department: '資工系 二年級' }`；查詢改用 `'113000001'`，不存在改 `'999999999'`。

`tests/courses.test.ts`：所有 `'C001'`→`'11510EECS200101'`、`'C002'`→`'11510MATH200102'`；新增案例：
```ts
  it('科號非 15 碼拋錯', () => {
    expect(() => createCourse(db, { code: 'C001', name: 'x', teacher: 'y' })).toThrow('科號必須為 15 碼');
  });
```

`tests/barcode.test.ts` 兩個案例的輸入改為 24 碼：`'11300000111510EECS200101'` 與 `'11300000211510EECS200101'`。

Run: `npm test` → Expected: 多個 FAIL（CHECK 未生效、訊息不存在）。

- [ ] **Step 4: courses.ts 加驗證**

`lib/courses.ts` 的 `createCourse` 最前面加：
```ts
  if (input.code.length !== 15) throw new Error('科號必須為 15 碼');
```

- [ ] **Step 5: applications 測試（先寫）**

`tests/applications.test.ts` 全檔替換：
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { students, applicationCoursesA } from '@/lib/db/schema';
import { createCourse, setCourseActive } from '@/lib/courses';
import {
  createApplication, getApplication, listApplicationsByStudent, findApplicationByBarcode,
  receiveApplication, receiveByInput, nextApplicationId, DuplicateApplicationError,
} from '@/lib/applications';

const SID = '113000001';
const B1 = '11510EECS200101';
const B2 = '11510MATH200102';
const A1 = { code: 'EE2010', name: '電路學', time: 'M3M4', teacher: '林教授' };
const A2 = { code: 'CS1010', name: '計概', time: 'T5T6', teacher: '陳教授' };
const base = { studentId: SID, coursesA: [A1], courseBCode: B1 };

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  db.insert(students).values({ id: SID, name: '王小明', department: '資工系 二年級' }).run();
  createCourse(db, { code: B1, name: 'X-Class 線代', teacher: '李教授' });
  createCourse(db, { code: B2, name: 'X-Class 機率', teacher: '張教授' });
});

describe('nextApplicationId', () => {
  it('空表從 A000001 起並遞增', () => {
    expect(nextApplicationId(db)).toBe('A000001');
    createApplication(db, base);
    expect(nextApplicationId(db)).toBe('A000002');
  });
});

describe('createApplication', () => {
  it('成功：barcode = 學號 + B 科號，A 課程依序寫入', () => {
    const a = createApplication(db, { ...base, coursesA: [A1, A2] });
    expect(a.id).toBe('A000001');
    expect(a.barcode).toBe(SID + B1);
    expect(a.status).toBe('printed');
    const rows = db.select().from(applicationCoursesA).all();
    expect(rows.map(r => [r.seq, r.code])).toEqual([[1, 'EE2010'], [2, 'CS1010']]);
  });
  it('學號不存在', () => {
    expect(() => createApplication(db, { ...base, studentId: '999999999' })).toThrow('查無此學號');
  });
  it('B 停用', () => {
    setCourseActive(db, B1, false);
    expect(() => createApplication(db, base)).toThrow('課程不存在或已停用');
  });
  it('A 課程 0 門', () => {
    expect(() => createApplication(db, { ...base, coursesA: [] })).toThrow('一般課程至少一門，且每門四欄皆必填');
  });
  it('A 課程欄位空白', () => {
    expect(() => createApplication(db, { ...base, coursesA: [{ ...A1, time: '  ' }] })).toThrow('一般課程至少一門，且每門四欄皆必填');
  });
  it('A 課程 6 門', () => {
    expect(() => createApplication(db, { ...base, coursesA: [A1, A1, A1, A1, A1, A1] })).toThrow('一般課程最多五門');
  });
  it('同學生同 B 課程第二次被拒並回傳既有 id', () => {
    const first = createApplication(db, base);
    try {
      createApplication(db, { ...base, coursesA: [A2] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DuplicateApplicationError);
      expect((e as DuplicateApplicationError).existingId).toBe(first.id);
      expect((e as Error).message).toBe('你已申請過此 X-Class 課程');
    }
    expect(db.select().from(applicationCoursesA).all()).toHaveLength(1);
  });
  it('同學生不同 B 課程可以', () => {
    createApplication(db, base);
    expect(createApplication(db, { ...base, courseBCode: B2 }).id).toBe('A000002');
  });
  it('B 無效時 A 子表不殘留（transaction）', () => {
    expect(() => createApplication(db, { ...base, courseBCode: '11510XXXX999999' })).toThrow();
    expect(db.select().from(applicationCoursesA).all()).toHaveLength(0);
  });
});

describe('getApplication / findApplicationByBarcode', () => {
  it('回傳學生、B 課程與 A 課程列表', () => {
    createApplication(db, { ...base, coursesA: [A1, A2] });
    const d = getApplication(db, 'A000001');
    expect(d?.studentName).toBe('王小明');
    expect(d?.courseBName).toBe('X-Class 線代');
    expect(d?.courseBTeacher).toBe('李教授');
    expect(d?.coursesA.map(c => c.name)).toEqual(['電路學', '計概']);
    expect(findApplicationByBarcode(db, SID + B1)?.id).toBe('A000001');
  });
  it('不存在回 undefined', () => {
    expect(getApplication(db, 'A999999')).toBeUndefined();
    expect(findApplicationByBarcode(db, SID + B2)).toBeUndefined();
  });
});

describe('listApplicationsByStudent', () => {
  it('只回該學生、新→舊', () => {
    createApplication(db, base);
    createApplication(db, { ...base, courseBCode: B2 });
    db.insert(students).values({ id: '113000002', name: '別人', department: 'x' }).run();
    createApplication(db, { ...base, studentId: '113000002' });
    const list = listApplicationsByStudent(db, SID);
    expect(list.map(x => x.courseBCode)).toEqual([B2, B1]);
    expect(list[0].courseBName).toBe('X-Class 機率');
  });
});

describe('receiveByInput', () => {
  it('24 碼 → received', () => {
    createApplication(db, base);
    const r = receiveByInput(db, SID + B1);
    expect(r.kind).toBe('received');
    if (r.kind === 'received') expect(r.detail.receivedAt).not.toBeNull();
  });
  it('流水號路徑', () => {
    createApplication(db, base);
    expect(receiveByInput(db, 'A000001').kind).toBe('received');
  });
  it('重複掃描 already 且不覆寫', () => {
    createApplication(db, base);
    const first = receiveByInput(db, SID + B1);
    const second = receiveByInput(db, SID + B1);
    expect(second.kind).toBe('already');
    if (first.kind === 'received' && second.kind === 'already') expect(second.detail.receivedAt).toBe(first.detail.receivedAt);
  });
  it('格式錯誤 vs 查無', () => {
    expect(receiveByInput(db, 'XYZ').kind).toBe('bad_format');
    expect(receiveByInput(db, SID + B2).kind).toBe('not_found');
    expect(receiveByInput(db, 'A999999').kind).toBe('not_found');
  });
  it('前後空白會被修剪', () => {
    createApplication(db, base);
    expect(receiveByInput(db, `  ${SID}${B1}\n`).kind).toBe('received');
  });
});

describe('receiveApplication（保留）', () => {
  it('printed → received', () => {
    createApplication(db, base);
    expect(receiveApplication(db, 'A000001').kind).toBe('received');
  });
});
```

Run: `npm test -- tests/applications.test.ts` → FAIL。

- [ ] **Step 6: 實作 applications.ts**

全檔替換：
```ts
import { eq, desc, asc, and } from 'drizzle-orm';
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
  coursesA: ApplicationCourseA[];
};

export type ApplicationSummary = {
  id: string;
  courseBCode: string;
  courseBName: string;
  courseBTeacher: string;
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
const BARCODE_RE = /^[0-9A-Za-z]{24}$/;

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
}

function loadDetail(db: Db, where: ReturnType<typeof eq>): ApplicationDetail | undefined {
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
```
注意 `nextApplicationId(tx)`：`tx` 型別與 `Db` 結構相容（v2 已驗證 `createCourse(tx, …)` 可行）。若 TS 抱怨 `loadDetail` 的 `where` 型別，改用 `SQL` 型別：`import { SQL } from 'drizzle-orm'` 並宣告 `where: SQL`。

- [ ] **Step 7: seed v3 + 測試**

`lib/seed.ts` 內 `studentRows` 的 `id` 改 `'113' + String(n).padStart(6, '0')`；課程迴圈改：
```ts
    const DEPT_CODES = ['EECS', 'MATH', 'PHYS', 'CHEM', 'ECON', 'CHIN', 'LANG', 'LIFE', 'MSE0', 'CS00'];
    for (let i = 1; i <= 100; i++) {
      createCourse(tx, {
        code: '11510' + pick(DEPT_CODES, i - 1) + String(200100 + i).padStart(6, '0'),
        name: `${pick(COURSE_BASES, i - 1)}${Math.ceil(i / 10)}`,
        teacher: `${pick(SURNAMES, i * 3)}教授`,
      });
    }
```
（`DEPT_CODES` 放檔案頂部常數區。）`tests/seed.test.ts` 加一個斷言：seed 後第一筆學生 id 為 `'113000001'`，且所有課程 `code.length === 15`：
```ts
  it('學號 9 碼、科號 15 碼', () => {
    seed(db, { ifEmpty: false });
    expect(db.select().from(students).limit(1).get()?.id).toBe('113000001');
    expect(db.select().from(courses).all().every(c => c.code.length === 15)).toBe(true);
  });
```

- [ ] **Step 8: 全部測試通過**

Run: `npm test` → Expected: 全 PASS（`tsc` 會因 `app/` 失敗，屬預期）。`npm run seed` 印出 `seed 完成：2000 學生、100 課程`。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "資料層 v3：A 課程改子表手填多門、條碼改學號+科號並唯一、學號科號長度固定，對齊校方收件系統"
```

---

### Task 2: 認證層與登入頁 + Nav

**Files:**
- Create: `lib/auth-core.ts`、`lib/auth.ts`、`app/login/page.tsx`、`app/login/LoginForm.tsx`、`app/login/actions.ts`、`tests/auth.test.ts`
- Modify: `components/Nav.tsx`、`app/layout.tsx`
- Temporary: `app/apply/*`、`app/admin/scan/*`、`app/apply/[id]/page.tsx` 需最小修補讓 `tsc`/`build` 通過（Task 3–5 再正式重做）

**Interfaces:**
- Produces:
  - `lib/auth-core.ts`：`interface CookieStore { get(name): string | undefined; set(name, value): void; delete(name): void }`；`SESSION_COOKIE = 'sid'`；`resolveStudent(db, store): Student | null`；`setSession(store, studentId)`；`clearSession(store)`
  - `lib/auth.ts`（server only）：`getCurrentStudent(): Promise<Student | null>`、`login(studentId): Promise<Student | null>`、`logout(): Promise<void>`
  - `/login?next=/apply`

- [ ] **Step 1: auth-core 測試（先寫）**

`tests/auth.test.ts`：
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { students } from '@/lib/db/schema';
import { CookieStore, SESSION_COOKIE, resolveStudent, setSession, clearSession } from '@/lib/auth-core';

function memStore(): CookieStore & { jar: Map<string, string> } {
  const jar = new Map<string, string>();
  return { jar, get: n => jar.get(n), set: (n, v) => { jar.set(n, v); }, delete: n => { jar.delete(n); } };
}

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  db.insert(students).values({ id: '113000001', name: '王小明', department: '資工系 二年級' }).run();
  db.insert(students).values({ id: '113000002', name: '停用生', department: 'x', isActive: 0 }).run();
});

describe('auth-core', () => {
  it('setSession 寫入 sid，resolveStudent 讀回學生', () => {
    const store = memStore();
    setSession(store, '113000001');
    expect(store.jar.get(SESSION_COOKIE)).toBe('113000001');
    expect(resolveStudent(db, store)?.name).toBe('王小明');
  });
  it('無 cookie → null', () => {
    expect(resolveStudent(db, memStore())).toBeNull();
  });
  it('cookie 指向不存在或停用的學生 → null', () => {
    const s1 = memStore(); s1.set(SESSION_COOKIE, '999999999');
    expect(resolveStudent(db, s1)).toBeNull();
    const s2 = memStore(); s2.set(SESSION_COOKIE, '113000002');
    expect(resolveStudent(db, s2)).toBeNull();
  });
  it('clearSession 刪除 cookie', () => {
    const store = memStore();
    setSession(store, '113000001');
    clearSession(store);
    expect(store.jar.has(SESSION_COOKIE)).toBe(false);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm test -- tests/auth.test.ts` → FAIL。

- [ ] **Step 3: 實作 auth-core.ts 與 auth.ts**

`lib/auth-core.ts`：
```ts
import { Db } from './db/client';
import { Student } from './db/schema';
import { findStudent } from './students';

export const SESSION_COOKIE = 'sid';

export interface CookieStore {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  delete(name: string): void;
}

export function resolveStudent(db: Db, store: CookieStore): Student | null {
  const sid = store.get(SESSION_COOKIE);
  if (!sid) return null;
  const s = findStudent(db, sid);
  return s && s.isActive === 1 ? s : null;
}

export function setSession(store: CookieStore, studentId: string): void {
  store.set(SESSION_COOKIE, studentId);
}

export function clearSession(store: CookieStore): void {
  store.delete(SESSION_COOKIE);
}
```

`lib/auth.ts`（**接 SSO 時只換這個檔**）：
```ts
import 'server-only';
import { cookies } from 'next/headers';
import { getDb } from './db/client';
import { Student } from './db/schema';
import { findStudent } from './students';
import { CookieStore, resolveStudent, setSession, clearSession } from './auth-core';

async function nextCookieStore(): Promise<CookieStore> {
  const jar = await cookies();
  return {
    get: (n) => jar.get(n)?.value,
    set: (n, v) => { jar.set(n, v, { httpOnly: true, sameSite: 'lax', path: '/' }); },
    delete: (n) => { jar.delete(n); },
  };
}

export async function getCurrentStudent(): Promise<Student | null> {
  return resolveStudent(getDb(), await nextCookieStore());
}

/** Demo 假登入：只驗學號存在且啟用，不驗密碼。正式環境以 SSO 取代此函式。 */
export async function login(studentId: string): Promise<Student | null> {
  const s = findStudent(getDb(), studentId.trim());
  if (!s || s.isActive !== 1) return null;
  setSession(await nextCookieStore(), s.id);
  return s;
}

export async function logout(): Promise<void> {
  clearSession(await nextCookieStore());
}
```
若 `server-only` 套件不存在：`npm install server-only`。

- [ ] **Step 4: 登入頁**

`app/login/actions.ts`：
```ts
'use server';

import { redirect } from 'next/navigation';
import { login, logout } from '@/lib/auth';

function safeNext(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/apply';
}

export async function loginAction(formData: FormData): Promise<{ error: string } | void> {
  const studentId = String(formData.get('studentId') ?? '').trim();
  const s = await login(studentId);
  if (!s) return { error: '查無此學號' };
  redirect(safeNext(formData.get('next')));
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect('/login');
}
```

`app/login/LoginForm.tsx`：
```tsx
'use client';

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { loginAction } from './actions';

export default function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError('');
    startTransition(async () => {
      const r = await loginAction(formData);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Field id="studentId" label="學號" hint="Demo 環境：輸入學號即可登入（例：113000001），正式環境將由校務系統單一登入取代" error={error}>
        <input id="studentId" name="studentId" className="input" required autoComplete="username" inputMode="numeric" maxLength={9} />
      </Field>
      <Button type="submit" variant="primary" loading={pending}>登入</Button>
    </form>
  );
}
```

`app/login/page.tsx`：
```tsx
import { redirect } from 'next/navigation';
import Card from '@/components/Card';
import { getCurrentStudent } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '/apply' } = await searchParams;
  if (await getCurrentStudent()) redirect(next.startsWith('/') ? next : '/apply');
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">學生登入</h1>
      <p className="mb-6 text-muted-fg">登入後即可申請 X-Class 課程並查看申請紀錄。</p>
      <Card><LoginForm next={next} /></Card>
    </>
  );
}
```

- [ ] **Step 5: Nav 顯示登入狀態**

`components/Nav.tsx` 改為接受 props（保持 client component）：
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/login/actions';

const LINKS = [
  { href: '/apply', label: '學生申請' },
  { href: '/admin/courses', label: '課程管理' },
  { href: '/admin/scan', label: '掃描收件' },
];

export type NavUser = { id: string; name: string } | null;

export default function Nav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  return (
    <header className="bg-primary text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="min-h-11 inline-flex items-center text-lg font-semibold tracking-wide">國立○○大學 課程申請表系統</Link>
        <nav aria-label="主選單" className="flex flex-wrap items-center gap-1">
          {LINKS.map(l => {
            const active = pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined}
                className={`min-h-11 inline-flex items-center rounded-[var(--radius-card)] px-3 py-2 text-sm transition-colors duration-150 hover:bg-white/10 ${active ? 'bg-white/15 font-medium' : ''}`}>
                {l.label}
              </Link>
            );
          })}
          {user ? (
            <form action={logoutAction} className="ml-2 flex items-center gap-2 border-l border-white/30 pl-3 text-sm">
              <span className="font-mono">{user.id}</span><span>{user.name}</span>
              <button type="submit" className="min-h-11 cursor-pointer rounded-[var(--radius-card)] px-2 underline-offset-2 hover:underline">登出</button>
            </form>
          ) : (
            <Link href="/login" className="ml-2 min-h-11 inline-flex items-center border-l border-white/30 pl-3 text-sm hover:underline">登入</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```
`app/layout.tsx` 改為 async，取得使用者後傳入：
```tsx
import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { getCurrentStudent } from "@/lib/auth";

export const metadata: Metadata = {
  title: "課程申請表系統",
  description: "學生登入後申請 X-Class 課程、列印含條碼申請表；行政掃描收件",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const s = await getCurrentStudent();
  return (
    <html lang="zh-Hant">
      <body>
        <Nav user={s ? { id: s.id, name: s.name } : null} />
        <main className="container-narrow">{children}</main>
      </body>
    </html>
  );
}
```
layout 讀 cookie 會讓整站 dynamic — 本專案所有頁面本來就是 `force-dynamic` 或 server-rendered，可接受。

- [ ] **Step 6: 讓 build 恢復（最小修補，不做視覺）**

目前 `app/apply/actions.ts`、`ApplyForm.tsx`、`app/apply/[id]/page.tsx`、`app/admin/scan/actions.ts`、`ScanForm.tsx` 仍引用 v2 的 `courseACode/courseAStatus/courseAName`。在本 Task 做**最小改動**讓 `tsc` 通過（Task 3–5 會整個重寫）：
- `app/apply/actions.ts`：`submitApplication` 改為 `createApplication(getDb(), { studentId, coursesA: [{ code: String(formData.get('courseACode') ?? ''), name: '(待填)', time: '(待填)', teacher: '(待填)' }], courseBCode })`，`lookupStudent` 不動。
- `app/apply/ApplyForm.tsx`：把 `courseAStatus` 那個 `Field` 刪除；`courseACode` 的 `<select>` 改為 `<input id="courseACode" name="courseACode" className="input" required value={courseA} onChange={e => setCourseA(e.target.value)} />`。
- `app/apply/[id]/page.tsx`：A 課程區塊改為 `a.coursesA.map(c => <tr key={c.seq}><td>{c.code}</td><td>{c.name}</td><td>{c.time}</td><td>{c.teacher}</td></tr>)`；條碼 `renderCode128Svg(a.barcode)`；人類可讀改 `{a.barcode}`。
- `app/admin/scan/actions.ts`：`ScanOutcome` 的 `courseACode/courseAName` 改為 `coursesA: { code: string; name: string }[]`；`scan` 改呼叫 `receiveByInput`，`bad_format` 先對應到 `not_found`。
- `app/admin/scan/ScanForm.tsx`：顯示 A 課程改 `current.coursesA.map(c => c.code).join('、')`。

- [ ] **Step 7: 驗證**

Run: `npm test && npx tsc --noEmit && npm run build` → 全過。背景 `npm run dev -- -p 3200`（記 PID）：curl `/login` 200 含「學生登入」；curl `/apply` 應 200（尚未 gate，Task 3 做）。kill 該 PID。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "新增假登入與 lib/auth.ts 單一替換點，為接校務 SSO 預留；Nav 顯示登入狀態"
```

---

### Task 3: `/apply` v3（登入 gate、唯讀學生卡、A 課程動態列、申請紀錄）

**Files:**
- Modify: `app/apply/page.tsx`、`app/apply/ApplyForm.tsx`、`app/apply/actions.ts`
- Create: `app/apply/CourseARows.tsx`、`app/apply/MyApplications.tsx`
- Modify: `components/icons.tsx`（加 `PlusIcon`、`TrashIcon`）

**Interfaces:**
- Consumes: `getCurrentStudent`（Task 2）；`createApplication`、`DuplicateApplicationError`、`listApplicationsByStudent`、`MAX_COURSES_A`（Task 1）；`listActiveCourses`
- Produces: `submitApplication(formData): Promise<{ error: string; existingId?: string } | void>`，欄位名 `courseA[i][code|name|time|teacher]`、`courseBCode`

- [ ] **Step 1: icons 追加**

`components/icons.tsx` 末尾加：
```tsx
export const PlusIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
);
export const TrashIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
);
```

- [ ] **Step 2: actions.ts**

```ts
'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getCurrentStudent } from '@/lib/auth';
import { createApplication, DuplicateApplicationError, MAX_COURSES_A, CourseAInput } from '@/lib/applications';

function parseCoursesA(formData: FormData): CourseAInput[] {
  const rows: CourseAInput[] = [];
  for (let i = 0; i < MAX_COURSES_A; i++) {
    const get = (f: string) => formData.get(`courseA[${i}][${f}]`);
    if (get('code') === null && get('name') === null) continue;
    rows.push({
      code: String(get('code') ?? ''), name: String(get('name') ?? ''),
      time: String(get('time') ?? ''), teacher: String(get('teacher') ?? ''),
    });
  }
  return rows;
}

export async function submitApplication(formData: FormData): Promise<{ error: string; existingId?: string } | void> {
  const student = await getCurrentStudent();
  if (!student) redirect('/login?next=/apply');

  let id: string;
  try {
    id = createApplication(getDb(), {
      studentId: student.id,
      coursesA: parseCoursesA(formData),
      courseBCode: String(formData.get('courseBCode') ?? ''),
    }).id;
  } catch (e) {
    if (e instanceof DuplicateApplicationError) return { error: e.message, existingId: e.existingId };
    return { error: (e as Error).message };
  }
  redirect(`/apply/${id}`);
}
```
（移除 `lookupStudent`——登入後不再需要。）

- [ ] **Step 3: CourseARows.tsx**

```tsx
'use client';

import Button from '@/components/Button';
import { PlusIcon, TrashIcon } from '@/components/icons';

export type CourseARow = { key: number; code: string; name: string; time: string; teacher: string };
const FIELDS: Array<{ f: keyof Omit<CourseARow, 'key'>; label: string; hint: string }> = [
  { f: 'code', label: '科號（課號）', hint: '例：EE201001' },
  { f: 'name', label: '課名', hint: '例：電路學' },
  { f: 'time', label: '上課時間', hint: '例：M3M4' },
  { f: 'teacher', label: '任課教師', hint: '例：林教授' },
];

type Props = { rows: CourseARow[]; max: number; onChange: (rows: CourseARow[]) => void };

export default function CourseARows({ rows, max, onChange }: Props) {
  function update(i: number, f: keyof Omit<CourseARow, 'key'>, v: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [f]: v } : r)));
  }
  function add() {
    if (rows.length >= max) return;
    onChange([...rows, { key: Date.now(), code: '', name: '', time: '', teacher: '' }]);
  }
  function remove(i: number) {
    if (rows.length <= 1) return;
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">一般課程 A（至少一門，最多 {max} 門；校內或校外課程皆可）</legend>
      {rows.map((r, i) => (
        <div key={r.key} className="rounded-[var(--radius-card)] border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-fg">第 {i + 1} 門</span>
            <Button type="button" variant="danger" className="min-h-11 px-3 text-xs" onClick={() => remove(i)} disabled={rows.length <= 1} aria-label={`刪除第 ${i + 1} 門`}>
              <TrashIcon className="size-4" /> 刪除
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(({ f, label, hint }) => {
              const id = `courseA-${i}-${f}`;
              return (
                <div key={f} className="flex flex-col gap-1.5">
                  <label htmlFor={id} className="text-sm font-medium">{label}</label>
                  <input id={id} name={`courseA[${i}][${f}]`} className="input" required value={r[f]} onChange={e => update(i, f, e.target.value)} placeholder={hint} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={add} disabled={rows.length >= max} className="self-start">
        <PlusIcon className="size-4" /> 新增一門
      </Button>
    </fieldset>
  );
}
```

- [ ] **Step 4: ApplyForm.tsx**

```tsx
'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import CourseARows, { CourseARow } from './CourseARows';
import { submitApplication } from './actions';

type CourseOption = { code: string; name: string; teacher: string };

export default function ApplyForm({ courses, maxCoursesA }: { courses: CourseOption[]; maxCoursesA: number }) {
  const [rows, setRows] = useState<CourseARow[]>([{ key: 1, code: '', name: '', time: '', teacher: '' }]);
  const [courseB, setCourseB] = useState('');
  const [error, setError] = useState<{ message: string; existingId?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const rowsComplete = rows.every(r => r.code.trim() && r.name.trim() && r.time.trim() && r.teacher.trim());

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await submitApplication(formData);
      if (r?.error) setError({ message: r.error, existingId: r.existingId });
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      <CourseARows rows={rows} max={maxCoursesA} onChange={setRows} />

      <Field id="courseBCode" label="X-Class 課程 B" hint="欲申請的 X-Class 課程，需事先與授課教師確認">
        <select id="courseBCode" name="courseBCode" className="input" required value={courseB} onChange={e => setCourseB(e.target.value)}>
          <option value="" disabled>請選擇</option>
          {courses.map(c => <option key={c.code} value={c.code}>{c.code}　{c.name}（{c.teacher}）</option>)}
        </select>
      </Field>

      {error && (
        <p role="alert" className="rounded-[var(--radius-card)] bg-danger-bg px-3 py-2 text-sm text-danger">
          {error.message}
          {error.existingId && (
            <>　<Link href={`/apply/${error.existingId}`} className="underline">查看／重新列印原申請表</Link></>
          )}
        </p>
      )}
      <Button type="submit" variant="primary" loading={pending} disabled={!rowsComplete || !courseB}>產生申請表</Button>
    </form>
  );
}
```

- [ ] **Step 5: MyApplications.tsx（server component）**

```tsx
import Link from 'next/link';
import Badge from '@/components/Badge';
import { formatDate } from '@/lib/format';
import type { ApplicationSummary } from '@/lib/applications';

export default function MyApplications({ items }: { items: ApplicationSummary[] }) {
  if (items.length === 0) return <p className="text-muted-fg">尚未申請任何 X-Class 課程。</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-fg">
          <tr>
            <th className="px-3 py-2 font-semibold">X-Class 科號</th>
            <th className="px-3 py-2 font-semibold">課名</th>
            <th className="px-3 py-2 font-semibold">授課教師</th>
            <th className="px-3 py-2 font-semibold">申請日期</th>
            <th className="px-3 py-2 font-semibold">狀態</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map(a => (
            <tr key={a.id} className="border-t border-border even:bg-background/60">
              <td className="px-3 py-2 font-mono">{a.courseBCode}</td>
              <td className="px-3 py-2">{a.courseBName}</td>
              <td className="px-3 py-2">{a.courseBTeacher}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(a.createdAt)}</td>
              <td className="px-3 py-2">
                {a.status === 'received' ? <Badge tone="success">已收件</Badge> : <Badge tone="neutral">已產生</Badge>}
              </td>
              <td className="px-3 py-2 text-right">
                <Link href={`/apply/${a.id}`} className="min-h-11 inline-flex items-center text-secondary underline-offset-2 hover:underline">列印</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: page.tsx**

```tsx
import { redirect } from 'next/navigation';
import Card from '@/components/Card';
import { getDb } from '@/lib/db/client';
import { getCurrentStudent } from '@/lib/auth';
import { listActiveCourses } from '@/lib/courses';
import { listApplicationsByStudent, MAX_COURSES_A } from '@/lib/applications';
import ApplyForm from './ApplyForm';
import MyApplications from './MyApplications';

export const dynamic = 'force-dynamic';

export default async function ApplyPage() {
  const student = await getCurrentStudent();
  if (!student) redirect('/login?next=/apply');

  const db = getDb();
  const courses = listActiveCourses(db).map(c => ({ code: c.code, name: c.name, teacher: c.teacher }));
  const mine = listApplicationsByStudent(db, student.id);

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">X-Class 課程修課申請</h1>
      <p className="mb-6 text-muted-fg">填寫後系統會產生一張含條碼的申請表，請列印、完成簽章後送交課務組。</p>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-fg">申請人（由登入資訊帶出）</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          <dt className="text-muted-fg">學號</dt><dd className="font-mono">{student.id}</dd>
          <dt className="text-muted-fg">姓名</dt><dd>{student.name}</dd>
          <dt className="text-muted-fg">系級</dt><dd>{student.department}</dd>
        </dl>
      </Card>

      <Card className="mb-8"><ApplyForm courses={courses} maxCoursesA={MAX_COURSES_A} /></Card>

      <h2 className="mb-3 text-xl font-semibold">我的申請紀錄</h2>
      <Card className="p-0 sm:p-2"><MyApplications items={mine} /></Card>
    </>
  );
}
```

- [ ] **Step 7: 驗證**

Run: `npm test && npx tsc --noEmit && npm run build`。背景 dev 3200：`curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3200/apply` → `307 …/login?next=/apply`；用 curl 帶 cookie 模擬登入：`curl -s -c jar.txt -d "studentId=113000001&next=/apply" http://localhost:3200/login`（Server Action 無法這樣打）——改為 `curl -s -b "sid=113000001" http://localhost:3200/apply` 應 200 且含「申請人（由登入資訊帶出）」、「我的申請紀錄」、「尚未申請」。kill 自己的 PID。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "申請頁改由登入帶出學號、A 課程改手填多門並顯示申請紀錄，回應校方對外校課程與重複申請的需求"
```

---

### Task 4: 列印頁 v3（條碼右上、A 課程表格、頁尾流水號）

**Files:**
- Modify: `app/apply/[id]/page.tsx`、`app/apply/[id]/print.css`
- Modify: `tests/print-toolbar.test.tsx`（若有引用舊欄位）

**Interfaces:**
- Consumes: `getApplication`（含 `coursesA`、`barcode`）、`renderCode128Svg`

- [ ] **Step 1: page.tsx**

```tsx
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getApplication } from '@/lib/applications';
import { renderCode128Svg } from '@/lib/barcode';
import { formatDate } from '@/lib/format';
import PrintToolbar from './PrintToolbar';
import './print.css';

export const dynamic = 'force-dynamic';

const TERMS = [
  '本人已與 X-Class 課程授課教師事前溝通，並確認教師提供整學期完整之非同步學習資源。',
  '本人同意不得要求補課、調整教學進度、請假延交作業等額外安排。',
  '若 X-Class 課程考試與一般課程衝突，不予改期或補考，相關風險由本人自行承擔。',
];

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = getApplication(getDb(), id);
  if (!a) notFound();
  const svg = renderCode128Svg(a.barcode);

  return (
    <div className="print-wrap">
      <PrintToolbar />
      <article className="sheet">
        <div className="sheet-head">
          <div className="sheet-title">
            <h1>國立○○大學　X-Class 課程修課申請表</h1>
            <p>NTHU X-Class Application Form　　115 學年度上學期</p>
          </div>
          <div className="barcode" aria-label={`條碼 ${a.barcode}`}>
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="human">{a.barcode}</div>
          </div>
        </div>

        <section>
          <h2>一、申請人</h2>
          <table>
            <tbody>
              <tr><th>學號</th><td>{a.studentId}</td><th>姓名</th><td>{a.studentName}</td></tr>
              <tr><th>系級</th><td colSpan={3}>{a.department}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>二、一般課程（Course A）</h2>
          <table className="courses-a">
            <thead>
              <tr><th>#</th><th>科號（課號）</th><th>課名</th><th>上課時間</th><th>任課教師</th></tr>
            </thead>
            <tbody>
              {a.coursesA.map(c => (
                <tr key={c.seq}><td>{c.seq}</td><td>{c.code}</td><td>{c.name}</td><td>{c.time}</td><td>{c.teacher}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>三、X-Class 課程（Course B）</h2>
          <table>
            <tbody>
              <tr><th>科號</th><td>{a.courseBCode}</td><th>授課教師</th><td>{a.courseBTeacher}</td></tr>
              <tr><th>課程名稱</th><td colSpan={3}>{a.courseBName}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>四、申請人同意事項</h2>
          <ol className="terms">{TERMS.map(t => <li key={t}>{t}</li>)}</ol>
        </section>

        <section className="signatures">
          <div><span>X-Class 授課教師簽章</span><div className="line" /></div>
          <div><span>學生簽名</span><div className="line" /></div>
          <div><span>日期</span><div className="line">{formatDate(a.createdAt)}</div></div>
        </section>

        <footer className="sheet-foot">
          <p className="note">請於開學第二週週五前，將本表送交校本部第一綜合大樓一樓課務組。</p>
          <p className="serial">申請單號 {a.id}</p>
        </footer>
      </article>
    </div>
  );
}
```

- [ ] **Step 2: print.css**

把 `.sheet-head`、`.sheet-foot`、`.barcode` 相關規則替換為：
```css
.sheet-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm; margin-bottom: 6mm; }
.sheet-title { flex: 1; }
.sheet-title h1 { font-size: 18pt; font-weight: 700; letter-spacing: 0.05em; }
.sheet-title p { font-size: 10pt; color: #333; }
.barcode { flex: 0 0 auto; text-align: center; padding: 3mm; border: 1px solid #000; }
.barcode svg { width: 60mm; height: auto; display: block; }
.barcode .human { font-family: ui-monospace, monospace; font-size: 9pt; margin-top: 1mm; letter-spacing: 0.08em; }
.courses-a th { width: auto; }
.courses-a th:first-child, .courses-a td:first-child { width: 8mm; text-align: center; }
.sheet-foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; margin-top: 10mm; }
.note { font-size: 10pt; color: #333; max-width: 70%; }
.serial { font-family: ui-monospace, monospace; font-size: 9pt; color: #333; }
```
其餘規則（`.sheet`、`.terms`、`.signatures`、`@media print`）保持。在窄螢幕加：
```css
@media (max-width: 640px) { .sheet-head { flex-direction: column; } .barcode { align-self: flex-end; } }
```

- [ ] **Step 3: 驗證**

`npm test && npx tsc --noEmit && npm run build`。背景 dev 3200：先用 `npx tsx -e` 建一筆（`createApplication(getDb(), { studentId:'113000001', coursesA:[{code:'EE2010',name:'電路學',time:'M3M4',teacher:'林教授'},{code:'CS1010',name:'計概',time:'T5T6',teacher:'陳教授'}], courseBCode: <listActiveCourses 第一筆 code> })`），curl `/apply/A000001` 含 `<svg`、`11300000111510`、`電路學`、`計概`、`申請單號 A000001`。列印預覽（條碼右上、一頁）列人工驗證。kill 自己的 PID。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "列印表條碼移至右上並改為學號+科號，A 課程改表格多列，方便課務組收件時直接掃描"
```

---

### Task 5: 掃描頁 v3 + 課程管理科號驗證

**Files:**
- Modify: `app/admin/scan/actions.ts`、`app/admin/scan/ScanForm.tsx`、`app/admin/scan/page.tsx`
- Modify: `app/admin/courses/actions.ts`、`app/admin/courses/AddCourseForm.tsx`

**Interfaces:**
- Consumes: `receiveByInput`、`ReceiveResult`（Task 1）
- Produces: `ScanOutcome = { kind:'received'|'already', id, barcode, studentId, studentName, department, coursesA: {seq,code,name}[], courseBCode, courseBName, courseBTeacher, receivedAt } | { kind:'not_found', input } | { kind:'bad_format', input }`

- [ ] **Step 1: actions.ts**

```ts
'use server';

import { getDb } from '@/lib/db/client';
import { receiveByInput } from '@/lib/applications';

export type ScanOutcome =
  | {
      kind: 'received' | 'already';
      id: string; barcode: string; studentId: string; studentName: string; department: string;
      coursesA: { seq: number; code: string; name: string }[];
      courseBCode: string; courseBName: string; courseBTeacher: string; receivedAt: string;
    }
  | { kind: 'not_found'; input: string }
  | { kind: 'bad_format'; input: string };

export async function scan(raw: string): Promise<ScanOutcome> {
  const input = raw.trim();
  const r = receiveByInput(getDb(), input);
  if (r.kind === 'not_found' || r.kind === 'bad_format') return { kind: r.kind, input };
  const d = r.detail;
  return {
    kind: r.kind,
    id: d.id, barcode: d.barcode, studentId: d.studentId, studentName: d.studentName, department: d.department,
    coursesA: d.coursesA.map(c => ({ seq: c.seq, code: c.code, name: c.name })),
    courseBCode: d.courseBCode, courseBName: d.courseBName, courseBTeacher: d.courseBTeacher,
    receivedAt: d.receivedAt ?? '',
  };
}
```

- [ ] **Step 2: ScanForm.tsx**

```tsx
'use client';

import { useRef, useState } from 'react';
import { CheckIcon, XIcon } from '@/components/icons';
import { formatDateTime } from '@/lib/format';
import { scan, ScanOutcome } from './actions';

type Entry = ScanOutcome & { at: string };

const STYLE: Record<ScanOutcome['kind'], { box: string; text: string; title: string }> = {
  received: { box: 'bg-success-bg border-success', text: 'text-success', title: '收件成功' },
  already: { box: 'bg-warning-bg border-warning', text: 'text-warning', title: '此申請單已收件' },
  not_found: { box: 'bg-danger-bg border-danger', text: 'text-danger', title: '查無此申請單' },
  bad_format: { box: 'bg-danger-bg border-danger', text: 'text-danger', title: '條碼格式錯誤' },
};

function label(e: Entry): string {
  return e.kind === 'received' || e.kind === 'already' ? e.barcode : e.input;
}

export default function ScanForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = inputRef.current;
    const value = el?.value.trim() ?? '';
    if (!value || !el) return;
    el.value = '';
    let outcome: ScanOutcome;
    try {
      outcome = await scan(value);
    } catch {
      outcome = { kind: 'not_found', input: value };
    }
    const entry: Entry = { ...outcome, at: new Date().toISOString() };
    setCurrent(entry);
    setHistory(h => [entry, ...h].slice(0, 5));
    el.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit}>
        <label htmlFor="scan" className="mb-2 block text-sm font-medium">掃描申請表右上角條碼（24 碼），或輸入申請單號後按 Enter</label>
        <input id="scan" ref={inputRef} autoFocus autoComplete="off" placeholder="11300000111510EECS200101"
          className="input min-h-16 text-center font-mono text-2xl tracking-widest" />
      </form>

      {current && (
        <div key={current.at} role="status" className={`animate-[fade-in_200ms_ease-out] rounded-[var(--radius-card)] border-2 p-6 ${STYLE[current.kind].box} ${STYLE[current.kind].text}`}>
          <div className="flex items-center gap-2 text-2xl font-semibold">
            {current.kind === 'received' ? <CheckIcon className="size-7" /> : <XIcon className="size-7" />}
            {STYLE[current.kind].title}
          </div>
          <p className="mt-2 font-mono text-lg">{label(current)}</p>
          {(current.kind === 'received' || current.kind === 'already') && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base text-foreground">
              <dt className="text-muted-fg">學生</dt><dd>{current.studentId}　{current.studentName}　{current.department}</dd>
              <dt className="text-muted-fg">一般課程 A</dt>
              <dd><ul>{current.coursesA.map(c => <li key={c.seq}>{c.seq}. {c.code}　{c.name}</li>)}</ul></dd>
              <dt className="text-muted-fg">X-Class B</dt><dd>{current.courseBCode}　{current.courseBName}（{current.courseBTeacher}）</dd>
              <dt className="text-muted-fg">申請單號</dt><dd className="font-mono">{current.id}</dd>
              {current.kind === 'already' && (<><dt className="text-muted-fg">原收件時間</dt><dd>{formatDateTime(current.receivedAt)}</dd></>)}
            </dl>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-fg">最近掃描</h2>
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface text-sm">
            {history.map(h => (
              <li key={h.at} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="font-mono">{label(h)}</span>
                <span className="flex-1 truncate text-muted-fg">{h.kind === 'received' || h.kind === 'already' ? `${h.studentId} ${h.studentName}` : '—'}</span>
                <span className={STYLE[h.kind].text}>{STYLE[h.kind].title}</span>
                <span className="text-muted-fg">{formatDateTime(h.at).slice(11)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```
`app/admin/scan/page.tsx` 的說明文字改：「游標會停在輸入框，掃描申請表右上角條碼會自動送出，不需碰滑鼠。」

- [ ] **Step 3: 課程管理科號提示**

`app/admin/courses/AddCourseForm.tsx` 科號欄位：`<Field id="code" label="科號（15 碼）" hint="例：11510EECS200101"><input … maxLength={15} minLength={15} className="input font-mono" /></Field>`。`actions.ts` 不動（`createCourse` 已 throw `科號必須為 15 碼`，錯誤會回到表單）。

- [ ] **Step 4: 驗證**

`npm test && npx tsc --noEmit && npm run build`。背景 dev 3200：curl `/admin/scan` 含「24 碼」與 `autofocus`；`/admin/courses` 含「15 碼」。kill 自己的 PID。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "掃描頁改讀 24 碼條碼並區分格式錯誤與查無，顯示多門 A 課程；課程管理提示科號 15 碼"
```

---

### Task 6: 文件、首頁與線上驗證

**Files:**
- Modify: `README.md`、`app/page.tsx`
- Verify: Render 重新部署

- [ ] **Step 1: README**

更新：一句話說明（登入 → 填 A 課程 1–5 門 → 選 X-Class → 列印 → 掃右上角 24 碼）；頁面清單加 `/login`；「假資料」段落改學號 `113000001`–`113002000`、科號 15 碼範例；「接 SSO」段：只需改 `lib/auth.ts`；部署段落加一句「Render Free 磁碟不持久，每次重啟自動重 seed；若用 Railway volume，schema 變更後需清空 volume 再部署」。

- [ ] **Step 2: 首頁卡片文案**

`app/page.tsx` 學生申請卡描述改「登入後填寫一般課程與 X-Class 課程，產生含條碼的申請表」。

- [ ] **Step 3: 全量驗證與 commit**

```bash
npm test && npx tsc --noEmit && npm run build
git add -A && git commit -m "更新 README 與首頁文案，反映登入流程、手填 A 課程與 24 碼條碼"
```

- [ ] **Step 4: 線上驗證（控制器執行）**

`git push origin main` 後等 Render 部署，curl `/login` 200、`/apply` 307 → `/login`；以 `-b "sid=113000001"` 取 `/apply` 200。人工：登入、填 2 門 A、選 B、列印預覽條碼在右上、手機掃出 24 碼、`/admin/scan` 貼上 24 碼收件成功、再掃一次為已收件、回 `/apply` 紀錄顯示「已收件」。

---

## 自我檢查

**Spec 覆蓋：** §4（4 表、CHECK、UNIQUE、子表）→ T1；§5 認證 → T2；Layout/Nav 登入狀態 → T2；`/login` → T2；`/apply` 全部 8 點 → T3；`/apply/[id]` 8 點（條碼右上、A 表格、頁尾單號）→ T4；`/admin/courses` 15 碼 → T1 + T5；`/admin/scan` 解析與三態四種 → T1 + T5；§6 錯誤表 11 列 → T1（A 課程 0/6 門、空白、B 停用、重複）、T2（登入不存在、未登入導向、session 失效）、T5（格式錯誤 / 查無 / 重複掃描）、T1（科號 15 碼）；§7 seed → T1；§8 測試 → T1 + T2；README/部署 → T6。

**型別一致性：** `CourseAInput`、`ApplicationSummary`、`DuplicateApplicationError.existingId`、`MAX_COURSES_A` 在 T1 定義、T3 使用；`ReceiveResult.kind` 四種在 T1 定義、T5 `ScanOutcome` 對應；`getCurrentStudent` 回 `Student | null` 在 T2 定義、T3 與 layout 使用；欄位名 `courseA[i][field]` 在 T3 `CourseARows` 與 `actions.ts` 一致。

**已知取捨：** T1 結束 `tsc` 失敗屬預期（T2 Step 6 修復）；session cookie 未簽章（demo）；`layout.tsx` 讀 cookie 使整站 dynamic。
