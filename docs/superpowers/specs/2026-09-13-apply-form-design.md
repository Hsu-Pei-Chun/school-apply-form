# 科目申請表系統 — 設計文件

日期：2026-09-13
狀態：已與需求方確認，待實作

## 1. 背景與目標

學校約 2000 名學生、100 門科目。學生申請某科目時，系統自動產生一張申請表，
表上印有條碼；學生列印紙本、簽名後送交辦公室，行政人員以掃描槍掃條碼登記收件。
科目清單會持續變動，行政人員需能隨時新增或停用科目。

現階段目標：以假資料做出可 demo 的雛型，證明「申請 → 列印 → 掃描收件」流程可行。

## 2. 範圍

### 做

- 學生輸入學號、選科目，產生申請表
- 申請表 A4 版型，含 Code 128 條碼，瀏覽器直接列印
- 行政後台：科目新增 / 啟用 / 停用
- 行政後台：掃描條碼登記收件，處理重複掃描與無效條碼
- 假資料產生腳本：2000 學生、100 科目

### 不做（YAGNI，等真資料進來再評估）

- 登入 / 身分驗證
- Email 或任何通知
- 申請額度或時間限制
- 表單版型客製化
- 學生 / 科目資料匯入 UI
- 正式部署

## 3. 技術選型

| 項目 | 選擇 | 理由 |
|---|---|---|
| 框架 | Next.js (App Router) + TypeScript | 單一 repo、`npm run dev` 即可 demo |
| 資料庫 | SQLite (`better-sqlite3`) + Drizzle ORM | 零安裝；schema 即文件；之後換 Postgres 只改 driver |
| 條碼 | `bwip-js` 產 SVG，內嵌於頁面 | 向量圖列印不糊；不需後端產 PDF |
| 列印 | HTML A4 版型 + `@media print` + `window.print()` | 避開後端 PDF 的中文字型嵌入問題 |
| 測試 | Vitest | 輕量，與 Next.js 相容 |

## 4. 資料模型

```
students
  id          TEXT PK      學號
  name        TEXT         姓名
  class_name  TEXT         班級
  is_active   INTEGER      1/0

subjects
  code        TEXT PK      科目代碼
  name        TEXT         科目名稱
  is_active   INTEGER      1/0（停用不刪除，保留舊申請單連結）
  created_at  TEXT         ISO 8601

applications
  id            TEXT PK    流水號，格式 A + 6 位數字，自 A000001 起
  student_id    TEXT FK → students.id
  subject_code  TEXT FK → subjects.code
  status        TEXT       'printed' | 'received'
  created_at    TEXT       ISO 8601
  received_at   TEXT NULL  ISO 8601，收件時寫入
```

原則：

- `applications` 一筆 = 一張紙。同一學生重複申請同一科目會產生新的一筆，各有獨立流水號。
- 條碼內容 = `applications.id`。條碼是查表的 key，不承載業務資料。
- 主檔（students / subjects）用 `is_active` 停用，不物理刪除。

## 5. 頁面與流程

### `/apply` — 學生申請

1. 輸入學號 → 即時查詢並顯示姓名、班級；查無此人顯示錯誤，不可送出
2. 下拉選科目（只列 `is_active = 1`）
3. 按「產生申請表」→ server 建立 `applications` 記錄 → 導向 `/apply/[id]`

### `/apply/[id]` — 申請表列印頁

- A4 版型：學校抬頭、申請表標題、學生學號 / 姓名 / 班級、科目代碼 / 名稱、申請日期、簽名欄
- 條碼區：Code 128 SVG，內容為流水號；條碼下方以文字印出流水號、學號、科目代碼
- 「列印」按鈕呼叫 `window.print()`；`@media print` 隱藏按鈕與導覽
- 流水號不存在 → 404

### `/admin/subjects` — 科目管理

- 列表：代碼、名稱、狀態、建立時間
- 新增：代碼 + 名稱；代碼重複則拒絕
- 每列一個「啟用 / 停用」切換

### `/admin/scan` — 掃描收件

- 頁面載入時 input 自動聚焦；掃描槍輸入流水號後送 Enter 即提交
- 結果區顯示：
  - 成功：綠色，學生姓名 / 學號 / 科目，狀態改為 `received`，寫入 `received_at`
  - 已收件：黃色，顯示原 `received_at`，不覆寫
  - 查無此號：紅色提示
- 提交後清空 input 並重新聚焦，連續掃描不需碰滑鼠

## 6. 錯誤處理

| 情境 | 處理 |
|---|---|
| 學號不存在 | 表單層顯示錯誤，禁止送出 |
| 送出時科目已停用（舊分頁） | server 拒絕，回傳錯誤訊息 |
| 流水號格式不符或不存在 | 掃描頁紅字提示，不拋例外 |
| 重複掃描 | 黃字提示，保留第一次收件時間 |
| 科目代碼重複新增 | server 拒絕，表單顯示錯誤 |

## 7. 假資料

`scripts/seed.ts`：

- 2000 學生：學號 `S` + 4 位數（S0001–S2000），姓名以常見中文姓名隨機組合，班級 `一年一班` … 共約 60 班
- 100 科目：代碼 `C001–C100`，名稱以「國文 / 數學 / 物理 …」加編號組合
- 執行方式 `npm run seed`；重複執行先清空再寫入

## 8. 測試策略

單元 / 整合測試（Vitest，直接對 SQLite 記憶體庫測）：

- 建立申請單：流水號格式正確且遞增；停用科目被拒；學號不存在被拒
- 掃描收件：`printed → received` 並寫入 `received_at`；重複掃描不覆寫 `received_at`；無效流水號回傳明確錯誤
- 科目管理：新增成功；代碼重複被拒；停用後不出現在申請頁下拉

手動驗證：

- `/apply/[id]` 用 Chrome 列印預覽確認 A4 版面與條碼清晰
- 以手機條碼 App 或掃描槍掃列印稿，確認 `/admin/scan` 正確登記

## 9. 專案結構（預期）

```
school-apply-form/
  app/
    apply/page.tsx
    apply/[id]/page.tsx
    admin/subjects/page.tsx
    admin/scan/page.tsx
  lib/
    db/schema.ts        Drizzle schema
    db/client.ts
    applications.ts     建立申請單、掃描收件
    subjects.ts         科目 CRUD
    barcode.ts          bwip-js 包裝
  scripts/seed.ts
  tests/
  docs/superpowers/specs/
```

## 10. 未來擴充方向（不在本次範圍）

- 換成 Postgres 或搬入 AI GO 資料中心：schema 已對齊，只換資料層
- 接學校 SSO 取代手填學號
- 收件統計報表
