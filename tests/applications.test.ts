import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { students } from '@/lib/db/schema';
import { createCourse, setCourseActive } from '@/lib/courses';
import { createApplication, getApplication, receiveApplication, nextApplicationId } from '@/lib/applications';

let db: Db;
const input = { studentId: 'S0001', courseACode: 'C001', courseAStatus: '已選上', courseBCode: 'C002' };

beforeEach(() => {
  db = createDb(':memory:');
  db.insert(students).values({ id: 'S0001', name: '王小明', department: '資工系 二年級' }).run();
  createCourse(db, { code: 'C001', name: '微積分', teacher: '王教授' });
  createCourse(db, { code: 'C002', name: 'X-Class 線代', teacher: '李教授' });
});

describe('nextApplicationId', () => {
  it('空表從 A000001 起', () => {
    expect(nextApplicationId(db)).toBe('A000001');
  });
  it('遞增', () => {
    createApplication(db, input);
    createApplication(db, input);
    expect(nextApplicationId(db)).toBe('A000003');
  });
});

describe('createApplication', () => {
  it('成功建立，狀態 printed', () => {
    const a = createApplication(db, input);
    expect(a.id).toBe('A000001');
    expect(a.status).toBe('printed');
    expect(a.courseAStatus).toBe('已選上');
    expect(a.receivedAt).toBeNull();
  });
  it('學號不存在拋錯', () => {
    expect(() => createApplication(db, { ...input, studentId: 'S9999' })).toThrow('查無此學號');
  });
  it('A 課程停用拋錯', () => {
    setCourseActive(db, 'C001', false);
    expect(() => createApplication(db, input)).toThrow('課程不存在或已停用');
  });
  it('B 課程不存在拋錯', () => {
    expect(() => createApplication(db, { ...input, courseBCode: 'C999' })).toThrow('課程不存在或已停用');
  });
  it('A 與 B 相同拋錯', () => {
    expect(() => createApplication(db, { ...input, courseBCode: 'C001' })).toThrow('一般課程與 X-Class 課程不可相同');
  });
});

describe('getApplication', () => {
  it('回傳含學生、A、B 課程資訊的明細', () => {
    createApplication(db, input);
    const d = getApplication(db, 'A000001');
    expect(d?.studentName).toBe('王小明');
    expect(d?.department).toBe('資工系 二年級');
    expect(d?.courseAName).toBe('微積分');
    expect(d?.courseBName).toBe('X-Class 線代');
    expect(d?.courseBTeacher).toBe('李教授');
  });
  it('不存在回傳 undefined', () => {
    expect(getApplication(db, 'A999999')).toBeUndefined();
  });
});

describe('receiveApplication', () => {
  it('printed → received 並寫入 receivedAt', () => {
    createApplication(db, input);
    const r = receiveApplication(db, 'A000001');
    expect(r.kind).toBe('received');
    if (r.kind === 'received') {
      expect(r.detail.status).toBe('received');
      expect(r.detail.receivedAt).not.toBeNull();
    }
  });
  it('重複掃描回 already 且不覆寫 receivedAt', () => {
    createApplication(db, input);
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
