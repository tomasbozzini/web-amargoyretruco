#!/usr/bin/env node
/**
 * Prepara una foto de producto para la web, con la máxima calidad posible.
 *
 * Uso:
 *   npm run foto -- <id-del-producto> <ruta-a-la-foto> [--paquete=izq,arriba,der,abajo]
 *   npm run foto -- --lista            (muestra los ids de los productos)
 *
 * El id es "marca-producto-presentación" en minúsculas y sin tildes, por ejemplo
 * "canarias-canarias-serena-500-g" (el mismo que usa la web para cada producto).
 *
 * Qué hace:
 *   - Recorta la foto en cuadrado (como la muestra la tarjeta). Sin --paquete,
 *     desde el centro. Con --paquete (la caja del paquete en % del ancho y del
 *     alto de la foto), encuadra para que el paquete ocupe siempre lo mismo:
 *     78 % del alto, centrado, con 13 % de aire arriba para las etiquetas de
 *     stock. Así todos los paquetes se ven del mismo tamaño en la grilla,
 *     aunque las fotos se hayan sacado a distinta distancia.
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

const args = process.argv.slice(2);
const paqueteArg = args.find((a) => a.startsWith('--paquete='));
const [id, file] = args.filter((a) => a !== paqueteArg);

/** Ocupación del paquete en el cuadrado y aire por encima. */
const PAQUETE_ALTO = 0.78;
const PAQUETE_ANCHO_MAX = 0.85;
const AIRE_ARRIBA = 0.13;

function parsePaquete(raw) {
  if (!raw) return null;
  const nums = raw.slice('--paquete='.length).split(',').map(Number);
  const [izq, arriba, der, abajo] = nums;
  const ok = nums.length === 4 && nums.every((n) => Number.isFinite(n) && n >= 0 && n <= 100) && izq < der && arriba < abajo;
  if (!ok) {
    console.error('--paquete espera cuatro porcentajes: izq,arriba,der,abajo (por ejemplo --paquete=30,32,70,80)');
    process.exit(1);
  }
  return { izq, arriba, der, abajo };
}

/** Cuadrado a recortar (en píxeles de la foto ya rotada). */
function encuadre(width, height, paquete) {
  const maxSide = Math.min(width, height);
  if (!paquete) return { left: Math.round((width - maxSide) / 2), top: Math.round((height - maxSide) / 2), side: maxSide };
  const px = { izq: (paquete.izq / 100) * width, der: (paquete.der / 100) * width, arriba: (paquete.arriba / 100) * height, abajo: (paquete.abajo / 100) * height };
  const alto = px.abajo - px.arriba;
  const ancho = px.der - px.izq;
  const side = Math.round(Math.min(maxSide, Math.max(alto / PAQUETE_ALTO, ancho / PAQUETE_ANCHO_MAX)));
  const clamp = (v, max) => Math.round(Math.min(Math.max(v, 0), max));
  return {
    left: clamp((px.izq + px.der) / 2 - side / 2, width - side),
    top: clamp(px.arriba - AIRE_ARRIBA * side, height - side),
    side,
  };
}

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

const paquete = parsePaquete(paqueteArg);

mkdirSync(OUT_DIR, { recursive: true });
// Medidas ya con la orientación corregida (fotos de celular giradas por EXIF).
const meta = await sharp(file).metadata();
const { width: fotoAncho, height: fotoAlto } = meta.autoOrient ?? meta;
const { left, top, side } = encuadre(fotoAncho, fotoAlto, paquete);
if (side < 1280) console.warn(`Atención: el recorte mide ${side} px de lado; para máxima nitidez conviene 1280 px o más.`);

// Base: orientación corregida y recorte cuadrado, directo del original (sin
// recomprimir en el medio). Los colores pasan a sRGB al guardar.
const base = sharp(file).autoOrient().extract({ left, top, width: side, height: side });

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
