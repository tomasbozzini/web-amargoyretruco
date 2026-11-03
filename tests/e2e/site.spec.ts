import { expect, test, type Page } from '@playwright/test';

/**
 * Flujo completo en mobile contra el build de producción.
 * Datos: tests/fixtures/catalogo-prueba.csv (precios de PRUEBA, no reales).
 */
const MOCK = 'http://127.0.0.1:4400';
const FALLBACK_SITE = 'http://127.0.0.1:4322';
const PAUSED_SITE = 'http://127.0.0.1:4323';
const PHONE = '5491133907596';
const DISCLAIMER = 'Precios y stock sujetos a confirmación por WhatsApp';

const ID = {
  baldo500: 'baldo-baldo-tradicional-500-g',
  baldo1kg: 'baldo-baldo-tradicional-1-kg',
  serena: 'canarias-canarias-serena-500-g',
  especial: 'canarias-canarias-edicion-especial-500-g',
  reiVerde: 'rei-verde-rei-verde-tradicional-500-g',
  sara: 'sara-sara-img-src-x-onerror-alert-1-500-g',
};

/** Normaliza espacios duros (es-AR formatea "$ 8.600" con NBSP). */
const norm = (text: string | null) => (text ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

const card = (page: Page, id: string) => page.locator(`[data-product][data-id="${id}"]`);
const visibleCards = (page: Page) => page.locator('[data-product-item]:not([hidden]) [data-product]');
const orderLink = (page: Page) => page.locator('[data-whatsapp-order]');

async function orderMessage(page: Page): Promise<string> {
  const href = await orderLink(page).getAttribute('href');
  expect(href, 'el botón de pedido debería tener link').toBeTruthy();
  const url = new URL(href ?? '');
  expect(`${url.origin}${url.pathname}`).toBe(`https://wa.me/${PHONE}`);
  return url.searchParams.get('text') ?? '';
}

let problems: string[] = [];

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK}/control/ok`);
  problems = [];
  page.on('console', (msg) => {
    if (/Content Security Policy|Refused to/i.test(msg.text())) problems.push(`CSP: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`JS: ${error.message}`));
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'alert') problems.push(`alert inesperado: ${dialog.message()}`);
    await dialog.dismiss();
  });
});

test.afterEach(() => {
  expect(problems, 'sin errores de JS, violaciones de CSP ni alerts').toEqual([]);
});

test('muestra el catálogo del Sheets con precios y estados de stock', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  await expect(page.locator('[data-product]')).toHaveCount(6);
  await expect(page.locator('[data-sales-paused-banner]')).toHaveCount(0);
  // Con "reducir movimiento" no hay intro.
  await expect(page.locator('[data-intro]')).toHaveCount(0);
  await expect(page.locator('[data-brand-chip]')).toHaveText(['Todas', 'Baldo', 'Canarias', 'Rei Verde', 'Sara']);

  expect(norm(await card(page, ID.baldo500).locator('[data-price-value]').innerText())).toBe('$ 8.600');
  expect(norm(await card(page, ID.baldo1kg).locator('[data-price-value]').innerText())).toBe('$ 15.900');

  // Agotado: etiqueta y botón deshabilitado.
  await expect(card(page, ID.reiVerde).getByText('Agotado', { exact: true }).first()).toBeVisible();
  await expect(card(page, ID.reiVerde).locator('[data-add]')).toBeDisabled();

  // Stock bajo (<= 2): "Últimas unidades".
  await expect(card(page, ID.especial).getByText('Últimas unidades')).toBeVisible();
  await expect(card(page, ID.baldo500).getByText('Últimas unidades')).toHaveCount(0);

  // Filas ignoradas: sin precio, Visible=NO, precio absurdo, sin marca.
  await expect(page.getByText('Verdecita')).toHaveCount(0);
  await expect(page.getByText('Centenaria')).toHaveCount(0);
  await expect(page.getByText('Precio absurdo')).toHaveCount(0);
});

test('el texto del Sheets se muestra como texto plano (sin inyección de HTML)', async ({ page }) => {
  await page.goto('/');
  await expect(card(page, ID.sara).getByRole('heading')).toHaveText('Sara <img src=x onerror=alert(1)>');
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  // La foto "javascript:alert(1)" se descartó: queda la ilustración.
  await expect(card(page, ID.sara).locator('img')).toHaveCount(0);
});

test('si una foto no carga, queda la ilustración de la marca', async ({ page }) => {
  await page.goto('/');
  // Canarias Serena tiene una URL https que no resuelve.
  await expect(card(page, ID.serena).locator('img[data-product-img]')).toHaveCount(0, { timeout: 15_000 });
  await expect(card(page, ID.serena).locator('[aria-hidden="true"]', { hasText: 'Canarias' }).first()).toBeVisible();
});

test('filtros por marca, buscador y orden por precio', async ({ page }) => {
  await page.goto('/');
  const count = page.locator('[data-results-count]');

  await page.getByRole('button', { name: 'Canarias', exact: true }).click();
  await expect(visibleCards(page)).toHaveCount(2);
  await expect(count).toHaveText('Mostrando 2 de 6 yerbas');
  await expect(page.getByRole('button', { name: 'Canarias', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Todas' }).click();
  await page.getByLabel('Buscar yerba').fill('edicion'); // sin tilde
  await expect(visibleCards(page)).toHaveCount(1);
  await expect(visibleCards(page).first()).toHaveAttribute('data-id', ID.especial);

  await page.getByLabel('Buscar yerba').fill('1 kg');
  await expect(visibleCards(page)).toHaveCount(1);

  await page.getByLabel('Buscar yerba').fill('zzz');
  await expect(visibleCards(page)).toHaveCount(0);
  await expect(page.getByText('Ni el ancho de espadas te salva')).toBeVisible();
  await page.getByRole('button', { name: 'Ver todas las yerbas' }).click();
  await expect(visibleCards(page)).toHaveCount(6);
  await expect(page.getByLabel('Buscar yerba')).toHaveValue('');

  await page.getByLabel('Ordenar').selectOption('price-asc');
  await expect(visibleCards(page).first()).toHaveAttribute('data-id', ID.sara); // $ 7.100
  await expect(visibleCards(page).last()).toHaveAttribute('data-id', ID.baldo1kg); // $ 15.900
  await page.getByLabel('Ordenar').selectOption('price-desc');
  await expect(visibleCards(page).first()).toHaveAttribute('data-id', ID.baldo1kg);
  await page.getByLabel('Ordenar').selectOption('default');
  await expect(visibleCards(page).first()).toHaveAttribute('data-id', ID.baldo500);
});

test('carrito: mínimo de delivery, cambio a retiro y mensaje de WhatsApp', async ({ page, context }) => {
  await page.goto('/');
  const baldo = card(page, ID.baldo500);
  await baldo.locator('[data-add]').click();
  await baldo.locator('[data-card-increase]').click();

  await expect(page.locator('[data-cart-count]')).toHaveText('2');
  await expect(baldo.locator('[data-card-qty]')).toHaveText('2');
  await expect(page.locator('[data-mobile-cart-bar]')).toBeVisible();
  expect(norm(await page.locator('[data-mobile-cart-summary]').innerText())).toBe('2 · $ 17.200');

  await page.locator('[data-mobile-cart-bar] [data-cart-open]').click();
  const cart = page.locator('[data-cart-dialog]');
  await expect(cart).toBeVisible();
  await expect(cart.locator('[data-cart-lines] li')).toHaveCount(1);
  expect(norm(await cart.locator('[data-cart-total]').innerText())).toBe('$ 17.200');

  // Sin elegir entrega: no se puede pedir.
  await expect(orderLink(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-cart-help]')).toHaveText('Elegí si lo querés por delivery o lo retirás.');

  // Delivery por debajo del mínimo ($ 20.000): bloqueado, muestra cuánto falta.
  await cart.getByLabel(/Delivery sin cargo en Tandil/).check();
  await expect(cart.locator('[data-min-warning]')).toBeVisible();
  expect(norm(await cart.locator('[data-min-missing]').innerText())).toBe('$ 2.800');
  await expect(orderLink(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(orderLink(page)).not.toHaveAttribute('href', /.+/);

  // Ofrece cambiar a retiro. Con retiro solo se pide el nombre (obligatorio).
  await cart.getByRole('button', { name: 'Cambiar a retiro en zona Campus universitario' }).click();
  await expect(cart.getByLabel(/Retiro en zona Campus universitario/)).toBeChecked();
  await expect(cart.locator('[data-min-warning]')).toBeHidden();
  await expect(cart.getByLabel('Tu nombre', { exact: true })).toBeVisible();
  await expect(cart.getByLabel('Dirección de entrega')).toBeHidden();
  await expect(cart.getByText('(opcional)')).toHaveCount(0);
  await expect(orderLink(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-cart-help]')).toHaveText('Escribí tu nombre para mandar el pedido.');

  // Tocar el botón sin nombre lleva al campo y lo marca.
  await orderLink(page).click({ force: true }); // aria-disabled: Playwright no lo toca sin force
  await expect(cart.getByLabel('Tu nombre', { exact: true })).toBeFocused();
  await expect(cart.getByLabel('Tu nombre', { exact: true })).toHaveAttribute('aria-invalid', 'true');

  await cart.getByLabel('Tu nombre', { exact: true }).fill('Juan');
  await expect(cart.getByLabel('Tu nombre', { exact: true })).not.toHaveAttribute('aria-invalid', 'true');
  await expect(orderLink(page)).not.toHaveAttribute('aria-disabled', 'true');
  let message = await orderMessage(page);
  expect(message).toContain('Entrega: Retiro en zona Campus universitario');
  expect(message).toContain('*Total: $ 17.200*');
  expect(message).toContain('Nombre: Juan');
  expect(message).not.toContain('Dirección:');
  expect(message).toContain(DISCLAIMER);

  // Vuelve a delivery y suma uno: $ 25.800 supera el mínimo, pero falta la dirección.
  await cart.getByLabel(/Delivery sin cargo en Tandil/).check();
  await cart.getByRole('button', { name: 'Sumar uno de Baldo Tradicional' }).click();
  await expect(cart.getByLabel('Cantidad: 3')).toBeVisible();
  expect(norm(await cart.locator('[data-cart-total]').innerText())).toBe('$ 25.800');
  await expect(cart.locator('[data-min-warning]')).toBeHidden();
  await expect(cart.getByLabel('Dirección de entrega')).toBeVisible();
  await expect(orderLink(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-cart-help]')).toHaveText('Escribí la dirección de entrega para el delivery.');
  await orderLink(page).click({ force: true }); // aria-disabled: Playwright no lo toca sin force
  await expect(cart.getByLabel('Dirección de entrega')).toBeFocused();
  await expect(cart.getByLabel('Dirección de entrega')).toHaveAttribute('aria-invalid', 'true');

  // Con nombre y dirección, se puede pedir.
  await cart.getByLabel('Dirección de entrega').fill('Av. Colón 123');
  await expect(orderLink(page)).not.toHaveAttribute('aria-disabled', 'true');
  message = await orderMessage(page);
  expect(message).toBe(
    [
      '¡Hola Amargo y Retruco! 🧉 Quiero hacer este pedido:',
      '',
      '• 3 x Baldo Tradicional (500 g) - $ 8.600 c/u = $ 25.800',
      '',
      '*Total: $ 25.800*',
      'Entrega: Delivery en Tandil',
      'Nombre: Juan',
      'Dirección: Av. Colón 123',
      '',
      `_${DISCLAIMER}._`,
    ].join('\n'),
  );

  // El botón abre wa.me en otra pestaña (se intercepta para no salir a internet).
  await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'wa.me simulado' }));
  const [popup] = await Promise.all([context.waitForEvent('page'), orderLink(page).click()]);
  expect(popup.url()).toMatch(new RegExp(`^https://wa\\.me/${PHONE}\\?text=`));
  expect(new URL(popup.url()).searchParams.get('text')).toBe(message);
});

test('stock: no deja pasar del stock y lo agotado no se agrega', async ({ page }) => {
  await page.goto('/');
  const especial = card(page, ID.especial); // stock 2
  await especial.locator('[data-add]').click();
  await especial.getByRole('button', { name: 'Sumar uno de Canarias Edición Especial 500 g' }).click();
  await expect(especial.locator('[data-card-qty]')).toHaveText('2');
  await expect(especial.locator('[data-card-increase]')).toBeDisabled();
  await expect(especial.locator('[data-in-cart]')).toHaveText('Máximo disponible: 2');

  await page.locator('[data-cart-open]').first().click();
  const cart = page.locator('[data-cart-dialog]');
  await expect(cart.getByRole('button', { name: 'Sumar uno de Canarias Edición Especial' })).toBeDisabled();
  await expect(cart.getByText('Máximo disponible: 2')).toBeVisible();

  // Restar y quitar.
  await cart.getByRole('button', { name: 'Restar uno de Canarias Edición Especial' }).click();
  await expect(cart.getByLabel('Cantidad: 1')).toBeVisible();
  await cart.getByRole('button', { name: 'Quitar Canarias Edición Especial del pedido' }).click();
  await expect(cart.getByText('Todavía no tenés cartas en la mano')).toBeVisible();
  await page.keyboard.press('Escape');
  // La tarjeta se sincroniza con el carrito: vuelve el botón "Agregar".
  await expect(especial.locator('[data-add]')).toBeVisible();
  await expect(especial.locator('[data-card-stepper]')).toBeHidden();

  // Agotado: botón deshabilitado y sin selector de cantidad.
  await expect(card(page, ID.reiVerde).locator('[data-add]')).toBeDisabled();
  await expect(card(page, ID.reiVerde).locator('[data-card-stepper]')).toHaveCount(0);
});

test('selector − cantidad + en la tarjeta, respetando el stock', async ({ page }) => {
  await page.goto('/');
  const serena = card(page, ID.serena); // stock 3
  const add = serena.locator('[data-add]');
  const plus = serena.locator('[data-card-increase]');
  const minus = serena.locator('[data-card-decrease]');
  const qty = serena.locator('[data-card-qty]');

  await expect(serena.locator('[data-card-stepper]')).toBeHidden();
  await add.click();
  await expect(add).toBeHidden();
  await expect(serena.locator('[data-card-stepper]')).toBeVisible();
  await expect(qty).toHaveText('1');
  await expect(plus).toBeFocused();
  await expect(minus).toHaveAccessibleName('Quitar Canarias Serena 500 g del pedido');

  await plus.click();
  await expect(minus).toHaveAccessibleName('Restar uno de Canarias Serena 500 g');
  await plus.click();
  await expect(qty).toHaveText('3');
  await expect(plus).toBeDisabled();
  await expect(serena.locator('[data-in-cart]')).toHaveText('Máximo disponible: 3');
  await expect(minus).toBeFocused(); // al deshabilitarse el "+", el foco pasa al "−"
  await expect(page.locator('[data-cart-count]')).toHaveText('3');

  await minus.click();
  await expect(qty).toHaveText('2');
  await expect(plus).toBeEnabled();
  await expect(serena.locator('[data-in-cart]')).toHaveText('');
  await minus.click();
  await minus.click();
  await expect(serena.locator('[data-card-stepper]')).toBeHidden();
  await expect(add).toBeVisible();
  await expect(add).toBeFocused();
  await expect(page.locator('[data-cart-count]')).toBeHidden();
});

test('al recargar la página, el pedido se reinicia', async ({ page }) => {
  await page.goto('/');
  await card(page, ID.baldo1kg).locator('[data-add]').click();
  await card(page, ID.baldo500).locator('[data-add]').click();
  await page.locator('[data-cart-open]').first().click();
  await page.getByLabel(/Tu nombre/).fill('Juana');
  await page.getByLabel(/Retiro en zona Campus universitario/).check();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-cart-count]')).toHaveText('2');

  await page.reload();
  await expect(page.locator('[data-cart-count]')).toBeHidden();
  await expect(page.locator('[data-mobile-cart-bar]')).toBeHidden();
  await expect(card(page, ID.baldo1kg).locator('[data-in-cart]')).toHaveText('');
  await page.locator('[data-cart-open]').first().click();
  await expect(page.getByText('Todavía no tenés cartas en la mano')).toBeVisible();
  await expect(page.getByLabel(/Tu nombre/)).toHaveValue('');

  // No queda nada guardado en el navegador.
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('un pedido viejo guardado por una versión anterior no se carga y se borra', async ({ page }) => {
  await page.addInitScript((id) => {
    // Simula el pedido que dejaba guardado la versión anterior (solo antes de la primera carga).
    if (!sessionStorage.getItem('sembrado')) {
      sessionStorage.setItem('sembrado', '1');
      localStorage.setItem('ayr-carrito-v1', JSON.stringify({ items: { [id]: 2 }, delivery: 'pickup' }));
    }
  }, ID.baldo500);
  await page.goto('/');
  await expect(page.locator('[data-cart-count]')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('ayr-carrito-v1'))).toBeNull();
});

test('si localStorage está bloqueado, el carrito igual funciona', async ({ page }) => {
  await page.addInitScript(() => {
    const fail = () => {
      throw new DOMException('bloqueado', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', { get: fail });
  });
  await page.goto('/');
  await card(page, ID.baldo500).locator('[data-add]').click();
  await expect(page.locator('[data-cart-count]')).toHaveText('1');
});

test('el panel se cierra con Escape y devuelve el foco', async ({ page }) => {
  await page.goto('/');
  const opener = page.locator('header [data-cart-open]');
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-cart-dialog]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-cart-dialog]')).toBeHidden();
  await expect(opener).toBeFocused();
});

test('preguntas frecuentes en acordeón accesible', async ({ page }) => {
  await page.goto('/');
  const delivery = page.locator('details', { hasText: '¿Hacen delivery?' });
  await expect(delivery.getByText(/solo dentro de Tandil/)).toBeHidden();
  await delivery.locator('summary').click();
  await expect(delivery.getByText(/solo dentro de Tandil, con una compra mínima de \$\s20\.000/)).toBeVisible();
  await expect(page.locator('details', { hasText: '¿Cómo pago?' })).toContainText('Los datos para transferir te los pasamos por WhatsApp');
  await expect(delivery).toContainText('El delivery es sin cargo.');
  await expect(page.locator('#inicio').getByText(/Delivery sin cargo en Tandil \(mín\. \$\s20\.000\)/)).toBeVisible();
});

test('headers de seguridad, caché del CDN, SEO', async ({ page, request }) => {
  const res = await request.get('/');
  const headers = res.headers();
  expect(headers['cache-control']).toBe('public, s-maxage=300, stale-while-revalidate=3600');
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-frame-options']).toBe('DENY');

  const html = await res.text();
  expect(html).not.toContain('CATALOG_CSV_URL');
  expect(html).not.toContain('127.0.0.1:4400'); // la URL del CSV nunca llega al navegador

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
  await expect(page).toHaveTitle(/Amargo y Retruco/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.png$/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Tandil/);
  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(jsonLd['@type']).toBe('Store');
  expect(jsonLd.address.addressLocality).toBe('Tandil');
  expect(jsonLd.address.streetAddress).toBeUndefined();

  // Todos los links externos con rel="noopener noreferrer".
  const unsafe = await page.locator('a[target="_blank"]:not([rel~="noopener"]), a[target="_blank"]:not([rel~="noreferrer"])').count();
  expect(unsafe).toBe(0);
  // Todas las imágenes con alt.
  expect(await page.locator('img:not([alt])').count()).toBe(0);

  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Sitemap:');
  const sitemap = await request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain('<urlset');
  const missing = await page.goto('/no-existe');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Me voy al mazo' })).toBeVisible();
});

test('Sheets caído: usa la última copia buena en memoria', async ({ page, request }) => {
  await page.goto('/'); // asegura una lectura buena
  await expect(page.locator('[data-product]')).toHaveCount(6);
  await request.post(`${MOCK}/control/fail`);
  const res = await page.reload();
  expect(res?.status()).toBe(200);
  await expect(page.locator('[data-product]')).toHaveCount(6);
  await request.post(`${MOCK}/control/ok`);
});

test('Sheets caído y sin copia en memoria: usa el respaldo y la página no se rompe', async ({ page }) => {
  const res = await page.goto(FALLBACK_SITE);
  expect(res?.status()).toBe(200);
  // Productos de src/data/fallback-catalog.json, con aviso de lista guardada.
  await expect(page.getByText('Estamos mostrando una lista guardada')).toBeVisible();
  expect(await page.locator('[data-product]').count()).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: /Mate y truco/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '¿Cómo se juega?' })).toBeVisible();
});

test('Sheets sin productos para mostrar: mensaje amable con link a WhatsApp', async ({ page, request }) => {
  await request.post(`${MOCK}/control/empty`);
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('[data-product]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Estamos barajando de nuevo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pedir la lista por WhatsApp' })).toHaveAttribute('href', new RegExp(`^https://wa\\.me/${PHONE}\\?text=`));
  await request.post(`${MOCK}/control/ok`);
});

test('ventas en pausa: cartel "Muy pronto renovamos stock" y no se puede agregar', async ({ page }) => {
  const res = await page.goto(PAUSED_SITE);
  expect(res?.status()).toBe(200);
  const banner = page.locator('[data-sales-paused-banner]');
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('heading', { name: 'Muy pronto renovamos stock' })).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Escribinos' })).toHaveAttribute('href', new RegExp(`^https://wa\\.me/${PHONE}`));

  // El catálogo se sigue viendo, pero nada se puede agregar.
  await expect(page.locator('[data-product]')).toHaveCount(6);
  const addButtons = page.locator('[data-add]');
  for (const button of await addButtons.all()) {
    await expect(button).toBeDisabled();
    await expect(button).toContainText('Muy pronto');
  }
  await expect(page.locator('[data-card-stepper]')).toHaveCount(0);
  await expect(page.getByText('Últimas unidades')).toHaveCount(0);
  await expect(page.locator('header [data-cart-open]')).toHaveCount(0);

  // Ni forzando el botón desde la consola se agrega algo al pedido.
  await addButtons.first().evaluate((button) => {
    (button as HTMLButtonElement).disabled = false;
    (button as HTMLButtonElement).click();
  });
  await expect(page.locator('[data-mobile-cart-bar]')).toBeHidden();
  await expect(page.locator('[data-toast]')).toBeHidden();
});

test.describe('intro del mate', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('se muestra al entrar, se va sola y no se repite al recargar', async ({ page }) => {
    await page.goto('/');
    const intro = page.locator('[data-intro]');
    await expect(intro).toBeVisible();
    await expect(intro).toContainText('Cebando el primero');
    // Termina sola (~2,6 s) y se saca de la página.
    await expect(intro).toHaveCount(0, { timeout: 6000 });
    await expect(page.getByRole('heading', { name: /Mate y truco/ })).toBeVisible();

    await page.reload();
    await expect(page.locator('[data-intro]')).toHaveCount(0);
  });

  test('se saltea tocando la pantalla y la página queda usable', async ({ page }) => {
    await page.goto('/');
    const intro = page.locator('[data-intro]');
    await expect(intro).toBeVisible();
    await intro.click();
    await expect(intro).toHaveCount(0, { timeout: 1500 });
    await card(page, ID.baldo500).locator('[data-add]').click();
    await expect(page.locator('[data-cart-count]')).toHaveText('1');
  });
});

