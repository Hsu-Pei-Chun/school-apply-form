'use client';

import Button from '@/components/Button';
import { PlusIcon, TrashIcon } from '@/components/icons';

export type CourseARow = { key: number; code: string; name: string; time: string; teacher: string };
const FIELDS: Array<{ f: keyof Omit<CourseARow, 'key'>; label: string; hint: string }> = [
  { f: 'code', label: '科號（課號）', hint: '例：EE201001' },
  { f: 'name', label: '課名', hint: '例：電路學' },
  { f: 'time', label: '上課時間', hint: '例：M3M4' },
  { f: 'teacher', label: '任課教師', hint: '例：林教授' },
];

type Props = { rows: CourseARow[]; max: number; onChange: (rows: CourseARow[]) => void };

export default function CourseARows({ rows, max, onChange }: Props) {
  function update(i: number, f: keyof Omit<CourseARow, 'key'>, v: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [f]: v } : r)));
  }
  function add() {
    if (rows.length >= max) return;
    onChange([...rows, { key: Date.now(), code: '', name: '', time: '', teacher: '' }]);
  }
  function remove(i: number) {
    if (rows.length <= 1) return;
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">一般課程 A（至少一門，最多 {max} 門；校內或校外課程皆可）</legend>
      {rows.map((r, i) => (
        <div key={r.key} className="rounded-[var(--radius-card)] border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-fg">第 {i + 1} 門</span>
            <Button type="button" variant="danger" className="min-h-11 px-3 text-xs" onClick={() => remove(i)} disabled={rows.length <= 1} aria-label={`刪除第 ${i + 1} 門`}>
              <TrashIcon className="size-4" /> 刪除
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(({ f, label, hint }) => {
              const id = `courseA-${i}-${f}`;
              return (
                <div key={f} className="flex flex-col gap-1.5">
                  <label htmlFor={id} className="text-sm font-medium">{label}</label>
                  <input id={id} name={`courseA[${i}][${f}]`} className="input" required value={r[f]} onChange={e => update(i, f, e.target.value)} placeholder={hint} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={add} disabled={rows.length >= max} className="self-start">
        <PlusIcon className="size-4" /> 新增一門
      </Button>
    </fieldset>
  );
}
