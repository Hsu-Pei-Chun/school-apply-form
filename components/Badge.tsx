type Tone = 'success' | 'neutral' | 'warning' | 'danger';
const TONE: Record<Tone, string> = {
  success: 'bg-success-bg text-success',
  neutral: 'bg-border/50 text-muted-fg',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
};
export default function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[tone]}`}>{children}</span>;
}
