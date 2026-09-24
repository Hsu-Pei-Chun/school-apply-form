import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { DEFAULT_FORM_TEXT, getFormText, getFormSettings, saveFormSettings, resetFormSettings, MAX_SETTING_LENGTH } from '@/lib/form-settings';

let db: Db;
beforeEach(() => { db = createDb(':memory:'); });

const input = {
  termsZh: '第一條\n\n  第二條  \n', termsEn: 'Term one\nTerm two\nTerm three',
  submitNoteZh: ' 請於週五前送交。 ', submitNoteEn: 'Submit by Friday.',
};

describe('form settings', () => {
  it('沒有設定時回傳程式內的預設文字', () => {
    expect(getFormText(db, 'zh')).toEqual(DEFAULT_FORM_TEXT.zh);
    expect(getFormText(db, 'en')).toEqual(DEFAULT_FORM_TEXT.en);
  });

  it('儲存後依語系讀回；同意事項一行一條、去除空行與前後空白', () => {
    saveFormSettings(db, input);
    expect(getFormText(db, 'zh')).toEqual({ terms: ['第一條', '第二條'], submitNote: '請於週五前送交。' });
    expect(getFormText(db, 'en').terms).toHaveLength(3);
    expect(getFormSettings(db).termsZh).toBe('第一條\n第二條');
  });

  it('重複儲存會覆蓋（upsert）', () => {
    saveFormSettings(db, input);
    saveFormSettings(db, { ...input, submitNoteEn: 'Updated.' });
    expect(getFormText(db, 'en').submitNote).toBe('Updated.');
  });

  it('送交說明可留空', () => {
    saveFormSettings(db, { ...input, submitNoteZh: '' });
    expect(getFormText(db, 'zh').submitNote).toBe('');
  });

  it('任一語系同意事項為空 → 拒絕，且不寫入', () => {
    expect(() => saveFormSettings(db, { ...input, termsEn: ' \n ' })).toThrow('同意事項至少一條');
    expect(getFormText(db, 'zh')).toEqual(DEFAULT_FORM_TEXT.zh);
  });

  it('超過長度上限 → 拒絕', () => {
    expect(() => saveFormSettings(db, { ...input, submitNoteZh: 'x'.repeat(MAX_SETTING_LENGTH + 1) })).toThrow(`每個欄位最多 ${MAX_SETTING_LENGTH} 字`);
  });

  it('還原後回到預設文字', () => {
    saveFormSettings(db, input);
    resetFormSettings(db);
    expect(getFormText(db, 'zh')).toEqual(DEFAULT_FORM_TEXT.zh);
  });
});
