import Link from 'next/link';
import Card from '@/components/Card';

const ITEMS = [
  { href: '/apply', title: '學生申請', desc: '登入後填寫一般課程與 X-Class 課程，產生含條碼的申請表' },
  { href: '/admin/courses', title: '課程管理', desc: '新增、停用課程與設定授課教師' },
  { href: '/admin/scan', title: '掃描收件', desc: '掃描條碼登記已收到的紙本申請表' },
];

export default function Home() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className="block">
          <Card className="transition-colors duration-150 hover:bg-background">
            <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-fg">{item.desc}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
