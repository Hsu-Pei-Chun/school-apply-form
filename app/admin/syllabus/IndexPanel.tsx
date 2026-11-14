'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import Field from '@/components/Field';
import { RefreshIcon } from '@/components/icons';
import { dict, Locale } from '@/lib/i18n';
import { formatDateTime } from '@/lib/format';
import type { IndexStatus } from '@/lib/syllabus/indexer';
import { indexStatusAction, startIndexAction } from './actions';

const POLL_MS = 2000;

export default function IndexPanel({ locale, initialUrl, initialStatus }: { locale: Locale; initialUrl: string; initialStatus: IndexStatus }) {
  const t = dict(locale).syllabus;
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const running = status.state === 'running';

  // 更新中每 2 秒問一次進度；跑完後重新整理頁面，讓統計數字與搜尋結果用上新資料
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      try {
        const s = await indexStatusAction();
        setStatus(s);
        if (s.state !== 'running') router.refresh();
      } catch { /* 網路暫時斷線就等下一輪 */ }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, router]);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setError('');
    try {
      const r = await startIndexAction(formData);
      if (r.ok) setStatus(r.status);
      else setError(r.error);
    } finally {
      setSubmitting(false);
    }
  }

  const pct = status.total ? Math.round((status.processed / status.total) * 100) : 0;

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <Field id="syllabus-url" label={t.urlLabel} hint={t.urlHint} error={error}>
        <input id="syllabus-url" name="url" type="url" required defaultValue={initialUrl} className="input" inputMode="url" autoComplete="off" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={submitting || running}>
          {!(submitting || running) && <RefreshIcon />} {running ? t.updating : t.update}
        </Button>
      </div>

      {running && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded-full bg-background" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm">{t.progress(status.processed, status.total)}</p>
          {status.total > 0 && <p className="text-sm text-muted-fg">{t.summary(status.updated, status.unchanged, status.failed, 0)}</p>}
          <p className="text-sm text-muted-fg">{t.keepOpen}</p>
        </div>
      )}

      {status.state === 'done' && (
        <p className="text-sm" aria-live="polite">
          {t.doneAt(formatDateTime(status.finishedAt))}：{t.summary(status.updated, status.unchanged, status.failed, status.removed)}
        </p>
      )}
      {status.state === 'error' && <p role="alert" className="text-sm text-danger">{status.message}</p>}

      {status.failures.length > 0 && !running && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-fg">{t.failedTitle}（{status.failed}）</summary>
          <ul className="mt-2 list-disc pl-5">
            {status.failures.map(f => <li key={f.code}><span className="font-mono whitespace-pre">{f.code}</span>：{f.error}</li>)}
          </ul>
        </details>
      )}
    </form>
  );
}
