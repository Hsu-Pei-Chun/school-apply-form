# 課程申請表系統 — 設計文件

日期：2026-09-13（v2：對齊清大 X-Class 申請表結構、新增 UI 設計原則）
狀態：v1 已實作並合併至 main；v2 為本次修訂範圍

## 1. 背景與目標

學校約 2000 名學生、100 門課程。學生申請 X-Class 課程時，系統自動產生一張申請表，
表上印有條碼；學生列印紙本、取得教師簽章與本人簽名後送交課務組，行政人員以掃描槍掃條碼登記收件。
課程清單會持續變動，行政人員需能隨時新增或停用課程。

表單結構參考國立清華大學課務組「X-Class 課程修課申請表」
（https://curricul.site.nthu.edu.tw/p/404-1208-314422.php）：
**一張申請表綁定兩門課**——學生已修的一般課程 A，與欲申請的 X-Class 課程 B。

現階段目標：以假資料做出可 demo 的雛型，證明「申請 → 列印 → 掃描收件」流程可行，且畫面達到可給學校看的品質。

## 2. 範圍

### 做

- 學生輸入學號、選課程 A 與課程 B，產生申請表
- 申請表 A4 版型（清大格式），含 Code 128 條碼，瀏覽器直接列印
- 行政後台：課程新增 / 啟用 / 停用（含授課教師）
- 行政後台：掃描條碼登記收件，處理重複掃描與無效條碼
- 假資料產生腳本：2000 學生、100 課程
- 依第 10 節設計原則實作四個頁面的視覺

### 不做（YAGNI，等真資料進來再評估）

- 登入 / 身分驗證
- Email 或任何通知
- 申請額度或截止日的系統限制（截止日只印在表上）
- 表單版型客製化
- 學生 / 課程資料匯入 UI
- 正式部署
- 深色模式（行政工具，先只做淺色）

## 3. 技術選型

| 項目 | 選擇 | 理由 |
|---|---|---|
| 框架 | Next.js 15 (App Router) + TypeScript | 單一 repo、`npm run dev` 即可 demo |
| 資料庫 | SQLite (`better-sqlite3`) + Drizzle ORM + drizzle-kit migrations | 零安裝；schema 單一來源；換 Postgres 只改 driver |
| 條碼 | `bwip-js` 產 SVG，內嵌於頁面 | 向量圖列印不糊；不需後端產 PDF |
| 列印 | HTML A4 版型 + `@media print` + `window.print()` | 避開後端 PDF 的中文字型嵌入問題 |
| 樣式 | Tailwind CSS + `globals.css` 定義 CSS 變數 token | 四個頁面不值得引入元件庫；token 讓顏色只定義一次 |
| 測試 | Vitest | 輕量，與 Next.js 相容 |

## 4. 資料模型

```
students
  id          TEXT PK      學號
  name        TEXT         姓名
  department  TEXT         系級（例：資工系 二年級）
  is_active   INTEGER      1/0

courses
  code        TEXT PK      課程代碼
  name        TEXT         課程名稱
  teacher     TEXT         授課教師
  is_active   INTEGER      1/0（停用不刪除，保留舊申請單連結）
  created_at  TEXT         ISO 8601

applications
  id                  TEXT PK    流水號，格式 A + 6 位數字，自 A000001 起
  student_id          TEXT FK → students.id
  course_a_code       TEXT FK → courses.code   一般課程（學生已選）
  course_a_status     TEXT                     A 課程修課狀態，學生自填（例：已選上 / 加簽中）
  course_b_code       TEXT FK → courses.code   X-Class 課程（欲申請）
  status              TEXT       'printed' | 'received'（DB 層 CHECK）
  created_at          TEXT       ISO 8601
  received_at         TEXT NULL  ISO 8601，收件時寫入
```

原則：

- `applications` 一筆 = 一張紙。同一學生重複申請會產生新的一筆，各有獨立流水號。
- 條碼內容 = `applications.id`。條碼是查表的 key，不承載業務資料。
- 主檔（students / courses）用 `is_active` 停用，不物理刪除。
- A、B 兩門課從同一份 `courses` 清單選；A ≠ B（server 端驗證）。
- v1 → v2 的更名：`subjects` → `courses`、`class_name` → `department`、`subject_code` → `course_a_code` + `course_b_code`。

## 5. 頁面與流程

### 共用 Layout

- 頂部導覽列（Primary 深藍底、白字）：左側校名／系統名，右側三個入口「學生申請」「課程管理」「掃描收件」，當前頁高亮。
- 內容區置中，最寬 720px（列印頁例外），卡片白底、圓角 8px、細邊框。

### `/apply` — 學生申請

1. 輸入學號 → blur 後即時查詢；欄位下方顯示「✓ 資工系 二年級 王小明」（成功綠）或「查無此學號」（錯誤紅，`role="alert"`）
2. 選一般課程 A（下拉，只列 `is_active = 1`）+ 填修課狀態（文字欄，預設「已選上」）
3. 選 X-Class 課程 B（下拉，同一清單，排除已選的 A）
4. 按「產生申請表」→ 按鈕進入 loading → server 建立 `applications` 記錄 → 導向 `/apply/[id]`
5. 每個欄位都有可見 label 與一行說明文字；錯誤訊息緊貼欄位下方

### `/apply/[id]` — 申請表列印頁

螢幕上：置中一張有陰影的「紙」（A4 比例），上方固定工具列「列印」「回申請頁」。列印時工具列隱藏、紙張填滿 A4、強制淺色。

紙張內容（依清大格式）：

1. 抬頭：「國立○○大學 X-Class 課程修課申請表」+ 學期
2. 申請人：學號、姓名、系級
3. 一般課程 A：課程代碼、課程名稱、修課狀態
4. X-Class 課程 B：課程代碼、課程名稱、授課教師
5. 同意條款（固定文字）：不得要求補課、調整教學進度、請假延交作業等額外安排；考試衝突不予改期或補考；風險自行承擔
6. 簽章區：X-Class 授課教師簽章 ／ 學生簽名 ／ 日期
7. 送件說明：於開學第二週週五前送交課務組
8. 條碼區（右下）：Code 128 SVG，內容為流水號；下方文字印流水號、學號、B 課程代碼

流水號不存在 → 404。

### `/admin/courses` — 課程管理（v1 為 `/admin/subjects`，更名）

- 頂部卡片：新增表單（代碼、名稱、授課教師），代碼重複顯示錯誤
- 列表：斑馬紋表格；欄位代碼、名稱、教師、狀態（色標籤：啟用綠／停用灰）、建立時間、切換按鈕（outline 樣式）

### `/admin/scan` — 掃描收件

- 大字輸入框置中（字級 ≥ 24px，遠看得到），頁面載入時自動聚焦；掃描槍輸入流水號 + Enter 即提交
- 結果用大面積色塊卡片：
  - 成功：綠底，「收件成功」+ 學生／A／B 課程
  - 已收件：黃底，顯示原 `received_at`，不覆寫
  - 查無此號：紅底
- 提交後立即清空 input 並重新聚焦
- 下方列出本次 session 最近 5 筆掃描紀錄（流水號、學生、結果、時間）

## 6. 錯誤處理

| 情境 | 處理 |
|---|---|
| 學號不存在 | 欄位下方錯誤，禁止送出 |
| 送出時課程已停用（舊分頁） | server 拒絕，回傳錯誤訊息 |
| A 與 B 為同一門課 | server 拒絕：「一般課程與 X-Class 課程不可相同」 |
| 流水號格式不符或不存在 | 掃描頁紅色卡片，不拋例外 |
| 重複掃描 | 黃色卡片，保留第一次收件時間 |
| 課程代碼重複新增 | server 拒絕，表單顯示錯誤 |

## 7. 假資料

`scripts/seed.ts`：

- 2000 學生：學號 `S0001–S2000`，姓名以常見中文姓名隨機組合，系級由 10 個系 × 4 個年級組合
- 100 課程：代碼 `C001–C100`，名稱以「微積分 / 普通物理 / 計算機概論 …」加編號組合，教師以常見姓氏 + 「教授」
- 執行方式 `npm run seed`；重複執行先清空再寫入

## 8. 測試策略

單元 / 整合測試（Vitest，記憶體 SQLite）：

- 建立申請單：流水號格式正確且遞增；停用課程被拒；學號不存在被拒；A = B 被拒
- 掃描收件：`printed → received` 並寫入 `received_at`；重複掃描不覆寫；無效流水號回傳明確錯誤
- 課程管理：新增成功；代碼重複被拒；停用後不出現在申請頁下拉
- 時間格式：UTC → 台北時區

手動驗證：

- `/apply/[id]` 用 Chrome 列印預覽確認 A4 一頁、工具列隱藏、條碼清晰
- 以手機條碼 App 或掃描槍掃列印稿，確認 `/admin/scan` 正確登記
- 四個頁面在 375px / 768px / 1440px 寬度不出現橫向捲軸

## 9. 專案結構（預期）

```
school-apply-form/
  app/
    layout.tsx                共用導覽列
    globals.css               Tailwind + CSS 變數 token
    apply/page.tsx
    apply/ApplyForm.tsx
    apply/actions.ts
    apply/[id]/page.tsx
    apply/[id]/print.css
    admin/courses/page.tsx
    admin/courses/actions.ts
    admin/scan/page.tsx
    admin/scan/ScanForm.tsx
    admin/scan/actions.ts
  components/                 Button / Input / Select / Badge / Card（純 Tailwind，無外部元件庫）
  lib/
    db/schema.ts
    db/client.ts
    applications.ts
    courses.ts
    students.ts
    barcode.ts
    format.ts
  drizzle/                    migrations（drizzle-kit generate）
  design-system/school-apply-form/MASTER.md   設計系統工具產出的原始建議
  scripts/seed.ts
  tests/
```

## 10. UI 設計原則

以 `design-system/school-apply-form/MASTER.md` 為起點，依中文行政工具情境調整如下。

### 基調

學術機構、可信賴、乾淨。使用者是學生（一次性操作）與行政人員（每天重複操作），
兩者都不需要被「驚豔」，需要的是**一眼看懂、不會按錯**。

### Design Token（定義於 `globals.css`，元件只引用變數）

| Token | 值 | 用途 |
|---|---|---|
| `--color-primary` | `#1E3A5F` | 導覽列、主要按鈕、標題 |
| `--color-primary-hover` | `#16304F` | 主要按鈕 hover |
| `--color-secondary` | `#2563EB` | 連結、次要 CTA |
| `--color-background` | `#F8FAFC` | 頁面底色 |
| `--color-surface` | `#FFFFFF` | 卡片、輸入框 |
| `--color-foreground` | `#0F172A` | 主要文字 |
| `--color-muted-fg` | `#475569` | 說明文字（對白底對比 ≥ 4.5:1） |
| `--color-border` | `#CBD5E1` | 邊框、分隔線 |
| `--color-success` / `-bg` | `#15803D` / `#DCFCE7` | 收件成功、啟用標籤 |
| `--color-warning` / `-bg` | `#A16207` / `#FEF9C3` | 已收件 |
| `--color-danger` / `-bg` | `#DC2626` / `#FEE2E2` | 錯誤、查無 |
| `--radius` | `8px` | 卡片、按鈕、輸入框 |
| `--space-*` | 4 / 8 / 12 / 16 / 24 / 32 / 48px | 間距只用這組 |

### 字型

- UI：`"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif`
- 列印表：`"Noto Serif TC", "PMingLiU", serif`（正式文件感）
- 不透過 `next/font/google` 載入（build 需連網、且 Google 字型不含 CJK 子集問題）；以 CSS font stack 依賴本機字型，沒有時退回系統字型。
- 基準字級 16px、行高 1.5；掃描頁輸入框 ≥ 24px。

### 元件規則

- **按鈕**：主要（Primary 底白字）、次要（outline）、危險（紅 outline）。最小高度 44px，`cursor-pointer`，hover 150ms 過場，`disabled` 時降透明度且不可點。
- **輸入框**：可見 label 在上方、說明文字在下方、錯誤訊息取代說明文字並加 `role="alert"`；focus 顯示 2px Primary ring，不移除 outline。
- **狀態標籤（Badge）**：色底 + 深色字，不靠顏色單獨傳達（附文字）。
- **表格**：斑馬紋、表頭固定字重 600、數字欄右對齊。
- **圖示**：只用 SVG（inline Heroicons outline），不用 emoji。

### 動效

- 只用 CSS transition（150–200ms，`ease-out`），用於 hover、focus、結果卡片出現。
- 尊重 `prefers-reduced-motion`：設定時關閉所有 transition。
- 不引入 GSAP 或任何動畫函式庫。

### 版面

- 手機優先：375px 單欄；≥ 768px 表單維持單欄（最寬 720px）；表格在 < 768px 允許橫向捲動（外層 `overflow-x: auto`），頁面本身不可橫向捲動。
- 列印頁螢幕模式為「紙張預覽」，列印模式移除所有裝飾（陰影、工具列、底色）。

### 頁面別重點

| 頁面 | 使用情境 | 設計重點 |
|---|---|---|
| `/apply` | 學生一次性填寫 | 單欄、逐步確認（學號 ✓ → 選課），按鈕只在資料齊全時啟用 |
| `/apply/[id]` | 列印 | 螢幕上像紙、列印時就是紙；條碼區留白足夠避免掃描誤讀 |
| `/admin/courses` | 行政偶爾維護 | 新增在上、列表在下；停用的列降低對比 |
| `/admin/scan` | 行政連續掃描、離螢幕遠 | 大字、大色塊、少文字；結果卡片 200ms 淡入方便察覺變化 |

### 交付前檢查

- [ ] 所有互動元素 `cursor-pointer` 且有 hover / focus 狀態
- [ ] 文字對比 ≥ 4.5:1（Muted 文字對白底已驗證）
- [ ] 每個 input 都有 `<label for>`
- [ ] 錯誤訊息有 `role="alert"`
- [ ] `prefers-reduced-motion` 生效
- [ ] 375 / 768 / 1440 寬度無橫向捲軸
- [ ] 沒有 emoji 當圖示

## 11. 未來擴充方向（不在本次範圍）

- 換成 Postgres 或搬入 AI GO 資料中心：schema 已對齊，只換資料層
- 接學校 SSO 取代手填學號
- 收件統計報表
- 深色模式
