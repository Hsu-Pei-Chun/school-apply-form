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
  const input = {
    studentId: String(formData.get('studentId') ?? '').trim(),
    courseACode: String(formData.get('courseACode') ?? ''),
    courseAStatus: String(formData.get('courseAStatus') ?? '').trim() || '已選上',
    courseBCode: String(formData.get('courseBCode') ?? ''),
  };
  let id: string;
  try {
    id = createApplication(getDb(), input).id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/apply/${id}`);
}
