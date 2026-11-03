/**
 * Lógica pura del carrito (sin DOM), compartida entre el navegador y los tests.
 * El pedido vive solo en memoria: se reinicia al recargar la página.
 * Los precios salen del catálogo de la página. Igual, todo lo que se arma en el
 * cliente puede ser manipulado: por eso el pedido siempre lleva la leyenda de
 * confirmación.
 */

import { cleanText } from './text';

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

/** Datos que escribe quien pide. No se guardan: solo van en el mensaje de WhatsApp. */
export interface CustomerInfo {
  name: string;
  /** Solo se pide (y se usa) con delivery. */
  address: string;
}

export const CUSTOMER_NAME_MAX = 60;
export const CUSTOMER_ADDRESS_MAX = 120;
const MIN_NAME_LENGTH = 2;
const MIN_ADDRESS_LENGTH = 4;

export interface OrderCheck {
  ok: boolean;
  reason: 'empty' | 'no-delivery-mode' | 'below-minimum' | 'missing-name' | 'missing-address' | null;
  /** Cuánto falta para llegar al mínimo de delivery (0 si no aplica). */
  missingForDelivery: number;
}

/**
 * Decide si el pedido se puede mandar:
 * productos, tipo de entrega, mínimo de delivery, nombre (siempre) y dirección (solo delivery).
 */
export function checkOrder(
  totals: CartTotals,
  delivery: DeliveryMode | null,
  minDelivery: number,
  customer: CustomerInfo,
): OrderCheck {
  const missing = Math.max(0, Math.round((minDelivery - totals.total) * 100) / 100);
  const fail = (reason: NonNullable<OrderCheck['reason']>): OrderCheck => ({ ok: false, reason, missingForDelivery: missing });
  if (totals.lines.length === 0) return fail('empty');
  if (!delivery) return fail('no-delivery-mode');
  if (delivery === 'delivery' && missing > 0) return fail('below-minimum');
  if (cleanText(customer.name, CUSTOMER_NAME_MAX).length < MIN_NAME_LENGTH) return fail('missing-name');
  if (delivery === 'delivery' && cleanText(customer.address, CUSTOMER_ADDRESS_MAX).length < MIN_ADDRESS_LENGTH) {
    return fail('missing-address');
  }
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
