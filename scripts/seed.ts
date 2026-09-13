import { createDb } from '../lib/db/client';
import { students, subjects, applications } from '../lib/db/schema';
import { createSubject } from '../lib/subjects';

const SURNAMES = ['王', '李', '張', '劉', '陳', '楊', '黃', '趙', '吳', '周', '林', '徐', '許', '蔡', '鄭'];
const GIVEN = ['小明', '小華', '雅婷', '志偉', '淑芬', '俊傑', '怡君', '家豪', '佩珊', '冠宇', '心怡', '宗翰', '欣妤', '柏翰', '思穎'];
const GRADES = ['一', '二', '三'];
const CLASSES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
const SUBJECT_BASES = ['國文', '英文', '數學', '物理', '化學', '生物', '歷史', '地理', '公民', '資訊'];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

const db = createDb(process.env.DATABASE_PATH ?? 'data/app.db');

db.delete(applications).run();
db.delete(subjects).run();
db.delete(students).run();

const studentRows = Array.from({ length: 2000 }, (_, i) => {
  const n = i + 1;
  return {
    id: 'S' + String(n).padStart(4, '0'),
    name: pick(SURNAMES, n * 7) + pick(GIVEN, n * 13),
    className: `${pick(GRADES, Math.floor(i / 700))}年${pick(CLASSES, Math.floor(i / 35))}班`,
    isActive: 1,
  };
});
for (let i = 0; i < studentRows.length; i += 500) {
  db.insert(students).values(studentRows.slice(i, i + 500)).run();
}

for (let i = 1; i <= 100; i++) {
  createSubject(db, {
    code: 'C' + String(i).padStart(3, '0'),
    name: `${pick(SUBJECT_BASES, i - 1)}${Math.ceil(i / 10)}`,
  });
}

console.log('seed 完成：2000 學生、100 科目');
