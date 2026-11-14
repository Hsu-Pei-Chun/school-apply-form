import { ExternalLinkIcon } from '@/components/icons';
import { dict, Locale } from '@/lib/i18n';
import type { Segment } from '@/lib/syllabus/search';
import type { SearchResult } from '@/lib/syllabus/store';

function Snippet({ segs }: { segs: Segment[] }) {
  return (
    <p className="break-words rounded-[var(--radius-card)] bg-background px-3 py-2 text-sm leading-6 text-muted-fg">
      {segs.map((s, j) => s.hit
        ? <mark key={j} className="rounded-sm bg-warning-bg px-0.5 font-medium text-foreground">{s.text}</mark>
        : <span key={j}>{s.text}</span>)}
    </p>
  );
}

// 結果可能好幾百筆：課名當標題、資訊收成一行、每個關鍵字只先露一段前後文，手機上才掃得完
export default function SyllabusResult({ r, locale }: { r: SearchResult; locale: Locale }) {
  const t = dict(locale).syllabus;
  const title = (locale === 'en' && r.nameEn ? r.nameEn : r.name) || r.code;
  const hits = r.hits.filter(h => h.count > 0);
  return (
    <article className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug">{title}</h3>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-fg">
            <span className="font-mono whitespace-pre">{r.code}</span>
            {r.teacher && <span>{r.teacher}</span>}
            {r.time && <span className="font-mono">{r.time}</span>}
          </p>
        </div>
        <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-card)] border border-border px-3 text-sm font-medium text-secondary
            transition-colors duration-150 hover:border-secondary hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          {t.openPdf} <ExternalLinkIcon className="size-4" />
        </a>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {hits.map(h => (
          <div key={h.keyword} className="flex flex-col gap-1.5">
            <span className="self-start rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {h.keyword} · {t.hits(h.count)}
            </span>
            {h.snippets[0] && <Snippet segs={h.snippets[0]} />}
            {h.snippets.length > 1 && (
              <details className="group">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-secondary hover:underline">
                  {t.moreSnippets(h.snippets.length - 1)}
                </summary>
                <div className="flex flex-col gap-1.5">
                  {h.snippets.slice(1).map((segs, i) => <Snippet key={i} segs={segs} />)}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
