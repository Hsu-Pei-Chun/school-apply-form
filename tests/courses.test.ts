import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, Db } from '@/lib/db/client';
import { createCourse, listCourses, listActiveCourses, setCourseActive } from '@/lib/courses';

let db: Db;
beforeEach(() => { db = createDb(':memory:'); });

describe('courses', () => {
  it('新增後可列出，含教師', () => {
    const c = createCourse(db, { code: 'C001', name: '微積分', teacher: '王教授' });
    expect(c.isActive).toBe(1);
    expect(c.teacher).toBe('王教授');
    expect(listCourses(db).map(x => x.code)).toEqual(['C001']);
  });

  it('代碼重複拋錯', () => {
    createCourse(db, { code: 'C001', name: '微積分', teacher: '王教授' });
    expect(() => createCourse(db, { code: 'C001', name: '線代', teacher: '李教授' })).toThrow('課程代碼已存在');
  });

  it('停用後不在 active 清單但仍在完整清單', () => {
    createCourse(db, { code: 'C001', name: '微積分', teacher: '王教授' });
    createCourse(db, { code: 'C002', name: '線代', teacher: '李教授' });
    setCourseActive(db, 'C001', false);
    expect(listActiveCourses(db).map(x => x.code)).toEqual(['C002']);
    expect(listCourses(db).map(x => x.code)).toEqual(['C001', 'C002']);
  });
});
