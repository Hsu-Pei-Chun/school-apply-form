import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/**
 * 健康檢查：實際對資料庫執行一次查詢。供 .github/workflows/keep-alive.yml 定期呼叫，
 * 避免 Turso 免費方案的資料庫因閒置 10 天被封存。
 */
export async function GET() {
  try {
    const db = await getDb();
    await db.run(sql`select 1`);
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[health] database check failed', e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
