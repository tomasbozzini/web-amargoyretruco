import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../src/lib/csv';

describe('parseCsv', () => {
  it('lee filas simples', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('respeta comillas, comas y saltos de línea dentro de comillas', () => {
    expect(parseCsv('a,b\n"8.600,00","dice ""hola""\ny chau"')).toEqual([
      ['a', 'b'],
      ['8.600,00', 'dice "hola"\ny chau'],
    ]);
  });

  it('soporta CRLF, BOM y filas vacías', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n\r\n,\r\n3,4\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('limita filas y largo de campos', () => {
    const big = Array.from({ length: 50 }, (_, i) => `${i},${'x'.repeat(100)}`).join('\n');
    const rows = parseCsv(big, { maxRows: 10, maxFieldLength: 20 });
    expect(rows).toHaveLength(10);
    expect(rows[0][1]).toHaveLength(20);
  });
});
