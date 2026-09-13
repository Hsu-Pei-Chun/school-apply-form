import type { ReactNode } from 'react';

type Props = { id: string; label: string; hint?: string; error?: string; children: ReactNode };

export default function Field({ id, label, hint, error, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted-fg">{hint}</p>
      ) : null}
    </div>
  );
}
