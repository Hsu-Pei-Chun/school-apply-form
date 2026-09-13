import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getApplication } from '@/lib/applications';
import { renderCode128Svg } from '@/lib/barcode';
import { formatDate } from '@/lib/format';
import PrintButton from './PrintButton';
import './print.css';

export const dynamic = 'force-dynamic';

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = getApplication(getDb(), id);
  if (!a) notFound();
  const svg = renderCode128Svg(a.id);
  const date = formatDate(a.createdAt);

  return (
    <main className="sheet">
      <p className="no-print"><PrintButton /></p>
      <h1>○○學校 科目申請表</h1>
      <table>
        <tbody>
          <tr><th>學號</th><td>{a.studentId}</td></tr>
          <tr><th>姓名</th><td>{a.studentName}</td></tr>
          <tr><th>系級</th><td>{a.department}</td></tr>
          <tr><th>一般課程 A</th><td>{a.courseACode} {a.courseAName}</td></tr>
          <tr><th>A 修課狀態</th><td>{a.courseAStatus}</td></tr>
          <tr><th>X-Class 課程 B</th><td>{a.courseBCode} {a.courseBName}</td></tr>
          <tr><th>B 授課教師</th><td>{a.courseBTeacher}</td></tr>
          <tr><th>申請日期</th><td>{date}</td></tr>
        </tbody>
      </table>
      <div className="barcode">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="human">{a.id}　{a.studentId}　{a.courseBCode}</div>
      </div>
      <p className="signature">學生簽名：________________　　家長簽名：________________</p>
    </main>
  );
}
