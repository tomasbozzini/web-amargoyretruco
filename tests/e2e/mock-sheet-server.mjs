/**
 * Simula el CSV publicado del Google Sheets para los tests end-to-end.
 *   GET  /catalogo.csv     -> CSV de prueba (o 500 si está en modo falla)
 *   POST /control/fail     -> el "Sheets" empieza a fallar
 *   POST /control/ok       -> vuelve a responder bien
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.env.MOCK_SHEET_PORT ?? 4400);
const csv = readFileSync(new URL('../fixtures/catalogo-prueba.csv', import.meta.url), 'utf8');
let failing = false;

createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/control/fail') {
    failing = true;
    return res.end('fail');
  }
  if (req.method === 'POST' && req.url === '/control/ok') {
    failing = false;
    return res.end('ok');
  }
  if (req.url?.startsWith('/catalogo.csv')) {
    if (failing) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      return res.end('Internal error');
    }
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8' });
    return res.end(csv);
  }
  if (req.url === '/health') return res.end('ok');
  res.writeHead(404);
  res.end();
}).listen(port, '127.0.0.1', () => console.log(`mock sheet en http://127.0.0.1:${port}`));
