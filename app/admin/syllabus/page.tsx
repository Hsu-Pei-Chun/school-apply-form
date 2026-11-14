import Card from '@/components/Card';
import Button from '@/components/Button';
import { ChevronDownIcon, SearchIcon } from '@/components/icons';
import { getDb } from '@/lib/db/client';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';
import { formatDateTime } from '@/lib/format';
import { getLastRun, getSyllabusIndexUrl, getSyllabusStats, searchSyllabi } from '@/lib/syllabus/store';
import { getIndexStatus } from '@/lib/syllabus/indexer';
import IndexPanel from './IndexPanel';
import SyllabusResult from './SyllabusResult';

export const dynamic = 'force-dynamic';

const MAX_RESULTS = 300;

export default async function SyllabusPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = String((await searchParams).q ?? '').slice(0, 500);
  const locale = await getLocale();
  const t = dict(locale).syllabus;
  const db = await getDb();
  const [url, stats, lastRun, search] = await Promise.all([
    getSyllabusIndexUrl(db), getSyllabusStats(db), getLastRun(db), searchSyllabi(db, q),
  ]);
  const shown = search.results.slice(0, MAX_RESULTS);

  const status = getIndexStatus();
  const openSource = stats.total === 0 || status.state === 'running';

  // 搜尋是主要任務放最上面；來源設定不常用，收進 details（沒索引或更新中才自動展開）
  return (
    <div className="page-wide flex flex-col gap-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-fg">{t.intro}</p>
      </div>

      <Card>
        <form method="get" role="search" className="flex flex-col gap-1.5">
          <label htmlFor="q" className="font-semibold">{t.keywordLabel}</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="q" name="q" type="search" defaultValue={q} placeholder={t.keywordPlaceholder} className="input min-w-0 flex-1" />
            <Button type="submit"><SearchIcon /> {t.search}</Button>
          </div>
          <p className="text-sm text-muted-fg">{t.keywordHint}</p>
        </form>
      </Card>

      <details open={openSource} className="group rounded-[var(--radius-card)] border border-border bg-surface">
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap [&::-webkit-details-marker]:hidden items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
          <span className="flex items-center gap-2 font-semibold">
            <ChevronDownIcon className="size-4 -rotate-90 transition-transform duration-150 group-open:rotate-0" />
            {t.sourceSummary}
          </span>
          <span className="text-sm text-muted-fg">
            {stats.total === 0 ? t.neverRun : t.stats(stats.total, stats.noText, stats.failed)}
            {lastRun && <> {t.lastRun(formatDateTime(lastRun.finishedAt))}</>}
          </span>
        </summary>
        <div className="border-t border-border px-5 py-4">
          <IndexPanel locale={locale} initialUrl={url} initialStatus={status} />
        </div>
      </details>

      {search.keywords.length > 0 && (
        <section aria-live="polite" aria-label={t.searchTitle} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">{search.results.length ? t.resultCount(search.results.length) : t.noResults}</p>
            {search.results.length > MAX_RESULTS && <p className="text-sm text-muted-fg">{t.showingFirst(MAX_RESULTS)}</p>}
          </div>
          <ul className="flex flex-col gap-3">
            {shown.map(r => <li key={r.code}><SyllabusResult r={r} locale={locale} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
