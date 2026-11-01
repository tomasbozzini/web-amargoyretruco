/**
 * Lógica pura del carrito (sin DOM), compartida entre el navegador y los tests.
 * Los precios SIEMPRE salen del catálogo actual, nunca de lo guardado en el
 * navegador. Igual, todo lo que se arma en el cliente puede ser manipulado: por
 * eso el pedido siempre lleva la leyenda de confirmación.
 */

export type DeliveryMode = 'delivery' | 'pickup';

export interface CartProduct {
  id: string;
  brand: string;
  name: string;
  presentation: string;
  price: number;
  stock: number;
}

export interface CartState {
  /** id de producto -> cantidad */
  items: Record<string, number>;
  delivery: DeliveryMode | null;
}

export interface CartLine {
  product: CartProduct;
  quantity: number;
  lineTotal: number;
}

export interface CartTotals {
  lines: CartLine[];
  /** Cantidad total de paquetes. */
  count: number;
  total: number;
}

export const MAX_QUANTITY_PER_ITEM = 99;

export function emptyCart(): CartState {
  return { items: {}, delivery: null };
}

function maxFor(product: CartProduct): number {
  return Math.max(0, Math.min(product.stock, MAX_QUANTITY_PER_ITEM));
}

/** Cambia la cantidad respetando 0..stock. Cantidad 0 = se quita del carrito. */
export function setQuantity(state: CartState, product: CartProduct, quantity: number): CartState {
  const safe = Number.isFinite(quantity) ? Math.floor(quantity) : 0;
  const clamped = Math.max(0, Math.min(safe, maxFor(product)));
  const items = { ...state.items };
  if (clamped === 0) delete items[product.id];
  else items[product.id] = clamped;
  return { ...state, items };
}

export function addItem(state: CartState, product: CartProduct, amount = 1): CartState {
  return setQuantity(state, product, (state.items[product.id] ?? 0) + amount);
}

export function removeItem(state: CartState, productId: string): CartState {
  const items = { ...state.items };
  delete items[productId];
  return { ...state, items };
}

/** Ajusta lo guardado al catálogo actual: quita lo que ya no existe o está agotado y limita al stock. */
export function reconcile(state: CartState, products: Map<string, CartProduct>): CartState {
  let next: CartState = { ...state, items: {} };
  for (const [id, quantity] of Object.entries(state.items)) {
    const product = products.get(id);
    if (product) next = setQuantity(next, product, quantity);
  }
  return next;
}

export function computeTotals(state: CartState, products: Map<string, CartProduct>): CartTotals {
  const lines: CartLine[] = [];
  for (const [id, quantity] of Object.entries(state.items)) {
    const product = products.get(id);
    if (!product || quantity <= 0) continue;
    lines.push({ product, quantity, lineTotal: product.price * quantity });
  }
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  // Redondeo a centavos para evitar errores de coma flotante.
  return { lines, count, total: Math.round(total * 100) / 100 };
}

export interface OrderCheck {
  ok: boolean;
  reason: 'empty' | 'no-delivery-mode' | 'below-minimum' | null;
  /** Cuánto falta para llegar al mínimo de delivery (0 si no aplica). */
  missingForDelivery: number;
}

export function checkOrder(totals: CartTotals, delivery: DeliveryMode | null, minDelivery: number): OrderCheck {
  const missing = Math.max(0, Math.round((minDelivery - totals.total) * 100) / 100);
  if (totals.lines.length === 0) return { ok: false, reason: 'empty', missingForDelivery: missing };
  if (!delivery) return { ok: false, reason: 'no-delivery-mode', missingForDelivery: missing };
  if (delivery === 'delivery' && missing > 0) return { ok: false, reason: 'below-minimum', missingForDelivery: missing };
  return { ok: true, reason: null, missingForDelivery: delivery === 'delivery' ? 0 : missing };
}

/* ------------------------------------------------------------------ */
/* Persistencia (localStorage con try/catch)                           */
/* ------------------------------------------------------------------ */

export const STORAGE_KEY = 'ayr-carrito-v1';

/**
 * Lee el carrito guardado. Solo se guardan ids, cantidades y el tipo de entrega:
 * nunca nombre ni zona del cliente, y nunca precios.
 */
export function parseStoredCart(raw: string | null): CartState {
  if (!raw || raw.length > 20_000) return emptyCart();
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return emptyCart();
    const { items, delivery } = data as { items?: unknown; delivery?: unknown };
    const safeItems: Record<string, number> = {};
    if (typeof items === 'object' && items !== null) {
      for (const [id, qty] of Object.entries(items).slice(0, 200)) {
        if (/^[a-z0-9-]{1,200}$/.test(id) && typeof qty === 'number' && Number.isInteger(qty) && qty > 0) {
          safeItems[id] = Math.min(qty, MAX_QUANTITY_PER_ITEM);
        }
      }
    }
    return {
      items: safeItems,
      delivery: delivery === 'delivery' || delivery === 'pickup' ? delivery : null,
    };
  } catch {
    return emptyCart();
  }
}

export function loadCart(storage: Pick<Storage, 'getItem'> | null | undefined): CartState {
  try {
    return parseStoredCart(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return emptyCart();
  }
}

export function saveCart(storage: Pick<Storage, 'setItem'> | null | undefined, state: CartState): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ items: state.items, delivery: state.delivery }));
  } catch {
    /* modo privado, almacenamiento lleno o bloqueado: el carrito sigue en memoria */
  }
}
