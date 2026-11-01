/**
 * Simula el CSV publicado del Google Sheets para los tests end-to-end.
 *   GET  /catalogo.csv     -> CSV de prueba (o 500 si está en modo falla)
 *   POST /control/fail     -> el "Sheets" empieza a fallar
 *   POST /control/empty    -> responde un CSV válido pero sin filas para mostrar
 *   POST /control/ok       -> vuelve a responder bien
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.env.MOCK_SHEET_PORT ?? 4400);
const csv = readFileSync(new URL('../fixtures/catalogo-prueba.csv', import.meta.url), 'utf8');
const emptyCsv = 'Marca,Producto,Presentación,Precio,Stock,Foto,Visible\nBaldo,Baldo Tradicional,500 g,,3,,SI\n';
let mode = 'ok';

createServer((req, res) => {
  const control = /^\/control\/(ok|fail|empty)$/.exec(req.url ?? '');
  if (req.method === 'POST' && control) {
    mode = control[1];
    return res.end(mode);
  }
  if (req.url?.startsWith('/catalogo.csv')) {
    if (mode === 'fail') {
      res.writeHead(500, { 'content-type': 'text/plain' });
      return res.end('Internal error');
    }
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8' });
    return res.end(mode === 'empty' ? emptyCsv : csv);
  }
  if (req.url === '/health') return res.end('ok');
  res.writeHead(404);
  res.end();
}).listen(port, '127.0.0.1', () => console.log(`mock sheet en http://127.0.0.1:${port}`));
