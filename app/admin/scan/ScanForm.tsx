'use client';

import { useRef, useState } from 'react';
import { scan, ScanOutcome } from './actions';
import { formatDateTime } from '@/lib/format';

const COLORS = { received: '#0a0', already: '#c90', not_found: '#c00' } as const;

export default function ScanForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = inputRef.current?.value ?? '';
    if (!value.trim()) return;
    setOutcome(await scan(value));
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit}>
        <input ref={inputRef} autoFocus placeholder="掃描條碼或輸入流水號後 Enter" style={{ fontSize: 20, width: 320 }} />
      </form>
      {outcome && (
        <div style={{ marginTop: 16, padding: 12, border: `2px solid ${COLORS[outcome.kind]}`, color: COLORS[outcome.kind] }}>
          {outcome.kind === 'not_found' && <p>查無此流水號：{outcome.id}</p>}
          {outcome.kind === 'received' && <p>收件成功</p>}
          {outcome.kind === 'already' && <p>已收件（{formatDateTime(outcome.receivedAt)}）</p>}
          {outcome.kind !== 'not_found' && (
            <p>{outcome.id}　{outcome.studentId} {outcome.studentName}　{outcome.subjectCode} {outcome.subjectName}</p>
          )}
        </div>
      )}
    </div>
  );
}
