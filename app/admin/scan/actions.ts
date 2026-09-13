'use server';

import { getDb } from '@/lib/db/client';
import { receiveApplication } from '@/lib/applications';

export type ScanOutcome =
  | { kind: 'received' | 'already'; id: string; studentId: string; studentName: string; subjectCode: string; subjectName: string; receivedAt: string }
  | { kind: 'not_found'; id: string };

export async function scan(id: string): Promise<ScanOutcome> {
  const code = id.trim();
  const r = receiveApplication(getDb(), code);
  if (r.kind === 'not_found') return { kind: 'not_found', id: code };
  const d = r.detail;
  return {
    kind: r.kind,
    id: d.id,
    studentId: d.studentId,
    studentName: d.studentName,
    subjectCode: d.subjectCode,
    subjectName: d.subjectName,
    receivedAt: d.receivedAt ?? '',
  };
}
