'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
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
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="danger" loading={pending} disabled={picked.length === 0} onClick={onDelete} className="text-sm">
          {t.deleteSelected(picked.length)}
        </Button>
        {picked.length > 0 && <span className="text-sm text-muted-fg">{t.selected(picked.length)}</span>}
      </div>
      {notice && (
        <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`mb-3 text-sm ${notice.tone === 'error' ? 'text-danger' : 'text-success'}`}>
          {notice.lines.map(l => <p key={l}>{l}</p>)}
        </div>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-muted-fg whitespace-nowrap">
            <tr>
              <th className="w-10 px-4 py-3">
                <input ref={selectAllRef} type="checkbox" aria-label={t.selectAll} className="size-4 cursor-pointer align-middle"
                  checked={allChecked} onChange={toggleAll} disabled={codes.length === 0} />
              </th>
              <th className="px-4 py-3 font-semibold">{t.code}</th>
              <th className="px-4 py-3 font-semibold">{t.name}</th>
              <th className="px-4 py-3 font-semibold">{t.nameEn}</th>
              <th className="px-4 py-3 font-semibold">{t.teacher}</th>
              <th className="px-4 py-3 font-semibold">{t.time}</th>
              <th className="px-4 py-3 font-semibold">{t.note}</th>
              <th className="px-4 py-3 font-semibold">{t.status}</th>
              <th className="px-4 py-3 font-semibold">{t.created}</th>
              {/* 表格比內容區寬，操作欄固定在右側，避免停用按鈕被捲到畫面外 */}
              <th className="sticky right-0 bg-background px-4 py-3 shadow-[-1px_0_0_var(--color-border)]" />
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.code} className={`border-t border-border bg-surface even:bg-background ${c.isActive ? '' : 'text-muted-fg'}`}>
                <td className="px-4 py-2">
                  <input type="checkbox" aria-label={t.selectRow(c.code)} className="size-4 cursor-pointer align-middle"
                    checked={selected.has(c.code)} onChange={() => toggleOne(c.code)} />
                </td>
                <td className="px-4 py-2 whitespace-pre font-mono">{c.code}</td>
                <td className="min-w-40 px-4 py-2">{c.name}</td>
                <td className="min-w-40 px-4 py-2">{c.nameEn}</td>
                <td className="min-w-28 px-4 py-2">{c.teacher}</td>
                <td className="px-4 py-2 font-mono">{c.time}</td>
                <td className="min-w-24 px-4 py-2">{c.note}</td>
                <td className="px-4 py-2 whitespace-nowrap"><Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? t.active : t.inactive}</Badge></td>
                <td className="px-4 py-2 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                <td className="sticky right-0 bg-inherit px-4 py-2 text-right shadow-[-1px_0_0_var(--color-border)]">
                  <form action={toggleCourse}>
                    <input type="hidden" name="code" value={c.code} />
                    <input type="hidden" name="isActive" value={c.isActive} />
                    <Button type="submit" variant={c.isActive ? 'danger' : 'secondary'} className="min-h-11 whitespace-nowrap px-3 text-xs">
                      {c.isActive ? t.disable : t.enable}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
