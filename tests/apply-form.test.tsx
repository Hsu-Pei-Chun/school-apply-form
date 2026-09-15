import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// ApplyForm 匯入的 './actions' 會經由 lib/auth 拉進 'server-only'，
// 在 vitest（非 Next server 執行環境）下匯入會直接 throw，因此在此 stub 掉，
// 只驗證 ApplyForm 本身的下拉／hint 呈現邏輯。
vi.mock('@/app/apply/actions', () => ({ submitApplication: vi.fn() }));

const { default: ApplyForm } = await import('@/app/apply/ApplyForm');

const courses = [{ code: '11510EECS200101', name: 'X-Class 線代', teacher: '李教授', time: 'M1M2' }];
const spacedCourses = [{ code: '11510CS  110400', name: '關鍵科技探索', teacher: '磨課師', time: 'Mn' }];

describe('ApplyForm', () => {
  it('X-Class 課程 B 下拉選項需包含上課時間', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={courses} maxCoursesA={5} />);
    expect(html).toContain('11510EECS200101　X-Class 線代（李教授）　M1M2');
  });

  it('科號含空格時，option 顯示以不換行空白取代（避免瀏覽器壓縮），value 維持原始科號', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={spacedCourses} maxCoursesA={5} />);
    expect(html).toContain('value="11510CS  110400"');
    expect(html).toContain('11510CS  110400　關鍵科技探索（磨課師）　Mn');
  });

  it('hint 需提示含上課時間', () => {
    const html = renderToStaticMarkup(<ApplyForm courses={courses} maxCoursesA={5} />);
    expect(html).toContain('欲申請的 X-Class 課程（含上課時間），需事先與授課教師確認');
  });
});
