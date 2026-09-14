import { redirect } from 'next/navigation';
import Card from '@/components/Card';
import { getCurrentStudent } from '@/lib/auth';
import { safeNext } from '@/lib/auth-core';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '/apply' } = await searchParams;
  if (await getCurrentStudent()) redirect(safeNext(next));
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">學生登入</h1>
      <p className="mb-6 text-muted-fg">登入後即可申請 X-Class 課程並查看申請紀錄。</p>
      <Card><LoginForm next={next} /></Card>
    </>
  );
}
