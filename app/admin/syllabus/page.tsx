import Card from '@/components/Card';
import Button from '@/components/Button';
import { SearchIcon } from '@/components/icons';
import { getDb } from '@/lib/db/client';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';
import { formatDateTime } from '@/lib/format';
import { getLastRun, getSyllabusIndexUrl, getSyllabusStats, searchSyllabi } from '@/lib/syllabus/store';
import { getIndexStatus } from '@/lib/syllabus/indexer';
import IndexPanel from './IndexPanel';

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

  return (
    <div className="page-wide">
      <h1 className="mb-1 text-2xl font-semibold">{t.title}</h1>
      <p className="mb-6 text-muted-fg">{t.intro}</p>

      <Card className="mb-6">
        <h2 className="mb-1 text-lg font-semibold">{t.sourceTitle}</h2>
        <p className="mb-4 text-sm text-muted-fg">
          {stats.total === 0 ? t.neverRun : t.stats(stats.total, stats.noText, stats.failed)}
          {lastRun && <> {t.lastRun(formatDateTime(lastRun.finishedAt))}</>}
        </p>
        <IndexPanel locale={locale} initialUrl={url} initialStatus={getIndexStatus()} />
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">{t.searchTitle}</h2>
        <form method="get" className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">{t.keywordLabel}</label>
          <div className="flex flex-wrap gap-2">
            <input id="q" name="q" type="search" defaultValue={q} placeholder={t.keywordPlaceholder} className="input min-w-0 flex-1" />
            <Button type="submit"><SearchIcon /> {t.search}</Button>
          </div>
          <p className="text-sm text-muted-fg">{t.keywordHint}</p>
        </form>
      </Card>

      {search.keywords.length > 0 && (
        <section aria-live="polite">
          <p className="mb-3 font-medium">
            {search.results.length ? t.resultCount(search.results.length) : t.noResults}
          </p>
          {search.results.length > MAX_RESULTS && <p className="mb-3 text-sm text-muted-fg">{t.showingFirst(MAX_RESULTS)}</p>}
          <ul className="flex flex-col gap-3">
            {shown.map(r => (
              <li key={r.code}>
                <Card className="!p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="mr-2 font-mono text-sm whitespace-pre text-muted-fg">{r.code}</span>
                      <span className="font-semibold">{locale === 'en' && r.nameEn ? r.nameEn : r.name || r.code}</span>
                      {r.teacher && <span className="ml-2 text-sm text-muted-fg">{r.teacher}</span>}
                      {r.time && <span className="ml-2 text-sm text-muted-fg">{r.time}</span>}
                    </div>
                    <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-secondary hover:underline">
                      {t.openPdf} ↗
                    </a>
                  </div>
                  <ul className="mt-2 flex flex-col gap-2 text-sm">
                    {r.hits.filter(h => h.count > 0).map(h => (
                      <li key={h.keyword}>
                        <span className="mr-2 inline-block rounded bg-background px-2 py-0.5 font-medium">
                          {h.keyword} · {t.hits(h.count)}
                        </span>
                        {h.snippets.map((segs, i) => (
                          <p key={i} className="mt-1 break-words text-muted-fg">
                            {segs.map((s, j) => s.hit
                              ? <mark key={j} className="rounded-sm bg-warning-bg px-0.5 text-foreground">{s.text}</mark>
                              : <span key={j}>{s.text}</span>)}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
