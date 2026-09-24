'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin-auth';
import { createCourse, setCourseActive } from '@/lib/courses';
import { parseCourseImport, planCourseImport, applyCourseImport, ImportPlan } from '@/lib/course-import';
import { getLocale } from '@/lib/locale';
import { errorText, msg } from '@/lib/messages';

export async function addCourse(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const nameEn = String(formData.get('nameEn') ?? '').trim();
  const teacher = String(formData.get('teacher') ?? '').trim();
  const time = String(formData.get('time') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!code || !name || !teacher || !time) return { error: msg(await getLocale(), 'courseFieldsRequired') };
  try {
    await createCourse(await getDb(), { code, name, nameEn, teacher, time, note });
  } catch (e) {
    return { error: errorText(await getLocale(), e) };
  }
  revalidatePath('/admin/courses');
}

export async function toggleCourse(formData: FormData) {
  await requireAdmin();
  const code = String(formData.get('code'));
  const isActive = formData.get('isActive') === '1';
  await setCourseActive(await getDb(), code, !isActive);
  revalidatePath('/admin/courses');
}

export async function previewImport(text: string): Promise<ImportPlan | { error: string }> {
  await requireAdmin();
  try {
    return await planCourseImport(await getDb(), parseCourseImport(String(text ?? '')));
  } catch (e) {
    return { error: errorText(await getLocale(), e) };
  }
}

export async function confirmImport(text: string): Promise<{ imported: number } | { error: string }> {
  await requireAdmin();
  const db = await getDb();
  try {
    const plan = await planCourseImport(db, parseCourseImport(String(text ?? '')));
    const imported = await applyCourseImport(db, plan);
    revalidatePath('/admin/courses');
    revalidatePath('/apply');
    return { imported };
  } catch (e) {
    return { error: errorText(await getLocale(), e) };
  }
}
