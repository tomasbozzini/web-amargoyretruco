/**
 * Lógica pura del carrito (sin DOM), compartida entre el navegador y los tests.
 * El pedido vive solo en memoria: se reinicia al recargar la página.
 * Los precios salen del catálogo de la página. Igual, todo lo que se arma en el
 * cliente puede ser manipulado: por eso el pedido siempre lleva la leyenda de
 * confirmación.
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
/* Sin persistencia                                                    */
/* ------------------------------------------------------------------ */

/**
 * El pedido vive solo en memoria: al recargar o volver a entrar a la web,
 * arranca vacío. Las primeras versiones lo guardaban en localStorage con esta
 * clave; se borra al cargar la página para no dejar pedidos viejos guardados.
 */
export const LEGACY_STORAGE_KEY = 'ayr-carrito-v1';

export function clearLegacyCart(storage: Pick<Storage, 'removeItem'> | null | undefined): void {
  try {
    storage?.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* almacenamiento bloqueado o modo privado: no hay nada que borrar */
  }
}
