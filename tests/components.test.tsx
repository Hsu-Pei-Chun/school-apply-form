import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Button from '@/components/Button';
import Field from '@/components/Field';
import Badge from '@/components/Badge';

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
