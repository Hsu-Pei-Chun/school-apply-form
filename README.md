# 課程申請表系統

學生不需登入，自行填寫申請人資料（學號、姓名、科系、學部別）與 1～5 門一般課程（科號、課名、上課時間、任課教師），從下拉選單選一門 X-Class 課程（科號 15 碼），產生右上角含條碼（格式 `學號-科號-B`，共 27 碼）的申請表，列印後送交課務組。

## 需求

- Node 22（建議透過 [mise](https://mise.jdx.dev/) 管理版本）

## Quick start

```bash
npm install
npm run dev
```

資料庫一開始是空的（資料表會自動建立），請先到 `/login` 以管理員登入（本機預設密碼 `admin`），再到 `/admin/courses` 匯入或新增 X-Class 課程，學生申請頁才有課程可選。

## 頁面

- `/apply`：學生填寫申請表（不需登入）
- `/apply/[id]`：申請表明細與列印（含條碼）
- `/login`：管理員登入（密碼為環境變數 `ADMIN_PASSWORD`）
- `/admin/courses`：課程管理，需管理員登入（新增／停用／批次匯入：貼上 Excel（第一行為標題：科號、中文課名、英文課名、上課時間、教師、備註，順序不限；英文課名、備註可省略）或上傳 UTF-8 CSV，預覽後整批寫入；科號已存在會略過。科號 15 碼可含空格補位（如 `11510AIA 500700`），系統會原樣保留，條碼內也會保留該空格。）

- `/admin/settings`：申請表設定，需管理員登入（中、英文各自編輯申請人同意事項與送交說明；資料庫沒有設定時使用 `lib/form-settings.ts` 的預設文字）

導覽列可切換中文／English（記在 `lang` cookie），申請頁、課程管理、列印的申請表都會跟著切換；英文版申請表的學部別顯示英文，X-Class 課程下拉選單顯示英文課名。

## 管理員登入

| 環境變數 | 說明 |
| --- | --- |
| `ADMIN_PASSWORD` | 管理員密碼。**正式環境必填**，未設定時無法登入課程管理；本機開發未設定時預設為 `admin`。 |
| `ADMIN_SESSION_SECRET` | 選填，登入 cookie 的簽章金鑰；未設定時沿用 `ADMIN_PASSWORD`。 |

登入有效 8 小時；更換 `ADMIN_PASSWORD`（或 `ADMIN_SESSION_SECRET`）會讓所有已登入的 session 立即失效。

## 測試

```bash
npm test
```

## Schema 變更

改了 `lib/db/schema.ts` 後，需要重新產生 migration：

```bash
npm run db:generate
```

## 資料庫（Turso）

正式環境使用 [Turso](https://turso.tech)（雲端 SQLite），資料不會因為 Render 重新部署、重啟或休眠而遺失。本機開發未設定時自動改用本機檔案 `data/app.db`。

| 環境變數 | 說明 |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso 資料庫網址，例：`libsql://school-apply-form-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso 資料庫的存取 token |
| `DATABASE_PATH` | 未設定 Turso 時使用的本機 SQLite 檔案路徑（預設 `data/app.db`） |

建立 Turso 資料庫（**請建立 libSQL 類型**，`@libsql/client` 與 Drizzle 連線的是 libSQL 資料庫；不要加 `--tursodb`）：

```bash
turso auth signup                              # 或 turso auth login
turso db create school-apply-form              # 建立 libSQL 資料庫
turso db show school-apply-form --url          # → TURSO_DATABASE_URL（libsql://...）
turso db tokens create school-apply-form       # → TURSO_AUTH_TOKEN
```

也可以在 https://app.turso.tech 後台建立資料庫，並在該資料庫頁面取得 URL 與建立 token（需讀寫權限）。

資料表會在網站第一次存取資料庫時自動建立（migration 自動套用），不需手動執行。

**Turso 免費方案閒置 10 天會封存資料庫**，封存後需用 `turso group unarchive <group>` 恢復。`.github/workflows/keep-alive.yml` 每 3 天呼叫一次 `/api/health`（會實際查詢資料庫）以避免封存；GitHub 會在 repo 連續 60 天沒有 commit 時停用排程，屆時需到 Actions 頁面重新啟用。網站網址不同時，在 repo 的 Settings → Secrets and variables → Actions → Variables 設定 `HEALTHCHECK_URL`。

## 部署

### Render

1. 把 repo push 到 GitHub。
2. Render → New → Web Service，連結此 repo；Render 會自動偵測 `Dockerfile`。
3. Environment 新增：
   - `ADMIN_PASSWORD`：管理員密碼
   - `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`：見上方「資料庫（Turso）」
4. 部署完成後，以管理員登入並匯入課程。

未設定 Turso 時會退回容器內的 SQLite 檔案；Render 免費方案磁碟不持久，重啟後資料會遺失（僅適合 demo）。

### Railway

1. 把 repo push 到 GitHub。
2. Railway → New Project → Deploy from GitHub repo，選此 repo；Railway 會偵測 `Dockerfile`。
3. Variables 新增 `ADMIN_PASSWORD`、`TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`。
4. Settings → Networking → Generate Domain，即可拿到公開網址。

> 正式建置使用 webpack（`npm run build`）；Turbopack 的 production build 目前無法處理 `@libsql/client`，開發模式（`npm run dev`）仍使用 Turbopack。
