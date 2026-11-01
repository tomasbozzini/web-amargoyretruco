/**
 * Utilidades de texto. Todo lo que viene del Sheets pasa por `cleanText`
 * antes de mostrarse: se trata siempre como texto plano (Astro lo escapa al
 * renderizar y en el cliente se usa `textContent`, nunca `innerHTML`).
 */

// Caracteres de control y de dirección de texto (bidi) que pueden usarse para
// romper el formato o disfrazar contenido.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g;

/** Normaliza, quita caracteres de control, colapsa espacios y limita el largo. */
export function cleanText(value: unknown, maxLength: number): string {
  if (value === null || value === undefined) return '';
  const text = String(value)
    .normalize('NFC')
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** Minúsculas y sin tildes, para comparar y buscar. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** "Canarias Té verde" -> "canarias-te-verde" */
export function slugify(value: string): string {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Nombre completo para mostrar en el carrito y en el mensaje:
 * si el producto ya incluye la marca ("Baldo Tradicional") se deja igual;
 * si no ("Tradicional"), se antepone la marca.
 */
export function fullProductName(brand: string, name: string): string {
  return normalizeForSearch(name).includes(normalizeForSearch(brand)) ? name : `${brand} ${name}`;
}
