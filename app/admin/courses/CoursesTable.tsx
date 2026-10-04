'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import type { Course } from '@/lib/db/schema';
import { formatDate } from '@/lib/format';
import { dict, Locale } from '@/lib/i18n';
import { deleteSelectedCourses, toggleCourse } from './actions';

export default function CoursesTable({ locale, rows }: { locale: Locale; rows: Course[] }) {
  const t = dict(locale).courses;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; lines: string[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement>(null);

  // 列表重新整理後，只保留仍存在的選取
  const codes = rows.map(c => c.code);
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

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold">
          {t.listTitle}<span className="ml-2 text-sm font-normal text-muted-fg">{t.total(rows.length)}</span>
        </h2>
        <Button type="button" variant="danger" loading={pending} disabled={picked.length === 0} onClick={onDelete} className="text-sm">
          {t.deleteSelected(picked.length)}
        </Button>
        {notice && (
          <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`w-full text-sm ${notice.tone === 'error' ? 'text-danger' : 'text-success'}`}>
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
              <th className="px-3 py-2.5 font-semibold">{t.status}</th>
              <th className="px-3 py-2.5 font-semibold">{t.created}</th>
              <th className="py-2.5 pl-3 pr-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map(c => {
              const checked = selected.has(c.code);
              return (
                <tr key={c.code} className={`border-t border-border align-top ${checked ? 'bg-primary/5' : 'hover:bg-background'} ${c.isActive ? '' : 'text-muted-fg'}`}>
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
                  <td className="px-3 py-3 whitespace-nowrap"><Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? t.active : t.inactive}</Badge></td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-fg">{formatDate(c.createdAt)}</td>
                  <td className="py-2 pl-3 pr-4 text-right">
                    <form action={toggleCourse}>
                      <input type="hidden" name="code" value={c.code} />
                      <input type="hidden" name="isActive" value={c.isActive} />
                      <button type="submit" className={`cursor-pointer whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium transition-colors
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${c.isActive
                          ? 'border-danger/40 text-danger hover:bg-danger-bg'
                          : 'border-border text-foreground hover:bg-background'}`}>
                        {c.isActive ? t.disable : t.enable}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
