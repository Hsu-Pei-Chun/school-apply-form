import { createDb } from '../lib/db/client';
import { seed } from '../lib/seed';

const db = createDb(process.env.DATABASE_PATH ?? 'data/app.db');
const ifEmpty = process.argv.includes('--if-empty');
const result = seed(db, { ifEmpty });

if (result === 'skipped') {
  console.log('既有資料，略過 seed');
} else {
  console.log('seed 完成：100 課程');
}
