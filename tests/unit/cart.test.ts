import { describe, expect, it } from 'vitest';
import {
  addItem,
  checkOrder,
  computeTotals,
  emptyCart,
  loadCart,
  parseStoredCart,
  reconcile,
  removeItem,
  saveCart,
  setQuantity,
  STORAGE_KEY,
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

  it('reconcile: quita lo que ya no existe o está agotado y ajusta al stock actual', () => {
    const stored = { items: { 'baldo-500': 3, 'serena-500': 10, 'rei-500': 1, 'ya-no-existe': 2 }, delivery: 'delivery' as const };
    expect(reconcile(stored, catalog)).toEqual({ items: { 'baldo-500': 3, 'serena-500': 2 }, delivery: 'delivery' });
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

describe('persistencia', () => {
  it('ignora datos corruptos o manipulados', () => {
    expect(parseStoredCart(null)).toEqual(emptyCart());
    expect(parseStoredCart('{no es json')).toEqual(emptyCart());
    expect(parseStoredCart('"texto"')).toEqual(emptyCart());
    expect(
      parseStoredCart(JSON.stringify({ items: { 'baldo-500': 2, '<script>': 1, x: -1, y: 1.5, z: '3' }, delivery: 'helicoptero', price: 1 })),
    ).toEqual({ items: { 'baldo-500': 2 }, delivery: null });
  });

  it('no guarda precios ni datos personales', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    saveCart(storage, { items: { 'baldo-500': 2 }, delivery: 'pickup' });
    expect(JSON.parse(store.get(STORAGE_KEY) ?? '')).toEqual({ items: { 'baldo-500': 2 }, delivery: 'pickup' });
    expect(loadCart(storage)).toEqual({ items: { 'baldo-500': 2 }, delivery: 'pickup' });
  });

  it('si localStorage falla (modo privado, bloqueado), sigue funcionando en memoria', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadCart(broken)).toEqual(emptyCart());
    expect(() => saveCart(broken, emptyCart())).not.toThrow();
    expect(loadCart(null)).toEqual(emptyCart());
  });
});
