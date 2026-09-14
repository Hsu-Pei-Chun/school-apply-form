import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { createCourse, listCourses, listActiveCourses, setCourseActive } from '@/lib/courses';

let db: Db;
beforeEach(() => { db = createDb(':memory:'); });

describe('courses', () => {
  it('新增後可列出，含教師', () => {
    const c = createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授' });
    expect(c.isActive).toBe(1);
    expect(c.teacher).toBe('王教授');
    expect(listCourses(db).map(x => x.code)).toEqual(['11510EECS200101']);
  });

  it('代碼重複拋錯', () => {
    createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授' });
    expect(() => createCourse(db, { code: '11510EECS200101', name: '線代', teacher: '李教授' })).toThrow('課程代碼已存在');
  });

  it('停用後不在 active 清單但仍在完整清單', () => {
    createCourse(db, { code: '11510EECS200101', name: '微積分', teacher: '王教授' });
    createCourse(db, { code: '11510MATH200102', name: '線代', teacher: '李教授' });
    setCourseActive(db, '11510EECS200101', false);
    expect(listActiveCourses(db).map(x => x.code)).toEqual(['11510MATH200102']);
    expect(listCourses(db).map(x => x.code)).toEqual(['11510EECS200101', '11510MATH200102']);
  });

  it('科號非 15 碼拋錯', () => {
    expect(() => createCourse(db, { code: 'C001', name: 'x', teacher: 'y' })).toThrow('科號必須為 15 碼');
  });
});
