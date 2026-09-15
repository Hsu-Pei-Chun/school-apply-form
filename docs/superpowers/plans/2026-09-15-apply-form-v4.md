# 課程申請表系統 v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** X-Class 課程加「上課時間」欄位並顯示於下拉、申請表、掃描結果；課程管理新增「批次匯入」（貼上 Excel 或上傳 CSV → 預覽 → 整批寫入），保留逐筆新增。

**Architecture:** 資料層先加 `courses.time`（破壞性 migration 重產、seed 補時間）並讓所有既有查詢／型別跟上；批次匯入的解析與驗證放 `lib/course-import.ts` 純函式（parse → plan → apply 三段），UI 只負責貼上／上傳、呼叫預覽與確認兩個 Server Action；最後把時間帶到下拉、列印頁、掃描頁。

**Tech Stack:** Next.js 15.5 (App Router), React 19, Tailwind v4, better-sqlite3 + drizzle-orm 0.45, Vitest

**Spec:** `docs/superpowers/specs/2026-09-13-apply-form-design.md`（v4）

## Global Constraints

- **v3 → v4 為破壞性 schema 變更**：`rm -rf drizzle data && npx drizzle-kit generate` 重產 `0000_*`；`data/` 不進 git
- `courses.time TEXT NOT NULL`，自由文字，不驗格式，但不得空白；錯誤訊息 `代碼、名稱、授課教師、上課時間皆必填`
- 科號規則不變：`/^[0-9A-Za-z]{15}$/`，訊息 `科號必須為 15 碼英數`；重複 `課程代碼已存在`
- 批次匯入：每行 `科號 ⇥ 課名 ⇥ 授課教師 ⇥ 上課時間`；分隔符 Tab 優先、其次逗號；首行含「科號」視為標題跳過；空行跳過；處理 BOM 與 CRLF
- 預覽狀態三種：`add`（綠）／`skip`（黃，科號已存在）／`error`（紅，原因文字）；有 `error` 時 `applyCourseImport` 拒絕（throw `匯入內容有錯誤，請先修正`）
- `applyCourseImport` 為一個 transaction，只寫入 `add` 行，回傳寫入筆數
- UI：每個 input/textarea `<label htmlFor>`；錯誤 `role="alert"`；互動元素 `min-h-11`；圖示 inline SVG；無 raw hex；繁體中文
- 子代理驗證時只能 kill 自己啟動的 PID，**禁止 `pkill`/`killall`**；port 3100 屬控制器；驗證完確認 `ss -ltn | grep 3200` 為空
- 每個 Task 結束 `npm test && npx tsc --noEmit && npm run build` 必過（Task 1 允許 `app/` 暫時不編譯，但 Task 1 內必須把 `app/` 補到能編譯——見 Task 1 Step 8）
- Commit message 說明「為什麼」；不得 `--no-verify`

---

## File Structure

```
lib/
  db/schema.ts              courses.time
  courses.ts                createCourse 加 time
  course-import.ts          parseCourseImport / planCourseImport / applyCourseImport（純函式）
  applications.ts           ApplicationDetail / ApplicationSummary 加 courseBTime
  seed.ts                   time 輪流
app/
  admin/courses/page.tsx    兩張卡（批次匯入、逐筆新增）+ 列表加時間欄
  admin/courses/actions.ts  addCourse 加 time；previewImport / confirmImport
  admin/courses/AddCourseForm.tsx        加上課時間欄
  admin/courses/ImportCoursesForm.tsx    textarea + 檔案上傳 + 預覽表 + 確認
  apply/page.tsx, ApplyForm.tsx          下拉顯示時間
  apply/[id]/page.tsx                    B 區塊加上課時間
  admin/scan/actions.ts, ScanForm.tsx    結果卡加時間
tests/
  courses.test.ts, course-import.test.ts, applications.test.ts, seed.test.ts, db.test.ts
README.md
```

---

### Task 1: 資料層加 `courses.time` 並讓全站編譯

**Files:**
- Modify: `lib/db/schema.ts`、`lib/courses.ts`、`lib/applications.ts`、`lib/seed.ts`
- Delete + regenerate: `drizzle/`
- Modify tests: `tests/db.test.ts`、`tests/courses.test.ts`、`tests/applications.test.ts`、`tests/seed.test.ts`
- Modify（最小修補讓 build 過）: `app/admin/courses/actions.ts`、`app/admin/courses/AddCourseForm.tsx`

**Interfaces:**
- Produces: `Course.time: string`；`createCourse(db, {code, name, teacher, time})`（`time` 空白 throw `上課時間為必填`）；`ApplicationDetail.courseBTime`、`ApplicationSummary.courseBTime`

- [ ] **Step 1: schema**

`lib/db/schema.ts` 的 `courses` 表在 `teacher` 後加：
```ts
    time: text('time').notNull(),
```

- [ ] **Step 2: 重產 migration**

```bash
rm -rf drizzle data && npx drizzle-kit generate && grep -c "CREATE TABLE" drizzle/0000_*.sql   # 4
grep -n '"time"' drizzle/0000_*.sql   # courses 表應有 time text NOT NULL
```

- [ ] **Step 3: 測試先改（RED）**

- `tests/db.test.ts`：`courses` 插入加 `time: 'M1M2'`。
- `tests/courses.test.ts`：所有 `createCourse` 呼叫加 `time: 'M1M2'`；新增：
```ts
  it('上課時間空白拋錯', () => {
    expect(() => createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: '  ' })).toThrow('上課時間為必填');
  });
  it('新增後 time 可讀回', () => {
    createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授', time: 'T1T2R1R2' });
    expect(listCourses(db)[0].time).toBe('T1T2R1R2');
  });
```
- `tests/applications.test.ts`：`beforeEach` 與其他 `createCourse` 呼叫加 `time`（B1 用 `'M1M2'`、B2 用 `'T3T4'`、B3 用 `'W5W6'`）；`getApplication` 測試加 `expect(d?.courseBTime).toBe('M1M2')`；`listApplicationsByStudent` 測試加 `expect(list[0].courseBTime).toBe('T3T4')` 與 `expect(list[0].courseBTeacher).toBe('張教授')`（順手補 v3 deferred）。
- `tests/seed.test.ts`：加 `expect(db.select().from(courses).all().every(c => c.time.length > 0)).toBe(true)`。

Run: `npm test` → FAIL（型別／欄位缺）。

- [ ] **Step 4: courses.ts**

```ts
export function createCourse(db: Db, input: { code: string; name: string; teacher: string; time: string }): Course {
  if (!/^[0-9A-Za-z]{15}$/.test(input.code)) throw new Error('科號必須為 15 碼英數');
  if (!input.time.trim()) throw new Error('上課時間為必填');
  const exists = db.select().from(courses).where(eq(courses.code, input.code)).get();
  if (exists) throw new Error('課程代碼已存在');
  const row: Course = { ...input, time: input.time.trim(), isActive: 1, createdAt: new Date().toISOString() };
  db.insert(courses).values(row).run();
  return row;
}
```

- [ ] **Step 5: applications.ts**

`ApplicationDetail` 加 `courseBTime: string`；`loadDetail` 的 select 加 `courseBTime: courses.time`；`ApplicationSummary` 加 `courseBTime: string`；`listApplicationsByStudent` 的 select 加 `courseBTime: courses.time`。

- [ ] **Step 6: seed.ts**

檔頭加 `const TIMES = ['M1M2', 'T3T4', 'W5W6', 'R7R8', 'F1F2', 'M3M4R3R4'];`，`createCourse(tx, {...})` 加 `time: pick(TIMES, i - 1)`。

- [ ] **Step 7: 測試通過**

Run: `npm test` → 全 PASS。`npm run seed` 印出 `seed 完成：2000 學生、100 課程`。

- [ ] **Step 8: app/ 最小修補讓 build 過**

`app/admin/courses/actions.ts` 的 `addCourse`：讀 `time`，必填檢查改為 `if (!code || !name || !teacher || !time) return { error: '代碼、名稱、授課教師、上課時間皆必填' };`，`createCourse(getDb(), { code, name, teacher, time })`。
`app/admin/courses/AddCourseForm.tsx`：在授課教師後加 `<Field id="time" label="上課時間" hint="例：M1M2、T1T2R1R2"><input id="time" name="time" className="input font-mono" required /></Field>`；grid 改 `sm:grid-cols-[1fr_2fr_1fr_1fr_auto]`，error 的 `sm:col-span-4` 改 `sm:col-span-5`。

Run: `npx tsc --noEmit && npm run build` → 過。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "X-Class 課程加上課時間欄位，申請表的核心是衝堂特許，沒有時間就沒有意義"
```

---

### Task 2: 批次匯入純函式 `lib/course-import.ts`

**Files:**
- Create: `lib/course-import.ts`、`tests/course-import.test.ts`

**Interfaces:**
- Consumes: `Db`、`schema.courses`、`createCourse`（Task 1）
- Produces:
```ts
export type ParsedRow = { line: number; code: string; name: string; teacher: string; time: string; raw: string };
export type PlanRow = ParsedRow & ({ status: 'add' } | { status: 'skip'; reason: string } | { status: 'error'; reason: string });
export type ImportPlan = { rows: PlanRow[]; addCount: number; skipCount: number; errorCount: number };
export function parseCourseImport(text: string): ParsedRow[];
export function planCourseImport(db: Db, rows: ParsedRow[]): ImportPlan;
export function applyCourseImport(db: Db, plan: ImportPlan): number;
```

- [ ] **Step 1: 測試（RED）**

`tests/course-import.test.ts`：
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { createCourse, listCourses } from '@/lib/courses';
import { parseCourseImport, planCourseImport, applyCourseImport } from '@/lib/course-import';

const C1 = '11510CHEM200104';
const C2 = '11510CHEM200114';
const C3 = '11510MATH200124';

let db: Db;
beforeEach(() => { db = createDb(':memory:'); });

describe('parseCourseImport', () => {
  it('Tab 分隔、跳過標題列與空行、處理 CRLF 與 BOM', () => {
    const text = '﻿科號\t課名\t授課教師\t上課時間\r\n' + `${C1}\t線性代數1\t許教授\tM1M2\r\n\r\n${C2}\t線性代數2\t許教授\tT3T4\r\n`;
    const rows = parseCourseImport(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ line: 2, code: C1, name: '線性代數1', teacher: '許教授', time: 'M1M2' });
    expect(rows[1]).toMatchObject({ line: 4, code: C2, time: 'T3T4' });
  });
  it('逗號分隔也可', () => {
    const rows = parseCourseImport(`${C1},線性代數1,許教授,M1M2`);
    expect(rows[0]).toMatchObject({ code: C1, name: '線性代數1', teacher: '許教授', time: 'M1M2' });
  });
  it('欄位會 trim；欄位不足時缺的為空字串', () => {
    const rows = parseCourseImport(` ${C1} \t 線性代數1 \t許教授`);
    expect(rows[0]).toMatchObject({ code: C1, name: '線性代數1', teacher: '許教授', time: '' });
  });
});

describe('planCourseImport', () => {
  it('正常行 add；已存在 skip；格式錯誤 error；同批重複 error', () => {
    createCourse(db, { code: C2, name: '既有', teacher: '王', time: 'M1M2' });
    const rows = parseCourseImport([
      `${C1}\t線性代數1\t許教授\tM1M2`,
      `${C2}\t線性代數2\t許教授\tT3T4`,
      `C001\t壞科號\t許教授\tM1M2`,
      `${C3}\t\t許教授\tM1M2`,
      `${C1}\t重複\t許教授\tM1M2`,
    ].join('\n'));
    const plan = planCourseImport(db, rows);
    expect(plan.rows.map(r => r.status)).toEqual(['add', 'skip', 'error', 'error', 'error']);
    expect((plan.rows[2] as { reason: string }).reason).toBe('科號必須為 15 碼英數');
    expect((plan.rows[3] as { reason: string }).reason).toBe('課名、授課教師、上課時間皆必填');
    expect((plan.rows[4] as { reason: string }).reason).toBe('同批內科號重複');
    expect(plan).toMatchObject({ addCount: 1, skipCount: 1, errorCount: 3 });
  });
  it('欄位不足 → error', () => {
    const plan = planCourseImport(db, parseCourseImport(`${C1}\t線性代數1`));
    expect(plan.rows[0].status).toBe('error');
  });
});

describe('applyCourseImport', () => {
  it('只寫入 add 行並回傳筆數；skip 不覆蓋既有', () => {
    createCourse(db, { code: C2, name: '既有', teacher: '王', time: 'M1M2' });
    const plan = planCourseImport(db, parseCourseImport(`${C1}\t線性代數1\t許教授\tM1M2\n${C2}\t新名\t新師\tT3T4\n${C3}\t線代3\t李\tW5W6`));
    expect(applyCourseImport(db, plan)).toBe(2);
    const all = listCourses(db);
    expect(all.map(c => c.code)).toEqual([C1, C2, C3]);
    expect(all.find(c => c.code === C2)?.name).toBe('既有');
  });
  it('有 error 行時拒絕整批', () => {
    const plan = planCourseImport(db, parseCourseImport(`${C1}\t線性代數1\t許教授\tM1M2\nC001\t壞\t王\tM1M2`));
    expect(() => applyCourseImport(db, plan)).toThrow('匯入內容有錯誤，請先修正');
    expect(listCourses(db)).toHaveLength(0);
  });
});
```

Run: `npm test -- tests/course-import.test.ts` → FAIL。

- [ ] **Step 2: 實作**

`lib/course-import.ts`：
```ts
import { eq, inArray } from 'drizzle-orm';
import { Db } from './db/client';
import { courses } from './db/schema';
import { createCourse } from './courses';

export type ParsedRow = { line: number; code: string; name: string; teacher: string; time: string; raw: string };
export type PlanRow = ParsedRow & ({ status: 'add' } | { status: 'skip'; reason: string } | { status: 'error'; reason: string });
export type ImportPlan = { rows: PlanRow[]; addCount: number; skipCount: number; errorCount: number };

const CODE_RE = /^[0-9A-Za-z]{15}$/;

function splitLine(line: string): string[] {
  const sep = line.includes('\t') ? '\t' : ',';
  return line.split(sep).map(s => s.trim());
}

export function parseCourseImport(text: string): ParsedRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const rows: ParsedRow[] = [];
  lines.forEach((raw, idx) => {
    if (!raw.trim()) return;
    const cells = splitLine(raw);
    if (idx === 0 && cells.some(c => c.includes('科號'))) return;
    const [code = '', name = '', teacher = '', time = ''] = cells;
    rows.push({ line: idx + 1, code, name, teacher, time, raw });
  });
  return rows;
}

export function planCourseImport(db: Db, rows: ParsedRow[]): ImportPlan {
  const codes = rows.map(r => r.code).filter(Boolean);
  const existing = new Set(
    codes.length ? db.select({ code: courses.code }).from(courses).where(inArray(courses.code, codes)).all().map(r => r.code) : []
  );
  const seen = new Set<string>();
  const out: PlanRow[] = rows.map(r => {
    if (!CODE_RE.test(r.code)) return { ...r, status: 'error', reason: '科號必須為 15 碼英數' };
    if (!r.name || !r.teacher || !r.time) return { ...r, status: 'error', reason: '課名、授課教師、上課時間皆必填' };
    if (seen.has(r.code)) return { ...r, status: 'error', reason: '同批內科號重複' };
    seen.add(r.code);
    if (existing.has(r.code)) return { ...r, status: 'skip', reason: '科號已存在，略過' };
    return { ...r, status: 'add' };
  });
  return {
    rows: out,
    addCount: out.filter(r => r.status === 'add').length,
    skipCount: out.filter(r => r.status === 'skip').length,
    errorCount: out.filter(r => r.status === 'error').length,
  };
}

export function applyCourseImport(db: Db, plan: ImportPlan): number {
  if (plan.errorCount > 0) throw new Error('匯入內容有錯誤，請先修正');
  return db.transaction((tx) => {
    let n = 0;
    for (const r of plan.rows) {
      if (r.status !== 'add') continue;
      createCourse(tx, { code: r.code, name: r.name, teacher: r.teacher, time: r.time });
      n++;
    }
    return n;
  });
}
```
（`eq` 若未用可移除 import。）

- [ ] **Step 3: 通過與 commit**

Run: `npm test` → 全 PASS。
```bash
git add lib/course-import.ts tests/course-import.test.ts
git commit -m "批次匯入拆成 parse/plan/apply 純函式，讓預覽與寫入共用同一套驗證且可單元測試"
```

---

### Task 3: 課程管理頁：批次匯入 UI + 逐筆新增 + 列表時間欄

**Files:**
- Modify: `app/admin/courses/page.tsx`、`app/admin/courses/actions.ts`
- Create: `app/admin/courses/ImportCoursesForm.tsx`
- Modify: `components/icons.tsx`（加 `UploadIcon`）

**Interfaces:**
- Consumes: Task 2 三個函式與型別；`addCourse`（Task 1 已加 time）
- Produces: Server Actions `previewImport(text): Promise<ImportPlan>`、`confirmImport(text): Promise<{ imported: number } | { error: string }>`（confirm 會重新 parse+plan 再 apply，不信任 client 傳來的 plan）

- [ ] **Step 1: icons**

`components/icons.tsx` 加：
```tsx
export const UploadIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
);
```

- [ ] **Step 2: actions.ts 加兩個 action**

```ts
import { parseCourseImport, planCourseImport, applyCourseImport, ImportPlan } from '@/lib/course-import';

export async function previewImport(text: string): Promise<ImportPlan> {
  return planCourseImport(getDb(), parseCourseImport(String(text ?? '')));
}

export async function confirmImport(text: string): Promise<{ imported: number } | { error: string }> {
  const db = getDb();
  const plan = planCourseImport(db, parseCourseImport(String(text ?? '')));
  try {
    const imported = applyCourseImport(db, plan);
    revalidatePath('/admin/courses');
    revalidatePath('/apply');
    return { imported };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
```

- [ ] **Step 3: ImportCoursesForm.tsx**

```tsx
'use client';

import { useRef, useState, useTransition } from 'react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import { UploadIcon } from '@/components/icons';
import type { ImportPlan, PlanRow } from '@/lib/course-import';
import { previewImport, confirmImport } from './actions';

const TONE: Record<PlanRow['status'], 'success' | 'warning' | 'danger'> = { add: 'success', skip: 'warning', error: 'danger' };
const LABEL: Record<PlanRow['status'], string> = { add: '新增', skip: '略過', error: '錯誤' };

export default function ImportCoursesForm() {
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setText(await f.text());
    setPlan(null);
    setMessage(null);
  }

  function onPreview() {
    setMessage(null);
    startTransition(async () => { setPlan(await previewImport(text)); });
  }

  function onConfirm() {
    startTransition(async () => {
      const r = await confirmImport(text);
      if ('error' in r) { setMessage({ kind: 'error', text: r.error }); return; }
      setMessage({ kind: 'ok', text: `已匯入 ${r.imported} 筆` });
      setText(''); setPlan(null);
      if (fileRef.current) fileRef.current.value = '';
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="import-text" className="text-sm font-medium">貼上 Excel 內容（每行一科：科號 ⇥ 課名 ⇥ 授課教師 ⇥ 上課時間）</label>
        <textarea id="import-text" className="input min-h-40 font-mono text-sm" value={text}
          onChange={e => { setText(e.target.value); setPlan(null); setMessage(null); }}
          placeholder={'11510CHEM200104\t線性代數1\t許教授\tM1M2'} />
        <p className="text-sm text-muted-fg">Tab 或逗號分隔皆可；第一行若為標題會自動略過。</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="import-file" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border border-border bg-surface px-4 text-sm hover:bg-background">
          <UploadIcon className="size-4" /> 或上傳 CSV / TXT
        </label>
        <input id="import-file" ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFile} />
        <Button type="button" variant="secondary" onClick={onPreview} loading={pending} disabled={!text.trim()}>預覽</Button>
        {plan && (
          <Button type="button" variant="primary" onClick={onConfirm} loading={pending} disabled={plan.errorCount > 0 || plan.addCount === 0}>
            確認匯入 {plan.addCount} 筆{plan.skipCount > 0 ? `（略過 ${plan.skipCount} 筆）` : ''}
          </Button>
        )}
      </div>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-[var(--radius-card)] px-3 py-2 text-sm ${message.kind === 'error' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'}`}>
          {message.text}
        </p>
      )}

      {plan && plan.errorCount > 0 && (
        <p role="alert" className="text-sm text-danger">有 {plan.errorCount} 行錯誤，請修正後重新預覽。</p>
      )}

      {plan && (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-muted-fg">
              <tr>
                <th className="px-3 py-2 font-semibold">行</th>
                <th className="px-3 py-2 font-semibold">科號</th>
                <th className="px-3 py-2 font-semibold">課名</th>
                <th className="px-3 py-2 font-semibold">教師</th>
                <th className="px-3 py-2 font-semibold">時間</th>
                <th className="px-3 py-2 font-semibold">結果</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map(r => (
                <tr key={r.line} className="border-t border-border even:bg-background/60">
                  <td className="px-3 py-2 text-muted-fg">{r.line}</td>
                  <td className="px-3 py-2 font-mono">{r.code}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.teacher}</td>
                  <td className="px-3 py-2 font-mono">{r.time}</td>
                  <td className="px-3 py-2">
                    <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                    {r.status !== 'add' && <span className="ml-2 text-muted-fg">{r.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: page.tsx**

- 在 `<Card className="mb-6"><AddCourseForm /></Card>` 之前加：
```tsx
      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">批次匯入</h2>
        <ImportCoursesForm />
      </Card>
      <h2 className="mb-3 text-lg font-semibold">逐筆新增</h2>
```
- 列表 `<thead>` 在「教師」後加 `<th className="px-4 py-3 font-semibold">時間</th>`；`<tbody>` 對應加 `<td className="px-4 py-2 font-mono">{c.time}</td>`。
- 頁面說明改：「批次匯入或逐筆新增課程，並可停用。停用的課程不會出現在學生申請頁，但既有申請單仍可查詢。」

- [ ] **Step 5: 驗證**

`npm test && npx tsc --noEmit && npm run build`。背景 `npm run dev -- -p 3200 &`（記 PID）：curl `/admin/courses` 含 `批次匯入`、`逐筆新增`、`上課時間`、`M1M2`（seed 的時間）。kill 該 PID，確認 3200 釋放。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "課程管理提供貼上/上傳批次匯入並先預覽再寫入，讓首學期 54 科能一次進來且不會匯一半"
```

---

### Task 4: 時間帶到下拉、申請表、掃描結果

**Files:**
- Modify: `app/apply/page.tsx`、`app/apply/ApplyForm.tsx`、`app/apply/MyApplications.tsx`、`app/apply/[id]/page.tsx`、`app/admin/scan/actions.ts`、`app/admin/scan/ScanForm.tsx`

**Interfaces:**
- Consumes: `Course.time`、`ApplicationDetail.courseBTime`、`ApplicationSummary.courseBTime`（Task 1）

- [ ] **Step 1: 下拉**

`app/apply/page.tsx`：map 加 `time: c.time`。`ApplyForm.tsx`：`CourseOption` 加 `time: string`；option 文字改 `{c.code}　{c.name}（{c.teacher}）　{c.time}`；`Field` 的 hint 改「欲申請的 X-Class 課程（含上課時間），需事先與授課教師確認」。

- [ ] **Step 2: 我的申請紀錄**

`MyApplications.tsx` 表頭在「授課教師」後加 `<th>上課時間</th>`，列加 `<td className="px-3 py-2 font-mono">{a.courseBTime}</td>`。

- [ ] **Step 3: 列印頁 B 區塊**

`app/apply/[id]/page.tsx` 「三、X-Class 課程（Course B）」表格改為：
```tsx
            <tbody>
              <tr><th>科號</th><td>{a.courseBCode}</td><th>上課時間</th><td>{a.courseBTime}</td></tr>
              <tr><th>課程名稱</th><td>{a.courseBName}</td><th>授課教師</th><td>{a.courseBTeacher}</td></tr>
            </tbody>
```

- [ ] **Step 4: 掃描結果**

`app/admin/scan/actions.ts` `ScanOutcome` 加 `courseBTime: string`，回傳 `courseBTime: d.courseBTime`。`ScanForm.tsx` 的 `X-Class B` 列改 `{current.courseBCode}　{current.courseBName}（{current.courseBTeacher}）　{current.courseBTime}`。

- [ ] **Step 5: 驗證（含一頁 A4 複核）**

`npm test && npx tsc --noEmit && npm run build`。背景 dev 3200：`npx tsx -e` 建一筆 5 門 A 的申請（學號 `113000003`，取第一筆啟用課程），curl `/apply/A00000N` 含 `上課時間` 出現在 Course B 表格；`google-chrome --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer --user-data-dir=<scratch>/chrome-profile --print-to-pdf=<scratch>/v4.pdf http://localhost:3200/apply/A00000N` → `pdfinfo` `Pages: 1`。curl `-b sid=113000001 /apply` 含下拉時間。kill PID。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "X-Class 上課時間顯示於下拉、申請紀錄、申請表與掃描結果，讓衝堂資訊在每個決策點都看得到"
```

---

### Task 5: README 與線上驗證

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README**

課程管理段加「批次匯入：貼上 Excel（科號、課名、授課教師、上課時間）或上傳 CSV，預覽後整批寫入；科號已存在會略過」；假資料段提到課程含上課時間；流程一句話加「（含上課時間）」。

- [ ] **Step 2: 驗證與 commit**

```bash
npm test && npx tsc --noEmit && npm run build
git add -A && git commit -m "README 補批次匯入與上課時間說明"
```

- [ ] **Step 3: 線上驗證（控制器）**

merge 後 Render 自動部署；curl `/admin/courses` 含 `批次匯入`。人工：貼 3 行預覽三色 → 匯入 → `/apply` 下拉看時間 → 列印預覽 B 含時間。

---

## 自我檢查

**Spec 覆蓋：** §4 `courses.time` → T1；§5 下拉時間 → T4；列印 B 時間 → T4；`/admin/courses` 批次匯入卡（textarea、檔案、預覽三色、紅字擋、確認、transaction）→ T2 + T3；逐筆新增加時間 → T1 Step 8；列表時間欄 → T3；掃描含時間 → T4；§6 三列匯入錯誤 → T2；§7 seed 時間 → T1；§8 測試（課程時間必填、匯入各情境、BOM/CRLF）→ T1 + T2；README → T5。

**型別一致性：** `createCourse` 四欄在 T1 定義、T2 `applyCourseImport` 使用；`ImportPlan`/`PlanRow` 在 T2 定義、T3 `ImportCoursesForm` 與 actions 使用；`courseBTime` 在 T1 加到 `ApplicationDetail`/`ApplicationSummary`、T4 使用。

**取捨：** `confirmImport` 重新 parse+plan 而非信任 client 的 plan，多一次查詢但避免 TOCTOU 與竄改；檔案上傳走 `File.text()` 在瀏覽器端讀，不經 server 存檔。
