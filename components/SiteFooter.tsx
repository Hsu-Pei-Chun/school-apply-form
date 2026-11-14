import Link from 'next/link';
import { dict, Locale } from '@/lib/i18n';

// 頁尾的管理員入口：導覽列不對學生露出管理頁，管理員從這裡登入
export default function SiteFooter({ isAdmin, locale }: { isAdmin: boolean; locale: Locale }) {
  if (isAdmin) return null;
  const t = dict(locale).site;
  return (
    <footer className="no-print border-t border-border">
      <div className="mx-auto flex max-w-5xl justify-end px-4 py-2">
        <Link href={`/login?next=${encodeURIComponent('/admin/courses')}`}
          className="inline-flex min-h-11 items-center px-2 text-sm text-muted-fg underline-offset-2 hover:text-foreground hover:underline">
          {t.adminLogin}
        </Link>
      </div>
    </footer>
  );
}
