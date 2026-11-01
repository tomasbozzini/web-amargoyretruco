/**
 * Armado del mensaje de pedido para WhatsApp (se arma en el navegador).
 */
import type { CartTotals, DeliveryMode } from './cart';
import { formatPricePlain } from './price';
import { cleanText, fullProductName } from './text';

export interface OrderMessageInput {
  businessName: string;
  totals: CartTotals;
  delivery: DeliveryMode;
  pickupArea: string;
  city: string;
  customerName?: string;
  customerZone?: string;
  disclaimer: string;
}

export const CUSTOMER_FIELD_MAX = 60;

export function buildOrderMessage(input: OrderMessageInput): string {
  const name = cleanText(input.customerName ?? '', CUSTOMER_FIELD_MAX);
  const zone = cleanText(input.customerZone ?? '', CUSTOMER_FIELD_MAX);

  const items = input.totals.lines.map(({ product, quantity, lineTotal }) => {
    const label = fullProductName(product.brand, product.name);
    const presentation = product.presentation ? ` (${product.presentation})` : '';
    const unit = formatPricePlain(product.price);
    const subtotal = quantity > 1 ? ` = ${formatPricePlain(lineTotal)}` : '';
    return `• ${quantity} x ${label}${presentation} - ${unit} c/u${subtotal}`;
  });

  const deliveryText =
    input.delivery === 'delivery' ? `Delivery en ${input.city}` : `Retiro en ${input.pickupArea}`;

  const lines = [
    `¡Hola ${input.businessName}! 🧉 Quiero hacer este pedido:`,
    '',
    ...items,
    '',
    `*Total: ${formatPricePlain(input.totals.total)}*`,
    `Entrega: ${deliveryText}`,
  ];
  if (name) lines.push(`Nombre: ${name}`);
  if (zone) lines.push(`Zona/barrio: ${zone}`);
  lines.push('', `_${input.disclaimer}._`);

  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, '')}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
