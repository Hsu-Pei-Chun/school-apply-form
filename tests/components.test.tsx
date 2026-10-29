import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Button from '@/components/Button';
import Field from '@/components/Field';
import Badge from '@/components/Badge';
import Combobox, { filterOptions } from '@/components/Combobox';

describe('Button', () => {
  it('primary 帶主色 class 且最小高度 44px', () => {
    const html = renderToStaticMarkup(<Button variant="primary">送出</Button>);
    expect(html).toContain('bg-primary');
    expect(html).toContain('min-h-11');
  });
  it('loading 時 disabled 並顯示 aria-busy', () => {
    const html = renderToStaticMarkup(<Button variant="primary" loading>送出</Button>);
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
  });
});

describe('Field', () => {
  it('label 綁定 id，error 用 role=alert 且取代 hint', () => {
    const html = renderToStaticMarkup(
      <Field id="sid" label="學號" hint="例：S0001" error="查無此學號"><input id="sid" /></Field>
    );
    expect(html).toContain('for="sid"');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('例：S0001');
  });
  it('無 error 時顯示 hint', () => {
    const html = renderToStaticMarkup(<Field id="sid" label="學號" hint="例：S0001"><input id="sid" /></Field>);
    expect(html).toContain('例：S0001');
  });
});

describe('Badge', () => {
  it('success 使用 success token', () => {
    expect(renderToStaticMarkup(<Badge tone="success">啟用</Badge>)).toContain('bg-success-bg');
  });
});

describe('Combobox', () => {
  const options = [
    { value: 'A1', label: 'A1　發展心理學（周育如）　Mn' },
    { value: 'B2', label: 'B2　Linear Algebra（李教授）　M1M2' },
  ];
  it('送出值放在 hidden input，輸入框顯示已選項目', () => {
    const html = renderToStaticMarkup(<Combobox id="c" name="code" options={options} value="B2" onChange={() => {}} emptyText="無" />);
    expect(html).toContain('type="hidden" name="code" value="B2"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('value="B2　Linear Algebra（李教授）　M1M2"');
  });
  it('filterOptions：多關鍵字皆須命中、不分大小寫，空字串回傳全部', () => {
    expect(filterOptions(options, '')).toEqual(options);
    expect(filterOptions(options, '心理 周').map(o => o.value)).toEqual(['A1']);
    expect(filterOptions(options, 'linear')).toEqual([options[1]]);
    expect(filterOptions(options, '心理 李')).toEqual([]);
  });
});
