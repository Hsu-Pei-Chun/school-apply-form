'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getCurrentStudent } from '@/lib/auth';
import { createApplication, DuplicateApplicationError, MAX_COURSES_A, CourseAInput } from '@/lib/applications';

function parseCoursesA(formData: FormData): CourseAInput[] {
  const rows: CourseAInput[] = [];
  for (let i = 0; i < MAX_COURSES_A; i++) {
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
  const student = await getCurrentStudent();
  if (!student) redirect('/login?next=/apply');

  let id: string;
  try {
    id = createApplication(getDb(), {
      studentId: student.id,
      coursesA: parseCoursesA(formData),
      courseBCode: String(formData.get('courseBCode') ?? ''),
    }).id;
  } catch (e) {
    if (e instanceof DuplicateApplicationError) return { error: e.message, existingId: e.existingId };
    return { error: (e as Error).message };
  }
  redirect(`/apply/${id}`);
}
