import { count } from 'drizzle-orm';
import { Db } from './db/client';
import { students, courses, applications } from './db/schema';
import { createCourse } from './courses';

const SURNAMES = ['王', '李', '張', '劉', '陳', '楊', '黃', '趙', '吳', '周', '林', '徐', '許', '蔡', '鄭'];
const GIVEN = ['小明', '小華', '雅婷', '志偉', '淑芬', '俊傑', '怡君', '家豪', '佩珊', '冠宇', '心怡', '宗翰', '欣妤', '柏翰', '思穎'];
const DEPARTMENTS = ['資工系', '電機系', '數學系', '物理系', '化學系', '經濟系', '中文系', '外語系', '生科系', '材料系'];
const GRADES = ['一年級', '二年級', '三年級', '四年級'];
const COURSE_BASES = ['微積分', '普通物理', '計算機概論', '線性代數', '普通化學', '經濟學原理', '英文寫作', '資料結構', '統計學', '生命科學導論'];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

export function seed(db: Db, { ifEmpty }: { ifEmpty: boolean }): 'seeded' | 'skipped' {
  if (ifEmpty) {
    const existing = db.select({ n: count() }).from(students).get();
    if (existing && existing.n > 0) {
      return 'skipped';
    }
  }

  db.transaction((tx) => {
    tx.delete(applications).run();
    tx.delete(courses).run();
    tx.delete(students).run();

    const studentRows = Array.from({ length: 2000 }, (_, i) => {
      const n = i + 1;
      return {
        id: 'S' + String(n).padStart(4, '0'),
        name: pick(SURNAMES, n * 7) + pick(GIVEN, n * 13),
        department: `${pick(DEPARTMENTS, Math.floor(i / 200))} ${pick(GRADES, Math.floor(i / 50))}`,
        isActive: 1,
      };
    });
    for (let i = 0; i < studentRows.length; i += 500) {
      tx.insert(students).values(studentRows.slice(i, i + 500)).run();
    }

    for (let i = 1; i <= 100; i++) {
      createCourse(tx, {
        code: 'C' + String(i).padStart(3, '0'),
        name: `${pick(COURSE_BASES, i - 1)}${Math.ceil(i / 10)}`,
        teacher: `${pick(SURNAMES, i * 3)}教授`,
      });
    }
  });

  return 'seeded';
}
