'use client';

import { useRef, useState } from 'react';
import { CheckIcon, XIcon } from '@/components/icons';
import { formatDateTime } from '@/lib/format';
import { scan, ScanOutcome } from './actions';

type Entry = ScanOutcome & { at: string };

const STYLE: Record<ScanOutcome['kind'], { box: string; text: string; title: string }> = {
  received: { box: 'bg-success-bg text-success border-success', text: 'text-success', title: '收件成功' },
  already: { box: 'bg-warning-bg text-warning border-warning', text: 'text-warning', title: '此申請單已收件' },
  not_found: { box: 'bg-danger-bg text-danger border-danger', text: 'text-danger', title: '查無此流水號' },
};

export default function ScanForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = inputRef.current;
    const value = el?.value.trim() ?? '';
    if (!value || !el) return;
    el.value = '';
    let outcome: ScanOutcome;
    try {
      outcome = await scan(value);
    } catch {
      outcome = { kind: 'not_found', id: value };
    }
    const entry: Entry = { ...outcome, at: new Date().toISOString() };
    setCurrent(entry);
    setHistory(h => [entry, ...h].slice(0, 5));
    el.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit}>
        <label htmlFor="scan" className="mb-2 block text-sm font-medium">掃描條碼或輸入流水號後按 Enter</label>
        <input id="scan" ref={inputRef} autoFocus autoComplete="off" placeholder="A000001"
          className="input min-h-16 text-center font-mono text-2xl tracking-widest" />
      </form>

      {current && (
        <div key={current.at} role="status" className={`animate-[fade-in_200ms_ease-out] rounded-[var(--radius-card)] border-2 p-6 ${STYLE[current.kind].box}`}>
          <div className="flex items-center gap-2 text-2xl font-semibold">
            {current.kind === 'received' ? <CheckIcon className="size-7" /> : <XIcon className="size-7" />}
            {STYLE[current.kind].title}
          </div>
          <p className="mt-2 font-mono text-lg">{current.id}</p>
          {current.kind !== 'not_found' && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base text-foreground">
              <dt className="text-muted-fg">學生</dt><dd>{current.studentId}　{current.studentName}</dd>
              <dt className="text-muted-fg">課程 A</dt><dd>{current.courseACode}　{current.courseAName}</dd>
              <dt className="text-muted-fg">課程 B</dt><dd>{current.courseBCode}　{current.courseBName}</dd>
              {current.kind === 'already' && (<><dt className="text-muted-fg">原收件時間</dt><dd>{formatDateTime(current.receivedAt)}</dd></>)}
            </dl>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-fg">最近掃描</h2>
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface text-sm">
            {history.map(h => (
              <li key={h.at} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="font-mono">{h.id}</span>
                <span className="flex-1 truncate text-muted-fg">{h.kind !== 'not_found' ? `${h.studentId} ${h.studentName}` : '—'}</span>
                <span className={STYLE[h.kind].text}>{STYLE[h.kind].title}</span>
                <span className="text-muted-fg">{formatDateTime(h.at).slice(11)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
