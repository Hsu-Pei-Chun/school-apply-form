import { createClient, Client } from '@libsql/client';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

export type Db = LibSQLDatabase<typeof schema> & { $client: Client };

export type DbConfig = { url: string; authToken?: string };

/**
 * 有設定 TURSO_DATABASE_URL 時連線到 Turso（雲端 SQLite，資料不會因 Render 重啟而遺失）；
 * 否則使用本機檔案 DATABASE_PATH（預設 data/app.db），供本機開發使用。
 */
export function databaseConfig(env: Record<string, string | undefined> = process.env): DbConfig {
  if (env.TURSO_DATABASE_URL) return { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN };
  return { url: `file:${env.DATABASE_PATH ?? 'data/app.db'}` };
}

/** 建立連線並套用尚未執行的 migration（已套用過的會略過）。url 可為 `:memory:`、`file:...` 或 `libsql://...`。 */
export async function createDb(url: string, authToken?: string): Promise<Db> {
  if (url.startsWith('file:')) {
    fs.mkdirSync(path.dirname(url.slice('file:'.length)), { recursive: true });
  }
  const db = drizzle(createClient({ url, authToken }), { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  return db;
}

const g = globalThis as { __schoolApplyDb?: Promise<Db> };
export function getDb(): Promise<Db> {
  if (!g.__schoolApplyDb) {
    const config = databaseConfig();
    if (process.env.NODE_ENV === 'production' && config.url.startsWith('file:')) {
      console.warn('[db] 未設定 TURSO_DATABASE_URL，改用本機 SQLite 檔案；在 Render 免費方案上重啟後資料會遺失。');
    }
    // 連線或 migration 失敗時清掉快取，下一個請求會重試，而不是永遠拿到同一個失敗的 Promise
    g.__schoolApplyDb = createDb(config.url, config.authToken).catch((e) => {
      g.__schoolApplyDb = undefined;
      throw e;
    });
  }
  return g.__schoolApplyDb;
}

/** 資料庫或交易皆可：讓 createCourse 等函式能在 transaction 內重用。 */
export type Executor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * 是否為 UNIQUE／PRIMARY KEY 衝突。libsql 的錯誤可能被 drizzle 包成 DrizzleQueryError（原始錯誤在 cause），
 * 錯誤碼可能在 code 或 extendedCode，因此逐層檢查。
 */
export function isUniqueViolation(e: unknown): boolean {
  for (let cur = e as { code?: unknown; extendedCode?: unknown; message?: unknown; cause?: unknown } | undefined; cur; cur = cur.cause as typeof cur) {
    const codes = [cur.code, cur.extendedCode].map(String);
    if (codes.some(c => c === 'SQLITE_CONSTRAINT_UNIQUE' || c === 'SQLITE_CONSTRAINT_PRIMARYKEY')) return true;
    if (typeof cur.message === 'string' && /UNIQUE constraint failed/.test(cur.message)) return true;
  }
  return false;
}
