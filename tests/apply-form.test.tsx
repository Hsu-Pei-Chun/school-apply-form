import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// ApplyForm 匯入的 './actions' 是 server action（會拉進 DB），在此 stub 掉，
// 只驗證 ApplyForm 本身的欄位／下拉／hint 呈現邏輯。
vi.mock('@/app/apply/actions', () => ({ submitApplication: vi.fn() }));

const { default: ApplyForm } = await import('@/app/apply/ApplyForm');

const course = { code: '11510EECS200101', name: 'X-Class 線代', nameEn: 'Linear Algebra', teacher: '李教授', time: 'M1M2', note: '' };
const courses = [course];
const spacedCourses = [{ ...course, code: '11510CS  110400', name: '關鍵科技探索', nameEn: '', teacher: '磨課師', time: 'Mn' }];
const notedCourses = [{ ...course, note: '限大學部' }];

describe('ApplyForm', () => {
  it('申請人資料由申請人自行填寫：學號、姓名、科系、學部別', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={courses} maxCoursesA={5} locale="zh" />);
    expect(html).toContain('name="studentId"');
    expect(html).toContain('pattern="\\d{9}"');
    expect(html).toContain('name="studentName"');
    expect(html).toContain('name="department"');
    expect(html).toContain('name="degree"');
    for (const d of ['大學部', '碩士班', '博士班', '在職專班']) expect(html).toContain(`<option value="${d}">${d}</option>`);
  });

  it('依設計稿分成三個編號區段卡，右側有申請摘要', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={courses} maxCoursesA={5} locale="zh" />);
    for (const h of ['申請人資料', '一般課程 A', 'X-Class 課程 B', '申請摘要']) expect(html).toMatch(new RegExp(`<h2[^>]*>${h}</h2>`));
    expect(html).toContain('還差 4 欄');
    expect(html).toContain('尚未選擇');
  });

  it('X-Class 課程 B 為搜尋框＋可點選的課程卡片，卡片含課名、時間、科號、教師', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={courses} maxCoursesA={5} locale="zh" />);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('placeholder="輸入科號、課名或教師搜尋"');
    expect(html).toMatch(/type="radio"[^>]*name="courseBPick"[^>]*value="11510EECS200101"/);
    for (const v of ['X-Class 線代', 'M1M2', '李教授']) expect(html).toContain(v);
    expect(html).toContain('<input type="hidden" name="courseBCode" value=""/>');
  });

  it('課程有備註時，卡片附上備註標籤', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={notedCourses} maxCoursesA={5} locale="zh" />);
    expect(html).toMatch(/※ (<!-- -->)?限大學部/);
  });

  it('科號含空格時，卡片以 whitespace-pre 原樣顯示，radio value 維持原始科號', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={spacedCourses} maxCoursesA={5} locale="zh" />);
    expect(html).toContain('value="11510CS  110400"');
    expect(html).toMatch(/class="font-mono whitespace-pre">11510CS  110400</);
  });

  it('送出鈕不預先停用，讓瀏覽器驗證能指出缺漏的欄位', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={courses} maxCoursesA={5} locale="zh" />);
    const submit = html.match(/<button type="submit"[^>]*>/)?.[0];
    expect(submit).toBeDefined();
    expect(submit).not.toContain('disabled=""');
  });

  it('不用 <form action>：React 19 會在 action 結束後重設未受控欄位，送出失敗時學號、姓名會被清空', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={courses} maxCoursesA={5} locale="zh" />);
    expect(html).not.toContain('React form unexpectedly submitted');
  });

  it('hint 需提示含上課時間', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={courses} maxCoursesA={5} locale="zh" />);
    expect(html).toContain('選一門欲加選的課（含上課時間）；請先與授課教師確認');
  });
});

describe('ApplyForm（英文）', () => {
  it('標籤為英文；學部別顯示英文但送出值維持中文', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={courses} maxCoursesA={5} locale="en" />);
    expect(html).toContain('Student ID');
    expect(html).toContain('Generate Form');
    expect(html).toContain('<option value="碩士班">Master&#x27;s</option>');
    expect(html).not.toContain('產生申請表');
  });

  it('X-Class 課程顯示英文課名；無英文課名時退回中文課名', () => {
    expect(renderToStaticMarkup(<ApplyForm courses={courses} maxCoursesA={5} locale="en" />))
      .toMatch(/<span class="font-semibold">Linear Algebra<\/span>/);
    expect(renderToStaticMarkup(<ApplyForm courses={spacedCourses} maxCoursesA={5} locale="en" />))
      .toMatch(/<span class="font-semibold">關鍵科技探索<\/span>/);
  });
});
