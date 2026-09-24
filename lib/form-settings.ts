import { Db } from './db/client';
import { formSettings } from './db/schema';
import type { Locale } from './i18n';
import { AppError } from './messages';

export type FormText = { terms: string[]; submitNote: string };

export const DEFAULT_FORM_TEXT: Record<Locale, FormText> = {
  zh: {
    terms: [
      '本人已與 X-Class 課程授課教師事前溝通，並確認教師提供整學期完整之非同步學習資源。',
      '本人同意不得要求補課、調整教學進度、請假延交作業等額外安排。',
      '若 X-Class 課程考試與一般課程衝突，不予改期或補考，相關風險由本人自行承擔。',
    ],
    submitNote: '請於開學第二週週五前，將本表送交校本部第一綜合大樓一樓課務組。',
  },
  en: {
    terms: [
      'I have communicated with the X-Class course instructor in advance and confirmed that the instructor provides complete asynchronous learning resources for the entire semester.',
      'I agree not to request make-up classes, changes to the teaching schedule, leave, or extensions on assignments.',
      'If an X-Class course exam conflicts with a regular course, it will not be rescheduled and no make-up exam will be given; I bear all related risks.',
    ],
    submitNote: 'Please submit this form to the Curriculum Division, 1F, First General Building, Main Campus, by Friday of the second week of the semester.',
  },
};

export const MAX_SETTING_LENGTH = 2000;

/** 編輯表單用的平面格式：同意事項以換行分隔，一行一條。 */
export type FormSettingsInput = { termsZh: string; termsEn: string; submitNoteZh: string; submitNoteEn: string };
const KEYS = ['termsZh', 'termsEn', 'submitNoteZh', 'submitNoteEn'] as const;

function splitTerms(text: string): string[] {
  return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function defaults(): FormSettingsInput {
  return {
    termsZh: DEFAULT_FORM_TEXT.zh.terms.join('\n'), termsEn: DEFAULT_FORM_TEXT.en.terms.join('\n'),
    submitNoteZh: DEFAULT_FORM_TEXT.zh.submitNote, submitNoteEn: DEFAULT_FORM_TEXT.en.submitNote,
  };
}

export async function getFormSettings(db: Db): Promise<FormSettingsInput> {
  const stored = Object.fromEntries((await db.select().from(formSettings).all()).map(r => [r.key, r.value]));
  const d = defaults();
  return Object.fromEntries(KEYS.map(k => [k, stored[k] ?? d[k]])) as FormSettingsInput;
}

export async function getFormText(db: Db, locale: Locale): Promise<FormText> {
  const s = await getFormSettings(db);
  return locale === 'en'
    ? { terms: splitTerms(s.termsEn), submitNote: s.submitNoteEn }
    : { terms: splitTerms(s.termsZh), submitNote: s.submitNoteZh };
}

export async function saveFormSettings(db: Db, input: FormSettingsInput): Promise<FormSettingsInput> {
  const v: FormSettingsInput = {
    termsZh: splitTerms(input.termsZh).join('\n'), termsEn: splitTerms(input.termsEn).join('\n'),
    submitNoteZh: input.submitNoteZh.trim(), submitNoteEn: input.submitNoteEn.trim(),
  };
  if (!v.termsZh || !v.termsEn) throw new AppError('termsRequired');
  if (KEYS.some(k => v[k].length > MAX_SETTING_LENGTH)) throw new AppError('settingTooLong', { n: MAX_SETTING_LENGTH });
  await db.transaction(async (tx) => {
    for (const key of KEYS) {
      await tx.insert(formSettings).values({ key, value: v[key] }).onConflictDoUpdate({ target: formSettings.key, set: { value: v[key] } }).run();
    }
  });
  return v;
}

export async function resetFormSettings(db: Db): Promise<void> {
  await db.delete(formSettings).run();
}
