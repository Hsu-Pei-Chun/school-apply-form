# 課程申請表系統

學生登入後填寫 1～5 門一般課程（科號 15 碼），選擇一門 X-Class 課程，產生含 24 碼條碼的申請表，打印並由行政人員掃碼收件。

## 需求

- Node 22（建議透過 [mise](https://mise.jdx.dev/) 管理版本）

## Quick start

```bash
npm install
npm run seed   # 產生可重複執行的假資料
npm run dev
```

## 頁面

- `/login`：學生登入（9 位學號）
- `/apply`：學生填寫申請表
- `/apply/[id]`：申請表明細與列印（含條碼）
- `/admin/courses`：課程管理（新增／停用）
- `/admin/scan`：行政掃描收件

## 假資料

`npm run seed` 會產生：
- 學生：`113000001` 到 `113002000`（2000 筆）
- 課程：科號 15 碼格式（如 `11510XXXX2001NN`）

## 接 SSO

若需整合校內 SSO 系統，修改 `lib/auth.ts` 檔案中的登入邏輯即可，資料庫 schema 無須變更。

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
5. 容器每次啟動會執行 `seed --if-empty`，只有在 `students` 表為空時才寫入假資料；已有資料時會自動略過，不會覆蓋。
6. Settings → Networking → Generate Domain，即可拿到公開網址給他人測試。

若 schema 有異動（如新增欄位），請清空 volume 後再部署，以便重新 seed。

### Render

1. 把 repo push 到 GitHub。
2. Render → New → Web Service，連結此 repo；Render 會自動偵測 `Dockerfile`。
3. Database path 預設 `/app/data/app.db`（Dockerfile 已預設環境變數）。
4. Render Free plan 磁碟不持久，每次重啟或部署後檔案會遺失，系統會自動執行 `seed --if-empty` 重建假資料。

> 注意：這是單一容器 + SQLite，適合 demo。正式多人使用請換 Postgres（`lib/db/client.ts` 換 driver，schema 不用改）。
