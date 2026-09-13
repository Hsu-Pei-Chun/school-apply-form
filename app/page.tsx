import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>科目申請表系統</h1>
      <ul>
        <li><Link href="/apply">學生申請</Link></li>
        <li><Link href="/admin/subjects">科目管理</Link></li>
        <li><Link href="/admin/scan">掃描收件</Link></li>
      </ul>
    </main>
  );
}
