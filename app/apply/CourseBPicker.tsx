'use client';

import { useState } from 'react';
import { SearchIcon } from '@/components/icons';
import { dict, Locale } from '@/lib/i18n';

export type CourseOption = { code: string; name: string; nameEn: string; teacher: string; time: string; note: string };

type Props = {
  courses: CourseOption[];
  value: string;
  onChange: (code: string) => void;
  error?: string;
  labelledBy: string;
  locale: Locale;
};

export const courseTitle = (c: CourseOption, locale: Locale) => (locale === 'en' ? c.nameEn || c.name : c.name);

// 多個關鍵字以空白分隔，全部命中才算（不分大小寫）
function matches(c: CourseOption, q: string) {
  const hay = [c.code, c.name, c.nameEn, c.teacher, c.time, c.note].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(k => hay.includes(k));
}

// 搜尋框＋可直接點選的課程卡片（原生 radio）。送出值走 hidden input：
// 搜尋把已選的卡片篩掉時，值仍會送出
export default function CourseBPicker({ courses, value, onChange, error, labelledBy, locale }: Props) {
  const t = dict(locale).apply;
  const [query, setQuery] = useState('');
  const shown = courses.filter(c => matches(c, query));

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="courseBCode" value={value} />
      <div className="relative">
        <label htmlFor="courseBSearch" className="sr-only">{t.courseBSearch}</label>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-fg" />
        <input id="courseBSearch" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.courseBSearch}
          className="input pl-9" autoComplete="off" aria-describedby={error ? 'courseB-error' : undefined} aria-invalid={error ? true : undefined} />
      </div>
      <p className="text-sm text-muted-fg">{t.courseBCount(courses.length)}</p>
      {error && <p id="courseB-error" role="alert" className="text-sm text-danger">{error}</p>}

      <div role="radiogroup" aria-labelledby={labelledBy} className="-m-1 flex max-h-[28rem] flex-col gap-2 overflow-y-auto p-1">
        {shown.map(c => {
          const checked = c.code === value;
          return (
            <label key={c.code}
              className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] px-4 py-3 transition-colors duration-150
                has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40
                ${checked ? 'border-2 border-primary bg-primary/5' : 'border border-border bg-surface hover:border-primary/50 hover:bg-background'}`}>
              <input type="radio" name="courseBPick" value={c.code} checked={checked} onChange={() => onChange(c.code)}
                className="mt-1 size-4 shrink-0 cursor-pointer accent-primary focus:outline-none" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">{courseTitle(c, locale)}</span>
                  <span className="font-mono text-sm text-foreground/80">{c.time}</span>
                </span>
                <span className="text-sm text-muted-fg">
                  <span className="font-mono whitespace-pre">{c.code}</span>　·　{c.teacher}
                </span>
                {c.note && <span className="self-start rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning">※ {c.note}</span>}
              </span>
            </label>
          );
        })}
        {shown.length === 0 && <p className="px-1 py-4 text-center text-sm text-muted-fg">{t.noMatch}</p>}
      </div>
    </div>
  );
}
