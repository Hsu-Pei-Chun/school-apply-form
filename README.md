# 課程申請表系統

學生申請 X-Class 課程（一般課程 A + X-Class 課程 B），列印含條碼申請表，行政掃描收件。

## 需求

- Node 22（建議透過 [mise](https://mise.jdx.dev/) 管理版本）

## Quick start

```bash
npm install
npm run seed   # 產生可重複執行的假資料
npm run dev
```

## 頁面

- `/apply`：學生填寫申請表
- `/apply/[id]`：申請表明細與列印（含條碼）
- `/admin/courses`：課程管理（新增／停用）
- `/admin/scan`：行政掃描收件

## 測試

```bash
npm test
```

## 資料庫

改了 `lib/db/schema.ts` 後，需要重新產生 migration：

```bash
npm run db:generate
```

## 部署到 Railway

1. 把 repo push 到 GitHub。
2. Railway → New Project → Deploy from GitHub repo，選此 repo；Railway 會偵測 `Dockerfile`。
3. Settings → Volumes → Add Volume，Mount path 填 `/app/data`（SQLite 檔案放這裡，重新部署不會遺失）。
4. Variables 確認 `DATABASE_PATH=/app/data/app.db`（Dockerfile 已預設，可不填）。
5. 容器每次啟動會執行 `seed --if-empty`，只有在 `students` 表為空時才寫入假資料；已有資料時會自動略過，不會覆蓋。
6. Settings → Networking → Generate Domain，即可拿到公開網址給他人測試。

> 注意：這是單一容器 + SQLite，適合 demo。正式多人使用請換 Postgres（`lib/db/client.ts` 換 driver，schema 不用改）。
