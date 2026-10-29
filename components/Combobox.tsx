'use client';

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { ChevronDownIcon } from './icons';

export type ComboboxOption = { value: string; label: string };

// 以空白切成多個關鍵字，全部命中才算符合（不分大小寫），例：「心理 周」
export function filterOptions(options: ComboboxOption[], query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return options;
  return options.filter(o => {
    const label = o.label.toLowerCase();
    return terms.every(t => label.includes(t));
  });
}

type Props = {
  id: string;
  name: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText: string;
};

// 可搜尋的下拉選單：送出值走 hidden input，輸入框只負責顯示與搜尋
export default function Combobox({ id, name, options, value, onChange, placeholder, emptyText }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find(o => o.value === value);
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const optionId = (i: number) => `${listId}-${i}`;

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  }, [open, active]); // eslint-disable-line react-hooks/exhaustive-deps

  function openList() {
    setActive(Math.max(0, options.findIndex(o => o.value === value)));
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setQuery('');
  }
  function choose(o: ComboboxOption) {
    onChange(o.value);
    close();
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(i => Math.min(Math.max(i + step, 0), filtered.length - 1));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        id={id} role="combobox" className="input pr-10" autoComplete="off"
        aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? optionId(active) : undefined}
        placeholder={selected?.label ?? placeholder}
        value={open ? query : selected?.label ?? ''}
        onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onFocus={openList} onClick={() => !open && openList()} onBlur={close} onKeyDown={onKeyDown}
      />
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-fg" />
      <ul id={listId} role="listbox" hidden={!open}
        className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-[var(--radius-card)] border border-border bg-surface py-1 shadow-lg">
        {filtered.length ? filtered.map((o, i) => (
          <li key={o.value} id={optionId(i)} role="option" data-value={o.value} aria-selected={o.value === value}
            onMouseDown={e => { e.preventDefault(); choose(o); }} onMouseMove={() => setActive(i)}
            className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-primary/10' : ''} ${o.value === value ? 'font-semibold text-primary' : ''}`}>
            {o.label}
          </li>
        )) : (
          <li className="px-3 py-2 text-sm text-muted-fg">{emptyText}</li>
        )}
      </ul>
    </div>
  );
}
