import { redirect } from 'next/navigation';
import Card from '@/components/Card';
import { isAdmin, isAdminConfigured } from '@/lib/admin-auth';
import { safeNext } from '@/lib/admin-auth-core';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await isAdmin()) redirect(next);
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">管理員登入</h1>
      <p className="mb-6 text-muted-fg">課程管理僅限課務組使用，請輸入管理員密碼。</p>
      <Card>
        {isAdminConfigured()
          ? <LoginForm next={next} />
          : <p role="alert" className="text-sm text-danger">系統尚未設定管理員密碼（環境變數 ADMIN_PASSWORD），請聯絡系統管理者。</p>}
      </Card>
    </>
  );
}
