import type { Locale } from './i18n';

// 使用者看得到的錯誤訊息。lib 丟出 AppError（帶 key），由 action／畫面依目前語系轉成文字；
// Error.message 固定為中文，方便記錄與測試。
type Params = { n?: number; fields?: string[] };

const FIELD_LABELS: Record<Locale, Record<string, string>> = {
  zh: { code: '科號', name: '中文課名', nameEn: '英文課名', time: '上課時間', teacher: '教師', note: '備註' },
  en: { code: 'Course No.', name: 'Chinese Title', nameEn: 'English Title', time: 'Class Time', teacher: 'Instructor', note: 'Note' },
};

const zh = {
  courseUnavailable: () => '課程不存在或已停用',
  studentIdFormat: () => '學號必須為 9 碼數字',
  applicantRequired: () => '姓名、科系皆必填',
  applicantTooLong: (p: Params) => `姓名、科系最多 ${p.n} 字`,
  degreeRequired: () => '請選擇學部別',
  courseARequired: () => '一般課程至少一門，且每門四欄皆必填',
  courseATooMany: () => '一般課程最多五門',
  courseATooLong: () => '一般課程欄位最多 100 字',
  duplicateApplication: () => '此學號已申請過此 X-Class 課程',
  courseCodeFormat: () => '科號必須為 15 碼（英數或空格）',
  timeRequired: () => '上課時間為必填',
  courseExists: () => '課程代碼已存在',
  courseFieldsRequired: () => '代碼、名稱、授課教師、上課時間皆必填',
  headerMissing: (p: Params) => `標題列缺少欄位：${(p.fields ?? []).map(f => FIELD_LABELS.zh[f]).join('、')}`,
  tooManyLines: (p: Params) => `一次最多匯入 ${p.n} 行`,
  importFieldsRequired: () => '課名、授課教師、上課時間皆必填',
  duplicateInBatch: () => '同批內科號重複',
  codeExistsSkip: () => '科號已存在',
  importHasErrors: () => '匯入內容有錯誤，請先修正',
  wrongPassword: () => '密碼錯誤',
  termsRequired: () => '同意事項至少一條',
  settingTooLong: (p: Params) => `每個欄位最多 ${p.n} 字`,
};

export type MessageKey = keyof typeof zh;

const en: Record<MessageKey, (p: Params) => string> = {
  courseUnavailable: () => 'The course does not exist or has been disabled.',
  studentIdFormat: () => 'Student ID must be 9 digits.',
  applicantRequired: () => 'Name and department are required.',
  applicantTooLong: (p) => `Name and department must be at most ${p.n} characters.`,
  degreeRequired: () => 'Please select a program level.',
  courseARequired: () => 'Enter at least one regular course, with all four fields filled in.',
  courseATooMany: () => 'At most five regular courses.',
  courseATooLong: () => 'Regular course fields must be at most 100 characters.',
  duplicateApplication: () => 'This student ID has already applied for this X-Class course.',
  courseCodeFormat: () => 'Course No. must be 15 characters (letters, digits or spaces).',
  timeRequired: () => 'Class time is required.',
  courseExists: () => 'This course number already exists.',
  courseFieldsRequired: () => 'Course No., title, instructor and class time are required.',
  headerMissing: (p) => `Header row is missing: ${(p.fields ?? []).map(f => FIELD_LABELS.en[f]).join(', ')}`,
  tooManyLines: (p) => `At most ${p.n} lines per import.`,
  importFieldsRequired: () => 'Title, instructor and class time are required.',
  duplicateInBatch: () => 'Duplicate course number in this batch.',
  codeExistsSkip: () => 'Course number already exists.',
  importHasErrors: () => 'The import contains errors. Please fix them first.',
  wrongPassword: () => 'Incorrect password.',
  termsRequired: () => 'Enter at least one term.',
  settingTooLong: (p) => `Each field must be at most ${p.n} characters.`,
};

const MESSAGES: Record<Locale, Record<MessageKey, (p: Params) => string>> = { zh, en };

export function msg(locale: Locale, key: MessageKey, params: Params = {}): string {
  return MESSAGES[locale][key](params);
}

export class AppError extends Error {
  constructor(public readonly key: MessageKey, public readonly params: Params = {}) {
    super(msg('zh', key, params));
    this.name = 'AppError';
  }
}

/** 把任意例外轉成給使用者看的文字：AppError 依語系翻譯，其他錯誤原樣顯示。 */
export function errorText(locale: Locale, e: unknown): string {
  if (e instanceof AppError) return msg(locale, e.key, e.params);
  return (e as Error).message;
}
