/**
 * Precios: lectura tolerante desde el Sheets y formato para mostrar.
 * Acepta, entre otros: 8600 · $8.600 · $ 8.600 · 8.600,00 · 8600.50 · 8,600
 */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;

  const text = raw.trim();
  if (!text || text.includes('-')) return null; // vacío o negativo

  // Solo dígitos y separadores. Si hay letras raras (p. ej. "consultar"), se descarta.
  const stripped = text.replace(/[$\s ]|ARS/gi, '');
  if (!/^[\d.,]+$/.test(stripped)) return null;

  let normalized: string;
  const lastDot = stripped.lastIndexOf('.');
  const lastComma = stripped.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    // Hay ambos: el último que aparece es el separador decimal.
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    normalized = stripped.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ',';
    const parts = stripped.split(sep);
    // "8.600" / "12.500" / "1.250.000" -> separador de miles (formato argentino).
    const looksLikeThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3) && parts[0].length >= 1 && parts[0].length <= 3;
    if (looksLikeThousands) {
      normalized = parts.join('');
    } else if (parts.length === 2) {
      normalized = `${parts[0]}.${parts[1]}`; // "8600,5" / "8600.50" -> decimal
    } else {
      return null; // "8.60.0" y similares
    }
  } else {
    normalized = stripped;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const formatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 8600 -> "$ 8.600" (con espacio duro, como lo formatea es-AR). */
export function formatPrice(value: number): string {
  return formatter.format(value);
}

/** Versión con espacio común, para el mensaje de WhatsApp. */
export function formatPricePlain(value: number): string {
  return formatPrice(value).replace(/ /g, ' ');
}
