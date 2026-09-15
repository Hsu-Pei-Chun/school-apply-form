import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MyApplications from '@/app/apply/MyApplications';
import type { ApplicationSummary } from '@/lib/applications';

const items: ApplicationSummary[] = [
  {
    id: 'A000001', status: 'printed', createdAt: '2026-01-01T00:00:00.000Z', receivedAt: null,
    courseBCode: '11510EECS200101', courseBName: 'X-Class 線代', courseBTeacher: '李教授', courseBTime: 'M1M2',
  },
];

describe('MyApplications', () => {
  it('表頭需含「上課時間」欄位', () => {
    const html = renderToStaticMarkup(<MyApplications items={items} />);
    expect(html).toContain('<th class="px-3 py-2 font-semibold">上課時間</th>');
  });

  it('列需顯示 courseBTime', () => {
    const html = renderToStaticMarkup(<MyApplications items={items} />);
    expect(html).toContain('<td class="px-3 py-2 font-mono">M1M2</td>');
  });
});
