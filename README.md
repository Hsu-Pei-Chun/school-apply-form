# 課程申請表系統

學生不需登入，自行填寫申請人資料（學號、姓名、科系、學部別）與 1～5 門一般課程（科號、課名、上課時間、任課教師），從下拉選單選一門 X-Class 課程（科號 15 碼），產生右上角含條碼（格式 `學號-科號-B`，共 27 碼）的申請表，列印後送交課務組。

## 需求

- Node 22（建議透過 [mise](https://mise.jdx.dev/) 管理版本）

## Quick start

```bash
npm install
npm run seed   # 產生可重複執行的假資料
npm run dev
```

## 頁面

- `/apply`：學生填寫申請表（不需登入）
- `/apply/[id]`：申請表明細與列印（含條碼）
- `/login`：管理員登入（密碼為環境變數 `ADMIN_PASSWORD`）
- `/admin/courses`：課程管理，需管理員登入（新增／停用／批次匯入：貼上 Excel（第一行為標題：科號、中文課名、英文課名、上課時間、教師、備註，順序不限；英文課名、備註可省略）或上傳 UTF-8 CSV，預覽後整批寫入；科號已存在會略過。科號 15 碼可含空格補位（如 `11510AIA 500700`），系統會原樣保留，條碼內也會保留該空格。）

## 管理員登入

| 環境變數 | 說明 |
| --- | --- |
| `ADMIN_PASSWORD` | 管理員密碼。**正式環境必填**，未設定時無法登入課程管理；本機開發未設定時預設為 `admin`。 |
| `ADMIN_SESSION_SECRET` | 選填，登入 cookie 的簽章金鑰；未設定時沿用 `ADMIN_PASSWORD`。 |

登入有效 8 小時；更換 `ADMIN_PASSWORD`（或 `ADMIN_SESSION_SECRET`）會讓所有已登入的 session 立即失效。

## 假資料

`npm run seed` 會產生：
- 課程 100 筆：科號 15 碼格式（如 `11510XXXX2001NN`），含上課時間，部分課程含備註

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
6. 容器每次啟動會執行 `seed --if-empty`，只有在 `courses` 表為空時才寫入假資料；已有資料時會自動略過，不會覆蓋。
7. Settings → Networking → Generate Domain，即可拿到公開網址給他人測試。

若 schema 有異動（如新增欄位），請清空 volume 後再部署，以便重新 seed。

### Render

1. 把 repo push 到 GitHub。
2. Render → New → Web Service，連結此 repo；Render 會自動偵測 `Dockerfile`。
3. Environment 新增 `ADMIN_PASSWORD`（管理員密碼）。
4. Database path 預設 `/app/data/app.db`（Dockerfile 已預設環境變數）。
5. **Render Free plan 磁碟不持久**：每次部署、閒置休眠後被喚醒、或 Render 重啟容器時，SQLite 檔案都會遺失（申請單、匯入的課程全部消失），系統會自動執行 `seed --if-empty` 重建假資料。僅適合 demo；正式使用請改用付費方案並加掛 Persistent Disk（Mount path `/app/data`），程式不需修改。

> 注意：這是單一容器 + SQLite，資料需放在持久磁碟上。若日後改用 Postgres，需將 `lib/db/schema.ts` 改為 `pg-core`、資料存取函式改為 async，並重新產生 migration。
