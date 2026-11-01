/**
 * Catálogo: lectura del CSV público del Google Sheets, validación y respaldo.
 *
 * Orden de prioridad:
 *   1. CSV del Sheets (CATALOG_CSV_URL).
 *   2. Si falla: última copia buena en memoria (de una lectura anterior en la misma instancia).
 *   3. Si no hay: src/data/fallback-catalog.json.
 * La página nunca se rompe porque el Sheets falle.
 *
 * Este módulo no importa nada de Astro para poder testearlo con Vitest.
 */
import { z } from 'zod';
import { CATALOG_FETCH_TIMEOUT_MS, LOW_STOCK_THRESHOLD, MAX_REASONABLE_PRICE } from '../config';
import fallbackData from '../data/fallback-catalog.json';
import { parseCsv } from './csv';
import { parsePrice } from './price';
import { cleanText, normalizeForSearch, slugify } from './text';

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface Product {
  id: string;
  brand: string;
  name: string;
  presentation: string;
  /** Precio por paquete, en pesos. */
  price: number;
  /** Entero >= 0. */
  stock: number;
  /** URL https de la foto, o null para usar la ilustración de la marca. */
  photo: string | null;
}

export type CatalogSource = 'sheet' | 'memory' | 'fallback';

export interface CatalogResult {
  products: Product[];
  /** Marcas en el orden en que aparecen en el Sheets. */
  brands: string[];
  source: CatalogSource;
  /** Filas descartadas por las reglas de validación. */
  ignoredRows: number;
}

/* ------------------------------------------------------------------ */
/* Columnas                                                            */
/* ------------------------------------------------------------------ */

const COLUMN_KEYS = ['marca', 'producto', 'presentacion', 'precio', 'stock', 'foto', 'visible'] as const;
type ColumnKey = (typeof COLUMN_KEYS)[number];
const REQUIRED_COLUMNS: ColumnKey[] = ['marca', 'producto', 'precio', 'stock', 'visible'];

export type RawRecord = Partial<Record<ColumnKey, string>>;

/** "Presentación " -> "presentacion" */
function toColumnKey(header: string): ColumnKey | null {
  const key = normalizeForSearch(header).replace(/[^a-z]/g, '');
  return (COLUMN_KEYS as readonly string[]).includes(key) ? (key as ColumnKey) : null;
}

/* ------------------------------------------------------------------ */
/* Reglas por campo                                                    */
/* ------------------------------------------------------------------ */

export const TEXT_LIMITS = { brand: 40, name: 80, presentation: 30 } as const;
const MAX_STOCK = 9999;
const MAX_PHOTO_URL_LENGTH = 600;

/** Stock entero >= 0. Vacío, negativo o inválido cuenta como 0 (Agotado): es lo más seguro. */
export function parseStock(raw: unknown): number {
  const text = String(raw ?? '').trim();
  const match = /^(\d+)(?:[.,]0+)?$/.exec(text);
  if (!match) return 0;
  return Math.min(Number(match[1]), MAX_STOCK);
}

/** "SI", "Sí", "si" -> true. Cualquier otra cosa -> false. */
export function isVisible(raw: unknown): boolean {
  return normalizeForSearch(String(raw ?? '')) === 'si';
}

/**
 * Foto opcional: solo URLs https. Los links de "compartir" de Google Drive se
 * convierten a una URL de imagen directa.
 */
export function parsePhotoUrl(raw: unknown): string | null {
  const text = String(raw ?? '').trim();
  if (!text || text.length > MAX_PHOTO_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;

  if (url.hostname === 'drive.google.com') {
    const id = /\/file\/d\/([\w-]{10,})/.exec(url.pathname)?.[1] ?? url.searchParams.get('id');
    if (id && /^[\w-]{10,}$/.test(id)) return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
  }
  return url.toString();
}

const RowSchema = z.object({
  marca: z.string().transform((s) => cleanText(s, TEXT_LIMITS.brand)).pipe(z.string().min(1, 'sin Marca')),
  producto: z.string().transform((s) => cleanText(s, TEXT_LIMITS.name)).pipe(z.string().min(1, 'sin Producto')),
  presentacion: z.string().transform((s) => cleanText(s, TEXT_LIMITS.presentation)),
  precio: z
    .string()
    .transform((s) => parsePrice(s))
    .pipe(
      z
        .number({ error: 'Precio vacío o no numérico' })
        .positive('Precio <= 0')
        .max(MAX_REASONABLE_PRICE, 'Precio absurdo'),
    ),
  stock: z.string().transform(parseStock),
  foto: z.string().transform(parsePhotoUrl),
  visible: z.string().transform(isVisible).pipe(z.literal(true, { error: 'Visible distinto de SI' })),
});

/* ------------------------------------------------------------------ */
/* Conversión filas -> productos                                       */
/* ------------------------------------------------------------------ */

export interface BuildResult {
  products: Product[];
  ignored: { row: number; reasons: string[] }[];
}

export function buildProducts(records: RawRecord[]): BuildResult {
  const products: Product[] = [];
  const ignored: BuildResult['ignored'] = [];
  const usedIds = new Set<string>();

  records.forEach((record, index) => {
    const input = Object.fromEntries(COLUMN_KEYS.map((key) => [key, record[key] ?? '']));
    const parsed = RowSchema.safeParse(input);
    // +2: la fila 1 del Sheets es el encabezado.
    const rowNumber = index + 2;
    if (!parsed.success) {
      ignored.push({ row: rowNumber, reasons: parsed.error.issues.map((issue) => issue.message) });
      return;
    }
    const { marca, producto, presentacion, precio, stock, foto } = parsed.data;

    const baseId = slugify(`${marca} ${producto} ${presentacion}`) || `producto-${rowNumber}`;
    let id = baseId;
    for (let n = 2; usedIds.has(id); n += 1) id = `${baseId}-${n}`;
    usedIds.add(id);

    products.push({ id, brand: marca, name: producto, presentation: presentacion, price: precio, stock, photo: foto });
  });

  return { products, ignored };
}

/** Convierte el texto CSV en registros. Falla si no tiene las columnas esperadas. */
export function recordsFromCsv(csvText: string): RawRecord[] {
  const [header, ...rows] = parseCsv(csvText);
  if (!header) throw new Error('CSV vacío');
  const keys = header.map(toColumnKey);
  const missing = REQUIRED_COLUMNS.filter((column) => !keys.includes(column));
  if (missing.length > 0) throw new Error(`Al CSV le faltan columnas: ${missing.join(', ')}`);

  return rows.map((cells) => {
    const record: RawRecord = {};
    keys.forEach((key, i) => {
      if (key && record[key] === undefined) record[key] = cells[i] ?? '';
    });
    return record;
  });
}

/** Convierte filas tipo objeto ({ "Marca": "...", ... }) en registros. */
export function recordsFromObjects(rows: unknown): RawRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => {
      const record: RawRecord = {};
      for (const [header, value] of Object.entries(row)) {
        const key = toColumnKey(header);
        if (key) record[key] = value === null || value === undefined ? '' : String(value);
      }
      return record;
    });
}

export function uniqueBrands(products: Product[]): string[] {
  return [...new Set(products.map((p) => p.brand))];
}

export function stockStatus(stock: number): 'soldout' | 'low' | 'ok' {
  if (stock <= 0) return 'soldout';
  if (stock <= LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

/* ------------------------------------------------------------------ */
/* Carga con respaldo                                                  */
/* ------------------------------------------------------------------ */

const MAX_CSV_BYTES = 1_000_000;

/** Última lectura buena del Sheets en esta instancia del servidor. */
let lastGood: { products: Product[]; ignoredRows: number } | null = null;

/** Solo para tests. */
export function resetCatalogMemory(): void {
  lastGood = null;
}

export function validateCsvUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol === 'https:') return url;
    // http solo para pruebas locales.
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return url;
  } catch {
    /* URL inválida */
  }
  return null;
}

async function fetchSheetCatalog(url: URL, fetchImpl: typeof fetch, timeoutMs: number): Promise<BuildResult> {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'text/csv, text/plain;q=0.9' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`El Sheets respondió ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) throw new Error('El Sheets devolvió una página HTML en vez de un CSV');
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_CSV_BYTES) throw new Error('El CSV es demasiado grande');
  const text = await response.text();
  if (text.length > MAX_CSV_BYTES) throw new Error('El CSV es demasiado grande');
  return buildProducts(recordsFromCsv(text));
}

function logIgnored(ignored: BuildResult['ignored'], source: string): void {
  if (ignored.length === 0) return;
  const detail = ignored
    .slice(0, 20)
    .map((item) => `fila ${item.row}: ${item.reasons.join(', ')}`)
    .join(' | ');
  console.warn(`[catalogo] ${source}: ${ignored.length} fila(s) ignorada(s). ${detail}`);
}

export interface LoadCatalogOptions {
  url?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Filas de respaldo (por defecto, src/data/fallback-catalog.json). */
  fallbackRows?: unknown;
}

export async function loadCatalog(options: LoadCatalogOptions = {}): Promise<CatalogResult> {
  const { fetchImpl = fetch, timeoutMs = CATALOG_FETCH_TIMEOUT_MS, fallbackRows = fallbackData.rows } = options;
  const url = validateCsvUrl(options.url);

  if (url) {
    try {
      const result = await fetchSheetCatalog(url, fetchImpl, timeoutMs);
      logIgnored(result.ignored, 'Sheets');
      lastGood = { products: result.products, ignoredRows: result.ignored.length };
      return { products: result.products, brands: uniqueBrands(result.products), source: 'sheet', ignoredRows: result.ignored.length };
    } catch (error) {
      console.error(`[catalogo] No se pudo leer el Sheets: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.warn('[catalogo] CATALOG_CSV_URL no está definida o no es una URL https válida. Uso el catálogo de respaldo.');
  }

  if (lastGood) {
    return { products: lastGood.products, brands: uniqueBrands(lastGood.products), source: 'memory', ignoredRows: lastGood.ignoredRows };
  }

  const fallback = buildProducts(recordsFromObjects(fallbackRows));
  logIgnored(fallback.ignored, 'Respaldo');
  return { products: fallback.products, brands: uniqueBrands(fallback.products), source: 'fallback', ignoredRows: fallback.ignored.length };
}
