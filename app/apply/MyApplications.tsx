import Link from 'next/link';
import Badge from '@/components/Badge';
import { formatDate } from '@/lib/format';
import type { ApplicationSummary } from '@/lib/applications';

export default function MyApplications({ items }: { items: ApplicationSummary[] }) {
  if (items.length === 0) return <p className="text-muted-fg">尚未申請任何 X-Class 課程。</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-fg">
          <tr>
            <th className="px-3 py-2 font-semibold">X-Class 科號</th>
            <th className="px-3 py-2 font-semibold">課名</th>
            <th className="px-3 py-2 font-semibold">授課教師</th>
            <th className="px-3 py-2 font-semibold">上課時間</th>
            <th className="px-3 py-2 font-semibold">申請日期</th>
            <th className="px-3 py-2 font-semibold">狀態</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map(a => (
            <tr key={a.id} className="border-t border-border even:bg-background/60">
              <td className="px-3 py-2 font-mono whitespace-pre">{a.courseBCode}</td>
              <td className="px-3 py-2">{a.courseBName}</td>
              <td className="px-3 py-2">{a.courseBTeacher}</td>
              <td className="px-3 py-2 font-mono">{a.courseBTime}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(a.createdAt)}</td>
              <td className="px-3 py-2">
                {a.status === 'received' ? <Badge tone="success">已收件</Badge> : <Badge tone="neutral">已產生</Badge>}
              </td>
              <td className="px-3 py-2 text-right">
                <Link href={`/apply/${a.id}`} className="min-h-11 inline-flex items-center text-secondary underline-offset-2 hover:underline">列印</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
