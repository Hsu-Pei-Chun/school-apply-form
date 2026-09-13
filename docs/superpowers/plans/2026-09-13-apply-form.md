# 科目申請表系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 學生選學號 + 科目後產生含 Code 128 條碼的 A4 申請表，行政人員在後台管理科目並以掃描槍掃條碼登記收件。

**Architecture:** Next.js App Router 單一 repo；`lib/` 放純函式的資料存取與商業邏輯（可在 Vitest 用記憶體 SQLite 直接測），`app/` 只做頁面與 Server Actions 呼叫 `lib/`。條碼在 server 端用 bwip-js 產 SVG 字串內嵌，列印走瀏覽器。

**Tech Stack:** Next.js 15 (App Router, TypeScript), better-sqlite3, drizzle-orm, bwip-js, Vitest, Node 22 (mise)

**Spec:** `docs/superpowers/specs/2026-09-13-apply-form-design.md`

## Global Constraints

- Node 22（`mise` 管理，已設定為預設）
- 資料庫 SQLite；正式檔案 `data/app.db`，測試用 `:memory:`
- 流水號格式：`A` + 6 位數字，自 `A000001` 起
- `applications.status` 只有 `'printed' | 'received'`
- 主檔 students / subjects 不物理刪除，用 `is_active`
- 所有 UI 文案繁體中文
- Commit message 說明「為什麼」；不得用 `--no-verify`

---

## File Structure

```
school-apply-form/
  package.json
  vitest.config.ts
  drizzle.config.ts           （僅供 drizzle-kit studio 看資料，非必要）
  lib/
    db/schema.ts              Drizzle 表定義（students, subjects, applications）
    db/client.ts              createDb(path) 建連線 + 建表；getDb() 單例
    subjects.ts               listSubjects / listActiveSubjects / createSubject / setSubjectActive
    students.ts               findStudent
    applications.ts           createApplication / getApplication / receiveApplication
    barcode.ts                renderCode128Svg(text)
  scripts/seed.ts             產 2000 學生 / 100 科目
  app/
    layout.tsx
    page.tsx                  首頁：兩個連結（申請 / 後台）
    apply/page.tsx            學生申請表單
    apply/actions.ts          Server Actions: lookupStudent, submitApplication
    apply/[id]/page.tsx       A4 列印頁
    apply/[id]/print.css
    admin/subjects/page.tsx
    admin/subjects/actions.ts
    admin/scan/page.tsx
    admin/scan/actions.ts
    admin/scan/ScanForm.tsx   Client Component（autofocus + 清空）
  tests/
    subjects.test.ts
    students.test.ts
    applications.test.ts
    barcode.test.ts
```

---

### Task 1: 專案骨架與資料庫層

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`
- Create: `lib/db/schema.ts`, `lib/db/client.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Produces: `createDb(path: string): Db` — 回傳 drizzle 實例並確保表已建立；`getDb(): Db` — 依 `process.env.DATABASE_PATH ?? 'data/app.db'` 的單例；型別 `Db = BetterSQLite3Database<typeof schema>`；`schema.students / schema.subjects / schema.applications`

- [ ] **Step 1: 建立 Next.js 專案**

```bash
cd /home/username/桌面/school-apply-form
npx create-next-app@15 . --typescript --app --no-tailwind --no-eslint --no-src-dir --import-alias "@/*" --use-npm
```

若提示目錄非空（有 docs/ 與 .git），選擇繼續。完成後確認 `app/page.tsx` 存在。

- [ ] **Step 2: 安裝依賴**

```bash
npm install better-sqlite3 drizzle-orm bwip-js
npm install -D @types/better-sqlite3 drizzle-kit vitest tsx
```

- [ ] **Step 3: 設定 vitest 與 .gitignore**

`vitest.config.ts`：
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname) } },
});
```

在 `package.json` 的 `scripts` 加入：
```json
"test": "vitest run",
"seed": "tsx scripts/seed.ts"
```

`.gitignore` 追加一行：`data/`

- [ ] **Step 4: 寫 schema**

`lib/db/schema.ts`：
```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  className: text('class_name').notNull(),
  isActive: integer('is_active').notNull().default(1),
});

export const subjects = sqliteTable('subjects', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull(),
});

export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id),
  subjectCode: text('subject_code').notNull().references(() => subjects.code),
  status: text('status', { enum: ['printed', 'received'] }).notNull().default('printed'),
  createdAt: text('created_at').notNull(),
  receivedAt: text('received_at'),
});

export type Student = typeof students.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Application = typeof applications.$inferSelect;
```

- [ ] **Step 5: 寫失敗測試**

`tests/db.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import { createDb } from '@/lib/db/client';
import { students, subjects, applications } from '@/lib/db/schema';

describe('createDb', () => {
  it('建立三張表且可查詢', () => {
    const db = createDb(':memory:');
    expect(db.select().from(students).all()).toEqual([]);
    expect(db.select().from(subjects).all()).toEqual([]);
    expect(db.select().from(applications).all()).toEqual([]);
  });
});
```

- [ ] **Step 6: 執行測試確認失敗**

Run: `npm test`
Expected: FAIL，找不到 `@/lib/db/client`

- [ ] **Step 7: 寫 client**

`lib/db/client.ts`：
```ts
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

const DDL = `
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS subjects (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  subject_code TEXT NOT NULL REFERENCES subjects(code),
  status TEXT NOT NULL DEFAULT 'printed',
  created_at TEXT NOT NULL,
  received_at TEXT
);
`;

export function createDb(filePath: string): Db {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const sqlite = new Database(filePath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}

let singleton: Db | undefined;
export function getDb(): Db {
  if (!singleton) {
    singleton = createDb(process.env.DATABASE_PATH ?? 'data/app.db');
  }
  return singleton;
}
```

- [ ] **Step 8: 執行測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "建立專案骨架與 SQLite 資料層，讓後續商業邏輯可用記憶體庫測試"
```

---

### Task 2: 學生查詢與科目管理

**Files:**
- Create: `lib/students.ts`, `lib/subjects.ts`
- Test: `tests/students.test.ts`, `tests/subjects.test.ts`

**Interfaces:**
- Consumes: `createDb`, `Db`, `schema.*`（Task 1）
- Produces:
  - `findStudent(db: Db, id: string): Student | undefined`
  - `listSubjects(db: Db): Subject[]`（全部，依 code 排序）
  - `listActiveSubjects(db: Db): Subject[]`
  - `createSubject(db: Db, input: { code: string; name: string }): Subject` — code 重複時 throw `Error('科目代碼已存在')`
  - `setSubjectActive(db: Db, code: string, isActive: boolean): void`

- [ ] **Step 1: 寫學生查詢失敗測試**

`tests/students.test.ts`：
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { students } from '@/lib/db/schema';
import { findStudent } from '@/lib/students';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  db.insert(students).values({ id: 'S0001', name: '王小明', className: '一年一班' }).run();
});

describe('findStudent', () => {
  it('找到存在的學生', () => {
    expect(findStudent(db, 'S0001')?.name).toBe('王小明');
  });
  it('學號不存在回傳 undefined', () => {
    expect(findStudent(db, 'S9999')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm test -- tests/students.test.ts`
Expected: FAIL，找不到 `@/lib/students`

- [ ] **Step 3: 實作 students.ts**

```ts
import { eq } from 'drizzle-orm';
import { Db } from './db/client';
import { students, Student } from './db/schema';

export function findStudent(db: Db, id: string): Student | undefined {
  return db.select().from(students).where(eq(students.id, id)).get();
}
```

- [ ] **Step 4: 執行確認通過**

Run: `npm test -- tests/students.test.ts`
Expected: PASS

- [ ] **Step 5: 寫科目管理失敗測試**

`tests/subjects.test.ts`：
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { createSubject, listSubjects, listActiveSubjects, setSubjectActive } from '@/lib/subjects';

let db: Db;
beforeEach(() => { db = createDb(':memory:'); });

describe('subjects', () => {
  it('新增後可列出', () => {
    const s = createSubject(db, { code: 'C001', name: '國文' });
    expect(s.isActive).toBe(1);
    expect(listSubjects(db).map(x => x.code)).toEqual(['C001']);
  });

  it('代碼重複拋錯', () => {
    createSubject(db, { code: 'C001', name: '國文' });
    expect(() => createSubject(db, { code: 'C001', name: '數學' })).toThrow('科目代碼已存在');
  });

  it('停用後不在 active 清單但仍在完整清單', () => {
    createSubject(db, { code: 'C001', name: '國文' });
    createSubject(db, { code: 'C002', name: '數學' });
    setSubjectActive(db, 'C001', false);
    expect(listActiveSubjects(db).map(x => x.code)).toEqual(['C002']);
    expect(listSubjects(db).map(x => x.code)).toEqual(['C001', 'C002']);
  });
});
```

- [ ] **Step 6: 執行確認失敗**

Run: `npm test -- tests/subjects.test.ts`
Expected: FAIL，找不到 `@/lib/subjects`

- [ ] **Step 7: 實作 subjects.ts**

```ts
import { asc, eq } from 'drizzle-orm';
import { Db } from './db/client';
import { subjects, Subject } from './db/schema';

export function listSubjects(db: Db): Subject[] {
  return db.select().from(subjects).orderBy(asc(subjects.code)).all();
}

export function listActiveSubjects(db: Db): Subject[] {
  return db.select().from(subjects).where(eq(subjects.isActive, 1)).orderBy(asc(subjects.code)).all();
}

export function createSubject(db: Db, input: { code: string; name: string }): Subject {
  const exists = db.select().from(subjects).where(eq(subjects.code, input.code)).get();
  if (exists) throw new Error('科目代碼已存在');
  const row = { code: input.code, name: input.name, isActive: 1, createdAt: new Date().toISOString() };
  db.insert(subjects).values(row).run();
  return row;
}

export function setSubjectActive(db: Db, code: string, isActive: boolean): void {
  db.update(subjects).set({ isActive: isActive ? 1 : 0 }).where(eq(subjects.code, code)).run();
}
```

- [ ] **Step 8: 執行全部測試確認通過**

Run: `npm test`
Expected: PASS（db、students、subjects）

- [ ] **Step 9: Commit**

```bash
git add lib/students.ts lib/subjects.ts tests/students.test.ts tests/subjects.test.ts
git commit -m "提供學生查詢與科目啟停用邏輯，停用不刪除以保留舊申請單連結"
```

---

### Task 3: 申請單建立與掃描收件

**Files:**
- Create: `lib/applications.ts`
- Test: `tests/applications.test.ts`

**Interfaces:**
- Consumes: `createDb`, `Db`, `schema.*`（Task 1）；`findStudent`（Task 2）
- Produces:
  - `createApplication(db: Db, input: { studentId: string; subjectCode: string }): Application` — 學號不存在 throw `Error('查無此學號')`；科目不存在或停用 throw `Error('科目不存在或已停用')`
  - `getApplication(db: Db, id: string): ApplicationDetail | undefined`，其中 `ApplicationDetail = Application & { studentName: string; className: string; subjectName: string }`
  - `receiveApplication(db: Db, id: string): { kind: 'received'; detail: ApplicationDetail } | { kind: 'already'; detail: ApplicationDetail } | { kind: 'not_found' }`
  - `nextApplicationId(db: Db): string`（內部用，但匯出以便測試）

- [ ] **Step 1: 寫失敗測試**

`tests/applications.test.ts`：
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { students } from '@/lib/db/schema';
import { createSubject, setSubjectActive } from '@/lib/subjects';
import { createApplication, getApplication, receiveApplication, nextApplicationId } from '@/lib/applications';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  db.insert(students).values({ id: 'S0001', name: '王小明', className: '一年一班' }).run();
  createSubject(db, { code: 'C001', name: '國文' });
});

describe('nextApplicationId', () => {
  it('空表從 A000001 起', () => {
    expect(nextApplicationId(db)).toBe('A000001');
  });
  it('遞增', () => {
    createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    expect(nextApplicationId(db)).toBe('A000003');
  });
});

describe('createApplication', () => {
  it('成功建立，狀態 printed', () => {
    const a = createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    expect(a.id).toBe('A000001');
    expect(a.status).toBe('printed');
    expect(a.receivedAt).toBeNull();
  });
  it('學號不存在拋錯', () => {
    expect(() => createApplication(db, { studentId: 'S9999', subjectCode: 'C001' })).toThrow('查無此學號');
  });
  it('科目停用拋錯', () => {
    setSubjectActive(db, 'C001', false);
    expect(() => createApplication(db, { studentId: 'S0001', subjectCode: 'C001' })).toThrow('科目不存在或已停用');
  });
});

describe('getApplication', () => {
  it('回傳含學生與科目名稱的明細', () => {
    createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    const d = getApplication(db, 'A000001');
    expect(d?.studentName).toBe('王小明');
    expect(d?.className).toBe('一年一班');
    expect(d?.subjectName).toBe('國文');
  });
  it('不存在回傳 undefined', () => {
    expect(getApplication(db, 'A999999')).toBeUndefined();
  });
});

describe('receiveApplication', () => {
  it('printed → received 並寫入 receivedAt', () => {
    createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    const r = receiveApplication(db, 'A000001');
    expect(r.kind).toBe('received');
    if (r.kind === 'received') {
      expect(r.detail.status).toBe('received');
      expect(r.detail.receivedAt).not.toBeNull();
    }
  });
  it('重複掃描回 already 且不覆寫 receivedAt', () => {
    createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
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

- [ ] **Step 2: 執行確認失敗**

Run: `npm test -- tests/applications.test.ts`
Expected: FAIL，找不到 `@/lib/applications`

- [ ] **Step 3: 實作 applications.ts**

```ts
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
```

- [ ] **Step 4: 執行確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/applications.ts tests/applications.test.ts
git commit -m "申請單以流水號為唯一鍵，讓條碼只需承載 id 且重複申請不撞號"
```

---

### Task 4: 假資料 seed 腳本

**Files:**
- Create: `scripts/seed.ts`

**Interfaces:**
- Consumes: `createDb`（Task 1）、`createSubject`（Task 2）

- [ ] **Step 1: 寫 seed 腳本**

`scripts/seed.ts`：
```ts
import { createDb } from '../lib/db/client';
import { students, subjects, applications } from '../lib/db/schema';
import { createSubject } from '../lib/subjects';

const SURNAMES = ['王', '李', '張', '劉', '陳', '楊', '黃', '趙', '吳', '周', '林', '徐', '許', '蔡', '鄭'];
const GIVEN = ['小明', '小華', '雅婷', '志偉', '淑芬', '俊傑', '怡君', '家豪', '佩珊', '冠宇', '心怡', '宗翰', '欣妤', '柏翰', '思穎'];
const GRADES = ['一', '二', '三'];
const CLASSES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
const SUBJECT_BASES = ['國文', '英文', '數學', '物理', '化學', '生物', '歷史', '地理', '公民', '資訊'];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

const db = createDb(process.env.DATABASE_PATH ?? 'data/app.db');

db.delete(applications).run();
db.delete(subjects).run();
db.delete(students).run();

const studentRows = Array.from({ length: 2000 }, (_, i) => {
  const n = i + 1;
  return {
    id: 'S' + String(n).padStart(4, '0'),
    name: pick(SURNAMES, n * 7) + pick(GIVEN, n * 13),
    className: `${pick(GRADES, Math.floor(i / 700))}年${pick(CLASSES, Math.floor(i / 35))}班`,
    isActive: 1,
  };
});
for (let i = 0; i < studentRows.length; i += 500) {
  db.insert(students).values(studentRows.slice(i, i + 500)).run();
}

for (let i = 1; i <= 100; i++) {
  createSubject(db, {
    code: 'C' + String(i).padStart(3, '0'),
    name: `${pick(SUBJECT_BASES, i - 1)}${Math.ceil(i / 10)}`,
  });
}

console.log('seed 完成：2000 學生、100 科目');
```

- [ ] **Step 2: 執行 seed 並驗證筆數**

Run:
```bash
npm run seed
node -e "const D=require('better-sqlite3');const d=new D('data/app.db');console.log(d.prepare('select count(*) c from students').get(), d.prepare('select count(*) c from subjects').get())"
```
Expected: 印出 `seed 完成…`，然後 `{ c: 2000 } { c: 100 }`

- [ ] **Step 3: 再執行一次 seed 確認可重複**

Run: `npm run seed && node -e "...同上"`
Expected: 仍是 2000 / 100，沒有 UNIQUE 錯誤

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "提供可重複執行的假資料，讓 demo 不依賴學校真實名單"
```

---

### Task 5: 條碼產生

**Files:**
- Create: `lib/barcode.ts`
- Test: `tests/barcode.test.ts`

**Interfaces:**
- Produces: `renderCode128Svg(text: string): string` — 回傳 `<svg …>` 字串

- [ ] **Step 1: 寫失敗測試**

`tests/barcode.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import { renderCode128Svg } from '@/lib/barcode';

describe('renderCode128Svg', () => {
  it('回傳 svg 字串', () => {
    const svg = renderCode128Svg('A000001');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
  });
  it('不同內容產生不同 svg', () => {
    expect(renderCode128Svg('A000001')).not.toBe(renderCode128Svg('A000002'));
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm test -- tests/barcode.test.ts`
Expected: FAIL，找不到 `@/lib/barcode`

- [ ] **Step 3: 實作**

`lib/barcode.ts`：
```ts
import bwipjs from 'bwip-js';

export function renderCode128Svg(text: string): string {
  return bwipjs.toSVG({
    bcid: 'code128',
    text,
    scale: 3,
    height: 15,
    includetext: false,
  });
}
```

若 TypeScript 抱怨 `toSVG` 不存在，改為 `import { toSVG } from 'bwip-js/node'`。

- [ ] **Step 4: 執行確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/barcode.ts tests/barcode.test.ts
git commit -m "條碼以 SVG 內嵌避免列印模糊，並集中在單一模組方便日後換碼制"
```

---

### Task 6: 學生申請頁與列印頁

**Files:**
- Create: `app/apply/page.tsx`, `app/apply/ApplyForm.tsx`, `app/apply/actions.ts`, `app/apply/[id]/page.tsx`, `app/apply/[id]/PrintButton.tsx`, `app/apply/[id]/print.css`
- Modify: `app/page.tsx`（替換 create-next-app 預設內容）

**Interfaces:**
- Consumes: `getDb`（Task 1）、`findStudent`、`listActiveSubjects`（Task 2）、`createApplication`、`getApplication`（Task 3）、`renderCode128Svg`（Task 5）

- [ ] **Step 1: 首頁**

`app/page.tsx`：
```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>科目申請表系統</h1>
      <ul>
        <li><Link href="/apply">學生申請</Link></li>
        <li><Link href="/admin/subjects">科目管理</Link></li>
        <li><Link href="/admin/scan">掃描收件</Link></li>
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Server Actions**

`app/apply/actions.ts`：
```ts
'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { findStudent } from '@/lib/students';
import { createApplication } from '@/lib/applications';

export async function lookupStudent(studentId: string) {
  const s = findStudent(getDb(), studentId.trim());
  return s ? { name: s.name, className: s.className } : null;
}

export async function submitApplication(formData: FormData): Promise<{ error: string } | void> {
  const studentId = String(formData.get('studentId') ?? '').trim();
  const subjectCode = String(formData.get('subjectCode') ?? '');
  let id: string;
  try {
    id = createApplication(getDb(), { studentId, subjectCode }).id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/apply/${id}`);
}
```

- [ ] **Step 3: 申請頁（Client Component 表單）**

`app/apply/page.tsx`：
```tsx
import { getDb } from '@/lib/db/client';
import { listActiveSubjects } from '@/lib/subjects';
import ApplyForm from './ApplyForm';

export const dynamic = 'force-dynamic';

export default function ApplyPage() {
  const subjects = listActiveSubjects(getDb()).map(s => ({ code: s.code, name: s.name }));
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>科目申請</h1>
      <ApplyForm subjects={subjects} />
    </main>
  );
}
```

`app/apply/ApplyForm.tsx`：
```tsx
'use client';

import { useState } from 'react';
import { lookupStudent, submitApplication } from './actions';

type Props = { subjects: { code: string; name: string }[] };

export default function ApplyForm({ subjects }: Props) {
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState<{ name: string; className: string } | null>(null);
  const [lookupError, setLookupError] = useState('');
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
      <label>
        學號
        <input name="studentId" value={studentId} onChange={e => setStudentId(e.target.value)} onBlur={onBlur} required />
      </label>
      {student && <p>{student.className} {student.name}</p>}
      {lookupError && <p style={{ color: 'red' }}>{lookupError}</p>}
      <label>
        科目
        <select name="subjectCode" required defaultValue="">
          <option value="" disabled>請選擇</option>
          {subjects.map(s => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}
        </select>
      </label>
      {submitError && <p style={{ color: 'red' }}>{submitError}</p>}
      <button type="submit" disabled={!student}>產生申請表</button>
    </form>
  );
}
```

- [ ] **Step 4: 列印頁與 print.css**

`app/apply/[id]/print.css`：
```css
@page { size: A4; margin: 20mm; }
.sheet { font-family: serif; max-width: 170mm; margin: 0 auto; }
.sheet h1 { text-align: center; }
.sheet table { width: 100%; border-collapse: collapse; margin: 16px 0; }
.sheet th, .sheet td { border: 1px solid #000; padding: 8px; text-align: left; }
.sheet th { width: 30%; }
.barcode { text-align: center; margin: 24px 0; }
.barcode svg { max-width: 60mm; height: auto; }
.barcode .human { font-family: monospace; margin-top: 4px; }
.signature { margin-top: 48px; }
@media print { .no-print { display: none; } }
```

`app/apply/[id]/page.tsx`：
```tsx
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getApplication } from '@/lib/applications';
import { renderCode128Svg } from '@/lib/barcode';
import PrintButton from './PrintButton';
import './print.css';

export const dynamic = 'force-dynamic';

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = getApplication(getDb(), id);
  if (!a) notFound();
  const svg = renderCode128Svg(a.id);
  const date = a.createdAt.slice(0, 10);

  return (
    <main className="sheet">
      <p className="no-print"><PrintButton /></p>
      <h1>○○學校 科目申請表</h1>
      <table>
        <tbody>
          <tr><th>學號</th><td>{a.studentId}</td></tr>
          <tr><th>姓名</th><td>{a.studentName}</td></tr>
          <tr><th>班級</th><td>{a.className}</td></tr>
          <tr><th>科目代碼</th><td>{a.subjectCode}</td></tr>
          <tr><th>科目名稱</th><td>{a.subjectName}</td></tr>
          <tr><th>申請日期</th><td>{date}</td></tr>
        </tbody>
      </table>
      <div className="barcode">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="human">{a.id}　{a.studentId}　{a.subjectCode}</div>
      </div>
      <p className="signature">學生簽名：________________　　家長簽名：________________</p>
    </main>
  );
}
```

`app/apply/[id]/PrintButton.tsx`：
```tsx
'use client';
export default function PrintButton() {
  return <button onClick={() => window.print()}>列印</button>;
}
```

- [ ] **Step 5: 手動驗證**

Run: `npm run dev`
1. 開 `http://localhost:3000/apply`，輸入 `S0001` 離開欄位 → 顯示班級姓名；輸入 `S9999` → 紅字「查無此學號」且按鈕停用
2. 選科目送出 → 導向 `/apply/A000001`，看到條碼與人類可讀文字
3. 按「列印」→ 列印預覽中按鈕消失、A4 一頁
4. 開 `/apply/A999999` → 404

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "學生端申請與列印頁，走瀏覽器列印以避開後端 PDF 中文字型問題"
```

---

### Task 7: 科目管理後台

**Files:**
- Create: `app/admin/subjects/page.tsx`, `app/admin/subjects/AddSubjectForm.tsx`, `app/admin/subjects/actions.ts`

**Interfaces:**
- Consumes: `getDb`（Task 1）、`listSubjects`、`createSubject`、`setSubjectActive`（Task 2）

- [ ] **Step 1: Server Actions**

`app/admin/subjects/actions.ts`：
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { createSubject, setSubjectActive } from '@/lib/subjects';

export async function addSubject(formData: FormData): Promise<{ error: string } | void> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!code || !name) return { error: '代碼與名稱皆必填' };
  try {
    createSubject(getDb(), { code, name });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/admin/subjects');
}

export async function toggleSubject(formData: FormData) {
  const code = String(formData.get('code'));
  const isActive = formData.get('isActive') === '1';
  setSubjectActive(getDb(), code, !isActive);
  revalidatePath('/admin/subjects');
}
```

- [ ] **Step 2: 頁面**

`app/admin/subjects/page.tsx`：
```tsx
import { getDb } from '@/lib/db/client';
import { listSubjects } from '@/lib/subjects';
import { toggleSubject } from './actions';
import AddSubjectForm from './AddSubjectForm';

export const dynamic = 'force-dynamic';

export default function SubjectsPage() {
  const rows = listSubjects(getDb());
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>科目管理</h1>
      <AddSubjectForm />
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', marginTop: 16 }}>
        <thead><tr><th>代碼</th><th>名稱</th><th>狀態</th><th>建立時間</th><th></th></tr></thead>
        <tbody>
          {rows.map(s => (
            <tr key={s.code}>
              <td>{s.code}</td>
              <td>{s.name}</td>
              <td>{s.isActive ? '啟用' : '停用'}</td>
              <td>{s.createdAt.slice(0, 10)}</td>
              <td>
                <form action={toggleSubject}>
                  <input type="hidden" name="code" value={s.code} />
                  <input type="hidden" name="isActive" value={s.isActive} />
                  <button type="submit">{s.isActive ? '停用' : '啟用'}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

`app/admin/subjects/AddSubjectForm.tsx`：
```tsx
'use client';

import { useState } from 'react';
import { addSubject } from './actions';

export default function AddSubjectForm() {
  const [error, setError] = useState('');
  async function onSubmit(formData: FormData) {
    setError('');
    const r = await addSubject(formData);
    if (r?.error) setError(r.error);
  }
  return (
    <form action={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
      <label>代碼<br /><input name="code" required /></label>
      <label>名稱<br /><input name="name" required /></label>
      <button type="submit">新增</button>
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </form>
  );
}
```

- [ ] **Step 3: 手動驗證**

Run: `npm run dev`
1. 開 `/admin/subjects`，新增 `C101 / 測試科目` → 列表出現
2. 再新增 `C101` → 紅字「科目代碼已存在」
3. 停用 `C101` → 狀態變停用；開 `/apply` 下拉不含 C101
4. 啟用回來 → `/apply` 下拉恢復

- [ ] **Step 4: Commit**

```bash
git add app/admin/subjects
git commit -m "科目管理後台，讓行政人員自行新增與停用科目不需改程式"
```

---

### Task 8: 掃描收件頁

**Files:**
- Create: `app/admin/scan/page.tsx`, `app/admin/scan/actions.ts`, `app/admin/scan/ScanForm.tsx`

**Interfaces:**
- Consumes: `getDb`（Task 1）、`receiveApplication`、`ReceiveResult`（Task 3）

- [ ] **Step 1: Server Action**

`app/admin/scan/actions.ts`：
```ts
'use server';

import { getDb } from '@/lib/db/client';
import { receiveApplication } from '@/lib/applications';

export type ScanOutcome =
  | { kind: 'received' | 'already'; id: string; studentId: string; studentName: string; subjectCode: string; subjectName: string; receivedAt: string }
  | { kind: 'not_found'; id: string };

export async function scan(id: string): Promise<ScanOutcome> {
  const code = id.trim();
  const r = receiveApplication(getDb(), code);
  if (r.kind === 'not_found') return { kind: 'not_found', id: code };
  const d = r.detail;
  return {
    kind: r.kind,
    id: d.id,
    studentId: d.studentId,
    studentName: d.studentName,
    subjectCode: d.subjectCode,
    subjectName: d.subjectName,
    receivedAt: d.receivedAt ?? '',
  };
}
```

- [ ] **Step 2: Client 表單**

`app/admin/scan/ScanForm.tsx`：
```tsx
'use client';

import { useRef, useState } from 'react';
import { scan, ScanOutcome } from './actions';

const COLORS = { received: '#0a0', already: '#c90', not_found: '#c00' } as const;

export default function ScanForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = inputRef.current?.value ?? '';
    if (!value.trim()) return;
    setOutcome(await scan(value));
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit}>
        <input ref={inputRef} autoFocus placeholder="掃描條碼或輸入流水號後 Enter" style={{ fontSize: 20, width: 320 }} />
      </form>
      {outcome && (
        <div style={{ marginTop: 16, padding: 12, border: `2px solid ${COLORS[outcome.kind]}`, color: COLORS[outcome.kind] }}>
          {outcome.kind === 'not_found' && <p>查無此流水號：{outcome.id}</p>}
          {outcome.kind === 'received' && <p>收件成功</p>}
          {outcome.kind === 'already' && <p>已收件（{outcome.receivedAt.replace('T', ' ').slice(0, 16)}）</p>}
          {outcome.kind !== 'not_found' && (
            <p>{outcome.id}　{outcome.studentId} {outcome.studentName}　{outcome.subjectCode} {outcome.subjectName}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 頁面**

`app/admin/scan/page.tsx`：
```tsx
import ScanForm from './ScanForm';

export default function ScanPage() {
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>掃描收件</h1>
      <ScanForm />
    </main>
  );
}
```

- [ ] **Step 4: 手動驗證**

Run: `npm run dev`
1. 開 `/admin/scan`，游標已在 input
2. 輸入 `A000001` Enter → 綠框「收件成功」＋學生科目；input 清空且仍聚焦
3. 再輸入 `A000001` Enter → 黃框「已收件（時間）」
4. 輸入 `XYZ` Enter → 紅框「查無此流水號」
5. 用手機條碼 App 掃列印稿或螢幕上的條碼，確認讀出 `A000001`

- [ ] **Step 5: 全部測試與 build**

Run: `npm test && npm run build`
Expected: 測試全 PASS，build 無型別錯誤

- [ ] **Step 6: Commit**

```bash
git add app/admin/scan
git commit -m "掃描收件頁保持 input 聚焦，讓掃描槍連續作業不需碰滑鼠"
```

---

## 自我檢查

**Spec 覆蓋：**
- §4 資料模型 → Task 1
- §5 `/apply` → Task 6；`/apply/[id]` → Task 6；`/admin/subjects` → Task 7；`/admin/scan` → Task 8
- §6 錯誤處理：學號不存在（Task 3 + 6）、科目停用（Task 3 + 6）、流水號無效（Task 3 + 8）、重複掃描（Task 3 + 8）、代碼重複（Task 2 + 7）
- §7 假資料 → Task 4
- §8 測試 → Task 1/2/3/5 單元測試，Task 6/7/8 手動驗證

**型別一致性：** `ReceiveResult` 在 Task 3 定義並匯出；Task 8 使用同名。`ApplicationDetail` 欄位名 `studentName / className / subjectName` 在 Task 3、6、8 一致。
