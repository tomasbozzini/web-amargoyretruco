/**
 * Script del cliente: filtros del catálogo, carrito y pedido por WhatsApp.
 *
 * Seguridad: todo el texto se inserta con textContent / createElement.
 * Nunca se usa innerHTML. Los datos de producto se leen de atributos data-*
 * que el servidor ya escapó.
 */
import {
  addItem,
  checkOrder,
  clearLegacyCart,
  computeTotals,
  emptyCart,
  removeItem,
  setQuantity,
  type CartProduct,
  type CartState,
  type CustomerInfo,
  type DeliveryMode,
} from '../lib/cart';
import { formatPrice } from '../lib/price';
import { fullProductName, normalizeForSearch } from '../lib/text';
import { buildOrderMessage, buildWhatsAppUrl } from '../lib/whatsapp';

/* ------------------------------------------------------------------ */
/* Utilidades DOM                                                      */
/* ------------------------------------------------------------------ */

const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [...root.querySelectorAll<T>(selector)];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Configuración y productos                                           */
/* ------------------------------------------------------------------ */

const configNode = $('[data-app-config]');
const config = {
  business: configNode?.dataset.business ?? '',
  city: configNode?.dataset.city ?? '',
  pickup: configNode?.dataset.pickup ?? '',
  phone: configNode?.dataset.phone ?? '',
  minDelivery: Number(configNode?.dataset.minDelivery ?? 0) || 0,
  disclaimer: configNode?.dataset.disclaimer ?? '',
  salesPaused: configNode?.dataset.salesPaused === 'true',
};

const cards = $$<HTMLElement>('[data-product]');
const products = new Map<string, CartProduct>();
// Con las ventas en pausa no se carga ningún producto en el carrito: no se puede agregar nada.
for (const card of config.salesPaused ? [] : cards) {
  const { id = '', brand = '', name = '', presentation = '' } = card.dataset;
  const price = Number(card.dataset.price);
  const stock = Number(card.dataset.stock);
  if (!id || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) continue;
  products.set(id, { id, brand, name, presentation, price, stock });
}

/* ------------------------------------------------------------------ */
/* Estado del carrito                                                  */
/* ------------------------------------------------------------------ */

// El pedido vive solo en memoria: cada vez que se carga la página arranca vacío.
// Se borra también cualquier pedido que hayan guardado versiones anteriores.
clearLegacyCart(safeStorage());
let cart: CartState = emptyCart();

function commit(next: CartState): void {
  cart = next;
  render();
}

/* ------------------------------------------------------------------ */
/* Avisos                                                              */
/* ------------------------------------------------------------------ */

const toast = $('[data-toast]');
let toastTimer: number | undefined;
function showToast(message: string): void {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

const cartAnnounce = $('[data-cart-announce]');
function announceInCart(message: string): void {
  if (!cartAnnounce) return;
  cartAnnounce.textContent = '';
  window.setTimeout(() => {
    cartAnnounce.textContent = message;
  }, 50);
}

/* ------------------------------------------------------------------ */
/* Catálogo: búsqueda, filtro por marca y orden                        */
/* ------------------------------------------------------------------ */

const grid = $('[data-product-grid]');
const items = $$<HTMLLIElement>('[data-product-item]');
const searchInput = $<HTMLInputElement>('[data-search-input]');
const sortSelect = $<HTMLSelectElement>('[data-sort-select]');
const chips = $$<HTMLButtonElement>('[data-brand-chip]');
const resultsCount = $('[data-results-count]');
const noResults = $('[data-no-results]');

const filters = { brand: '', query: '', sort: 'default' };

function applyFilters(): void {
  if (!grid) return;
  const tokens = normalizeForSearch(filters.query).split(/\s+/).filter(Boolean);
  let visible = 0;

  for (const item of items) {
    const card = $('[data-product]', item);
    const brandOk = !filters.brand || card?.dataset.brand === filters.brand;
    const haystack = card?.dataset.search ?? '';
    const queryOk = tokens.every((token) => haystack.includes(token));
    const show = brandOk && queryOk;
    item.hidden = !show;
    if (show) visible += 1;
  }

  const sorted = [...items].sort((a, b) => {
    const ca = $('[data-product]', a)?.dataset;
    const cb = $('[data-product]', b)?.dataset;
    if (filters.sort === 'price-asc') return Number(ca?.price) - Number(cb?.price);
    if (filters.sort === 'price-desc') return Number(cb?.price) - Number(ca?.price);
    return Number(ca?.order) - Number(cb?.order);
  });
  for (const item of sorted) grid.append(item);

  const total = items.length;
  if (resultsCount) {
    resultsCount.textContent =
      visible === total ? `${total} ${total === 1 ? 'yerba' : 'yerbas'}` : `Mostrando ${visible} de ${total} yerbas`;
  }
  if (noResults) noResults.hidden = visible > 0;
  grid.hidden = visible === 0;
}

searchInput?.addEventListener('input', () => {
  filters.query = searchInput.value.slice(0, 60);
  applyFilters();
});

sortSelect?.addEventListener('change', () => {
  filters.sort = sortSelect.value;
  applyFilters();
});

for (const chip of chips) {
  chip.addEventListener('click', () => {
    filters.brand = chip.dataset.brandChip ?? '';
    for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
    applyFilters();
  });
}

$('[data-clear-filters]')?.addEventListener('click', () => {
  filters.brand = '';
  filters.query = '';
  if (searchInput) searchInput.value = '';
  for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.brandChip === ''));
  applyFilters();
  searchInput?.focus();
});

/* ------------------------------------------------------------------ */
/* Botones "Agregar"                                                   */
/* ------------------------------------------------------------------ */

const pageAnnounce = $('[data-page-announce]');
function announce(message: string): void {
  if (!pageAnnounce) return;
  pageAnnounce.textContent = '';
  window.setTimeout(() => {
    pageAnnounce.textContent = message;
  }, 50);
}

/** "Baldo Tradicional 500 g" */
function itemLabel(product: CartProduct): string {
  return [fullProductName(product.brand, product.name), product.presentation].filter(Boolean).join(' ');
}

/*
 * "Agregar" suma 1 y se reemplaza por el selector − cantidad +, que respeta el
 * stock. Con 1 unidad, el "−" saca el producto y vuelve el botón "Agregar".
 */
for (const card of cards) {
  const product = products.get(card.dataset.id ?? '');
  const addButton = $<HTMLButtonElement>('[data-add]', card);
  const decrease = $<HTMLButtonElement>('[data-card-decrease]', card);
  const increase = $<HTMLButtonElement>('[data-card-increase]', card);
  if (!product || !addButton) continue;
  const label = itemLabel(product);

  addButton.addEventListener('click', () => {
    const next = addItem(cart, product);
    if ((next.items[product.id] ?? 0) === (cart.items[product.id] ?? 0)) {
      showToast(`No tenemos más stock de ${fullProductName(product.brand, product.name)}.`);
      return;
    }
    commit(next);
    showToast(`¡Quiero! Sumaste ${fullProductName(product.brand, product.name)} al pedido.`);
    // El botón quedó oculto: el foco pasa al "+" (o al "−" si ya no hay más stock).
    (increase && !increase.disabled ? increase : decrease)?.focus();
  });

  increase?.addEventListener('click', () => {
    const current = cart.items[product.id] ?? 0;
    const next = addItem(cart, product);
    const quantity = next.items[product.id] ?? 0;
    if (quantity === current) return;
    commit(next);
    announce(quantity >= product.stock ? `${label}: ${quantity}. Es el máximo disponible.` : `${label}: ${quantity} en tu pedido.`);
    if (increase.disabled) decrease?.focus();
  });

  decrease?.addEventListener('click', () => {
    const next = setQuantity(cart, product, (cart.items[product.id] ?? 0) - 1);
    commit(next);
    const quantity = next.items[product.id] ?? 0;
    if (quantity === 0) {
      announce(`Quitaste ${label} del pedido.`);
      addButton.focus();
    } else {
      announce(`${label}: ${quantity} en tu pedido.`);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Imágenes: si una foto no carga, queda la ilustración de la marca    */
/* ------------------------------------------------------------------ */

for (const img of $$<HTMLImageElement>('img[data-product-img]')) {
  if (img.complete && img.naturalWidth === 0) img.remove();
  else img.addEventListener('error', () => img.remove(), { once: true });
}

/* ------------------------------------------------------------------ */
/* Panel del carrito                                                   */
/* ------------------------------------------------------------------ */

const dialog = $<HTMLDialogElement>('[data-cart-dialog]');
const linesList = $('[data-cart-lines]');
const emptyState = $('[data-cart-empty]');
const formSection = $('[data-cart-form]');
const footer = $('[data-cart-footer]');
const subtotalNode = $('[data-cart-subtotal]');
const totalNode = $('[data-cart-total]');
const minWarning = $('[data-min-warning]');
const minMissing = $('[data-min-missing]');
const helpNode = $('[data-cart-help]');
const orderLink = $<HTMLAnchorElement>('[data-whatsapp-order]');
const nameInput = $<HTMLInputElement>('[data-customer-name]');
const addressInput = $<HTMLInputElement>('[data-customer-address]');
const addressGroup = $('[data-address-group]');
const deliveryOptions = $$<HTMLInputElement>('[data-delivery-option]');

function openCart(): void {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeCart(): void {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

for (const button of $$('[data-cart-open]')) button.addEventListener('click', openCart);
for (const button of $$('[data-cart-close]')) {
  button.addEventListener('click', () => {
    closeCart();
    if (button.hasAttribute('data-go-catalog')) $('#catalogo')?.scrollIntoView();
  });
}
// Click en el fondo oscuro cierra el panel.
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) closeCart();
});

for (const option of deliveryOptions) {
  option.addEventListener('change', () => {
    if (option.checked) commit({ ...cart, delivery: option.value as DeliveryMode });
  });
}

$('[data-switch-pickup]')?.addEventListener('click', () => {
  commit({ ...cart, delivery: 'pickup' });
  deliveryOptions.find((o) => o.value === 'pickup')?.focus();
  announceInCart(`Cambiaste a retiro en ${config.pickup}.`);
});

/** Nombre (siempre) y dirección (solo delivery): no se guardan, solo van en el mensaje. */
function customer(): CustomerInfo {
  return { name: nameInput?.value ?? '', address: addressInput?.value ?? '' };
}

for (const input of [nameInput, addressInput]) {
  input?.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    updateOrderLink();
  });
}

$('[data-cart-clear]')?.addEventListener('click', () => {
  if (!window.confirm('¿Vaciar el pedido?')) return;
  commit({ ...emptyCart(), delivery: cart.delivery });
  announceInCart('Vaciaste el pedido.');
});

orderLink?.addEventListener('click', (event) => {
  if (orderLink.getAttribute('aria-disabled') === 'true') {
    event.preventDefault();
    const check = checkOrder(computeTotals(cart, products), cart.delivery, config.minDelivery, customer());
    if (check.reason === 'no-delivery-mode') deliveryOptions[0]?.focus();
    if (check.reason === 'below-minimum') $<HTMLButtonElement>('[data-switch-pickup]')?.focus();
    const missingField = check.reason === 'missing-name' ? nameInput : check.reason === 'missing-address' ? addressInput : null;
    if (missingField) {
      missingField.setAttribute('aria-invalid', 'true');
      missingField.focus();
    }
  }
});

function lineControls(product: CartProduct, quantity: number): HTMLLIElement {
  const label = fullProductName(product.brand, product.name);
  const li = el('li', 'flex gap-3 py-3');
  const info = el('div', 'min-w-0 flex-1');
  info.append(el('p', 'font-bold leading-snug', label));
  const detail = [product.presentation, `${formatPrice(product.price)} c/u`].filter(Boolean).join(' · ');
  info.append(el('p', 'text-sm text-mate', detail));

  const controls = el('div', 'mt-2 flex items-center gap-2');
  const stepper = el('div', 'inline-flex items-center rounded-xl border-2 border-verde-oscuro/20 bg-white');

  const minus = el('button', 'inline-flex size-11 items-center justify-center rounded-l-xl text-2xl font-bold hover:bg-crema', '−');
  minus.type = 'button';
  minus.dataset.action = 'decrease';
  minus.dataset.id = product.id;
  minus.setAttribute('aria-label', `Restar uno de ${label}`);

  const qty = el('span', 'min-w-8 text-center text-lg font-bold', String(quantity));
  qty.setAttribute('aria-label', `Cantidad: ${quantity}`);

  const plus = el('button', 'inline-flex size-11 items-center justify-center rounded-r-xl text-2xl font-bold hover:bg-crema disabled:cursor-not-allowed disabled:opacity-40', '+');
  plus.type = 'button';
  plus.dataset.action = 'increase';
  plus.dataset.id = product.id;
  plus.setAttribute('aria-label', `Sumar uno de ${label}`);
  plus.disabled = quantity >= product.stock;

  stepper.append(minus, qty, plus);

  const remove = el('button', 'min-h-11 rounded-lg px-2 text-sm font-semibold text-terracota-oscuro underline underline-offset-4 hover:bg-crema', 'Quitar');
  remove.type = 'button';
  remove.dataset.action = 'remove';
  remove.dataset.id = product.id;
  remove.setAttribute('aria-label', `Quitar ${label} del pedido`);

  controls.append(stepper, remove);
  info.append(controls);
  if (quantity >= product.stock) {
    info.append(el('p', 'mt-1 text-xs font-semibold text-mate', `Máximo disponible: ${product.stock}`));
  }

  li.append(info, el('p', 'shrink-0 font-bold whitespace-nowrap', formatPrice(product.price * quantity)));
  return li;
}

linesList?.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
  if (!button) return;
  const product = products.get(button.dataset.id ?? '');
  if (!product) return;
  const current = cart.items[product.id] ?? 0;
  const label = fullProductName(product.brand, product.name);
  if (button.dataset.action === 'increase') {
    commit(setQuantity(cart, product, current + 1));
    announceInCart(`${label}: ${cart.items[product.id] ?? 0}`);
  } else if (button.dataset.action === 'decrease') {
    commit(setQuantity(cart, product, current - 1));
    announceInCart(cart.items[product.id] ? `${label}: ${cart.items[product.id]}` : `Quitaste ${label} del pedido.`);
  } else if (button.dataset.action === 'remove') {
    commit(removeItem(cart, product.id));
    announceInCart(`Quitaste ${label} del pedido.`);
  }
});

function renderLines(): void {
  if (!linesList) return;
  // Recordar el foco para no perderlo al redibujar.
  const active = document.activeElement as HTMLElement | null;
  const focusAction = active?.dataset?.action;
  const focusId = active?.dataset?.id;
  const hadFocusInside = !!active && linesList.contains(active);

  const totals = computeTotals(cart, products);
  linesList.replaceChildren(...totals.lines.map((line) => lineControls(line.product, line.quantity)));

  if (hadFocusInside) {
    const target =
      $<HTMLButtonElement>(`button[data-action="${focusAction}"][data-id="${CSS.escape(focusId ?? '')}"]:not(:disabled)`, linesList) ??
      $<HTMLButtonElement>(`button[data-id="${CSS.escape(focusId ?? '')}"]:not(:disabled)`, linesList) ??
      $<HTMLButtonElement>('button[data-action]', linesList) ??
      $<HTMLButtonElement>('[data-cart-close]');
    target?.focus();
  }
}

function updateOrderLink(): void {
  if (!orderLink) return;
  const totals = computeTotals(cart, products);
  const check = checkOrder(totals, cart.delivery, config.minDelivery, customer());

  if (check.ok && cart.delivery) {
    const message = buildOrderMessage({
      businessName: config.business,
      totals,
      delivery: cart.delivery,
      pickupArea: config.pickup,
      city: config.city,
      customerName: nameInput?.value,
      customerAddress: addressInput?.value,
      disclaimer: config.disclaimer,
    });
    orderLink.href = buildWhatsAppUrl(config.phone, message);
    orderLink.removeAttribute('aria-disabled');
    orderLink.removeAttribute('role');
    orderLink.removeAttribute('tabindex');
  } else {
    orderLink.removeAttribute('href');
    orderLink.setAttribute('aria-disabled', 'true');
    orderLink.setAttribute('role', 'link');
    orderLink.setAttribute('tabindex', '0');
  }

  if (helpNode) {
    helpNode.textContent =
      check.reason === 'no-delivery-mode'
        ? 'Elegí si lo querés por delivery o lo retirás.'
        : check.reason === 'below-minimum'
          ? `Para delivery te faltan ${formatPrice(check.missingForDelivery)}. Podés cambiar a retiro.`
          : check.reason === 'missing-name'
            ? 'Escribí tu nombre para mandar el pedido.'
            : check.reason === 'missing-address'
              ? 'Escribí la dirección de entrega para el delivery.'
              : 'Se abre WhatsApp con tu pedido listo para enviar.';
  }
}

function renderCart(): void {
  const totals = computeTotals(cart, products);
  const isEmpty = totals.lines.length === 0;
  const check = checkOrder(totals, cart.delivery, config.minDelivery, customer());

  if (emptyState) emptyState.hidden = !isEmpty;
  if (formSection) formSection.hidden = isEmpty;
  if (footer) footer.hidden = isEmpty;

  renderLines();
  if (subtotalNode) subtotalNode.textContent = formatPrice(totals.total);
  if (totalNode) totalNode.textContent = formatPrice(totals.total);

  for (const option of deliveryOptions) option.checked = option.value === cart.delivery;
  // Con delivery se pide la dirección; con retiro, solo el nombre.
  if (addressGroup) addressGroup.hidden = cart.delivery !== 'delivery';

  const belowMinimum = check.reason === 'below-minimum';
  if (minWarning) minWarning.hidden = !belowMinimum;
  if (minMissing) minMissing.textContent = formatPrice(check.missingForDelivery);

  updateOrderLink();
}

/* ------------------------------------------------------------------ */
/* Indicadores (encabezado, tarjetas, barra mobile)                    */
/* ------------------------------------------------------------------ */

const countBadge = $('[data-cart-count]');
const countSr = $('[data-cart-count-sr]');
const mobileBar = $('[data-mobile-cart-bar]');
const mobileSummary = $('[data-mobile-cart-summary]');
const fab = $('[data-whatsapp-fab]');

function renderIndicators(): void {
  const totals = computeTotals(cart, products);
  const hasItems = totals.count > 0;

  if (countBadge) {
    countBadge.textContent = String(totals.count);
    countBadge.hidden = !hasItems;
  }
  if (countSr) countSr.textContent = hasItems ? `, ${totals.count} ${totals.count === 1 ? 'producto' : 'productos'}` : ', vacío';
  if (mobileBar) mobileBar.hidden = !hasItems;
  if (mobileSummary) mobileSummary.textContent = `${totals.count} · ${formatPrice(totals.total)}`;
  if (fab) fab.dataset.raised = String(hasItems);

  for (const card of cards) {
    const product = products.get(card.dataset.id ?? '');
    if (!product) continue;
    const quantity = cart.items[product.id] ?? 0;
    const atMax = quantity > 0 && quantity >= product.stock;
    const inCart = $('[data-in-cart]', card);
    if (inCart) inCart.textContent = atMax ? `Máximo disponible: ${product.stock}` : '';

    const addButton = $<HTMLButtonElement>('[data-add]', card);
    const stepper = $('[data-card-stepper]', card);
    if (!addButton || !stepper || product.stock <= 0) continue;
    addButton.hidden = quantity > 0;
    stepper.hidden = quantity === 0;
    const qty = $('[data-card-qty]', card);
    if (qty) qty.textContent = String(quantity);
    const increase = $<HTMLButtonElement>('[data-card-increase]', card);
    if (increase) increase.disabled = atMax;
    const decrease = $('[data-card-decrease]', card);
    decrease?.setAttribute('aria-label', quantity === 1 ? `Quitar ${itemLabel(product)} del pedido` : `Restar uno de ${itemLabel(product)}`);
  }
}

function render(): void {
  renderCart();
  renderIndicators();
}

/* El botón flotante de WhatsApp aparece recién cuando deja de verse el del hero. */
const heroWhatsApp = $('[data-hero-whatsapp]');
if (fab && heroWhatsApp && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    const concealed = entry.isIntersecting;
    fab.dataset.concealed = String(concealed);
    if (concealed) {
      fab.setAttribute('aria-hidden', 'true');
      fab.setAttribute('tabindex', '-1');
    } else {
      fab.removeAttribute('aria-hidden');
      fab.removeAttribute('tabindex');
    }
  }).observe(heroWhatsApp);
}

render();
applyFilters();
