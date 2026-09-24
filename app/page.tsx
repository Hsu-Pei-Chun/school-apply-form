import Link from 'next/link';
import Card from '@/components/Card';

const ITEMS = [
  { href: '/apply', title: '學生申請', desc: '填寫申請人資料、一般課程與 X-Class 課程，產生含條碼的申請表' },
  { href: '/admin/courses', title: '課程管理', desc: '新增、匯入、停用課程（需管理員登入）' },
];

export default function Home() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
