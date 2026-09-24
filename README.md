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

## 資料庫

改了 `lib/db/schema.ts` 後，需要重新產生 migration：

```bash
npm run db:generate
```

## 部署

### Railway

1. 把 repo push 到 GitHub。
2. Railway → New Project → Deploy from GitHub repo，選此 repo；Railway 會偵測 `Dockerfile`。
3. Settings → Volumes → Add Volume，Mount path 填 `/app/data`（SQLite 檔案放這裡，重新部署不會遺失）。
4. Variables 確認 `DATABASE_PATH=/app/data/app.db`（Dockerfile 已預設，可不填）。
5. Variables 新增 `ADMIN_PASSWORD`（管理員密碼）。
6. Settings → Networking → Generate Domain，即可拿到公開網址給他人測試。

schema 異動時，migration 會在啟動後第一次存取資料庫時自動套用，不需手動執行。

### Render

1. 把 repo push 到 GitHub。
2. Render → New → Web Service，連結此 repo；Render 會自動偵測 `Dockerfile`。
3. Environment 新增 `ADMIN_PASSWORD`（管理員密碼）。
4. Database path 預設 `/app/data/app.db`（Dockerfile 已預設環境變數）。
5. **Render Free plan 磁碟不持久**：每次部署、閒置休眠後被喚醒、或 Render 重啟容器時，SQLite 檔案都會遺失（申請單、匯入的課程、申請表設定全部消失，回到空白資料庫），需重新匯入課程。僅適合 demo；正式使用請改用付費方案並加掛 Persistent Disk（Mount path `/app/data`），程式不需修改。

> 注意：這是單一容器 + SQLite，資料需放在持久磁碟上。若日後改用 Postgres，需將 `lib/db/schema.ts` 改為 `pg-core`、資料存取函式改為 async，並重新產生 migration。
