import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildProducts,
  isVisible,
  loadCatalog,
  parsePhotoUrl,
  parseStock,
  recordsFromCsv,
  recordsFromObjects,
  resetCatalogMemory,
  stockStatus,
  validateCsvUrl,
} from '../../src/lib/catalog';
import fallbackData from '../../src/data/fallback-catalog.json';
import { parsePrice } from '../../src/lib/price';

const fixture = readFileSync(new URL('../fixtures/catalogo-prueba.csv', import.meta.url), 'utf8');
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/TEST/pub?output=csv';

function csvResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8' }, ...init });
}

beforeEach(() => {
  resetCatalogMemory();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('reglas por campo', () => {
  it('stock: entero >= 0; vacío o inválido cuenta como 0', () => {
    expect(parseStock('6')).toBe(6);
    expect(parseStock(' 3 ')).toBe(3);
    expect(parseStock('4,00')).toBe(4);
    expect(parseStock('0')).toBe(0);
    expect(parseStock('')).toBe(0);
    expect(parseStock('-2')).toBe(0);
    expect(parseStock('2.5')).toBe(0);
    expect(parseStock('muchos')).toBe(0);
  });

  it('visible: solo SI (sin importar mayúsculas ni tilde)', () => {
    expect(isVisible('SI')).toBe(true);
    expect(isVisible(' si ')).toBe(true);
    expect(isVisible('Sí')).toBe(true);
    expect(isVisible('NO')).toBe(false);
    expect(isVisible('')).toBe(false);
    expect(isVisible('S')).toBe(false);
  });

  it('foto: solo https; convierte links de Google Drive', () => {
    expect(parsePhotoUrl('https://ejemplo.com/foto.jpg')).toBe('https://ejemplo.com/foto.jpg');
    expect(parsePhotoUrl('http://ejemplo.com/foto.jpg')).toBeNull();
    expect(parsePhotoUrl('javascript:alert(1)')).toBeNull();
    expect(parsePhotoUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(parsePhotoUrl('foto.jpg')).toBeNull();
    expect(parsePhotoUrl('https://user:pass@ejemplo.com/a.jpg')).toBeNull();
    expect(parsePhotoUrl('')).toBeNull();
    expect(parsePhotoUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')).toBe(
      'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w800',
    );
  });

  it('estado de stock', () => {
    expect(stockStatus(0)).toBe('soldout');
    expect(stockStatus(1)).toBe('low');
    expect(stockStatus(2)).toBe('low');
    expect(stockStatus(3)).toBe('ok');
  });
});

describe('buildProducts con el CSV de prueba', () => {
  const { products, ignored } = buildProducts(recordsFromCsv(fixture));

  it('solo deja las filas válidas', () => {
    expect(products.map((p) => `${p.name} ${p.presentation}`)).toEqual([
      'Baldo Tradicional 500 g',
      'Baldo Tradicional 1 kg',
      'Canarias Serena 500 g',
      'Canarias Edición Especial 500 g',
      'Rei Verde Tradicional 500 g',
      'Sara <img src=x onerror=alert(1)> 500 g',
    ]);
    // Sin precio, Visible=NO, precio absurdo y sin marca.
    expect(ignored.map((i) => i.row)).toEqual([8, 9, 10, 11]);
  });

  it('parsea precios en distintos formatos', () => {
    expect(products.map((p) => p.price)).toEqual([8600, 15900, 9200, 10500, 7400, 7100]);
  });

  it('descarta fotos no https', () => {
    expect(products[2].photo).toBe('https://example.invalid/serena.jpg');
    expect(products[5].photo).toBeNull();
  });

  it('genera ids estables y únicos', () => {
    expect(products[0].id).toBe('baldo-baldo-tradicional-500-g');
    expect(products[1].id).toBe('baldo-baldo-tradicional-1-kg');
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });

  it('el texto queda como texto plano (no se interpreta como HTML acá ni en ningún lado)', () => {
    expect(products[5].name).toBe('Sara <img src=x onerror=alert(1)>');
  });
});

describe('buildProducts: limpieza y duplicados', () => {
  it('limpia caracteres de control y limita largos', () => {
    const { products } = buildProducts([
      { marca: '  Baldo\u0000 ', producto: `Yerba ${'x'.repeat(200)}`, precio: '100', stock: '1', visible: 'SI' },
    ]);
    expect(products[0].brand).toBe('Baldo');
    expect(products[0].name.length).toBeLessThanOrEqual(80);
    expect(products[0].name.endsWith('…')).toBe(true);
  });

  it('desambigua ids repetidos', () => {
    const row = { marca: 'Baldo', producto: 'Baldo', presentacion: '500 g', precio: '100', stock: '1', visible: 'SI' };
    const { products } = buildProducts([row, row]);
    expect(products.map((p) => p.id)).toEqual(['baldo-baldo-500-g', 'baldo-baldo-500-g-2']);
  });

  it('rechaza precio 0, negativo y > 1.000.000', () => {
    const base = { marca: 'M', producto: 'P', stock: '1', visible: 'SI' };
    const { products } = buildProducts([
      { ...base, precio: '0' },
      { ...base, precio: '-10' },
      { ...base, precio: '1000001' },
      { ...base, precio: '1000000' },
    ]);
    expect(products.map((p) => p.price)).toEqual([1000000]);
  });
});

describe('recordsFromCsv', () => {
  it('acepta columnas en otro orden y sin tilde', () => {
    const records = recordsFromCsv('Visible,Precio,Stock,Producto,Marca,Presentacion\nSI,100,2,Prod,Marca,1 kg');
    expect(records[0]).toMatchObject({ marca: 'Marca', producto: 'Prod', presentacion: '1 kg', precio: '100' });
  });

  it('falla si faltan columnas obligatorias', () => {
    expect(() => recordsFromCsv('Marca,Producto\nA,B')).toThrow(/faltan columnas/);
    expect(() => recordsFromCsv('<!DOCTYPE html><html>')).toThrow();
  });
});

describe('validateCsvUrl', () => {
  it('solo https (o http local para pruebas)', () => {
    expect(validateCsvUrl(CSV_URL)?.hostname).toBe('docs.google.com');
    expect(validateCsvUrl('http://127.0.0.1:4400/c.csv')).not.toBeNull();
    expect(validateCsvUrl('http://docs.google.com/x')).toBeNull();
    expect(validateCsvUrl('file:///etc/passwd')).toBeNull();
    expect(validateCsvUrl('no es url')).toBeNull();
    expect(validateCsvUrl(undefined)).toBeNull();
  });
});

describe('loadCatalog: fuente y respaldos', () => {
  const backupRows = [{ Marca: 'Respaldo', Producto: 'Yerba respaldo', Presentación: '500 g', Precio: '5000', Stock: '1', Visible: 'SI' }];

  it('lee el Sheets cuando responde bien', async () => {
    const fetchImpl = vi.fn(async () => csvResponse(fixture));
    const result = await loadCatalog({ url: CSV_URL, fetchImpl, fallbackRows: backupRows });
    expect(result.source).toBe('sheet');
    expect(result.products).toHaveLength(6);
    expect(result.brands).toEqual(['Baldo', 'Canarias', 'Rei Verde', 'Sara']);
    expect(result.ignoredRows).toBe(4);
  });

  it('si el Sheets falla, usa la última copia buena en memoria', async () => {
    await loadCatalog({ url: CSV_URL, fetchImpl: async () => csvResponse(fixture), fallbackRows: backupRows });
    const result = await loadCatalog({
      url: CSV_URL,
      fetchImpl: async () => new Response('error', { status: 500 }),
      fallbackRows: backupRows,
    });
    expect(result.source).toBe('memory');
    expect(result.products).toHaveLength(6);
  });

  it('si el Sheets falla y no hay copia en memoria, usa el respaldo', async () => {
    const result = await loadCatalog({
      url: CSV_URL,
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
      fallbackRows: backupRows,
    });
    expect(result.source).toBe('fallback');
    expect(result.products.map((p) => p.name)).toEqual(['Yerba respaldo']);
  });

  it('una página HTML (Sheets despublicado) cuenta como falla', async () => {
    const result = await loadCatalog({
      url: CSV_URL,
      fetchImpl: async () => new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      fallbackRows: backupRows,
    });
    expect(result.source).toBe('fallback');
  });

  it('un CSV sin las columnas esperadas cuenta como falla', async () => {
    const result = await loadCatalog({ url: CSV_URL, fetchImpl: async () => csvResponse('otra,cosa\n1,2'), fallbackRows: backupRows });
    expect(result.source).toBe('fallback');
  });

  it('timeout: si el Sheets tarda demasiado, usa el respaldo', async () => {
    const slowFetch: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError')));
      });
    const result = await loadCatalog({ url: CSV_URL, fetchImpl: slowFetch, timeoutMs: 50, fallbackRows: backupRows });
    expect(result.source).toBe('fallback');
  });

  it('sin CATALOG_CSV_URL usa el respaldo sin intentar fetch', async () => {
    const fetchImpl = vi.fn();
    const result = await loadCatalog({ url: undefined, fetchImpl, fallbackRows: backupRows });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.source).toBe('fallback');
  });

  it('un Sheets válido pero sin filas visibles no es una falla (catálogo vacío)', async () => {
    const result = await loadCatalog({
      url: CSV_URL,
      fetchImpl: async () => csvResponse('Marca,Producto,Presentación,Precio,Stock,Foto,Visible\nBaldo,Baldo,500 g,,3,,SI'),
      fallbackRows: backupRows,
    });
    expect(result.source).toBe('sheet');
    expect(result.products).toEqual([]);
  });
});

describe('fallback-catalog.json real', () => {
  it('cada fila se muestra o se ignora con un motivo (nunca rompe)', () => {
    const records = recordsFromObjects(fallbackData.rows);
    expect(records.length).toBe(fallbackData.rows.length);
    const { products, ignored } = buildProducts(records);
    expect(products.length + ignored.length).toBe(records.length);
    for (const item of ignored) expect(item.reasons.length).toBeGreaterThan(0);
  });

  it('las filas visibles con precio válido se muestran', () => {
    const { products } = buildProducts(recordsFromObjects(fallbackData.rows));
    const expected = fallbackData.rows.filter((row) => isVisible(row.Visible) && (parsePrice(row.Precio) ?? 0) > 0);
    expect(products).toHaveLength(expected.length);
  });
});
