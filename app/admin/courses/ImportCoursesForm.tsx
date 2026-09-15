'use client';

import { useRef, useState, useTransition } from 'react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import { UploadIcon } from '@/components/icons';
import type { ImportPlan, PlanRow } from '@/lib/course-import';
import { previewImport, confirmImport } from './actions';

const TONE: Record<PlanRow['status'], 'success' | 'warning' | 'danger'> = { add: 'success', skip: 'warning', error: 'danger' };
const LABEL: Record<PlanRow['status'], string> = { add: '新增', skip: '已存在，略過', error: '錯誤' };

export default function ImportCoursesForm() {
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setText(await f.text());
    setPlan(null);
    setMessage(null);
    e.target.value = '';
  }

  function onPreview() {
    setMessage(null);
    startTransition(async () => {
      const r = await previewImport(text);
      if ('error' in r) { setMessage({ kind: 'error', text: r.error }); setPlan(null); return; }
      setPlan(r);
    });
  }

  function onConfirm() {
    startTransition(async () => {
      const r = await confirmImport(text);
      if ('error' in r) { setMessage({ kind: 'error', text: r.error }); return; }
      setMessage({ kind: 'ok', text: `已匯入 ${r.imported} 筆` });
      setText(''); setPlan(null);
      if (fileRef.current) fileRef.current.value = '';
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="import-text" className="text-sm font-medium">貼上 Excel 內容（每行一科：科號 ⇥ 課名 ⇥ 授課教師 ⇥ 上課時間）</label>
        <textarea id="import-text" className="input min-h-40 font-mono text-sm" value={text}
          onChange={e => { setText(e.target.value); setPlan(null); setMessage(null); }}
          placeholder={'11510CHEM200104\t線性代數1\t許教授\tM1M2'} />
        <p className="text-sm text-muted-fg">Tab 或逗號分隔皆可；第一行若為標題會自動略過；CSV 請以 UTF-8 儲存。</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="import-file" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border border-border bg-surface px-4 text-sm hover:bg-background">
          <UploadIcon className="size-4" /> 或上傳 CSV / TXT
        </label>
        <input id="import-file" ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFile} />
        <Button type="button" variant="secondary" onClick={onPreview} loading={pending} disabled={!text.trim()}>預覽</Button>
        {plan && (
          <Button type="button" variant="primary" onClick={onConfirm} loading={pending} disabled={plan.errorCount > 0 || plan.addCount === 0}>
            確認匯入 {plan.addCount} 筆{plan.skipCount > 0 ? `（略過 ${plan.skipCount} 筆）` : ''}
          </Button>
        )}
      </div>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-[var(--radius-card)] px-3 py-2 text-sm ${message.kind === 'error' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'}`}>
          {message.text}
        </p>
      )}

      {plan && plan.errorCount > 0 && (
        <p role="alert" className="text-sm text-danger">有 {plan.errorCount} 行錯誤，請修正後重新預覽。</p>
      )}

      {plan && plan.rows.length === 0 && (
        <p className="text-sm text-muted-fg">沒有可解析的資料。</p>
      )}

      {plan && plan.rows.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-muted-fg">
              <tr>
                <th className="px-3 py-2 font-semibold">行</th>
                <th className="px-3 py-2 font-semibold">科號</th>
                <th className="px-3 py-2 font-semibold">課名</th>
                <th className="px-3 py-2 font-semibold">教師</th>
                <th className="px-3 py-2 font-semibold">時間</th>
                <th className="px-3 py-2 font-semibold">結果</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map(r => (
                <tr key={r.line} className="border-t border-border even:bg-background/60">
                  <td className="px-3 py-2 text-muted-fg">{r.line}</td>
                  <td className="px-3 py-2 font-mono">{r.code}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.teacher}</td>
                  <td className="px-3 py-2 font-mono">{r.time}</td>
                  <td className="px-3 py-2">
                    <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                    {r.status !== 'add' && <span className="ml-2 text-muted-fg">{r.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
