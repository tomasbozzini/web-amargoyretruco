#!/usr/bin/env node
/**
 * Regenera src/data/fallback-catalog.json a partir del CSV publicado del Sheets.
 * Uso:
 *   CATALOG_CSV_URL="https://docs.google.com/.../pub?output=csv" npm run fallback:update
 * (o con la variable definida en .env)
 *
 * Guarda las filas tal cual vienen; las reglas de validación se aplican al mostrar.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const target = new URL('../src/data/fallback-catalog.json', import.meta.url);
const COLUMNS = ['Marca', 'Producto', 'Presentación', 'Precio', 'Stock', 'Foto', 'Visible'];

function readDotEnv() {
  const envFile = new URL('../.env', import.meta.url);
  if (!existsSync(envFile)) return {};
  return Object.fromEntries(
    readFileSync(envFile, 'utf8')
      .split(/\r?\n/)
      .map((line) => /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
  );
}

function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

const url = process.env.CATALOG_CSV_URL || readDotEnv().CATALOG_CSV_URL;
if (!url || !url.startsWith('https://')) {
  console.error('Falta CATALOG_CSV_URL (https). Definila en .env o en la línea de comandos.');
  process.exit(1);
}

const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
if (!res.ok) {
  console.error(`El Sheets respondió ${res.status}`);
  process.exit(1);
}
const [header, ...data] = parseCsv(await res.text());
const index = Object.fromEntries(COLUMNS.map((col) => [col, header.findIndex((h) => norm(h) === norm(col))]));
for (const col of ['Marca', 'Producto', 'Precio', 'Stock', 'Visible']) {
  if (index[col] === -1) {
    console.error(`Al CSV le falta la columna "${col}". ¿Publicaste la pestaña Catalogo?`);
    process.exit(1);
  }
}
const rows = data.map((cells) => Object.fromEntries(COLUMNS.map((col) => [col, index[col] === -1 ? '' : (cells[index[col]] ?? '').trim()])));
const today = new Date().toISOString().slice(0, 10);
const output = {
  _info: 'Respaldo del catálogo si el Google Sheets no responde. Mismas columnas que la pestaña Catalogo. Se regenera con `npm run fallback:update` (lee CATALOG_CSV_URL).',
  updatedAt: today,
  rows,
};
writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Listo: ${rows.length} filas guardadas en src/data/fallback-catalog.json (${today}).`);
