'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Button from '@/components/Button';
import { SearchIcon } from '@/components/icons';
import type { Course } from '@/lib/db/schema';
import { formatDate } from '@/lib/format';
import { dict, Locale } from '@/lib/i18n';
import { deleteSelectedCourses, toggleCourse } from './actions';

type Filter = 'all' | 'active' | 'inactive';

// 搜尋字串以空白切成多個關鍵字，全部命中才算（不分大小寫）
function matches(c: Course, q: string) {
  const hay = [c.code, c.name, c.nameEn, c.teacher, c.time, c.note].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(k => hay.includes(k));
}

export default function CoursesTable({ locale, rows }: { locale: Locale; rows: Course[] }) {
  const t = dict(locale).courses;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; lines: string[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const activeCount = rows.filter(c => c.isActive).length;
  const visible = rows.filter(c =>
    (filter === 'all' || (filter === 'active') === Boolean(c.isActive)) && matches(c, query));

  // 只對目前看得到的列做選取；列表重新整理或篩選後，看不到的選取不算數
  const codes = visible.map(c => c.code);
  const picked = codes.filter(c => selected.has(c));
  const allChecked = codes.length > 0 && picked.length === codes.length;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = picked.length > 0 && !allChecked;
  }, [picked.length, allChecked]);

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(codes));
  }

  function toggleOne(code: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  function onDelete() {
    if (picked.length === 0 || !window.confirm(t.confirmDelete(picked.length))) return;
    setNotice(null);
    startTransition(async () => {
      const r = await deleteSelectedCourses(picked);
      if ('error' in r) {
        setNotice({ tone: 'error', lines: [r.error] });
        return;
      }
      setSelected(new Set());
      setNotice({
        tone: r.inUse.length ? 'error' : 'ok',
        lines: [t.deleted(r.deleted), ...(r.inUse.length ? [t.inUse(r.inUse)] : [])],
      });
    });
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: t.filterAll(rows.length) },
    { key: 'active', label: t.filterActive(activeCount) },
    { key: 'inactive', label: t.filterInactive(rows.length - activeCount) },
  ];

  return (
    <section aria-labelledby="courses-list-title" className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="courses-list-title" className="text-lg font-semibold">
            {t.listTitle}<span className="ml-2 text-sm font-normal text-muted-fg">{t.total(rows.length)}</span>
          </h2>
          <Button type="button" variant="danger" loading={pending} disabled={picked.length === 0} onClick={onDelete} className="text-sm">
            {t.deleteSelected(picked.length)}
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="course-q" className="sr-only">{t.searchLabel}</label>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-fg" />
            <input id="course-q" type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder} className="input pl-9" autoComplete="off" />
          </div>
          <div role="group" aria-label={t.filterLabel} className="inline-flex self-start overflow-hidden rounded-[var(--radius-card)] border border-border text-sm sm:self-auto">
            {filters.map((f, i) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
                className={`min-h-11 cursor-pointer whitespace-nowrap px-3 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40
                  ${i > 0 ? 'border-l border-border' : ''} ${filter === f.key ? 'bg-primary text-white' : 'bg-surface text-foreground hover:bg-background'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {notice && (
          <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.tone === 'error' ? 'text-danger' : 'text-success'}`}>
            {notice.lines.map(l => <p key={l}>{l}</p>)}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-muted-fg whitespace-nowrap">
            <tr>
              <th className="w-10 py-2.5 pl-4 pr-2">
                <input ref={selectAllRef} type="checkbox" aria-label={t.selectAll} className="size-4 cursor-pointer align-middle accent-primary"
                  checked={allChecked} onChange={toggleAll} disabled={codes.length === 0} />
              </th>
              <th className="px-3 py-2.5 font-semibold">{t.code}</th>
              <th className="px-3 py-2.5 font-semibold">{t.name}</th>
              <th className="px-3 py-2.5 font-semibold">{t.teacher}</th>
              <th className="px-3 py-2.5 font-semibold">{t.time}</th>
              <th className="px-3 py-2.5 font-semibold">{t.note}</th>
              <th className="px-3 py-2.5 font-semibold">{t.created}</th>
              <th className="py-2.5 pl-3 pr-4 font-semibold">{t.open}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(c => {
              const checked = selected.has(c.code);
              const on = Boolean(c.isActive);
              return (
                <tr key={c.code} className={`border-t border-border align-top ${checked ? 'bg-primary/5' : 'hover:bg-background'} ${on ? '' : 'text-muted-fg'}`}>
                  <td className="py-3 pl-4 pr-2">
                    <input type="checkbox" aria-label={t.selectRow(c.code)} className="size-4 cursor-pointer align-middle accent-primary"
                      checked={checked} onChange={() => toggleOne(c.code)} />
                  </td>
                  <td className="px-3 py-3 whitespace-pre font-mono text-xs leading-5">{c.code}</td>
                  {/* 中英文課名合併一欄，避免欄位過多被擠壓 */}
                  <td className="min-w-48 px-3 py-3">
                    <div>{c.name}</div>
                    {c.nameEn && <div className="text-xs text-muted-fg">{c.nameEn}</div>}
                  </td>
                  <td className="min-w-24 px-3 py-3">{c.teacher}</td>
                  <td className="px-3 py-3 font-mono text-xs leading-5">{c.time}</td>
                  <td className="min-w-20 px-3 py-3 text-muted-fg">{c.note}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-fg">{formatDate(c.createdAt)}</td>
                  <td className="py-1 pl-3 pr-4">
                    {/* 停用可還原，用開關而不是紅色按鈕；紅色只留給不可復原的刪除 */}
                    <form action={toggleCourse}>
                      <input type="hidden" name="code" value={c.code} />
                      <input type="hidden" name="isActive" value={c.isActive} />
                      <button type="submit" role="switch" aria-checked={on} aria-label={t.openFor(c.code)}
                        className="group inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[var(--radius-card)] text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                        {/* 開：紫色實心＋白點；關：灰框空心＋灰點（以填滿與否區分，不只靠顏色） */}
                        <span aria-hidden className={`relative inline-block h-6 w-10 rounded-full border-2 transition-colors duration-150
                          ${on ? 'border-primary bg-primary' : 'border-muted-fg bg-surface group-hover:bg-background'}`}>
                          <span className={`absolute top-0.5 size-4 rounded-full transition-[left] duration-150 ${on ? 'left-[18px] bg-white' : 'left-0.5 bg-muted-fg'}`} />
                        </span>
                        {on ? t.active : t.inactive}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-fg">{t.noMatch}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
