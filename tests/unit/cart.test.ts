import { describe, expect, it } from 'vitest';
import {
  addItem,
  checkOrder,
  clearLegacyCart,
  computeTotals,
  emptyCart,
  LEGACY_STORAGE_KEY,
  removeItem,
  setQuantity,
  type CartProduct,
} from '../../src/lib/cart';

const baldo: CartProduct = { id: 'baldo-500', brand: 'Baldo', name: 'Baldo Tradicional', presentation: '500 g', price: 8600, stock: 6 };
const serena: CartProduct = { id: 'serena-500', brand: 'Canarias', name: 'Canarias Serena', presentation: '500 g', price: 9200, stock: 2 };
const agotada: CartProduct = { id: 'rei-500', brand: 'Rei Verde', name: 'Rei Verde Tradicional', presentation: '500 g', price: 7400, stock: 0 };
const catalog = new Map([baldo, serena, agotada].map((p) => [p.id, p]));

describe('carrito', () => {
  it('agrega y suma cantidades', () => {
    let cart = addItem(emptyCart(), baldo);
    cart = addItem(cart, baldo);
    expect(cart.items).toEqual({ 'baldo-500': 2 });
  });

  it('no supera el stock', () => {
    let cart = emptyCart();
    for (let i = 0; i < 5; i += 1) cart = addItem(cart, serena);
    expect(cart.items['serena-500']).toBe(2);
    expect(setQuantity(cart, serena, 99).items['serena-500']).toBe(2);
  });

  it('no permite agregar productos agotados', () => {
    expect(addItem(emptyCart(), agotada).items).toEqual({});
  });

  it('cantidad 0 o negativa quita el producto', () => {
    const cart = addItem(emptyCart(), baldo);
    expect(setQuantity(cart, baldo, 0).items).toEqual({});
    expect(setQuantity(cart, baldo, -3).items).toEqual({});
    expect(removeItem(cart, baldo.id).items).toEqual({});
  });

  it('calcula totales con precios del catálogo', () => {
    let cart = setQuantity(emptyCart(), baldo, 2);
    cart = setQuantity(cart, serena, 1);
    const totals = computeTotals(cart, catalog);
    expect(totals.count).toBe(3);
    expect(totals.total).toBe(8600 * 2 + 9200);
    expect(totals.lines.map((l) => l.lineTotal)).toEqual([17200, 9200]);
  });
});

describe('mínimo de delivery', () => {
  const MIN = 20000;

  it('pide elegir tipo de entrega', () => {
    const totals = computeTotals(setQuantity(emptyCart(), baldo, 3), catalog);
    expect(checkOrder(totals, null, MIN)).toMatchObject({ ok: false, reason: 'no-delivery-mode' });
  });

  it('bloquea delivery por debajo del mínimo e informa cuánto falta', () => {
    const totals = computeTotals(setQuantity(emptyCart(), baldo, 2), catalog); // 17.200
    expect(checkOrder(totals, 'delivery', MIN)).toEqual({ ok: false, reason: 'below-minimum', missingForDelivery: 2800 });
  });

  it('permite retiro aunque no llegue al mínimo', () => {
    const totals = computeTotals(setQuantity(emptyCart(), baldo, 1), catalog);
    expect(checkOrder(totals, 'pickup', MIN).ok).toBe(true);
  });

  it('permite delivery al llegar justo al mínimo', () => {
    const totals = computeTotals(setQuantity(emptyCart(), baldo, 3), catalog); // 25.800
    expect(checkOrder(totals, 'delivery', MIN)).toEqual({ ok: true, reason: null, missingForDelivery: 0 });
    const exact = { lines: [], count: 0, total: MIN };
    expect(checkOrder({ ...exact, lines: totals.lines }, 'delivery', MIN).ok).toBe(true);
  });

  it('carrito vacío no se puede enviar', () => {
    expect(checkOrder(computeTotals(emptyCart(), catalog), 'pickup', MIN)).toMatchObject({ ok: false, reason: 'empty' });
  });
});

describe('sin persistencia', () => {
  it('borra el pedido que guardaban versiones anteriores', () => {
    const store = new Map<string, string>([
      [LEGACY_STORAGE_KEY, JSON.stringify({ items: { 'baldo-500': 2 }, delivery: 'pickup' })],
      ['otra-clave', 'se queda'],
    ]);
    clearLegacyCart({ removeItem: (key: string) => void store.delete(key) });
    expect(store.has(LEGACY_STORAGE_KEY)).toBe(false);
    expect(store.get('otra-clave')).toBe('se queda');
  });

  it('si localStorage está bloqueado (modo privado), no rompe', () => {
    const broken = {
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => clearLegacyCart(broken)).not.toThrow();
    expect(() => clearLegacyCart(null)).not.toThrow();
  });
});
