'use client';

import { useRef, useState, useTransition } from 'react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import { UploadIcon } from '@/components/icons';
import type { ImportPlan, PlanRow } from '@/lib/course-import';
import { dict, Locale } from '@/lib/i18n';
import { msg } from '@/lib/messages';
import { previewImport, confirmImport } from './actions';

const TONE: Record<PlanRow['status'], 'success' | 'warning' | 'danger'> = { add: 'success', skip: 'warning', error: 'danger' };

export default function ImportCoursesForm({ locale }: { locale: Locale }) {
  const d = dict(locale).courses;
  const t = d.import;
  const LABEL: Record<PlanRow['status'], string> = { add: t.statusAdd, skip: t.statusSkip, error: t.statusError };
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
      setMessage({ kind: 'ok', text: t.imported(r.imported) });
      setText(''); setPlan(null);
      if (fileRef.current) fileRef.current.value = '';
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="import-text" className="text-sm font-medium">{t.pasteLabel}</label>
        <textarea id="import-text" className="input min-h-40 font-mono text-sm" value={text}
          onChange={e => { setText(e.target.value); setPlan(null); setMessage(null); }}
          placeholder={t.placeholder} />
        <p className="text-sm text-muted-fg">{t.help}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="import-file" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border border-border bg-surface px-4 text-sm hover:bg-background">
          <UploadIcon className="size-4" /> {t.upload}
        </label>
        <input id="import-file" ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFile} />
        <Button type="button" variant="secondary" onClick={onPreview} loading={pending} disabled={!text.trim()}>{t.preview}</Button>
        {plan && (
          <Button type="button" variant="primary" onClick={onConfirm} loading={pending} disabled={plan.errorCount > 0 || plan.addCount === 0}>
            {t.confirm(plan.addCount, plan.skipCount)}
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
        <p role="alert" className="text-sm text-danger">{t.errors(plan.errorCount)}</p>
      )}

      {plan && plan.rows.length === 0 && (
        <p className="text-sm text-muted-fg">{t.empty}</p>
      )}

      {plan && plan.rows.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-muted-fg">
              <tr>
                <th className="px-3 py-2 font-semibold">{t.line}</th>
                <th className="px-3 py-2 font-semibold">{d.code}</th>
                <th className="px-3 py-2 font-semibold">{d.name}</th>
                <th className="px-3 py-2 font-semibold">{d.nameEn}</th>
                <th className="px-3 py-2 font-semibold">{d.teacher}</th>
                <th className="px-3 py-2 font-semibold">{d.time}</th>
                <th className="px-3 py-2 font-semibold">{d.note}</th>
                <th className="px-3 py-2 font-semibold">{t.result}</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map(r => (
                <tr key={r.line} className="border-t border-border even:bg-background/60">
                  <td className="px-3 py-2 text-muted-fg">{r.line}</td>
                  <td className="px-3 py-2 whitespace-pre font-mono">{r.code}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.nameEn}</td>
                  <td className="px-3 py-2">{r.teacher}</td>
                  <td className="px-3 py-2 font-mono">{r.time}</td>
                  <td className="px-3 py-2">{r.note}</td>
                  <td className="px-3 py-2">
                    <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                    {r.status !== 'add' && <span className="ml-2 text-muted-fg">{msg(locale, r.reason)}</span>}
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
