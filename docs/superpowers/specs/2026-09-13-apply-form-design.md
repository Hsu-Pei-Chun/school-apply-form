# 課程申請表系統 — 設計文件

日期：2026-09-15（v4：X-Class 課程加上課時間、課程批次匯入）
狀態：v1–v3 已實作並合併至 main，部署於 Render；v4 為本次修訂範圍

## 1. 背景與目標

學校約 2000 名學生、100 門 X-Class 課程。學生申請 X-Class 課程時，系統自動產生一張申請表，
表上印有條碼；學生列印紙本、取得教師簽章與本人簽名後送交課務組，行政人員以掃描槍掃條碼登記收件，
掃到的內容要能直接寫入校方既有系統。X-Class 課程清單會持續變動，行政人員需能隨時新增或停用。

表單結構參考國立清華大學課務組「X-Class 課程修課申請表」
（https://curricul.site.nthu.edu.tw/p/404-1208-314422.php）：
一張申請表 = 學生已修的一般課程 A（**一至多門，可為校內或校外，學生手填**）+ 欲申請的 X-Class 課程 B（一門，從清單選）。

### v3 依校方回饋的變更摘要

| 回饋 | 對應變更 |
|---|---|
| 學生登入校務系統後應自動帶出學號 | 新增 `/login` 假登入 + `lib/auth.ts` 單一替換點；`/apply` 學號唯讀 |
| A 課程可能是校內或校外、可能不只一門 | A 課程改為學生手填 1–5 門（科號、課名、上課時間、任課教師），獨立子表 |
| 條碼改右上角，內容為學號 + 科號，供校方系統寫入 | 條碼內容 = 學號 9 碼 + B 科號 15 碼（24 碼、無分隔符），置於抬頭右側 |
| 同一學生對同一 X-Class 課程不可重複申請 | server + DB UNIQUE 擋下，並提供原申請表重印連結 |
| 申請畫面要同時看到該學生已申請的 X-Class | `/apply` 下半部為「我的申請紀錄」報表 |

### v4 依校方回饋的變更摘要

| 回饋 | 對應變更 |
|---|---|
| 這張表就是為了衝堂特許，X-Class 課程最重要的是上課時間 | `courses.time`（自由文字，如 `M1M2`、`T1T2R1R2`），下拉、申請表、掃描結果皆顯示 |
| 首次要一次匯入 54 科，之後仍要能逐筆新增 | `/admin/courses` 新增「批次匯入」：貼上 Excel 內容或上傳 CSV → 預覽 → 確認；逐筆新增保留 |

## 2. 範圍

### 做

- 假登入（輸入學號即登入，不驗密碼）→ `/apply` 帶出學號、姓名、系級
- 學生手填 1–5 門一般課程 A、選一門 X-Class 課程 B，產生申請表
- 申請表 A4 版型（清大格式），條碼於右上角，瀏覽器直接列印
- 行政後台：課程新增 / 啟用 / 停用（含授課教師、上課時間）；批次匯入（貼上或 CSV，預覽後整批寫入）
- 行政後台：掃描 24 碼條碼登記收件，處理重複掃描與無效條碼；亦相容流水號
- 假資料：2000 學生（9 碼學號）、100 課程（15 碼科號）
- 依第 10 節設計原則實作視覺

### 不做（YAGNI）

- 真實 SSO / 密碼驗證（`lib/auth.ts` 預留替換點）
- 後台登入
- Email 或任何通知
- 申請額度或截止日的系統限制
- A 課程進主檔或統計
- 學生資料匯入 UI
- Excel `.xlsx` 直接解析（貼上或 CSV 已足夠）
- 節次衝堂自動比對（衝堂由人工判斷，系統只負責印出時間）
- 深色模式

## 3. 技術選型

| 項目 | 選擇 | 理由 |
|---|---|---|
| 框架 | Next.js 15 (App Router) + TypeScript | 單一 repo、`npm run dev` 即可 demo |
| 資料庫 | SQLite (`better-sqlite3`) + Drizzle ORM + drizzle-kit migrations | 零安裝；schema 單一來源；換 Postgres 只改 driver |
| Session | httpOnly cookie，內容為學號（demo 不簽章） | 假登入只需識別身分；換 SSO 時改 `lib/auth.ts` |
| 條碼 | `bwip-js` 產 SVG，內嵌於頁面 | 向量圖列印不糊；不需後端產 PDF |
| 列印 | HTML A4 版型 + `@media print` + `window.print()` | 避開後端 PDF 的中文字型嵌入問題 |
| 樣式 | Tailwind CSS v4 + `globals.css` 定義 token | token 讓顏色只定義一次 |
| 測試 | Vitest | 輕量，與 Next.js 相容 |
| 部署 | Dockerfile（Next standalone）→ Render Free / Railway | SQLite 需要真實檔案系統 |

## 4. 資料模型

```
students
  id          TEXT PK      學號，固定 9 碼數字（CHECK length = 9）
  name        TEXT         姓名
  department  TEXT         系級（例：資工系 二年級）
  is_active   INTEGER      1/0

courses                    X-Class 課程主檔
  code        TEXT PK      科號，固定 15 碼英數（CHECK length = 15）
  name        TEXT         課程名稱
  teacher     TEXT         授課教師
  time        TEXT         上課時間，自由文字（例：M1M2、T1T2R1R2），不做格式驗證
  is_active   INTEGER      1/0（停用不刪除，保留舊申請單連結）
  created_at  TEXT         ISO 8601

applications
  id             TEXT PK    流水號，格式 A + 6 位數字（內部主鍵，不印條碼）
  student_id     TEXT FK → students.id
  course_b_code  TEXT FK → courses.code   X-Class 課程（欲申請）
  barcode        TEXT       = student_id || course_b_code，24 碼（CHECK length = 24），建立時寫入；UNIQUE
  UNIQUE (student_id, course_b_code)   同一學生同一 X-Class 課程只能有一張
  status         TEXT       'printed' | 'received'（DB 層 CHECK）
  created_at     TEXT       ISO 8601
  received_at    TEXT NULL  ISO 8601，收件時寫入

application_courses_a      一般課程 A（一對多，學生手填）
  id              INTEGER PK AUTOINCREMENT
  application_id  TEXT FK → applications.id
  seq             INTEGER  1..5，同一 application 內唯一
  code            TEXT     科號（課號），自由文字
  name            TEXT     課名
  time            TEXT     上課時間
  teacher         TEXT     任課教師
```

原則：

- `applications` 一筆 = 一張紙。**同一學生對同一 B 課程只能有一筆**（不論狀態）；重複申請時 server 拒絕並回傳既有流水號供重印。
- 條碼承載業務資料（學號 + B 科號），因為校方收件系統要直接讀取寫入；因上一條，條碼在系統內唯一。流水號保留為內部 PK。
- 掃描時以條碼直接對到唯一一筆申請單。
- A 課程為自由文字，不與 `courses` 關聯；每張申請單 1–5 門，`seq` 保序。
- 主檔（students / courses）用 `is_active` 停用，不物理刪除。
- v2 → v3、v3 → v4 皆為破壞性變更：重產 migration `0000`，重 seed。

## 5. 頁面與流程

### 認證（`lib/auth.ts`）

- `getCurrentStudent(): Student | null`：讀 cookie `sid` → 查 `students`；找不到或 `is_active = 0` 回 null
- `login(studentId)` / `logout()`：寫入 / 清除 cookie
- **這是接真 SSO 時唯一要換的檔案**；頁面與 Server Action 只呼叫 `getCurrentStudent()`

### 共用 Layout

- 頂部導覽列（Primary 深藍底、白字）：左側校名／系統名，右側入口「學生申請」「課程管理」「掃描收件」；已登入時右側顯示「學號 姓名｜登出」
- 內容區置中，最寬 720px（列印頁例外）

### `/login` — 假登入

- 一個欄位「學號」+ 按鈕「登入」；說明文字「Demo 環境：輸入學號即可登入，正式環境將由校務系統單一登入取代」
- 學號不存在 → 欄位下方錯誤 `role="alert"`
- 成功 → 導向 `/apply`（或 `?next=` 指定頁）

### `/apply` — 學生申請

1. 未登入 → 導向 `/login?next=/apply`
2. 頂部唯讀卡片顯示：學號、姓名、系級（不可編輯）
3. **一般課程 A**（至少 1 門、最多 5 門）：每門一張小卡，四個文字欄位——科號（課號）、課名、上課時間、任課教師，皆必填；「＋ 新增一門」按鈕（達 5 門時停用）；每張卡可刪除（只剩 1 門時刪除鈕停用）。表單欄位名 `courseA[i][code]` 等
4. **X-Class 課程 B**：下拉，只列 `is_active = 1`，顯示「科號　課名（教師）　上課時間」
5. 按「產生申請表」→ loading → server 驗證（A 至少 1 門且每欄非空、B 存在且啟用、**該學生尚未申請過此 B 課程**）→ 同一 transaction 寫入 `applications` + `application_courses_a` → 導向 `/apply/[id]`
6. 每個欄位都有可見 label；錯誤訊息緊貼欄位下方或表單頂部 `role="alert"`
7. 已申請過 → 表單頂部紅色提示「你已申請過此 X-Class 課程」+ 連結「查看／重新列印原申請表」→ `/apply/[原流水號]`
8. **下半部「我的申請紀錄」**（獨立 Card，位於表單下方）：列出該學生所有申請單，依申請時間新→舊；欄位：X-Class 科號、課名、授課教師、申請日期、狀態 Badge（`printed` → 「已產生」灰、`received` → 「已收件」綠）、操作「列印」連結 → `/apply/[id]`。無紀錄時顯示「尚未申請任何 X-Class 課程」。產生新申請單導回 `/apply` 時此列表即時反映。

### `/apply/[id]` — 申請表列印頁

螢幕上：置中一張有陰影的「紙」（A4 比例），上方固定工具列「列印」「回申請頁」。列印時工具列隱藏、紙張填滿 A4、強制淺色。

紙張內容（依清大格式）：

1. **抬頭列**：左側「國立○○大學 X-Class 課程修課申請表」+ 學期；**右側條碼區**：Code 128 SVG（內容 24 碼）+ 下方人類可讀 24 碼文字（等寬字）。條碼區寬約 60mm、四周留白 ≥ 5mm
2. 申請人：學號、姓名、系級
3. 一般課程 A：表格，每門一列——`#｜科號｜課名｜上課時間｜任課教師`
4. X-Class 課程 B：科號、課程名稱、授課教師、**上課時間**
5. 同意條款（固定文字）
6. 簽章區：X-Class 授課教師簽章 ／ 學生簽名 ／ 日期
7. 送件說明：於開學第二週週五前送交課務組
8. 頁尾小字：流水號（內部參考用）

任何人知道流水號都可開此頁（demo 不做擁有者驗證）。流水號不存在 → 404。

### `/admin/courses` — 課程管理

- 卡片一「批次匯入」：
  - `textarea` 貼上 Excel 內容，每行一科：`科號 ⇥ 課名 ⇥ 授課教師 ⇥ 上課時間`；分隔符自動偵測（Tab 優先，其次逗號）；第一行若含「科號」視為標題列跳過；也可上傳 `.csv`/`.txt` 檔，內容讀進同一 textarea
  - 按「預覽」→ 逐行解析結果表：每行顯示科號、課名、教師、時間、狀態——`新增`（綠）／`已存在，略過`（黃）／`錯誤：<原因>`（紅，原因：欄位數不足、科號非 15 碼英數、課名/教師/時間空白、同批內科號重複）
  - 有任何紅字行 → 「確認匯入」按鈕停用，提示先修正；否則顯示「確認匯入 N 筆（略過 M 筆）」
  - 確認 → 整批一個 transaction 寫入；成功後顯示「已匯入 N 筆」並清空 textarea
  - 解析與驗證為純函式 `lib/course-import.ts`：`parseCourseImport(text): ParsedRow[]`、`planCourseImport(db, rows): ImportPlan`、`applyCourseImport(db, plan): number`
- 卡片二「逐筆新增」：科號 15 碼、名稱、授課教師、上課時間，皆必填；科號長度/英數不符或重複顯示錯誤
- 列表：斑馬紋表格；科號（等寬字）、名稱、教師、時間、狀態 Badge、建立時間、切換按鈕

### `/admin/scan` — 掃描收件

- 大字輸入框置中、自動聚焦；掃描槍輸入 + Enter 即提交
- 輸入解析：
  - 24 碼 → 以 `barcode` 欄位直接查唯一一筆申請單
  - `A` + 6 位數字 → 以流水號查（行政人員手動查用）
  - 其他 → 格式錯誤
- 結果色塊卡片：
  - 成功：綠底，「收件成功」+ 學生、A 課程列表（多列）、B 課程（含上課時間）
  - 已收件：黃底，顯示原 `received_at`
  - 查無：紅底，區分「格式錯誤」與「查無此申請單」
- 提交後立即清空 input 並重新聚焦；下方最近 5 筆

## 6. 錯誤處理

| 情境 | 處理 |
|---|---|
| 登入學號不存在 / 已停用 | `/login` 欄位錯誤，不建 session |
| 未登入進 `/apply` | 導向 `/login?next=/apply` |
| session 學號已不存在（資料重 seed） | 視為未登入，清 cookie 並導向 `/login` |
| A 課程 0 門或任一欄空白 | server 拒絕：「一般課程至少一門，且每門四欄皆必填」 |
| A 課程超過 5 門 | server 拒絕：「一般課程最多五門」 |
| 送出時 B 課程已停用或不存在 | server 拒絕：「課程不存在或已停用」 |
| 同學生已申請過同一 B 課程 | server 拒絕：「你已申請過此 X-Class 課程」，回傳既有流水號；DB UNIQUE 為最後防線 |
| 掃描輸入非 24 碼且非流水號 | 紅卡「條碼格式錯誤」 |
| 24 碼拆出的學號/科號查無申請單 | 紅卡「查無此申請單」 |
| 重複掃描 | 黃卡，保留第一次收件時間 |
| 課程科號非 15 碼 / 重複新增 | server 拒絕，表單顯示錯誤 |
| 批次匯入任一行錯誤 | 預覽標紅，整批不可匯入 |
| 批次匯入科號已存在 | 預覽標黃、略過，不更新既有資料 |
| 批次匯入同批科號重複 | 後出現者標紅 |

## 7. 假資料

`lib/seed.ts`（`npm run seed`，`--if-empty` 供容器啟動）：

- 2000 學生：學號 9 碼 = `113` + 6 位流水（`113000001`–`113002000`），姓名隨機組合，系級 10 系 × 4 年級
- 100 課程：科號 15 碼 = `11510` + 系所 4 碼（`EECS`/`MATH`/`PHYS`/`CHEM`/`ECON`/`CHIN`/`LANG`/`LIFE`/`MSE0`/`CS00`）+ 6 碼課號（`200101` 起）= 15 碼純英數無空格；名稱「微積分 / 普通物理 …」+ 編號；教師「姓氏 + 教授」；上課時間輪流取 `M1M2` / `T3T4` / `W5W6` / `R7R8` / `F1F2` / `M3M4R3R4`
- 不預先產生申請單

## 8. 測試策略

單元 / 整合測試（Vitest，記憶體 SQLite）：

- 認證：`login` 寫 cookie、`getCurrentStudent` 對不存在學號回 null（以可注入的 cookie store 測）
- 建立申請單：流水號遞增；`barcode` = 學號 + B 科號；A 課程 0 門 / 6 門 / 欄位空白被拒；B 停用被拒；**同學生同 B 課程第二次被拒且回傳既有 id**；同學生不同 B 課程可以；A 課程順序保留；transaction（B 無效時 A 子表不殘留）
- 掃描：24 碼 → 唯一一筆 `printed → received`；流水號路徑仍可用；格式錯誤與查無分開回報；重複掃描不覆寫
- 申請紀錄：`listApplicationsByStudent` 只回該學生、新→舊、含 B 課程名稱與教師
- 課程管理：科號非 15 碼英數被拒；重複被拒；時間空白被拒
- 批次匯入：Tab / 逗號分隔皆可；標題列跳過；空行跳過；欄位不足、科號格式、空白欄位、同批重複各自標紅；已存在標黃且不寫入；plan 有紅字時 apply 拒絕；apply 為 transaction 且回傳筆數；BOM 與 CRLF 正常處理
- 條碼 SVG：內容 24 碼可產生
- Dockerfile：`HOSTNAME=0.0.0.0`

手動驗證：

- 貼上 3 行（1 正常、1 科號錯、1 已存在）→ 預覽三色正確 → 修正後匯入成功
- 登入 → 填 3 門 A → 選 B（下拉看得到時間）→ 列印預覽：條碼在右上、A 表格三列、B 含時間、一頁 A4
- 回 `/apply` 下半部看到剛才那筆；掃描收件後重新整理狀態變「已收件」
- 手機掃右上角條碼讀出 24 碼；`/admin/scan` 貼上後成功登記
- 375 / 768 / 1440 寬度無橫向捲軸

## 9. 專案結構（預期）

```
school-apply-form/
  app/
    layout.tsx / globals.css / page.tsx
    login/page.tsx, login/LoginForm.tsx, login/actions.ts
    apply/page.tsx, apply/ApplyForm.tsx, apply/CourseARows.tsx, apply/actions.ts
    apply/[id]/page.tsx, print.css, PrintToolbar.tsx
    admin/courses/page.tsx, actions.ts, AddCourseForm.tsx, ImportCoursesForm.tsx
    admin/scan/…
  components/                 Button / Field / Badge / Card / icons / Nav
  lib/
    auth.ts                   getCurrentStudent / login / logout（SSO 替換點）
    db/schema.ts, db/client.ts
    applications.ts           createApplication / getApplication / listApplicationsByStudent / receiveByBarcode / receiveApplication
    courses.ts, course-import.ts, students.ts, barcode.ts, format.ts, seed.ts
  drizzle/                    migrations（重產）
  scripts/seed.ts
  tests/
  Dockerfile, railway.toml, README.md
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
