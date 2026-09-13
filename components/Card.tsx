export default function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-[var(--radius-card)] border border-border bg-surface p-6 ${className}`}>{children}</div>;
}
