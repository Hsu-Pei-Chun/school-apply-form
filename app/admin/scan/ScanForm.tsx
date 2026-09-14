'use client';

import { useRef, useState } from 'react';
import { CheckIcon, XIcon } from '@/components/icons';
import { formatDateTime } from '@/lib/format';
import { scan, ScanOutcome } from './actions';

type Entry = ScanOutcome & { at: string };

const STYLE: Record<ScanOutcome['kind'], { box: string; text: string; title: string }> = {
  received: { box: 'bg-success-bg border-success', text: 'text-success', title: '收件成功' },
  already: { box: 'bg-warning-bg border-warning', text: 'text-warning', title: '此申請單已收件' },
  not_found: { box: 'bg-danger-bg border-danger', text: 'text-danger', title: '查無此申請單' },
  bad_format: { box: 'bg-danger-bg border-danger', text: 'text-danger', title: '條碼格式錯誤' },
};

function label(e: Entry): string {
  return 'barcode' in e ? e.barcode : e.input;
}

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
      outcome = { kind: 'not_found', input: value };
    }
    const entry: Entry = { ...outcome, at: new Date().toISOString() };
    setCurrent(entry);
    setHistory(h => [entry, ...h].slice(0, 5));
    el.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit}>
        <label htmlFor="scan" className="mb-2 block text-sm font-medium">掃描申請表右上角條碼（24 碼），或輸入申請單號後按 Enter</label>
        <input id="scan" ref={inputRef} autoFocus autoComplete="off" placeholder="11300000111510EECS200101"
          className="input min-h-16 text-center font-mono text-2xl tracking-widest" />
      </form>

      {current && (
        <div key={current.at} role="status" className={`animate-[fade-in_200ms_ease-out] rounded-[var(--radius-card)] border-2 p-6 ${STYLE[current.kind].box} ${STYLE[current.kind].text}`}>
          <div className="flex items-center gap-2 text-2xl font-semibold">
            {current.kind === 'received' ? <CheckIcon className="size-7" /> : <XIcon className="size-7" />}
            {STYLE[current.kind].title}
          </div>
          <p className="mt-2 font-mono text-lg">{label(current)}</p>
          {(current.kind === 'received' || current.kind === 'already') && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base text-foreground">
              <dt className="text-muted-fg">學生</dt><dd>{current.studentId}　{current.studentName}　{current.department}</dd>
              <dt className="text-muted-fg">一般課程 A</dt>
              <dd><ul>{current.coursesA.map(c => <li key={c.seq}>{c.seq}. {c.code}　{c.name}</li>)}</ul></dd>
              <dt className="text-muted-fg">X-Class B</dt><dd>{current.courseBCode}　{current.courseBName}（{current.courseBTeacher}）</dd>
              <dt className="text-muted-fg">申請單號</dt><dd className="font-mono">{current.id}</dd>
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
                <span className="font-mono">{label(h)}</span>
                <span className="flex-1 truncate text-muted-fg">{h.kind === 'received' || h.kind === 'already' ? `${h.studentId} ${h.studentName}` : '—'}</span>
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
