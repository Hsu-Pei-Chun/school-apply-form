'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { createApplication, DuplicateApplicationError, MAX_COURSES_A, CourseAInput } from '@/lib/applications';
import { getLocale } from '@/lib/locale';
import { errorText } from '@/lib/messages';

function parseCoursesA(formData: FormData): CourseAInput[] {
  const rows: CourseAInput[] = [];
  for (let i = 0; i <= MAX_COURSES_A; i++) {
    const get = (f: string) => formData.get(`courseA[${i}][${f}]`);
    if (get('code') === null && get('name') === null) continue;
    rows.push({
      code: String(get('code') ?? ''), name: String(get('name') ?? ''),
      time: String(get('time') ?? ''), teacher: String(get('teacher') ?? ''),
    });
  }
  return rows;
}

export async function submitApplication(formData: FormData): Promise<{ error: string; existingId?: string } | void> {
  const field = (name: string) => String(formData.get(name) ?? '');
  let id: string;
  try {
    id = (await createApplication(await getDb(), {
      studentId: field('studentId'),
      studentName: field('studentName'),
      department: field('department'),
      degree: field('degree'),
      coursesA: parseCoursesA(formData),
      courseBCode: field('courseBCode'),
    })).id;
  } catch (e) {
    const error = errorText(await getLocale(), e);
    return e instanceof DuplicateApplicationError ? { error, existingId: e.existingId } : { error };
  }
  redirect(`/apply/${id}`);
}
