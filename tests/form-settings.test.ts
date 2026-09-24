import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { DEFAULT_FORM_TEXT, getFormText, getFormSettings, saveFormSettings, resetFormSettings, MAX_SETTING_LENGTH } from '@/lib/form-settings';

let db: Db;
beforeEach(async () => { db = await createDb(':memory:'); });

const input = {
  termsZh: '第一條\n\n  第二條  \n', termsEn: 'Term one\nTerm two\nTerm three',
  submitNoteZh: ' 請於週五前送交。 ', submitNoteEn: 'Submit by Friday.',
};

describe('form settings', () => {
  it('沒有設定時回傳程式內的預設文字', async () => {
    expect(await getFormText(db, 'zh')).toEqual(DEFAULT_FORM_TEXT.zh);
    expect(await getFormText(db, 'en')).toEqual(DEFAULT_FORM_TEXT.en);
  });

  it('儲存後依語系讀回；同意事項一行一條、去除空行與前後空白', async () => {
    await saveFormSettings(db, input);
    expect(await getFormText(db, 'zh')).toEqual({ terms: ['第一條', '第二條'], submitNote: '請於週五前送交。' });
    expect((await getFormText(db, 'en')).terms).toHaveLength(3);
    expect((await getFormSettings(db)).termsZh).toBe('第一條\n第二條');
  });

  it('重複儲存會覆蓋（upsert）', async () => {
    await saveFormSettings(db, input);
    await saveFormSettings(db, { ...input, submitNoteEn: 'Updated.' });
    expect((await getFormText(db, 'en')).submitNote).toBe('Updated.');
  });

  it('送交說明可留空', async () => {
    await saveFormSettings(db, { ...input, submitNoteZh: '' });
    expect((await getFormText(db, 'zh')).submitNote).toBe('');
  });

  it('任一語系同意事項為空 → 拒絕，且不寫入', async () => {
    await expect(saveFormSettings(db, { ...input, termsEn: ' \n ' })).rejects.toThrow('同意事項至少一條');
    expect(await getFormText(db, 'zh')).toEqual(DEFAULT_FORM_TEXT.zh);
  });

  it('超過長度上限 → 拒絕', async () => {
    await expect(saveFormSettings(db, { ...input, submitNoteZh: 'x'.repeat(MAX_SETTING_LENGTH + 1) })).rejects.toThrow(`每個欄位最多 ${MAX_SETTING_LENGTH} 字`);
  });

  it('還原後回到預設文字', async () => {
    await saveFormSettings(db, input);
    await resetFormSettings(db);
    expect(await getFormText(db, 'zh')).toEqual(DEFAULT_FORM_TEXT.zh);
  });
});
