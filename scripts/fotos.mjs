#!/usr/bin/env node
/**
 * Prepara una foto de producto para la web, con la máxima calidad posible.
 *
 * Uso:
 *   npm run foto -- <id-del-producto> <ruta-a-la-foto>
 *   npm run foto -- --lista            (muestra los ids de los productos)
 *
 * El id es "marca-producto-presentación" en minúsculas y sin tildes, por ejemplo
 * "canarias-canarias-serena-500-g" (el mismo que usa la web para cada producto).
 *
 * Qué hace:
 *   - Recorta la foto en cuadrado desde el centro (como la muestra la tarjeta).
 *   - Convierte los colores a sRGB (las fotos de iPhone vienen en Display P3).
 *   - Genera 640 y 1280 px en AVIF y WebP (alta calidad) y un JPG de respaldo.
 *     Cada pantalla descarga el tamaño que necesita (srcset).
 *   - Quita los metadatos (EXIF, ubicación GPS, etc.).
 *   - Anota la foto en src/data/fotos.json. Si la columna Foto del Sheets está
 *     vacía, la web usa esta foto.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import sharp from 'sharp';

const ROOT = new URL('../', import.meta.url);
const OUT_DIR = new URL('public/fotos/', ROOT);
const MANIFEST = new URL('src/data/fotos.json', ROOT);
const FALLBACK = new URL('src/data/fallback-catalog.json', ROOT);
const WIDTHS = [640, 1280];

/** Igual que slugify en src/lib/text.ts */
const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const [id, file] = process.argv.slice(2);

if (id === '--lista' || !id) {
  const { rows } = JSON.parse(readFileSync(FALLBACK, 'utf8'));
  console.log('Ids de los productos (según la copia guardada del catálogo):');
  for (const r of rows) console.log(`  ${slugify(`${r.Marca} ${r.Producto} ${r['Presentación']}`)}`);
  if (!id) console.log('\nUso: npm run foto -- <id> <ruta-a-la-foto>');
  process.exit(0);
}
if (!/^[a-z0-9-]+$/.test(id) || !file || !existsSync(file)) {
  console.error('Uso: npm run foto -- <id> <ruta-a-la-foto>   (ver ids con: npm run foto -- --lista)');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const meta = await sharp(file).metadata();
const side = Math.min(meta.width, meta.height);
if (side < 1280) console.warn(`Atención: la foto mide ${meta.width}×${meta.height}; para máxima nitidez conviene que el lado menor tenga 1280 px o más.`);

// Base: recorte cuadrado centrado, orientación corregida y colores en sRGB.
const base = sharp(file).rotate().resize({ width: side, height: side, fit: 'cover', position: 'centre' });

for (const width of WIDTHS) {
  const size = Math.min(width, side);
  const pipeline = () => base.clone().resize(size, size, { kernel: 'lanczos3' }).withIccProfile('srgb');
  await pipeline().avif({ quality: 72, effort: 6, chromaSubsampling: '4:4:4' }).toFile(new URL(`${id}-${width}.avif`, OUT_DIR).pathname);
  await pipeline().webp({ quality: 90, effort: 6, smartSubsample: true }).toFile(new URL(`${id}-${width}.webp`, OUT_DIR).pathname);
  if (width === WIDTHS.at(-1)) {
    await pipeline().jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(new URL(`${id}-${width}.jpg`, OUT_DIR).pathname);
  }
}

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
manifest[id] = { anchos: WIDTHS };
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);

const kb = (name) => `${Math.round(statSync(new URL(name, OUT_DIR)).size / 1024)} KB`;
console.log(`Listo: ${id}`);
for (const w of WIDTHS) console.log(`  ${w}px  avif ${kb(`${id}-${w}.avif`)} · webp ${kb(`${id}-${w}.webp`)}`);
console.log(`  respaldo jpg ${kb(`${id}-${WIDTHS.at(-1)}.jpg`)}`);
