import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getApplication } from '@/lib/applications';
import { renderCode128Svg } from '@/lib/barcode';
import { formatDate } from '@/lib/format';
import PrintToolbar from './PrintToolbar';
import './print.css';

export const dynamic = 'force-dynamic';

const TERMS = [
  '本人已與 X-Class 課程授課教師事前溝通，並確認教師提供整學期完整之非同步學習資源。',
  '本人同意不得要求補課、調整教學進度、請假延交作業等額外安排。',
  '若 X-Class 課程考試與一般課程衝突，不予改期或補考，相關風險由本人自行承擔。',
];

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = getApplication(getDb(), id);
  if (!a) notFound();
  const svg = renderCode128Svg(a.id);

  return (
    <div className="print-wrap">
      <PrintToolbar />
      <article className="sheet">
        <header className="sheet-head">
          <h1>國立○○大學　X-Class 課程修課申請表</h1>
          <p>NTHU X-Class Application Form　　115 學年度上學期</p>
        </header>

        <section>
          <h2>一、申請人</h2>
          <table>
            <tbody>
              <tr><th>學號</th><td>{a.studentId}</td><th>姓名</th><td>{a.studentName}</td></tr>
              <tr><th>系級</th><td colSpan={3}>{a.department}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>二、一般課程（Course A）</h2>
          <table>
            <tbody>
              <tr><th>課程代碼</th><td>{a.courseACode}</td><th>修課狀態</th><td>{a.courseAStatus}</td></tr>
              <tr><th>課程名稱</th><td colSpan={3}>{a.courseAName}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>三、X-Class 課程（Course B）</h2>
          <table>
            <tbody>
              <tr><th>課程代碼</th><td>{a.courseBCode}</td><th>授課教師</th><td>{a.courseBTeacher}</td></tr>
              <tr><th>課程名稱</th><td colSpan={3}>{a.courseBName}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>四、申請人同意事項</h2>
          <ol className="terms">{TERMS.map(t => <li key={t}>{t}</li>)}</ol>
        </section>

        <section className="signatures">
          <div><span>X-Class 授課教師簽章</span><div className="line" /></div>
          <div><span>學生簽名</span><div className="line" /></div>
          <div><span>日期</span><div className="line">{formatDate(a.createdAt)}</div></div>
        </section>

        <footer className="sheet-foot">
          <p className="note">請於開學第二週週五前，將本表送交校本部第一綜合大樓一樓課務組。</p>
          <div className="barcode">
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="human">{a.id}　{a.studentId}　{a.courseBCode}</div>
          </div>
        </footer>
      </article>
    </div>
  );
}
