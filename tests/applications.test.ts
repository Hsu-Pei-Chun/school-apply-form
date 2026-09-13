import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { students } from '@/lib/db/schema';
import { createSubject, setSubjectActive } from '@/lib/subjects';
import { createApplication, getApplication, receiveApplication, nextApplicationId } from '@/lib/applications';

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  db.insert(students).values({ id: 'S0001', name: '王小明', className: '一年一班' }).run();
  createSubject(db, { code: 'C001', name: '國文' });
});

describe('nextApplicationId', () => {
  it('空表從 A000001 起', () => {
    expect(nextApplicationId(db)).toBe('A000001');
  });
  it('遞增', () => {
    createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    expect(nextApplicationId(db)).toBe('A000003');
  });
});

describe('createApplication', () => {
  it('成功建立，狀態 printed', () => {
    const a = createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    expect(a.id).toBe('A000001');
    expect(a.status).toBe('printed');
    expect(a.receivedAt).toBeNull();
  });
  it('學號不存在拋錯', () => {
    expect(() => createApplication(db, { studentId: 'S9999', subjectCode: 'C001' })).toThrow('查無此學號');
  });
  it('科目停用拋錯', () => {
    setSubjectActive(db, 'C001', false);
    expect(() => createApplication(db, { studentId: 'S0001', subjectCode: 'C001' })).toThrow('科目不存在或已停用');
  });
  it('科目代碼不存在拋錯', () => {
    expect(() => createApplication(db, { studentId: 'S0001', subjectCode: 'C999' })).toThrow('科目不存在或已停用');
  });
});

describe('getApplication', () => {
  it('回傳含學生與科目名稱的明細', () => {
    createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    const d = getApplication(db, 'A000001');
    expect(d?.studentName).toBe('王小明');
    expect(d?.className).toBe('一年一班');
    expect(d?.subjectName).toBe('國文');
  });
  it('不存在回傳 undefined', () => {
    expect(getApplication(db, 'A999999')).toBeUndefined();
  });
});

describe('receiveApplication', () => {
  it('printed → received 並寫入 receivedAt', () => {
    createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    const r = receiveApplication(db, 'A000001');
    expect(r.kind).toBe('received');
    if (r.kind === 'received') {
      expect(r.detail.status).toBe('received');
      expect(r.detail.receivedAt).not.toBeNull();
    }
  });
  it('重複掃描回 already 且不覆寫 receivedAt', () => {
    createApplication(db, { studentId: 'S0001', subjectCode: 'C001' });
    const first = receiveApplication(db, 'A000001');
    const second = receiveApplication(db, 'A000001');
    expect(second.kind).toBe('already');
    if (first.kind === 'received' && second.kind === 'already') {
      expect(second.detail.receivedAt).toBe(first.detail.receivedAt);
    }
  });
  it('無效流水號回 not_found', () => {
    expect(receiveApplication(db, 'XYZ').kind).toBe('not_found');
  });
});
