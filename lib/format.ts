const TZ = 'Asia/Taipei';

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);
  const time = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${date} ${time}`;
}
