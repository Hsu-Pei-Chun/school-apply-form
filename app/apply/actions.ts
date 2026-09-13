'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { findStudent } from '@/lib/students';
import { createApplication } from '@/lib/applications';

export async function lookupStudent(studentId: string) {
  const s = findStudent(getDb(), studentId.trim());
  return s ? { name: s.name, className: s.className } : null;
}

export async function submitApplication(formData: FormData): Promise<{ error: string } | void> {
  const studentId = String(formData.get('studentId') ?? '').trim();
  const subjectCode = String(formData.get('subjectCode') ?? '');
  let id: string;
  try {
    id = createApplication(getDb(), { studentId, subjectCode }).id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/apply/${id}`);
}
