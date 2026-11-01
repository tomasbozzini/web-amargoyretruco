/**
 * Parser CSV mínimo (RFC 4180): comillas, comillas escapadas (""), saltos de
 * línea dentro de comillas, CRLF y BOM. Sin dependencias.
 * Tiene límites para no procesar archivos absurdamente grandes.
 */
export interface CsvLimits {
  maxRows: number;
  maxFieldLength: number;
}

const DEFAULT_LIMITS: CsvLimits = { maxRows: 2000, maxFieldLength: 2000 };

export function parseCsv(input: string, limits: CsvLimits = DEFAULT_LIMITS): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field.length > limits.maxFieldLength ? field.slice(0, limits.maxFieldLength) : field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // Se ignoran las filas totalmente vacías.
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"' && field === '') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      pushRow();
      if (rows.length >= limits.maxRows) return rows;
    } else {
      field += char;
    }
    i += 1;
  }

  if (field !== '' || row.length > 0) pushRow();
  return rows.slice(0, limits.maxRows);
}
