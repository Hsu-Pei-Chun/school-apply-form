# 科目申請表系統

學生申請科目、列印含條碼的申請表，行政人員以掃描槍收件確認的學校內部系統。

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
- `/admin/subjects`：科目管理（新增／停用）
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
