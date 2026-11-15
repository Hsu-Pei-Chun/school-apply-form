'use client';

import { useState, type ReactNode } from 'react';

// 「課綱來源與更新」的展開狀態只在第一次載入時由伺服器決定（尚無索引或更新中才展開）。
// 之後由使用者自己開關：更新完成後頁面 router.refresh()，伺服器判斷會變成「收起」，
// 若直接用 <details open={…}> 會把正在看進度的面板收掉、連帶藏住完成結果。
export default function SourceDetails({ initialOpen, summary, children }: { initialOpen: boolean; summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details open={open} onToggle={e => setOpen(e.currentTarget.open)}
      className="group rounded-[var(--radius-card)] border border-border bg-surface">
      {summary}
      {children}
    </details>
  );
}
