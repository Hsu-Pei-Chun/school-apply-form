import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { students, applicationCoursesA } from '@/lib/db/schema';
import { createCourse, setCourseActive } from '@/lib/courses';
import {
  createApplication, getApplication, listApplicationsByStudent, findApplicationByBarcode,
  receiveApplication, receiveByInput, nextApplicationId, DuplicateApplicationError,
} from '@/lib/applications';

const SID = '113000001';
const B1 = '11510EECS200101';
const B2 = '11510MATH200102';
const A1 = { code: 'EE2010', name: '電路學', time: 'M3M4', teacher: '林教授' };
const A2 = { code: 'CS1010', name: '計概', time: 'T5T6', teacher: '陳教授' };
const base = { studentId: SID, coursesA: [A1], courseBCode: B1 };

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
  db.insert(students).values({ id: SID, name: '王小明', department: '資工系 二年級' }).run();
  createCourse(db, { code: B1, name: 'X-Class 線代', teacher: '李教授' });
  createCourse(db, { code: B2, name: 'X-Class 機率', teacher: '張教授' });
});

describe('nextApplicationId', () => {
  it('空表從 A000001 起並遞增', () => {
    expect(nextApplicationId(db)).toBe('A000001');
    createApplication(db, base);
    expect(nextApplicationId(db)).toBe('A000002');
  });
});

describe('createApplication', () => {
  it('成功：barcode = 學號 + B 科號，A 課程依序寫入', () => {
    const a = createApplication(db, { ...base, coursesA: [A1, A2] });
    expect(a.id).toBe('A000001');
    expect(a.barcode).toBe(SID + B1);
    expect(a.status).toBe('printed');
    const rows = db.select().from(applicationCoursesA).all();
    expect(rows.map(r => [r.seq, r.code])).toEqual([[1, 'EE2010'], [2, 'CS1010']]);
  });
  it('學號不存在', () => {
    expect(() => createApplication(db, { ...base, studentId: '999999999' })).toThrow('查無此學號');
  });
  it('B 停用', () => {
    setCourseActive(db, B1, false);
    expect(() => createApplication(db, base)).toThrow('課程不存在或已停用');
  });
  it('A 課程 0 門', () => {
    expect(() => createApplication(db, { ...base, coursesA: [] })).toThrow('一般課程至少一門，且每門四欄皆必填');
  });
  it('A 課程欄位空白', () => {
    expect(() => createApplication(db, { ...base, coursesA: [{ ...A1, time: '  ' }] })).toThrow('一般課程至少一門，且每門四欄皆必填');
  });
  it('A 課程 6 門', () => {
    expect(() => createApplication(db, { ...base, coursesA: [A1, A1, A1, A1, A1, A1] })).toThrow('一般課程最多五門');
  });
  it('A 課程欄位超過 100 字', () => {
    const longName = 'A'.repeat(101);
    expect(() => createApplication(db, { ...base, coursesA: [{ ...A1, name: longName }] })).toThrow('一般課程欄位最多 100 字');
  });
  it('同學生同 B 課程第二次被拒並回傳既有 id', () => {
    const first = createApplication(db, base);
    try {
      createApplication(db, { ...base, coursesA: [A2] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DuplicateApplicationError);
      expect((e as DuplicateApplicationError).existingId).toBe(first.id);
      expect((e as Error).message).toBe('你已申請過此 X-Class 課程');
    }
    expect(db.select().from(applicationCoursesA).all()).toHaveLength(1);
  });
  it('同學生不同 B 課程可以', () => {
    createApplication(db, base);
    expect(createApplication(db, { ...base, courseBCode: B2 }).id).toBe('A000002');
  });
  it('B 無效時 A 子表不殘留（transaction）', () => {
    expect(() => createApplication(db, { ...base, courseBCode: '11510XXXX999999' })).toThrow();
    expect(db.select().from(applicationCoursesA).all()).toHaveLength(0);
  });
});

describe('getApplication / findApplicationByBarcode', () => {
  it('回傳學生、B 課程與 A 課程列表', () => {
    createApplication(db, { ...base, coursesA: [A1, A2] });
    const d = getApplication(db, 'A000001');
    expect(d?.studentName).toBe('王小明');
    expect(d?.courseBName).toBe('X-Class 線代');
    expect(d?.courseBTeacher).toBe('李教授');
    expect(d?.coursesA.map(c => c.name)).toEqual(['電路學', '計概']);
    expect(findApplicationByBarcode(db, SID + B1)?.id).toBe('A000001');
  });
  it('不存在回 undefined', () => {
    expect(getApplication(db, 'A999999')).toBeUndefined();
    expect(findApplicationByBarcode(db, SID + B2)).toBeUndefined();
  });
});

describe('listApplicationsByStudent', () => {
  it('只回該學生、新→舊', () => {
    createApplication(db, base);
    createApplication(db, { ...base, courseBCode: B2 });
    db.insert(students).values({ id: '113000002', name: '別人', department: 'x' }).run();
    createApplication(db, { ...base, studentId: '113000002' });
    const list = listApplicationsByStudent(db, SID);
    expect(list.map(x => x.courseBCode)).toEqual([B2, B1]);
    expect(list[0].courseBName).toBe('X-Class 機率');
  });
});

describe('receiveByInput', () => {
  it('24 碼 → received', () => {
    createApplication(db, base);
    const r = receiveByInput(db, SID + B1);
    expect(r.kind).toBe('received');
    if (r.kind === 'received') expect(r.detail.receivedAt).not.toBeNull();
  });
  it('流水號路徑', () => {
    createApplication(db, base);
    expect(receiveByInput(db, 'A000001').kind).toBe('received');
  });
  it('重複掃描 already 且不覆寫', () => {
    createApplication(db, base);
    const first = receiveByInput(db, SID + B1);
    const second = receiveByInput(db, SID + B1);
    expect(second.kind).toBe('already');
    if (first.kind === 'received' && second.kind === 'already') expect(second.detail.receivedAt).toBe(first.detail.receivedAt);
  });
  it('格式錯誤 vs 查無', () => {
    expect(receiveByInput(db, 'XYZ').kind).toBe('bad_format');
    expect(receiveByInput(db, SID + B2).kind).toBe('not_found');
    expect(receiveByInput(db, 'A999999').kind).toBe('not_found');
  });
  it('前後空白會被修剪', () => {
    createApplication(db, base);
    expect(receiveByInput(db, `  ${SID}${B1}\n`).kind).toBe('received');
  });
});

describe('receiveApplication（保留）', () => {
  it('printed → received', () => {
    createApplication(db, base);
    expect(receiveApplication(db, 'A000001').kind).toBe('received');
  });
});
