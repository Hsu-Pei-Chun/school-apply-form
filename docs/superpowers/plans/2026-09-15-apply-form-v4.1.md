# 課程申請表系統 v4.1 Implementation Plan（hotfix）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依校方真實課程檔（54 科）修正：科號允許空格補位、匯入依標題列對應欄位（5 欄含英文課名）、CSV 引號、科號顯示保留空格；校方檔案 54 筆全部可匯入。

**Architecture:** 先改資料層（科號規則、`name_en` 欄位、條碼／掃描允許空格、migration 重產、seed 模擬含空格科號），再改匯入純函式（標題對應 + RFC 4180 引號 + 5 欄預設）並以校方 fixture 做整批測試，最後補 UI（英文課名欄、`whitespace-pre`）與 README。

**Tech Stack:** Next.js 15.5, React 19, Tailwind v4, better-sqlite3 + drizzle-orm 0.45, Vitest

**Spec:** `docs/superpowers/specs/2026-09-13-apply-form-design.md`（v4.1）

## Global Constraints

- **破壞性 schema 變更**（`courses.name_en`）：`rm -rf drizzle data && npx drizzle-kit generate` 重產 `0000_*`；`data/` 不進 git
- 科號規則：`/^[0-9A-Za-z ]{15}$/`（15 碼，每碼英數或空格），訊息 `科號必須為 15 碼（英數或空格）`；儲存與比對**保留內部空格，只 trim 首尾**
- 條碼 `BARCODE_RE` 改 `/^[0-9A-Za-z ]{24}$/`；`receiveByInput` 只 trim 首尾
- `courses.name_en TEXT NOT NULL DEFAULT ''`；`createCourse` 的 `nameEn` 選填（預設 `''`）
- 匯入標題同義詞：科號→`科號`；name→`中文課名`/`課名`/`課程名稱`；nameEn→`英文課名`；time→`上課時間`/`時間`；teacher→`教師`/`授課教師`。無標題預設順序 `科號、中文課名、英文課名、上課時間、教師`。標題缺 `科號`/`中文課名`/`上課時間`/`教師` 任一 → throw `標題列缺少欄位：X、Y`
- 逗號模式支援 RFC 4180：`"a,b"` 為一欄、`""` 為跳脫引號；Tab 模式不處理引號
- 校方 fixture `tests/fixtures/xclass-11510.tsv`（標題 + 54 行）必須 54 筆全為 `add`
- 所有顯示科號的地方用 `whitespace-pre`（Tailwind）或 `white-space: pre`（print.css）
- 子代理只能 kill 自己起的 PID，禁 `pkill`；3100 屬控制器；驗證後確認 3200 釋放
- 每個 Task `npm test && npx tsc --noEmit && npm run build` 必過；commit 說明「為什麼」；不得 `--no-verify`

---

### Task 1: 科號允許空格、`name_en`、條碼／掃描同步

**Files:**
- Modify: `lib/db/schema.ts`、`lib/courses.ts`、`lib/applications.ts`、`lib/seed.ts`、`app/admin/courses/AddCourseForm.tsx`、`app/admin/courses/actions.ts`
- Regenerate: `drizzle/`
- Tests: `tests/courses.test.ts`、`tests/applications.test.ts`、`tests/barcode.test.ts`、`tests/db.test.ts`、`tests/seed.test.ts`、`tests/course-import.test.ts`（既有科號規則訊息字串同步）

**Interfaces:**
- Produces: `Course.nameEn: string`；`createCourse(db, {code, name, teacher, time, nameEn?})`；科號／條碼正規式如 Global Constraints

- [ ] **Step 1: 測試先改（RED）**

`tests/courses.test.ts` 新增：
```ts
  it('科號可含空格補位（校方格式）', () => {
    const c = createCourse(db, { code: '11510AIA 500700', name: '實體人工智慧', teacher: '陽明交大', time: 'T5T6T7' });
    expect(c.code).toBe('11510AIA 500700');
    expect(c.nameEn).toBe('');
    expect(listCourses(db)[0].code).toBe('11510AIA 500700');
  });
  it('科號含兩個空格也保留', () => {
    createCourse(db, { code: '11510CS  110400', name: '關鍵科技探索', teacher: '磨課師', time: 'Mn', nameEn: 'Key Technology' });
    expect(listCourses(db)[0].code).toBe('11510CS  110400');
    expect(listCourses(db)[0].nameEn).toBe('Key Technology');
  });
```
既有「含空格 → 拋錯」案例改為「含 `-` 或中文 → 拋錯」，訊息改 `科號必須為 15 碼（英數或空格）`；`tests/course-import.test.ts` 內比對舊訊息 `科號必須為 15 碼英數` 的斷言同步改。

`tests/applications.test.ts` 新增 describe：
```ts
describe('科號含空格的條碼', () => {
  const BS = '11510CS  110400';
  it('barcode 24 碼含空格；receiveByInput 可對到', () => {
    createCourse(db, { code: BS, name: '關鍵科技', teacher: '磨課師', time: 'Mn' });
    const a = createApplication(db, { ...base, courseBCode: BS });
    expect(a.barcode).toBe(SID + BS);
    expect(a.barcode.length).toBe(24);
    expect(receiveByInput(db, `  ${SID}${BS}  `).kind).toBe('received');
  });
});
```
`tests/barcode.test.ts` 加案例：`renderCode128Svg('11300000111510CS  110400')` 回傳 `<svg`。
`tests/db.test.ts`：courses insert 不必給 `nameEn`（有 default）；加一案 `code: '11510CS  110400'` 可插入。
`tests/seed.test.ts`：加 `expect(db.select().from(courses).all().some(c => c.code.includes(' '))).toBe(true)`。

Run: `npm test` → FAIL。

- [ ] **Step 2: schema + migration**

`courses` 表在 `name` 後加 `nameEn: text('name_en').notNull().default('')`。
```bash
rm -rf drizzle data && npx drizzle-kit generate && grep -n "name_en" drizzle/0000_*.sql
```

- [ ] **Step 3: courses.ts**

```ts
export const COURSE_CODE_RE = /^[0-9A-Za-z ]{15}$/;
export const COURSE_CODE_ERROR = '科號必須為 15 碼（英數或空格）';

export function createCourse(db: Db, input: { code: string; name: string; teacher: string; time: string; nameEn?: string }): Course {
  if (!COURSE_CODE_RE.test(input.code)) throw new Error(COURSE_CODE_ERROR);
  if (!input.time.trim()) throw new Error('上課時間為必填');
  const exists = db.select().from(courses).where(eq(courses.code, input.code)).get();
  if (exists) throw new Error('課程代碼已存在');
  const row: Course = {
    code: input.code, name: input.name, nameEn: input.nameEn ?? '', teacher: input.teacher,
    time: input.time.trim(), isActive: 1, createdAt: new Date().toISOString(),
  };
  db.insert(courses).values(row).run();
  return row;
}
```

- [ ] **Step 4: applications.ts / seed.ts / 逐筆新增**

- `lib/applications.ts`：`BARCODE_RE = /^[0-9A-Za-z ]{24}$/`。
- `lib/seed.ts`：`DEPT_CODES` 的 `'CS00'` 改 `'CS  '`（兩個空格，模擬校方補位）；`createCourse` 加 `nameEn: \`Course ${i}\``。
- `app/admin/courses/AddCourseForm.tsx`：科號 `pattern="[0-9A-Za-z ]{15}"`，hint 改「例：11510AIA 500700（含空格補位，共 15 碼）」；加選填 `<Field id="nameEn" label="英文課名（選填）"><input id="nameEn" name="nameEn" className="input" /></Field>`；grid 改 6 欄 `sm:grid-cols-[1fr_2fr_2fr_1fr_1fr_auto]`、error `sm:col-span-6`。
- `app/admin/courses/actions.ts` `addCourse`：讀 `nameEn`（可空），**科號只 `trim()` 首尾**（現有 `.trim()` 已是如此，確認不要 `replace(/\s/g,'')`）。

- [ ] **Step 5: 通過與 commit**

`npm test && npx tsc --noEmit && npm run build`。
```bash
git add -A
git commit -m "科號允許空格補位並新增英文課名，對齊校方真實課程檔；條碼與掃描同步接受空格"
```

---

### Task 2: 匯入依標題對應、CSV 引號、5 欄預設；fixture 54 筆全 add

**Files:**
- Modify: `lib/course-import.ts`、`tests/course-import.test.ts`、`app/admin/courses/ImportCoursesForm.tsx`、`app/admin/courses/page.tsx`
- Fixture（已存在）: `tests/fixtures/xclass-11510.tsv`

**Interfaces:**
- Consumes: `createCourse`（含 `nameEn`）、`COURSE_CODE_RE`、`COURSE_CODE_ERROR`（Task 1）
- Produces: `ParsedRow` 加 `nameEn: string`；`parseCourseImport` 對缺必要標題 throw `標題列缺少欄位：…`

- [ ] **Step 1: 測試（RED）**

`tests/course-import.test.ts` 新增／修改：
```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('標題列對應', () => {
  it('依標題名稱對應，順序無關，英文課名可缺', () => {
    const text = '教師\t上課時間\t課名\t科號\n許教授\tM1M2\t線性代數1\t11510CHEM200104';
    const rows = parseCourseImport(text);
    expect(rows[0]).toMatchObject({ code: '11510CHEM200104', name: '線性代數1', teacher: '許教授', time: 'M1M2', nameEn: '' });
  });
  it('校方 5 欄標題（科號、中文課名、英文課名、上課時間、教師）', () => {
    const text = '科號\t中文課名\t英文課名\t上課時間\t教師\n11510AIA 200100\t統計學--台大\tStatistics--NTU\tW2W3W4\t台大李宗穎,周瑞賢';
    const rows = parseCourseImport(text);
    expect(rows[0]).toMatchObject({ code: '11510AIA 200100', name: '統計學--台大', nameEn: 'Statistics--NTU', time: 'W2W3W4', teacher: '台大李宗穎,周瑞賢' });
  });
  it('無標題時依校方 5 欄順序', () => {
    const rows = parseCourseImport('11510AIA 200100\t統計學\tStatistics\tW2W3W4\t李宗穎');
    expect(rows[0]).toMatchObject({ code: '11510AIA 200100', name: '統計學', nameEn: 'Statistics', time: 'W2W3W4', teacher: '李宗穎' });
  });
  it('標題缺必要欄位 → 整批錯誤', () => {
    expect(() => parseCourseImport('科號\t課名\t上課時間\n11510AIA 200100\tx\tM1')).toThrow('標題列缺少欄位：教師');
  });
});

describe('CSV 引號', () => {
  it('逗號模式：引號內逗號不切、雙引號跳脫', () => {
    const text = '科號,中文課名,英文課名,上課時間,教師\n11510AIA 200100,"統計學, 進階","Stats ""A""",W2W3W4,"台大李宗穎,周瑞賢"';
    const rows = parseCourseImport(text);
    expect(rows[0]).toMatchObject({ name: '統計學, 進階', nameEn: 'Stats "A"', teacher: '台大李宗穎,周瑞賢' });
  });
});

describe('校方真實檔案', () => {
  it('54 筆全部為 add，科號空格保留', () => {
    const text = readFileSync(path.join(__dirname, 'fixtures/xclass-11510.tsv'), 'utf-8');
    const plan = planCourseImport(db, parseCourseImport(text));
    expect(plan.rows).toHaveLength(54);
    expect(plan.errorCount).toBe(0);
    expect(plan.addCount).toBe(54);
    expect(plan.rows.find(r => r.code === '11510CS  110400')).toBeTruthy();
    expect(applyCourseImport(db, plan)).toBe(54);
    expect(listCourses(db).find(c => c.code === '11510AIA 200100')?.teacher).toBe('台大李宗穎,周瑞賢');
  });
});
```
既有測試中「4 欄順序 `科號 課名 教師 時間`」的無標題案例改成 5 欄順序（或加標題列）；含空格科號的舊「錯誤」案例改為預期 `add`；`科號必須為 15 碼英數` 字串改 `COURSE_CODE_ERROR`。

- [ ] **Step 2: 實作 parse**

`lib/course-import.ts` 重寫 parse 部分：
```ts
import { COURSE_CODE_RE, COURSE_CODE_ERROR, createCourse } from './courses';

export type ParsedRow = { line: number; code: string; name: string; nameEn: string; teacher: string; time: string; raw: string };
type Field = 'code' | 'name' | 'nameEn' | 'time' | 'teacher';
const HEADER_ALIASES: Record<Field, string[]> = {
  code: ['科號'], name: ['中文課名', '課名', '課程名稱'], nameEn: ['英文課名'], time: ['上課時間', '時間'], teacher: ['教師', '授課教師'],
};
const REQUIRED: Field[] = ['code', 'name', 'time', 'teacher'];
const DEFAULT_ORDER: Field[] = ['code', 'name', 'nameEn', 'time', 'teacher'];
const FIELD_LABEL: Record<Field, string> = { code: '科號', name: '中文課名', nameEn: '英文課名', time: '上課時間', teacher: '教師' };

function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}
function splitLine(line: string): string[] {
  return line.includes('\t') ? line.split('\t').map(s => s.trim()) : splitCsv(line);
}
function headerMap(cells: string[]): Partial<Record<Field, number>> | null {
  if (!cells.some(c => c.includes('科號'))) return null;
  const map: Partial<Record<Field, number>> = {};
  cells.forEach((c, i) => {
    for (const f of Object.keys(HEADER_ALIASES) as Field[]) {
      if (map[f] === undefined && HEADER_ALIASES[f].some(a => c === a)) map[f] = i;
    }
  });
  const missing = REQUIRED.filter(f => map[f] === undefined);
  if (missing.length) throw new Error(`標題列缺少欄位：${missing.map(f => FIELD_LABEL[f]).join('、')}`);
  return map;
}

export function parseCourseImport(text: string): ParsedRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  if (lines.length > MAX_IMPORT_LINES) throw new Error(`一次最多匯入 ${MAX_IMPORT_LINES} 行`);
  const rows: ParsedRow[] = [];
  let map: Partial<Record<Field, number>> | null = null;
  let first = true;
  lines.forEach((raw, idx) => {
    if (!raw.trim()) return;
    const cells = splitLine(raw);
    if (first) { first = false; const m = headerMap(cells); if (m) { map = m; return; } }
    const get = (f: Field) => {
      const i = map ? map[f] : DEFAULT_ORDER.indexOf(f);
      return i === undefined || i < 0 ? '' : (cells[i] ?? '');
    };
    rows.push({ line: idx + 1, code: get('code'), name: get('name'), nameEn: get('nameEn'), teacher: get('teacher'), time: get('time'), raw });
  });
  return rows;
}
```
`planCourseImport` 的科號檢查改用 `COURSE_CODE_RE` / `COURSE_CODE_ERROR`（移除本地 `CODE_RE`）；`applyCourseImport` 的 `createCourse` 加 `nameEn: r.nameEn`。

- [ ] **Step 3: UI**

- `ImportCoursesForm.tsx`：預覽表加「英文課名」欄（在課名後）；科號 `<td>` 加 `whitespace-pre`；說明文字改「第一行請為標題列（科號、中文課名、英文課名、上課時間、教師，順序不限）；Tab 或逗號分隔皆可；CSV 請以 UTF-8 儲存。」；placeholder 改 `科號\t中文課名\t英文課名\t上課時間\t教師`。
- `app/admin/courses/page.tsx`：列表加「英文課名」欄；科號 `<td>` 加 `whitespace-pre`。

- [ ] **Step 4: 驗證與 commit**

`npm test && npx tsc --noEmit && npm run build`。背景 dev 3200：curl `/admin/courses` 含 `英文課名`；用 `curl -s -X POST` 無法直接打 Server Action，故匯入以測試（fixture 54 add）為準。kill 自己的 PID。
```bash
git add -A
git commit -m "匯入改依標題列對應欄位並支援 CSV 引號，校方 54 科檔案可完整匯入；先前依位置對應會把英文課名寫進教師欄"
```

---

### Task 3: 科號空格在所有顯示點保留 + README

**Files:**
- Modify: `app/apply/ApplyForm.tsx`、`app/apply/MyApplications.tsx`、`app/apply/[id]/page.tsx`、`app/apply/[id]/print.css`、`app/admin/scan/ScanForm.tsx`、`README.md`

- [ ] **Step 1: 顯示**

- `MyApplications.tsx` 科號 `<td>` 加 `whitespace-pre`。
- `ApplyForm.tsx` option 文字：`<option>` 內空白會被瀏覽器壓縮，無法用 CSS；改為把科號中的空格以 ` `（不換行空白）取代後顯示：`{c.code.replace(/ /g, ' ')}　{c.name}（{c.teacher}）　{c.time}`。value 維持原始 code。
- `app/apply/[id]/page.tsx`：Course B 科號 `<td>` 與條碼 `.human` 都加 `className="code"`；`print.css` 加 `.sheet .code, .barcode .human { white-space: pre; }`。
- `ScanForm.tsx`：結果卡與最近掃描的 barcode／科號文字 `<span>`/`<dd>` 加 `whitespace-pre`。
- 更新 `tests/apply-form.test.tsx`（若比對 option 字串，改用 ` `）。

- [ ] **Step 2: README**

課程管理段改：「批次匯入：貼上 Excel（第一行為標題：科號、中文課名、英文課名、上課時間、教師，順序不限）或上傳 UTF-8 CSV，預覽後整批寫入；科號已存在會略過。科號 15 碼可含空格補位（如 `11510AIA 500700`），系統會原樣保留。」

- [ ] **Step 3: 驗證與 commit**

`npm test && npx tsc --noEmit && npm run build`。背景 dev 3200：`npx tsx -e` 用 `11510CS  110400`（先 `createCourse`）建一筆申請，curl `/apply/<id>` 含 `11510CS  110400`（兩個空格）與 `white-space: pre`；headless Chrome `Pages: 1`。kill 自己的 PID。
```bash
git add -A
git commit -m "科號在下拉、紀錄、申請表、掃描卡皆保留空格，避免補位空格被瀏覽器壓縮而看起來像另一個科號"
```

---

## 自我檢查

**Spec 覆蓋：** v4.1 三列（空格、標題對應+英文課名、CSV 引號）→ T1、T2；§4 `name_en` → T1；§5 欄位對應與同義詞、缺欄位錯誤 → T2；§8 fixture 54 add、含空格條碼可掃 → T1/T2；顯示保留空格 → T3；README → T3。

**型別一致性：** `COURSE_CODE_RE`/`COURSE_CODE_ERROR` 在 T1 匯出、T2 使用；`ParsedRow.nameEn` 在 T2 定義並傳給 `createCourse.nameEn`（T1）。

**取捨：** `<option>` 用 ` ` 而非 CSS（瀏覽器限制）；Tab 模式不處理引號（Excel 貼上不會產生引號）。
