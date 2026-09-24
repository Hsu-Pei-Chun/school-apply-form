import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getApplication } from '@/lib/applications';
import { getFormText } from '@/lib/form-settings';
import { renderCode128Svg } from '@/lib/barcode';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { dict } from '@/lib/i18n';
import PrintToolbar from './PrintToolbar';
import './print.css';

export const dynamic = 'force-dynamic';

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const a = getApplication(db, id);
  if (!a) notFound();
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.print;
  const text = getFormText(db, locale);
  const svg = renderCode128Svg(a.barcode);

  return (
    <div className="print-wrap">
      <PrintToolbar locale={locale} />
      <article className="sheet">
        <div className="sheet-head">
          <div className="sheet-title">
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          <div className="barcode" role="img" aria-label={`${t.barcode} ${a.barcode}`}>
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="human code">{a.barcode}</div>
          </div>
        </div>

        <section>
          <h2>{t.s1}</h2>
          <table>
            <tbody>
              <tr><th>{t.studentId}</th><td>{a.studentId}</td><th>{t.studentName}</th><td>{a.studentName}</td></tr>
              <tr><th>{t.department}</th><td>{a.department}</td><th>{t.degree}</th><td>{d.degrees[a.degree]}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>{t.s2}</h2>
          <table className="courses-a">
            <thead>
              <tr><th>#</th><th>{t.code}</th><th>{t.name}</th><th>{t.time}</th><th>{t.teacher}</th></tr>
            </thead>
            <tbody>
              {a.coursesA.map(c => (
                <tr key={c.seq}><td>{c.seq}</td><td className="code">{c.code}</td><td>{c.name}</td><td>{c.time}</td><td>{c.teacher}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>{t.s3}</h2>
          <table>
            <tbody>
              <tr><th>{t.bCode}</th><td className="code">{a.courseBCode}</td><th>{t.time}</th><td>{a.courseBTime}</td></tr>
              <tr><th>{t.bName}</th><td>{a.courseBName}</td><th>{t.bTeacher}</th><td>{a.courseBTeacher}</td></tr>
              {a.courseBNameEn && <tr><th>{t.bNameEn}</th><td colSpan={3}>{a.courseBNameEn}</td></tr>}
              {a.courseBNote && <tr><th>{t.note}</th><td colSpan={3}>{a.courseBNote}</td></tr>}
            </tbody>
          </table>
        </section>

        <section>
          <h2>{t.s4}</h2>
          <ol className="terms">{text.terms.map((term, i) => <li key={i}>{term}</li>)}</ol>
        </section>

        <section className="signatures">
          <div><span>{t.signTeacher}</span><div className="line" /></div>
          <div><span>{t.signStudent}</span><div className="line" /></div>
          <div><span>{t.appliedAt}</span><div className="line">{formatDate(a.createdAt)}</div></div>
        </section>

        {text.submitNote && (
          <footer className="sheet-foot">
            <p className="note">{text.submitNote}</p>
          </footer>
        )}
      </article>
    </div>
  );
}
