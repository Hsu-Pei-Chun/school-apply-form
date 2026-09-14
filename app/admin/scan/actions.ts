'use server';

import { getDb } from '@/lib/db/client';
import { receiveByInput } from '@/lib/applications';

export type ScanOutcome =
  | { kind: 'received' | 'already'; id: string; studentId: string; studentName: string; coursesA: { code: string; name: string }[]; courseBCode: string; courseBName: string; receivedAt: string }
  | { kind: 'not_found'; id: string };

export async function scan(id: string): Promise<ScanOutcome> {
  const code = id.trim();
  const r = receiveByInput(getDb(), code);
  if (r.kind === 'not_found' || r.kind === 'bad_format') return { kind: 'not_found', id: code };
  const d = r.detail;
  return {
    kind: r.kind,
    id: d.id,
    studentId: d.studentId,
    studentName: d.studentName,
    coursesA: d.coursesA.map(c => ({ code: c.code, name: c.name })),
    courseBCode: d.courseBCode,
    courseBName: d.courseBName,
    receivedAt: d.receivedAt ?? '',
  };
}
