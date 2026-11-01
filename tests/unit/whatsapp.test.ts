import { describe, expect, it } from 'vitest';
import { computeTotals, setQuantity, emptyCart, type CartProduct } from '../../src/lib/cart';
import { buildOrderMessage, buildWhatsAppUrl } from '../../src/lib/whatsapp';

const baldo: CartProduct = { id: 'baldo', brand: 'Baldo', name: 'Baldo Tradicional', presentation: '500 g', price: 8600, stock: 6 };
const verdecita: CartProduct = { id: 'verdecita', brand: 'Verdecita', name: 'Clásica', presentation: '1 kg', price: 7000, stock: 3 };
const catalog = new Map([baldo, verdecita].map((p) => [p.id, p]));
const DISCLAIMER = 'Precios y stock sujetos a confirmación por WhatsApp';

function totalsFor(items: [CartProduct, number][]) {
  let cart = emptyCart();
  for (const [product, qty] of items) cart = setQuantity(cart, product, qty);
  return computeTotals(cart, catalog);
}

const base = {
  businessName: 'Amargo y Retruco',
  pickupArea: 'zona Campus',
  city: 'Tandil',
  disclaimer: DISCLAIMER,
};

describe('buildOrderMessage', () => {
  it('arma el pedido completo con delivery', () => {
    const message = buildOrderMessage({
      ...base,
      totals: totalsFor([
        [baldo, 2],
        [verdecita, 1],
      ]),
      delivery: 'delivery',
      customerName: 'Juan',
      customerZone: 'Centro',
    });
    expect(message).toBe(
      [
        '¡Hola Amargo y Retruco! 🧉 Quiero hacer este pedido:',
        '',
        '• 2 x Baldo Tradicional (500 g) - $ 8.600 c/u = $ 17.200',
        '• 1 x Verdecita Clásica (1 kg) - $ 7.000 c/u',
        '',
        '*Total: $ 24.200*',
        'Entrega: Delivery en Tandil',
        'Nombre: Juan',
        'Zona/barrio: Centro',
        '',
        `_${DISCLAIMER}._`,
      ].join('\n'),
    );
  });

  it('retiro, sin nombre ni zona', () => {
    const message = buildOrderMessage({ ...base, totals: totalsFor([[baldo, 1]]), delivery: 'pickup' });
    expect(message).toContain('Entrega: Retiro en zona Campus');
    expect(message).not.toContain('Nombre:');
    expect(message).not.toContain('Zona/barrio:');
    expect(message).toContain(DISCLAIMER);
  });

  it('limpia nombre y zona (saltos de línea, largo)', () => {
    const message = buildOrderMessage({
      ...base,
      totals: totalsFor([[baldo, 1]]),
      delivery: 'pickup',
      customerName: 'Ana\n\nTotal: $ 1',
      customerZone: 'x'.repeat(300),
    });
    expect(message).toContain('Nombre: Ana Total: $ 1');
    const zoneLine = message.split('\n').find((l) => l.startsWith('Zona/barrio:')) ?? '';
    expect(zoneLine.length).toBeLessThanOrEqual('Zona/barrio: '.length + 60);
  });
});

describe('buildWhatsAppUrl', () => {
  it('codifica el mensaje con encodeURIComponent', () => {
    const url = buildWhatsAppUrl('5491133907596', 'Hola & chau\n¿Total? $ 8.600 #1');
    expect(url).toBe(`https://wa.me/5491133907596?text=${encodeURIComponent('Hola & chau\n¿Total? $ 8.600 #1')}`);
    expect(new URL(url).searchParams.get('text')).toBe('Hola & chau\n¿Total? $ 8.600 #1');
  });

  it('sin mensaje, link directo', () => {
    expect(buildWhatsAppUrl('+54 9 11 3390-7596')).toBe('https://wa.me/5491133907596');
  });
});
