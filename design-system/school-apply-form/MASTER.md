# 設計規範（School Apply Form）

> 本文件描述**目前網站實際使用**的設計。程式中的唯一來源是 `app/globals.css` 的 `@theme` 與 `components/`；
> 兩者不一致時以程式為準，並請同步更新本文件。新增頁面前請先讀完「頁面模式」與「禁止事項」。

**產品**：國立清華大學 X-Class 課程申請表系統。學生端填表、產生含條碼申請表並列印；管理端（課務組）管理課程、申請表文字與課綱搜尋。
**基調**：校務行政工具。清楚、穩重、好填，不追求行銷感；手機也要能完整操作。

---

## 色彩

取自清大官網 www.nthu.edu.tw 的 CSS。Tailwind class 以 token 名稱使用，例如 `bg-primary`、`text-muted-fg`。**不要在元件裡寫死色碼。**

| Token | 色碼 | 用途 | 對比 |
|---|---|---|---|
| `primary` | `#721F6E` 清華紫 | 導覽列、主按鈕、標題強調、步驟編號、開關開啟 | 白字 9.8:1 |
| `primary-hover` | `#44033F` | 主按鈕 hover（官網 banner 深紫） | |
| `secondary` | `#7E537B` | 文字連結（回申請頁、開啟 PDF、再顯示 N 段） | 白底 6.1:1 |
| `highlight` | `#FFFFD6` | 紫色導覽列上的 hover 文字 | |
| `background` | `#F6F4F6` | 頁面底色 | |
| `surface` | `#FFFFFF` | 卡片、輸入框 | |
| `foreground` | `#222222` | 內文 | |
| `muted-fg` | `#555555` | 次要文字、提示、圖示鈕 | 白底 7.5:1 |
| `border` | `#CFC8CF` | 卡片與輸入框外框（裝飾用，不可單獨表達狀態） | |
| `success` / `success-bg` | `#15803D` / `#DCFCE7` | 成功訊息、勾選圖示 | |
| `warning` / `warning-bg` | `#A16207` / `#FEF9C3` | 匯入「略過」、搜尋命中 `<mark>` 底色 | |
| `danger` / `danger-bg` | `#DC2626` / `#FEE2E2` | 錯誤訊息、**不可復原**的動作（刪除） | 白底 4.8:1 |

規則：
- 紅色只用在錯誤與不可復原的動作。可還原的動作（停用課程）用中性樣式或開關。
- 需要區分的狀態不可只靠色相，要同時有明暗或填滿差異（例：開關開＝紫色實心、關＝灰框空心）。
- 文字對比至少 4.5:1。
- 列印申請表（`.sheet`）固定黑白，不套用主題色。

## 字型

- 介面：`--font-sans` = Noto Sans TC → PingFang TC → Microsoft JhengHei → system-ui。
- 申請表：`--font-serif`，英文字型在前（Times New Roman），避免英文版擠到第二頁。
- 科號、上課時間、條碼號碼用 `font-mono`；科號含空格補位，要加 `whitespace-pre`。
- 字級：頁面標題 `text-2xl`（首頁主標 `text-3xl`～`text-4xl`）、區段標題 `text-lg`～`text-xl font-semibold`、內文 16px、提示 `text-sm`。

## 形狀與間距

- 圓角統一 `--radius-card`（8px）；膠囊標籤與步驟編號用 `rounded-full`。
- 卡片：`border border-border bg-surface`，padding `p-5`～`p-6`，**不加陰影**（只有螢幕上的申請表紙張有陰影）。
- 區塊間距 `gap-6`；表單欄位間距 `gap-3`～`gap-4`。
- 版面寬度：一般頁 `max-w-[720px]`（`.container-narrow`）；欄位多的頁面最外層加 `.page-wide` 放寬到 `max-w-5xl`。

## 元件（`components/`）

| 元件 | 說明 |
|---|---|
| `Button` | `primary`／`secondary`／`danger`；最小高度 44px（`min-h-11`）；`loading` 顯示轉圈並停用 |
| `Card` | 白底外框卡片 |
| `Field` | 標籤 + 輸入 + 提示／錯誤（錯誤帶 `role="alert"`） |
| `Badge` | 狀態膠囊：`success`／`neutral`／`warning`／`danger` |
| `Combobox` | 可搜尋下拉（選項多時用；選項少於約 6 個用原生 `select`） |
| `SiteFooter` | 未登入時的「管理員登入」入口 |
| `icons.tsx` | Heroicons outline，`stroke-width 1.5`，預設 `size-5` |
| `.input` | 所有輸入框、select、textarea 的共用 class |

圖示鈕（只有圖示、沒有文字）：`size-11`、`text-muted-fg`、hover 才顯示語意色，一定要有 `aria-label`。

## 頁面模式

- **流程導向**：學生最容易漏的是「列印 → 簽章 → 送交」。首頁與列印頁都用**編號步驟**（紫色圓形數字 + 標題 + 一行說明）講清楚。
- **主要任務放最上面**：課綱搜尋頁先放搜尋框；課程管理頁先放列表。不常用的設定收起來（`<details>` 或按鈕展開面板），需要時才自動展開（例：尚未建立課綱索引、索引更新中）。
- **長清單**：每筆資料用卡片或表格列；次要內容（第 2 段以後的搜尋片段）收進「再顯示 N 段」。
- **列表工具列**：搜尋框 + 狀態篩選（分段按鈕，`aria-pressed`，附筆數）+ 批次動作。
- **表單送出**：送出鈕不預先停用，讓瀏覽器 `required` 驗證指出缺漏欄位；瀏覽器驗不到的（hidden input）自己檢查並移動焦點。
  用 `onSubmit` 而不是 `<form action>`，否則 React 19 會在送出失敗時清空未受控欄位。
- **管理入口**：導覽列只對已登入管理員顯示管理頁；學生端只在頁尾放「管理員登入」。

## 無障礙與互動

- 觸控區至少 44×44px。
- 可見的 focus ring：`focus-visible:ring-2 focus-visible:ring-primary/40`。
- 互動元素一律 `cursor-pointer`；hover／狀態轉換 150ms（`transition-colors duration-150`）。
- 尊重 `prefers-reduced-motion`（`globals.css` 已全域處理）。
- 手機 375px 不可出現水平捲動；寬表格放在 `overflow-x-auto` 容器裡。
- 中英雙語：所有介面文字放 `lib/i18n.ts`，不要寫死在元件裡。

## 列印

- 申請表在 `app/apply/[id]/print.css`：A4、黑白、一頁。
- 螢幕上才需要的東西（工具列、說明卡、頁尾）加 `.no-print`。
- `.sheet.pdf-mode` 規則供「下載 PDF」使用，不可放進 `@media` 區塊（有測試檢查）。

## 禁止事項

- 寫死色碼、另外引入色票或字型。
- 用 emoji 當圖示。
- 紅色用在可還原的動作上。
- 漸層背景、左側色條卡片、大面積陰影等裝飾。
- 對學生顯示管理頁連結。
