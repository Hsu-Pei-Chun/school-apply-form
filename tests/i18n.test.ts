import { describe, it, expect } from 'vitest';
import { dict, toLocale } from '@/lib/i18n';
import { AppError, errorText, msg } from '@/lib/messages';
import { DuplicateApplicationError } from '@/lib/applications';

describe('toLocale', () => {
  it('只有 en 會切成英文，其餘（含空值、亂值）回到預設中文', () => {
    expect(toLocale('en')).toBe('en');
    expect(toLocale('zh')).toBe('zh');
    expect(toLocale(undefined)).toBe('zh');
    expect(toLocale('fr')).toBe('zh');
  });
});

describe('dict', () => {
  it('中英文字典結構一致（型別保證），抽查數個字串', () => {
    expect(dict('zh').print.appliedAt).toBe('申請日期');
    expect(dict('en').print.appliedAt).toBe('Application Date');
    expect(dict('en').degrees['在職專班']).toBe("In-service Master's");
    expect(dict('en').courses.import.confirm(1, 0)).toBe('Import 1 course');
    expect(dict('zh').courses.import.confirm(3, 2)).toBe('確認匯入 3 筆（略過 2 筆）');
  });
});

describe('messages', () => {
  it('AppError 的 message 為中文，errorText 依語系翻譯', () => {
    const e = new AppError('studentIdFormat');
    expect(e.message).toBe('學號必須為 9 碼數字');
    expect(errorText('zh', e)).toBe('學號必須為 9 碼數字');
    expect(errorText('en', e)).toBe('Student ID must be 9 digits.');
  });
  it('帶參數的訊息（標題列缺欄位）兩種語系都正確', () => {
    const e = new AppError('headerMissing', { fields: ['teacher', 'time'] });
    expect(e.message).toBe('標題列缺少欄位：教師、上課時間');
    expect(errorText('en', e)).toBe('Header row is missing: Instructor, Class Time');
  });
  it('DuplicateApplicationError 也可翻譯', () => {
    expect(errorText('en', new DuplicateApplicationError('A000001'))).toBe('This student ID has already applied for this X-Class course.');
  });
  it('非 AppError 的錯誤原樣顯示', () => {
    expect(errorText('en', new Error('boom'))).toBe('boom');
  });
  it('msg 直接取用', () => {
    expect(msg('en', 'wrongPassword')).toBe('Incorrect password.');
  });
});
