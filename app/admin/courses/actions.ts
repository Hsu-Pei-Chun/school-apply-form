'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin-auth';
import { createCourse, setCourseActive } from '@/lib/courses';
import { parseCourseImport, planCourseImport, applyCourseImport, ImportPlan } from '@/lib/course-import';

export async function addCourse(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const nameEn = String(formData.get('nameEn') ?? '').trim();
  const teacher = String(formData.get('teacher') ?? '').trim();
  const time = String(formData.get('time') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!code || !name || !teacher || !time) return { error: '代碼、名稱、授課教師、上課時間皆必填' };
  try {
    createCourse(getDb(), { code, name, nameEn, teacher, time, note });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/admin/courses');
}

export async function toggleCourse(formData: FormData) {
  await requireAdmin();
  const code = String(formData.get('code'));
  const isActive = formData.get('isActive') === '1';
  setCourseActive(getDb(), code, !isActive);
  revalidatePath('/admin/courses');
}

export async function previewImport(text: string): Promise<ImportPlan | { error: string }> {
  await requireAdmin();
  try {
    return planCourseImport(getDb(), parseCourseImport(String(text ?? '')));
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function confirmImport(text: string): Promise<{ imported: number } | { error: string }> {
  await requireAdmin();
  const db = getDb();
  try {
    const plan = planCourseImport(db, parseCourseImport(String(text ?? '')));
    const imported = applyCourseImport(db, plan);
    revalidatePath('/admin/courses');
    revalidatePath('/apply');
    return { imported };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
