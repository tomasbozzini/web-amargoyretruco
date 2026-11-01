import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../../src/lib/security-headers';

describe('headers de seguridad', () => {
  it('vercel.json y src/lib/security-headers.ts coinciden', () => {
    const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    const all = vercel.headers.find((h: { source: string }) => h.source === '/(.*)');
    const fromVercel = Object.fromEntries(all.headers.map((h: { key: string; value: string }) => [h.key, h.value]));
    expect(fromVercel).toEqual(SECURITY_HEADERS);
  });

  it('incluye lo pedido', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['Referrer-Policy']).toBeTruthy();
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("script-src 'self'");
    expect(SECURITY_HEADERS['Content-Security-Policy']).not.toContain('unsafe-inline');
    expect(SECURITY_HEADERS['Content-Security-Policy']).not.toContain('unsafe-eval');
  });
});

describe('código fuente', () => {
  const srcDir = new URL('../../src', import.meta.url).pathname;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(astro|ts)$/.test(name)) files.push(path);
    }
  };
  walk(srcDir);

  it('no usa innerHTML / outerHTML / insertAdjacentHTML / document.write', () => {
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      expect(code, file).not.toMatch(/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write/);
    }
  });

  it('set:html solo para el JSON-LD de config (nunca datos del Sheets)', () => {
    const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('set:html'));
    expect(offenders.map((f) => f.replace(srcDir, 'src'))).toEqual(['src/layouts/Base.astro']);
  });

  it('todos los target="_blank" llevan rel="noopener noreferrer"', () => {
    for (const file of files.filter((f) => f.endsWith('.astro'))) {
      const code = readFileSync(file, 'utf8');
      const tags = code.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? [];
      for (const tag of tags) expect(tag, file).toContain('rel="noopener noreferrer"');
    }
  });
});
