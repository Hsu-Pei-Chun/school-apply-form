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
  const svg = renderCode128Svg(a.barcode);

  return (
    <div className="print-wrap">
      <PrintToolbar />
      <article className="sheet">
        <div className="sheet-head">
          <div className="sheet-title">
            <h1>國立○○大學　X-Class 課程修課申請表</h1>
            <p>NTHU X-Class Application Form　　115 學年度上學期</p>
          </div>
          <div className="barcode" role="img" aria-label={`條碼 ${a.barcode}`}>
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="human">{a.barcode}</div>
          </div>
        </div>

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
          <table className="courses-a">
            <thead>
              <tr><th>#</th><th>科號（課號）</th><th>課名</th><th>上課時間</th><th>任課教師</th></tr>
            </thead>
            <tbody>
              {a.coursesA.map(c => (
                <tr key={c.seq}><td>{c.seq}</td><td>{c.code}</td><td>{c.name}</td><td>{c.time}</td><td>{c.teacher}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>三、X-Class 課程（Course B）</h2>
          <table>
            <tbody>
              <tr><th>科號</th><td>{a.courseBCode}</td><th>授課教師</th><td>{a.courseBTeacher}</td></tr>
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
          <p className="serial">申請單號 {a.id}</p>
        </footer>
      </article>
    </div>
  );
}
