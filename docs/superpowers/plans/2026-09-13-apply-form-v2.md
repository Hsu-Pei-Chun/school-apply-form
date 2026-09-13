# 課程申請表系統 v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 v1 雛型改成清大 X-Class 申請表結構（一般課程 A + X-Class 課程 B）、套用 spec §10 的 UI 設計原則，並可一鍵部署到 Railway。

**Architecture:** 資料層先改（schema v2 + migration 重產 + `lib/courses.ts` 取代 `lib/subjects.ts`），再機械式更新 `app/` 讓 build 恢復綠燈；接著引入 Tailwind v4 + CSS token + `components/` 基礎元件，逐頁重做視覺；最後加 Dockerfile（Next standalone）與 Railway 部署說明。

**Tech Stack:** Next.js 15.5 (App Router), React 19, Tailwind CSS v4, better-sqlite3 + drizzle-orm 0.45 + drizzle-kit, bwip-js, Vitest, Docker

**Spec:** `docs/superpowers/specs/2026-09-13-apply-form-design.md`（v2）

## Global Constraints

- Node 22（mise）；`npm` 為套件管理
- 資料庫 SQLite；正式檔案 `data/app.db`（可由 `DATABASE_PATH` 覆寫），測試用 `:memory:`
- **v1 → v2 為破壞性 schema 變更**：刪除 `drizzle/` 重新 `drizzle-kit generate` 產 `0000_*`；`data/app.db` 需刪除重 seed（假資料無保留價值）
- 流水號格式 `A` + 6 位數字，自 `A000001` 起
- `applications.status` 只有 `'printed' | 'received'`（DB CHECK）
- 主檔 students / courses 不物理刪除，用 `is_active`
- A ≠ B（server 端驗證，錯誤訊息「一般課程與 X-Class 課程不可相同」）
- 錯誤訊息逐字：`查無此學號`、`課程不存在或已停用`、`課程代碼已存在`
- UI token 依 spec §10 表格，只在 `app/globals.css` 定義一次；元件不得出現 raw hex
- 字型：UI `"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif`；列印 `"Noto Serif TC", "PMingLiU", serif`；**不用 `next/font/google`**
- 圖示只用 inline SVG，不用 emoji；互動元素最小高度 44px；每個 input 有 `<label htmlFor>`；錯誤訊息 `role="alert"`
- 動效只用 CSS transition 150–200ms；尊重 `prefers-reduced-motion`
- 所有 UI 文案繁體中文
- Commit message 說明「為什麼」；不得用 `--no-verify`；`data/`、`.next/`、`.superpowers/` 不進 git
- 每個 Task 結束時 `npm test` 必須通過；Task 2 起 `npx tsc --noEmit` 與 `npm run build` 也必須通過（Task 1 允許 `app/` 暫時無法編譯）

---

## File Structure

```
app/
  globals.css                 Tailwind v4 import + @theme token + 字型 + reduced-motion
  layout.tsx                  導覽列 + 內容容器
  page.tsx                    首頁：三張入口卡片
  apply/page.tsx
  apply/ApplyForm.tsx         學號查詢 + A/B 下拉 + 修課狀態
  apply/actions.ts
  apply/[id]/page.tsx         清大格式申請表
  apply/[id]/print.css
  apply/[id]/PrintToolbar.tsx 列印 / 返回（client）
  admin/courses/page.tsx      （v1 admin/subjects 刪除）
  admin/courses/actions.ts
  admin/courses/AddCourseForm.tsx
  admin/scan/page.tsx
  admin/scan/ScanForm.tsx     大字輸入 + 結果卡片 + 最近 5 筆
  admin/scan/actions.ts
components/
  Nav.tsx                     頂部導覽列（server）
  Button.tsx                  variant: primary | secondary | danger
  Field.tsx                   label + input/select + hint/error 包裝
  Badge.tsx                   tone: success | neutral | warning | danger
  Card.tsx
  icons.tsx                   4 個 Heroicons outline SVG（printer, arrow-left, check, x）
lib/
  db/schema.ts                v2
  db/client.ts                不變
  courses.ts                  取代 subjects.ts
  students.ts                 欄位改 department
  applications.ts             A/B
  barcode.ts / format.ts      不變
drizzle/                      重產
scripts/seed.ts               v2 資料
tests/
  courses.test.ts             取代 subjects.test.ts
  students.test.ts / applications.test.ts / db.test.ts 更新
Dockerfile, .dockerignore, railway.toml, README.md
```

---

### Task 1: 資料層 v2（schema、migration、courses、applications、seed）

**Files:**
- Modify: `lib/db/schema.ts`
- Delete: `drizzle/`（整個目錄，之後重產）、`lib/subjects.ts`、`tests/subjects.test.ts`
- Create: `lib/courses.ts`、`tests/courses.test.ts`
- Modify: `lib/students.ts`（無需改程式，型別自動跟隨；確認即可）、`lib/applications.ts`、`scripts/seed.ts`
- Modify: `tests/students.test.ts`、`tests/applications.test.ts`、`tests/db.test.ts`

**Interfaces:**
- Produces:
  - `schema.students` 欄位 `id, name, department, isActive`；`schema.courses` 欄位 `code, name, teacher, isActive, createdAt`；`schema.applications` 欄位 `id, studentId, courseACode, courseAStatus, courseBCode, status, createdAt, receivedAt`；型別 `Student`, `Course`, `Application`
  - `listCourses(db): Course[]`、`listActiveCourses(db): Course[]`、`createCourse(db, {code, name, teacher}): Course`（重複 throw `Error('課程代碼已存在')`）、`setCourseActive(db, code, boolean)`
  - `createApplication(db, {studentId, courseACode, courseAStatus, courseBCode}): Application`
  - `ApplicationDetail = Application & { studentName, department, courseAName, courseBName, courseBTeacher }`
  - `getApplication`、`receiveApplication`、`ReceiveResult` 簽名不變

- [ ] **Step 1: 改 schema**

`lib/db/schema.ts` 全檔替換：
```ts
import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  department: text('department').notNull(),
  isActive: integer('is_active').notNull().default(1),
});

export const courses = sqliteTable('courses', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  teacher: text('teacher').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull(),
});

export const applications = sqliteTable(
  'applications',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id').notNull().references(() => students.id),
    courseACode: text('course_a_code').notNull().references(() => courses.code),
    courseAStatus: text('course_a_status').notNull(),
    courseBCode: text('course_b_code').notNull().references(() => courses.code),
    status: text('status', { enum: ['printed', 'received'] }).notNull().default('printed'),
    createdAt: text('created_at').notNull(),
    receivedAt: text('received_at'),
  },
  (t) => [check('applications_status_check', sql`${t.status} IN ('printed', 'received')`)]
);

export type Student = typeof students.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Application = typeof applications.$inferSelect;
```

- [ ] **Step 2: 重產 migration**

```bash
rm -rf drizzle data
npx drizzle-kit generate
ls drizzle   # 應只有一個 0000_*.sql 與 meta/
grep -c "CREATE TABLE" drizzle/0000_*.sql   # 應為 3
```

- [ ] **Step 3: 寫 courses 失敗測試**

刪除 `lib/subjects.ts`、`tests/subjects.test.ts`。建立 `tests/courses.test.ts`：
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { createCourse, listCourses, listActiveCourses, setCourseActive } from '@/lib/courses';

let db: Db;
beforeEach(() => { db = createDb(':memory:'); });

describe('courses', () => {
  it('新增後可列出，含教師', () => {
    const c = createCourse(db, { code: 'C001', name: '微積分', teacher: '王教授' });
    expect(c.isActive).toBe(1);
    expect(c.teacher).toBe('王教授');
    expect(listCourses(db).map(x => x.code)).toEqual(['C001']);
  });

  it('代碼重複拋錯', () => {
    createCourse(db, { code: 'C001', name: '微積分', teacher: '王教授' });
    expect(() => createCourse(db, { code: 'C001', name: '線代', teacher: '李教授' })).toThrow('課程代碼已存在');
  });

  it('停用後不在 active 清單但仍在完整清單', () => {
    createCourse(db, { code: 'C001', name: '微積分', teacher: '王教授' });
    createCourse(db, { code: 'C002', name: '線代', teacher: '李教授' });
    setCourseActive(db, 'C001', false);
    expect(listActiveCourses(db).map(x => x.code)).toEqual(['C002']);
    expect(listCourses(db).map(x => x.code)).toEqual(['C001', 'C002']);
  });
});
```

- [ ] **Step 4: 執行確認失敗**

Run: `npm test -- tests/courses.test.ts`
Expected: FAIL，找不到 `@/lib/courses`

- [ ] **Step 5: 實作 courses.ts**

`lib/courses.ts`：
```ts
import { asc, eq } from 'drizzle-orm';
import { Db } from './db/client';
import { courses, Course } from './db/schema';

export function listCourses(db: Db): Course[] {
  return db.select().from(courses).orderBy(asc(courses.code)).all();
}

export function listActiveCourses(db: Db): Course[] {
  return db.select().from(courses).where(eq(courses.isActive, 1)).orderBy(asc(courses.code)).all();
}

export function createCourse(db: Db, input: { code: string; name: string; teacher: string }): Course {
  const exists = db.select().from(courses).where(eq(courses.code, input.code)).get();
  if (exists) throw new Error('課程代碼已存在');
  const row: Course = { ...input, isActive: 1, createdAt: new Date().toISOString() };
  db.insert(courses).values(row).run();
  return row;
}

export function setCourseActive(db: Db, code: string, isActive: boolean): void {
  db.update(courses).set({ isActive: isActive ? 1 : 0 }).where(eq(courses.code, code)).run();
}
```

- [ ] **Step 6: 更新 students / db 測試**

`tests/students.test.ts` 的 `beforeEach` 插入改為 `{ id: 'S0001', name: '王小明', department: '資工系 二年級' }`。
`tests/db.test.ts`：把 `subjects` import 改 `courses`；CHECK 測試中的 insert 改為插入 `students`（含 `department`）、`courses`（含 `teacher`），再插入 `applications` 時提供 `courseACode: 'C001', courseAStatus: '已選上', courseBCode: 'C001'`（此測試只驗 CHECK，A=B 在 DB 層不擋）。

- [ ] **Step 7: 寫 applications 失敗測試**

`tests/applications.test.ts` 全檔替換：
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { students } from '@/lib/db/schema';
import { createCourse, setCourseActive } from '@/lib/courses';
import { createApplication, getApplication, receiveApplication, nextApplicationId } from '@/lib/applications';

let db: Db;
const input = { studentId: 'S0001', courseACode: 'C001', courseAStatus: '已選上', courseBCode: 'C002' };

beforeEach(() => {
  db = createDb(':memory:');
  db.insert(students).values({ id: 'S0001', name: '王小明', department: '資工系 二年級' }).run();
  createCourse(db, { code: 'C001', name: '微積分', teacher: '王教授' });
  createCourse(db, { code: 'C002', name: 'X-Class 線代', teacher: '李教授' });
});

describe('nextApplicationId', () => {
  it('空表從 A000001 起', () => {
    expect(nextApplicationId(db)).toBe('A000001');
  });
  it('遞增', () => {
    createApplication(db, input);
    createApplication(db, input);
    expect(nextApplicationId(db)).toBe('A000003');
  });
});

describe('createApplication', () => {
  it('成功建立，狀態 printed', () => {
    const a = createApplication(db, input);
    expect(a.id).toBe('A000001');
    expect(a.status).toBe('printed');
    expect(a.courseAStatus).toBe('已選上');
    expect(a.receivedAt).toBeNull();
  });
  it('學號不存在拋錯', () => {
    expect(() => createApplication(db, { ...input, studentId: 'S9999' })).toThrow('查無此學號');
  });
  it('A 課程停用拋錯', () => {
    setCourseActive(db, 'C001', false);
    expect(() => createApplication(db, input)).toThrow('課程不存在或已停用');
  });
  it('B 課程不存在拋錯', () => {
    expect(() => createApplication(db, { ...input, courseBCode: 'C999' })).toThrow('課程不存在或已停用');
  });
  it('A 與 B 相同拋錯', () => {
    expect(() => createApplication(db, { ...input, courseBCode: 'C001' })).toThrow('一般課程與 X-Class 課程不可相同');
  });
});

describe('getApplication', () => {
  it('回傳含學生、A、B 課程資訊的明細', () => {
    createApplication(db, input);
    const d = getApplication(db, 'A000001');
    expect(d?.studentName).toBe('王小明');
    expect(d?.department).toBe('資工系 二年級');
    expect(d?.courseAName).toBe('微積分');
    expect(d?.courseBName).toBe('X-Class 線代');
    expect(d?.courseBTeacher).toBe('李教授');
  });
  it('不存在回傳 undefined', () => {
    expect(getApplication(db, 'A999999')).toBeUndefined();
  });
});

describe('receiveApplication', () => {
  it('printed → received 並寫入 receivedAt', () => {
    createApplication(db, input);
    const r = receiveApplication(db, 'A000001');
    expect(r.kind).toBe('received');
    if (r.kind === 'received') {
      expect(r.detail.status).toBe('received');
      expect(r.detail.receivedAt).not.toBeNull();
    }
  });
  it('重複掃描回 already 且不覆寫 receivedAt', () => {
    createApplication(db, input);
    const first = receiveApplication(db, 'A000001');
    const second = receiveApplication(db, 'A000001');
    expect(second.kind).toBe('already');
    if (first.kind === 'received' && second.kind === 'already') {
      expect(second.detail.receivedAt).toBe(first.detail.receivedAt);
    }
  });
  it('無效流水號回 not_found', () => {
    expect(receiveApplication(db, 'XYZ').kind).toBe('not_found');
  });
});
```

- [ ] **Step 8: 執行確認失敗**

Run: `npm test -- tests/applications.test.ts`
Expected: FAIL（型別 / 欄位不符）

- [ ] **Step 9: 實作 applications.ts**

`lib/applications.ts` 全檔替換：
```ts
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
```

- [ ] **Step 10: 更新 seed**

`scripts/seed.ts` 全檔替換：
```ts
import { createDb } from '../lib/db/client';
import { students, courses, applications } from '../lib/db/schema';
import { createCourse } from '../lib/courses';

const SURNAMES = ['王', '李', '張', '劉', '陳', '楊', '黃', '趙', '吳', '周', '林', '徐', '許', '蔡', '鄭'];
const GIVEN = ['小明', '小華', '雅婷', '志偉', '淑芬', '俊傑', '怡君', '家豪', '佩珊', '冠宇', '心怡', '宗翰', '欣妤', '柏翰', '思穎'];
const DEPARTMENTS = ['資工系', '電機系', '數學系', '物理系', '化學系', '經濟系', '中文系', '外語系', '生科系', '材料系'];
const GRADES = ['一年級', '二年級', '三年級', '四年級'];
const COURSE_BASES = ['微積分', '普通物理', '計算機概論', '線性代數', '普通化學', '經濟學原理', '英文寫作', '資料結構', '統計學', '生命科學導論'];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

const db = createDb(process.env.DATABASE_PATH ?? 'data/app.db');

db.delete(applications).run();
db.delete(courses).run();
db.delete(students).run();

const studentRows = Array.from({ length: 2000 }, (_, i) => {
  const n = i + 1;
  return {
    id: 'S' + String(n).padStart(4, '0'),
    name: pick(SURNAMES, n * 7) + pick(GIVEN, n * 13),
    department: `${pick(DEPARTMENTS, Math.floor(i / 200))} ${pick(GRADES, Math.floor(i / 50))}`,
    isActive: 1,
  };
});
for (let i = 0; i < studentRows.length; i += 500) {
  db.insert(students).values(studentRows.slice(i, i + 500)).run();
}

for (let i = 1; i <= 100; i++) {
  createCourse(db, {
    code: 'C' + String(i).padStart(3, '0'),
    name: `${pick(COURSE_BASES, i - 1)}${Math.ceil(i / 10)}`,
    teacher: `${pick(SURNAMES, i * 3)}教授`,
  });
}

console.log('seed 完成：2000 學生、100 課程');
```

- [ ] **Step 11: 執行全部測試與 seed**

Run: `npm test && npm run seed`
Expected: 測試全 PASS（`app/` 尚未更新，`npx tsc --noEmit` 會失敗，屬預期，Task 2 修復）；seed 印出 `seed 完成：2000 學生、100 課程`

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "資料層改為 A+B 兩門課結構，對齊清大 X-Class 申請表；假資料無保留價值故直接重產 migration"
```

---

### Task 2: 機械式更新 app/ 恢復 build（無視覺變更）

**Files:**
- Modify: `app/apply/actions.ts`、`app/apply/page.tsx`、`app/apply/ApplyForm.tsx`、`app/apply/[id]/page.tsx`
- Delete: `app/admin/subjects/`（整個目錄）
- Create: `app/admin/courses/page.tsx`、`app/admin/courses/actions.ts`、`app/admin/courses/AddCourseForm.tsx`
- Modify: `app/admin/scan/actions.ts`、`app/admin/scan/ScanForm.tsx`、`app/page.tsx`

**Interfaces:**
- Consumes: Task 1 全部
- Produces: `submitApplication(formData)` 讀 `studentId, courseACode, courseAStatus, courseBCode`；`ScanOutcome` 的 detail 欄位改為 `studentId, studentName, courseACode, courseBCode, courseBName, receivedAt`

- [ ] **Step 1: apply/actions.ts**

```ts
'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { findStudent } from '@/lib/students';
import { createApplication } from '@/lib/applications';

export async function lookupStudent(studentId: string) {
  const s = findStudent(getDb(), studentId.trim());
  return s ? { name: s.name, department: s.department } : null;
}

export async function submitApplication(formData: FormData): Promise<{ error: string } | void> {
  const input = {
    studentId: String(formData.get('studentId') ?? '').trim(),
    courseACode: String(formData.get('courseACode') ?? ''),
    courseAStatus: String(formData.get('courseAStatus') ?? '').trim() || '已選上',
    courseBCode: String(formData.get('courseBCode') ?? ''),
  };
  let id: string;
  try {
    id = createApplication(getDb(), input).id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/apply/${id}`);
}
```

- [ ] **Step 2: apply/page.tsx 與 ApplyForm.tsx（功能版，Task 4 再重做視覺）**

`app/apply/page.tsx`：`listActiveSubjects` → `listActiveCourses`（from `@/lib/courses`），傳入 `courses={courses.map(c => ({ code: c.code, name: c.name, teacher: c.teacher }))}`。

`app/apply/ApplyForm.tsx`：
```tsx
'use client';

import { useState } from 'react';
import { lookupStudent, submitApplication } from './actions';

type CourseOption = { code: string; name: string; teacher: string };
type Props = { courses: CourseOption[] };

export default function ApplyForm({ courses }: Props) {
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState<{ name: string; department: string } | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [courseA, setCourseA] = useState('');
  const [submitError, setSubmitError] = useState('');

  async function onBlur() {
    if (!studentId.trim()) return;
    const s = await lookupStudent(studentId);
    setStudent(s);
    setLookupError(s ? '' : '查無此學號');
  }

  async function onSubmit(formData: FormData) {
    setSubmitError('');
    const r = await submitApplication(formData);
    if (r?.error) setSubmitError(r.error);
  }

  return (
    <form action={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <label htmlFor="studentId">學號</label>
      <input id="studentId" name="studentId" value={studentId} onChange={e => setStudentId(e.target.value)} onBlur={onBlur} required />
      {student && <p>{student.department} {student.name}</p>}
      {lookupError && <p role="alert" style={{ color: 'red' }}>{lookupError}</p>}

      <label htmlFor="courseACode">一般課程 A</label>
      <select id="courseACode" name="courseACode" required value={courseA} onChange={e => setCourseA(e.target.value)}>
        <option value="" disabled>請選擇</option>
        {courses.map(c => <option key={c.code} value={c.code}>{c.code} {c.name}</option>)}
      </select>

      <label htmlFor="courseAStatus">A 課程修課狀態</label>
      <input id="courseAStatus" name="courseAStatus" defaultValue="已選上" />

      <label htmlFor="courseBCode">X-Class 課程 B</label>
      <select id="courseBCode" name="courseBCode" required defaultValue="">
        <option value="" disabled>請選擇</option>
        {courses.filter(c => c.code !== courseA).map(c => (
          <option key={c.code} value={c.code}>{c.code} {c.name}（{c.teacher}）</option>
        ))}
      </select>

      {submitError && <p role="alert" style={{ color: 'red' }}>{submitError}</p>}
      <button type="submit" disabled={!student}>產生申請表</button>
    </form>
  );
}
```

- [ ] **Step 3: apply/[id]/page.tsx（功能版）**

表格列改為：學號、姓名、系級（`a.department`）、一般課程 A（`a.courseACode} {a.courseAName}`）、A 修課狀態（`a.courseAStatus`）、X-Class 課程 B（`{a.courseBCode} {a.courseBName}`）、B 授課教師（`a.courseBTeacher`）、申請日期。條碼下方人類可讀文字改為 `{a.id}　{a.studentId}　{a.courseBCode}`。其餘不動。

- [ ] **Step 4: admin/courses（由 admin/subjects 改名 + 加 teacher）**

`git mv app/admin/subjects app/admin/courses`，然後：

`app/admin/courses/actions.ts`：
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { createCourse, setCourseActive } from '@/lib/courses';

export async function addCourse(formData: FormData): Promise<{ error: string } | void> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const teacher = String(formData.get('teacher') ?? '').trim();
  if (!code || !name || !teacher) return { error: '代碼、名稱、授課教師皆必填' };
  try {
    createCourse(getDb(), { code, name, teacher });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/admin/courses');
}

export async function toggleCourse(formData: FormData) {
  const code = String(formData.get('code'));
  const isActive = formData.get('isActive') === '1';
  setCourseActive(getDb(), code, !isActive);
  revalidatePath('/admin/courses');
}
```

`AddSubjectForm.tsx` → `git mv` 為 `AddCourseForm.tsx`，內容：import `addCourse`，表單加第三個欄位 `<label htmlFor="teacher">授課教師</label><input id="teacher" name="teacher" required />`，並為原本兩個 input 加 `id` + `htmlFor`。

`page.tsx`：`listSubjects` → `listCourses`，`toggleSubject` → `toggleCourse`，標題「課程管理」，表格加「教師」欄（`s.teacher`）。

- [ ] **Step 5: admin/scan**

`app/admin/scan/actions.ts` 的 `ScanOutcome` 與回傳改為：
```ts
export type ScanOutcome =
  | { kind: 'received' | 'already'; id: string; studentId: string; studentName: string; courseACode: string; courseBCode: string; courseBName: string; receivedAt: string }
  | { kind: 'not_found'; id: string };
```
回傳物件對應 `d.courseACode, d.courseBCode, d.courseBName`。

`ScanForm.tsx` 結果列改為 `{outcome.id}　{outcome.studentId} {outcome.studentName}　A:{outcome.courseACode}　B:{outcome.courseBCode} {outcome.courseBName}`。

- [ ] **Step 6: 首頁與 layout**

`app/page.tsx` 連結改為 `/admin/courses`「課程管理」。`app/layout.tsx` 的 `metadata.title` 改「課程申請表系統」。

- [ ] **Step 7: 驗證**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 全過。再以 `npm run dev -- -p 3100` 背景啟動，curl `/apply`、`/admin/courses`、`/admin/scan` 皆 200；用 `npx tsx -e` 建一筆申請後 curl `/apply/A000001` 含 `<svg` 與「X-Class」；結束後 **只 kill 自己啟動的那個 PID**（記下 `$!`，不要 `pkill -f`）。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "app 層跟上 A+B 資料模型，讓 build 恢復可用；視覺留待後續任務"
```

---

### Task 3: Tailwind v4、design token、基礎元件、導覽列

**Files:**
- Create: `postcss.config.mjs`、`components/Nav.tsx`、`components/Button.tsx`、`components/Field.tsx`、`components/Badge.tsx`、`components/Card.tsx`、`components/icons.tsx`
- Modify: `app/globals.css`（全檔替換）、`app/layout.tsx`、`app/page.tsx`
- Test: `tests/components.test.tsx`（用 `react-dom/server` 的 `renderToStaticMarkup` 驗證 class / 屬性）

**Interfaces:**
- Produces:
  - `<Button variant="primary"|"secondary"|"danger" loading?: boolean {...button props}>`
  - `<Field label id hint? error? >{input or select}</Field>`：渲染 `<label htmlFor={id}>`、children、`hint` 為 `<p class="text-muted">`、`error` 為 `<p role="alert" class="text-danger">`（有 error 時不顯示 hint）
  - `<Badge tone="success"|"neutral"|"warning"|"danger">text</Badge>`
  - `<Card className?>children</Card>`
  - `icons.tsx` 匯出 `PrinterIcon`, `ArrowLeftIcon`, `CheckIcon`, `XIcon`（各接受 `className`，`aria-hidden`）
  - CSS 類別：`.input`（input/select 共用樣式）、`.container-narrow`（max-w 720px 置中）

- [ ] **Step 1: 安裝 Tailwind v4**

```bash
npm install -D tailwindcss @tailwindcss/postcss postcss
```
`postcss.config.mjs`：
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

- [ ] **Step 2: globals.css**

```css
@import "tailwindcss";

@theme {
  --color-primary: #1E3A5F;
  --color-primary-hover: #16304F;
  --color-secondary: #2563EB;
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-foreground: #0F172A;
  --color-muted-fg: #475569;
  --color-border: #CBD5E1;
  --color-success: #15803D;
  --color-success-bg: #DCFCE7;
  --color-warning: #A16207;
  --color-warning-bg: #FEF9C3;
  --color-danger: #DC2626;
  --color-danger-bg: #FEE2E2;
  --radius-card: 8px;
  --font-sans: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif;
  --font-serif: "Noto Serif TC", "PMingLiU", serif;
}

html { color-scheme: light; }
body {
  @apply bg-background text-foreground font-sans antialiased;
  font-size: 16px;
  line-height: 1.5;
}

.container-narrow { @apply mx-auto w-full max-w-[720px] px-4 py-6 sm:py-8; }

.input {
  @apply block w-full min-h-11 rounded-[var(--radius-card)] border border-border bg-surface px-3 text-base
         transition-[border-color,box-shadow] duration-150
         focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0ms !important; animation-duration: 0ms !important; }
}
```

- [ ] **Step 3: 元件測試（先寫）**

`tests/components.test.tsx`：
```tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Button from '@/components/Button';
import Field from '@/components/Field';
import Badge from '@/components/Badge';

describe('Button', () => {
  it('primary 帶主色 class 且最小高度 44px', () => {
    const html = renderToStaticMarkup(<Button variant="primary">送出</Button>);
    expect(html).toContain('bg-primary');
    expect(html).toContain('min-h-11');
  });
  it('loading 時 disabled 並顯示 aria-busy', () => {
    const html = renderToStaticMarkup(<Button variant="primary" loading>送出</Button>);
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
  });
});

describe('Field', () => {
  it('label 綁定 id，error 用 role=alert 且取代 hint', () => {
    const html = renderToStaticMarkup(
      <Field id="sid" label="學號" hint="例：S0001" error="查無此學號"><input id="sid" /></Field>
    );
    expect(html).toContain('for="sid"');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('例：S0001');
  });
  it('無 error 時顯示 hint', () => {
    const html = renderToStaticMarkup(<Field id="sid" label="學號" hint="例：S0001"><input id="sid" /></Field>);
    expect(html).toContain('例：S0001');
  });
});

describe('Badge', () => {
  it('success 使用 success token', () => {
    expect(renderToStaticMarkup(<Badge tone="success">啟用</Badge>)).toContain('bg-success-bg');
  });
});
```
`vitest.config.ts` 的 `include` 改為 `['tests/**/*.test.{ts,tsx}']`，並確認 `tsconfig.json` 的 `jsx` 為 `preserve`（Next 預設）— vitest 需要 esbuild 處理 tsx，加 `esbuild: { jsx: 'automatic' }` 到 vitest config。

- [ ] **Step 4: 執行確認失敗**

Run: `npm test -- tests/components.test.tsx`
Expected: FAIL，找不到 `@/components/Button`

- [ ] **Step 5: 實作元件**

`components/Button.tsx`：
```tsx
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean };

const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-foreground hover:bg-background',
  danger: 'border border-danger text-danger bg-surface hover:bg-danger-bg',
};

export default function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-card)] px-4 font-medium
        transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
        disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}
```

`components/Field.tsx`：
```tsx
import type { ReactNode } from 'react';

type Props = { id: string; label: string; hint?: string; error?: string; children: ReactNode };

export default function Field({ id, label, hint, error, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted-fg">{hint}</p>
      ) : null}
    </div>
  );
}
```

`components/Badge.tsx`：
```tsx
type Tone = 'success' | 'neutral' | 'warning' | 'danger';
const TONE: Record<Tone, string> = {
  success: 'bg-success-bg text-success',
  neutral: 'bg-border/50 text-muted-fg',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
};
export default function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[tone]}`}>{children}</span>;
}
```

`components/Card.tsx`：
```tsx
export default function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-[var(--radius-card)] border border-border bg-surface p-6 ${className}`}>{children}</div>;
}
```

`components/icons.tsx`（Heroicons outline，24px，`stroke-width 1.5`）：
```tsx
type P = { className?: string };
const base = { fill: 'none', viewBox: '0 0 24 24', strokeWidth: 1.5, stroke: 'currentColor', 'aria-hidden': true } as const;

export const PrinterIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
);
export const ArrowLeftIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
);
export const CheckIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
);
export const XIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
);
```

`components/Nav.tsx`（server component；用 `usePathname` 需 client，改為由 layout 傳入無法取得路徑，故 Nav 做成 client component 用 `usePathname` 高亮）：
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/apply', label: '學生申請' },
  { href: '/admin/courses', label: '課程管理' },
  { href: '/admin/scan', label: '掃描收件' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="bg-primary text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-wide">國立○○大學 課程申請表系統</Link>
        <nav aria-label="主選單" className="flex gap-1">
          {LINKS.map(l => {
            const active = pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-[var(--radius-card)] px-3 py-2 text-sm transition-colors duration-150 hover:bg-white/10 ${active ? 'bg-white/15 font-medium' : ''}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
```

`app/layout.tsx`：body 內改為 `<Nav /><main className="container-narrow">{children}</main>`。

`app/page.tsx`：三張 `Card`（各一個 `Link` 包整張卡，標題 + 一行說明），grid `sm:grid-cols-3`。

- [ ] **Step 6: 驗證**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 全過。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "引入 Tailwind 與 design token，把顏色、字型、元件規則集中定義以免各頁各自為政"
```

---

### Task 4: `/apply` 與 `/apply/[id]` 視覺重做

**Files:**
- Modify: `app/apply/page.tsx`、`app/apply/ApplyForm.tsx`、`app/apply/[id]/page.tsx`、`app/apply/[id]/print.css`
- Create: `app/apply/[id]/PrintToolbar.tsx`
- Delete: `app/apply/[id]/PrintButton.tsx`

**Interfaces:**
- Consumes: Task 3 元件；`lookupStudent`、`submitApplication`（Task 2）；`getApplication`、`renderCode128Svg`

- [ ] **Step 1: ApplyForm.tsx 視覺版**

```tsx
'use client';

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { CheckIcon } from '@/components/icons';
import { lookupStudent, submitApplication } from './actions';

type CourseOption = { code: string; name: string; teacher: string };

export default function ApplyForm({ courses }: { courses: CourseOption[] }) {
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState<{ name: string; department: string } | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [courseA, setCourseA] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [pending, startTransition] = useTransition();

  async function onBlur() {
    if (!studentId.trim()) return;
    const s = await lookupStudent(studentId);
    setStudent(s);
    setLookupError(s ? '' : '查無此學號');
  }

  function onSubmit(formData: FormData) {
    setSubmitError('');
    startTransition(async () => {
      const r = await submitApplication(formData);
      if (r?.error) setSubmitError(r.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <Field id="studentId" label="學號" hint="例：S0001，輸入後離開欄位會自動帶出姓名" error={lookupError}>
        <input id="studentId" name="studentId" className="input" value={studentId}
          onChange={e => { setStudentId(e.target.value); setStudent(null); }} onBlur={onBlur} required autoComplete="off" />
      </Field>
      {student && (
        <p className="-mt-3 flex items-center gap-1.5 text-sm text-success">
          <CheckIcon className="size-4" /> {student.department}　{student.name}
        </p>
      )}

      <Field id="courseACode" label="一般課程 A" hint="你目前已選的正規課程">
        <select id="courseACode" name="courseACode" className="input" required value={courseA} onChange={e => setCourseA(e.target.value)}>
          <option value="" disabled>請選擇</option>
          {courses.map(c => <option key={c.code} value={c.code}>{c.code}　{c.name}</option>)}
        </select>
      </Field>

      <Field id="courseAStatus" label="A 課程修課狀態" hint="例：已選上、加簽中">
        <input id="courseAStatus" name="courseAStatus" className="input" defaultValue="已選上" />
      </Field>

      <Field id="courseBCode" label="X-Class 課程 B" hint="欲申請的 X-Class 課程，需事先與授課教師確認">
        <select id="courseBCode" name="courseBCode" className="input" required defaultValue="">
          <option value="" disabled>請選擇</option>
          {courses.filter(c => c.code !== courseA).map(c => (
            <option key={c.code} value={c.code}>{c.code}　{c.name}（{c.teacher}）</option>
          ))}
        </select>
      </Field>

      {submitError && <p role="alert" className="rounded-[var(--radius-card)] bg-danger-bg px-3 py-2 text-sm text-danger">{submitError}</p>}
      <Button type="submit" variant="primary" loading={pending} disabled={!student}>產生申請表</Button>
    </form>
  );
}
```

`app/apply/page.tsx`：
```tsx
import Card from '@/components/Card';
import { getDb } from '@/lib/db/client';
import { listActiveCourses } from '@/lib/courses';
import ApplyForm from './ApplyForm';

export const dynamic = 'force-dynamic';

export default function ApplyPage() {
  const courses = listActiveCourses(getDb()).map(c => ({ code: c.code, name: c.name, teacher: c.teacher }));
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">X-Class 課程修課申請</h1>
      <p className="mb-6 text-muted-fg">填寫後系統會產生一張含條碼的申請表，請列印、完成簽章後送交課務組。</p>
      <Card><ApplyForm courses={courses} /></Card>
    </>
  );
}
```

- [ ] **Step 2: PrintToolbar.tsx**

```tsx
'use client';

import Link from 'next/link';
import Button from '@/components/Button';
import { PrinterIcon, ArrowLeftIcon } from '@/components/icons';

export default function PrintToolbar() {
  return (
    <div className="no-print mb-4 flex items-center justify-between gap-2">
      <Link href="/apply" className="inline-flex items-center gap-1 text-sm text-secondary hover:underline">
        <ArrowLeftIcon className="size-4" /> 回申請頁
      </Link>
      <Button variant="primary" onClick={() => window.print()}><PrinterIcon /> 列印申請表</Button>
    </div>
  );
}
```

- [ ] **Step 3: 列印頁（清大格式）**

`app/apply/[id]/page.tsx`：
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
  const svg = renderCode128Svg(a.id);

  return (
    <div className="print-wrap">
      <PrintToolbar />
      <article className="sheet">
        <header className="sheet-head">
          <h1>國立○○大學　X-Class 課程修課申請表</h1>
          <p>NTHU X-Class Application Form　　115 學年度上學期</p>
        </header>

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
          <table>
            <tbody>
              <tr><th>課程代碼</th><td>{a.courseACode}</td><th>修課狀態</th><td>{a.courseAStatus}</td></tr>
              <tr><th>課程名稱</th><td colSpan={3}>{a.courseAName}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>三、X-Class 課程（Course B）</h2>
          <table>
            <tbody>
              <tr><th>課程代碼</th><td>{a.courseBCode}</td><th>授課教師</th><td>{a.courseBTeacher}</td></tr>
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
          <div className="barcode">
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="human">{a.id}　{a.studentId}　{a.courseBCode}</div>
          </div>
        </footer>
      </article>
    </div>
  );
}
```

`app/apply/[id]/print.css` 全檔替換：
```css
@page { size: A4; margin: 15mm; }

.print-wrap { max-width: 210mm; margin: 0 auto; }

.sheet {
  font-family: var(--font-serif);
  background: #fff; color: #000; color-scheme: light;
  width: 100%; min-height: 297mm; padding: 15mm;
  box-shadow: 0 4px 24px rgb(15 23 42 / 0.12);
  border: 1px solid var(--color-border);
  font-size: 12pt; line-height: 1.6;
}
.sheet-head { text-align: center; margin-bottom: 8mm; }
.sheet-head h1 { font-size: 18pt; font-weight: 700; letter-spacing: 0.05em; }
.sheet-head p { font-size: 10pt; color: #333; }
.sheet section { margin-bottom: 5mm; }
.sheet h2 { font-size: 12pt; font-weight: 700; margin-bottom: 2mm; }
.sheet table { width: 100%; border-collapse: collapse; }
.sheet th, .sheet td { border: 1px solid #000; padding: 2mm 3mm; text-align: left; vertical-align: middle; }
.sheet th { width: 22%; background: #f1f5f9; font-weight: 600; }
.terms { padding-left: 6mm; font-size: 11pt; }
.terms li { margin-bottom: 1mm; }
.signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6mm; margin-top: 8mm; }
.signatures span { display: block; font-size: 10pt; margin-bottom: 8mm; }
.signatures .line { border-bottom: 1px solid #000; min-height: 8mm; padding-bottom: 1mm; }
.sheet-foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; margin-top: 10mm; }
.note { font-size: 10pt; color: #333; max-width: 60%; }
.barcode { text-align: center; }
.barcode svg { width: 55mm; height: auto; }
.barcode .human { font-family: ui-monospace, monospace; font-size: 10pt; margin-top: 1mm; letter-spacing: 0.05em; }

@media print {
  .no-print, header, nav { display: none !important; }
  body, main { background: #fff !important; padding: 0 !important; margin: 0 !important; max-width: none !important; }
  .print-wrap { max-width: none; }
  .sheet { box-shadow: none; border: 0; padding: 0; min-height: auto; }
}
```

- [ ] **Step 4: 驗證**

Run: `npm test && npx tsc --noEmit && npm run build`；背景 `npm run dev -- -p 3100`，curl `/apply` 含 `X-Class 課程修課申請`、`/apply/A000001`（若無先用 `npx tsx -e` 建）含 `Course A`、`Course B`、`同意事項`、`<svg`。只 kill 自己啟動的 PID。列印預覽列為人工驗證。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "學生申請與列印頁套用設計系統，申請表版型對齊清大 X-Class 格式"
```

---

### Task 5: `/admin/courses` 與 `/admin/scan` 視覺重做

**Files:**
- Modify: `app/admin/courses/page.tsx`、`app/admin/courses/AddCourseForm.tsx`、`app/admin/scan/page.tsx`、`app/admin/scan/ScanForm.tsx`

**Interfaces:**
- Consumes: Task 3 元件；`addCourse`、`toggleCourse`、`scan`、`ScanOutcome`（Task 2）；`formatDate`、`formatDateTime`

- [ ] **Step 1: AddCourseForm.tsx**

```tsx
'use client';

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { addCourse } from './actions';

export default function AddCourseForm() {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError('');
    startTransition(async () => {
      const r = await addCourse(formData);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_2fr_1fr_auto] sm:items-end">
      <Field id="code" label="課程代碼"><input id="code" name="code" className="input" required /></Field>
      <Field id="name" label="課程名稱"><input id="name" name="name" className="input" required /></Field>
      <Field id="teacher" label="授課教師"><input id="teacher" name="teacher" className="input" required /></Field>
      <Button type="submit" variant="primary" loading={pending}>新增</Button>
      {error && <p role="alert" className="text-sm text-danger sm:col-span-4">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: courses/page.tsx**

```tsx
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { getDb } from '@/lib/db/client';
import { listCourses } from '@/lib/courses';
import { formatDate } from '@/lib/format';
import { toggleCourse } from './actions';
import AddCourseForm from './AddCourseForm';

export const dynamic = 'force-dynamic';

export default function CoursesPage() {
  const rows = listCourses(getDb());
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">課程管理</h1>
      <p className="mb-6 text-muted-fg">新增或停用課程。停用的課程不會出現在學生申請頁，但既有申請單仍可查詢。</p>
      <Card className="mb-6"><AddCourseForm /></Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-muted-fg">
            <tr>
              <th className="px-4 py-3 font-semibold">代碼</th>
              <th className="px-4 py-3 font-semibold">名稱</th>
              <th className="px-4 py-3 font-semibold">教師</th>
              <th className="px-4 py-3 font-semibold">狀態</th>
              <th className="px-4 py-3 font-semibold">建立</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.code} className={`border-t border-border even:bg-background/60 ${c.isActive ? '' : 'text-muted-fg'}`}>
                <td className="px-4 py-2 font-mono">{c.code}</td>
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">{c.teacher}</td>
                <td className="px-4 py-2"><Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? '啟用' : '停用'}</Badge></td>
                <td className="px-4 py-2 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-2 text-right">
                  <form action={toggleCourse}>
                    <input type="hidden" name="code" value={c.code} />
                    <input type="hidden" name="isActive" value={c.isActive} />
                    <Button type="submit" variant={c.isActive ? 'danger' : 'secondary'} className="min-h-9 px-3 text-xs">
                      {c.isActive ? '停用' : '啟用'}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
```

- [ ] **Step 3: ScanForm.tsx（大字 + 色塊卡片 + 最近 5 筆）**

```tsx
'use client';

import { useRef, useState } from 'react';
import { CheckIcon, XIcon } from '@/components/icons';
import { formatDateTime } from '@/lib/format';
import { scan, ScanOutcome } from './actions';

type Entry = ScanOutcome & { at: string };

const STYLE: Record<ScanOutcome['kind'], { box: string; title: string }> = {
  received: { box: 'bg-success-bg text-success border-success', title: '收件成功' },
  already: { box: 'bg-warning-bg text-warning border-warning', title: '此申請單已收件' },
  not_found: { box: 'bg-danger-bg text-danger border-danger', title: '查無此流水號' },
};

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
      outcome = { kind: 'not_found', id: value };
    }
    const entry: Entry = { ...outcome, at: new Date().toISOString() };
    setCurrent(entry);
    setHistory(h => [entry, ...h].slice(0, 5));
    el.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit}>
        <label htmlFor="scan" className="mb-2 block text-sm font-medium">掃描條碼或輸入流水號後按 Enter</label>
        <input id="scan" ref={inputRef} autoFocus autoComplete="off" placeholder="A000001"
          className="input text-center font-mono text-2xl tracking-widest" style={{ minHeight: 64 }} />
      </form>

      {current && (
        <div key={current.at} role="status" className={`animate-[fade-in_200ms_ease-out] rounded-[var(--radius-card)] border-2 p-6 ${STYLE[current.kind].box}`}>
          <div className="flex items-center gap-2 text-2xl font-semibold">
            {current.kind === 'received' ? <CheckIcon className="size-7" /> : <XIcon className="size-7" />}
            {STYLE[current.kind].title}
          </div>
          <p className="mt-2 font-mono text-lg">{current.id}</p>
          {current.kind !== 'not_found' && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base text-foreground">
              <dt className="text-muted-fg">學生</dt><dd>{current.studentId}　{current.studentName}</dd>
              <dt className="text-muted-fg">課程 A</dt><dd>{current.courseACode}</dd>
              <dt className="text-muted-fg">課程 B</dt><dd>{current.courseBCode}　{current.courseBName}</dd>
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
                <span className="font-mono">{h.id}</span>
                <span className="flex-1 truncate text-muted-fg">{h.kind !== 'not_found' ? `${h.studentId} ${h.studentName}` : '—'}</span>
                <span className={STYLE[h.kind].box.split(' ')[1]}>{STYLE[h.kind].title}</span>
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
在 `app/globals.css` 末尾加：
```css
@keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
```

`app/admin/scan/page.tsx`：
```tsx
import Card from '@/components/Card';
import ScanForm from './ScanForm';

export default function ScanPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">掃描收件</h1>
      <p className="mb-6 text-muted-fg">游標會停在輸入框，掃描槍掃完會自動送出，不需碰滑鼠。</p>
      <Card><ScanForm /></Card>
    </>
  );
}
```

- [ ] **Step 4: 驗證**

Run: `npm test && npx tsc --noEmit && npm run build`；背景 dev 3100，curl `/admin/courses` 含 `課程管理` 與 `C001`、`/admin/scan` 含 `autofocus`。只 kill 自己啟動的 PID。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "後台兩頁套用設計系統；掃描頁改大字大色塊，配合行政人員離螢幕遠的使用情境"
```

---

### Task 6: Railway 部署（Dockerfile + standalone + 文件）

**Files:**
- Create: `Dockerfile`、`.dockerignore`、`railway.toml`
- Modify: `next.config.ts`（`output: 'standalone'`）、`README.md`（加部署章節）、`package.json`（加 `start:prod` script）

**Interfaces:**
- Produces: `docker build -t school-apply-form .` 可成功；容器啟動時若 `DATABASE_PATH` 指向的 DB 為空則自動 seed

- [ ] **Step 1: next.config.ts**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'bwip-js'],
};

export default nextConfig;
```

- [ ] **Step 2: Dockerfile 與 .dockerignore**

`Dockerfile`：
```dockerfile
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/app/data/app.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/lib ./lib
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps /app/node_modules/.bin/tsx ./node_modules/.bin/tsx
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["sh", "-c", "if [ ! -s \"$DATABASE_PATH\" ]; then node node_modules/tsx/dist/cli.mjs scripts/seed.ts; fi; node server.js"]
```

`.dockerignore`：
```
node_modules
.next
data
.superpowers
.git
docs
design-system
```

`package.json` scripts 加：`"start:prod": "node .next/standalone/server.js"`。

- [ ] **Step 3: railway.toml**

```toml
[build]
builder = "DOCKERFILE"

[deploy]
healthcheckPath = "/"
restartPolicyType = "ON_FAILURE"
```

- [ ] **Step 4: 本機驗證**

```bash
npm run build && ls .next/standalone/server.js
docker build -t school-apply-form . 2>&1 | tail -5
```
Expected: build 成功。若本機無 docker daemon，記錄「Dockerfile 未於本機驗證」為 concern，至少確認 `npm run build` 後 `.next/standalone/server.js` 存在且 `PORT=3200 DATABASE_PATH=/tmp/x.db node .next/standalone/server.js` 能以 curl 取得 `/` 200（standalone 需複製 `.next/static` 與 `public` 到 `.next/standalone/` 下才有樣式，此驗證只看 200）。只 kill 自己啟動的 PID。

- [ ] **Step 5: README 部署章節**

在 `README.md` 末尾加：
```markdown
## 部署到 Railway

1. 把 repo push 到 GitHub。
2. Railway → New Project → Deploy from GitHub repo，選此 repo；Railway 會偵測 `Dockerfile`。
3. Settings → Volumes → Add Volume，Mount path 填 `/app/data`（SQLite 檔案放這裡，重新部署不會遺失）。
4. Variables 確認 `DATABASE_PATH=/app/data/app.db`（Dockerfile 已預設，可不填）。
5. 首次啟動容器會偵測 DB 為空並自動執行 seed；之後不會再覆蓋。
6. Settings → Networking → Generate Domain，即可拿到公開網址給他人測試。

> 注意：這是單一容器 + SQLite，適合 demo。正式多人使用請換 Postgres（`lib/db/client.ts` 換 driver，schema 不用改）。
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "提供 Dockerfile 與 Railway 設定，讓 demo 能一鍵部署給校方試用；SQLite 掛 volume 保留資料"
```

---

## 自我檢查

**Spec 覆蓋：** §4 → T1；§5 共用 Layout → T3；`/apply` → T2+T4；`/apply/[id]` → T2+T4；`/admin/courses` → T2+T5；`/admin/scan` → T2+T5；§6 六項錯誤 → T1（A=B、停用、學號）+ T2/T5（掃描三態、代碼重複）；§7 → T1 Step 10；§8 → T1 測試 + T3 元件測試；§10 token/字型/元件/動效/版面 → T3；交付前檢查 → T4/T5 各自 Step；部署 → T6。

**型別一致性：** `CreateApplicationInput` 欄位 `courseACode/courseAStatus/courseBCode` 在 T1、T2 actions、T4 ApplyForm name 屬性一致；`ApplicationDetail` 的 `department/courseAName/courseBName/courseBTeacher` 在 T1、T4 列印頁、T2/T5 ScanOutcome 對應一致；`Field` props `id/label/hint/error` 在 T3 定義、T4/T5 使用一致。

**已知取捨：** T1 結束時 `tsc` 失敗屬預期（T2 修復）；Dockerfile 若本機無 docker 只能部分驗證。
