'use server';

import { getDb } from '@/lib/db/client';
import { receiveByInput } from '@/lib/applications';

export type ScanOutcome =
  | {
      kind: 'received' | 'already';
      id: string; barcode: string; studentId: string; studentName: string; department: string;
      coursesA: { seq: number; code: string; name: string }[];
      courseBCode: string; courseBName: string; courseBTeacher: string; receivedAt: string;
    }
  | { kind: 'not_found'; input: string }
  | { kind: 'bad_format'; input: string };

export async function scan(raw: string): Promise<ScanOutcome> {
  const input = raw.trim();
  const r = receiveByInput(getDb(), input);
  if (r.kind === 'not_found' || r.kind === 'bad_format') return { kind: r.kind, input };
  const d = r.detail;
  return {
    kind: r.kind,
    id: d.id, barcode: d.barcode, studentId: d.studentId, studentName: d.studentName, department: d.department,
    coursesA: d.coursesA.map(c => ({ seq: c.seq, code: c.code, name: c.name })),
    courseBCode: d.courseBCode, courseBName: d.courseBName, courseBTeacher: d.courseBTeacher,
    receivedAt: d.receivedAt ?? '',
  };
}
