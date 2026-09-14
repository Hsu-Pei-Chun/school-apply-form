'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { findStudent } from '@/lib/students';
import { createApplication } from '@/lib/applications';

export async function lookupStudent(studentId: string) {
  const s = findStudent(getDb(), studentId.trim());
  return s ? { name: s.name, department: s.department } : null;
}

export async function submitApplication(formData: FormData): Promise<{ error: string } | void> {
  const studentId = String(formData.get('studentId') ?? '').trim();
  const courseBCode = String(formData.get('courseBCode') ?? '');
  const coursesA = [{ code: String(formData.get('courseACode') ?? ''), name: '(待填)', time: '(待填)', teacher: '(待填)' }];
  let id: string;
  try {
    id = createApplication(getDb(), { studentId, coursesA, courseBCode }).id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/apply/${id}`);
}
