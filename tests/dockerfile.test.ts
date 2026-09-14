import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const dockerfile = readFileSync(path.join(__dirname, '../Dockerfile'), 'utf-8');

describe('Dockerfile', () => {
  it('runtime 強制 HOSTNAME=0.0.0.0，避免 Next standalone 綁到容器主機名', () => {
    // Render / Fly 等平台會把 HOSTNAME 設成容器名，server.js 讀到後只綁該名稱，反向代理連不進去
    expect(dockerfile).toMatch(/^ENV\b[^\n]*\bHOSTNAME=0\.0\.0\.0\b/m);
  });
});
