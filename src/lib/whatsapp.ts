/**
 * Armado del mensaje de pedido para WhatsApp (se arma en el navegador).
 */
import { CUSTOMER_ADDRESS_MAX, CUSTOMER_NAME_MAX, type CartTotals, type DeliveryMode } from './cart';
import { formatPricePlain } from './price';
import { cleanText, fullProductName } from './text';

export interface OrderMessageInput {
  businessName: string;
  totals: CartTotals;
  delivery: DeliveryMode;
  pickupArea: string;
  city: string;
  customerName?: string;
  /** Solo se incluye si la entrega es delivery. */
  customerAddress?: string;
  disclaimer: string;
}

export function buildOrderMessage(input: OrderMessageInput): string {
  const name = cleanText(input.customerName ?? '', CUSTOMER_NAME_MAX);
  const address = input.delivery === 'delivery' ? cleanText(input.customerAddress ?? '', CUSTOMER_ADDRESS_MAX) : '';

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
  if (address) lines.push(`Dirección: ${address}`);
  lines.push('', `_${input.disclaimer}._`);

  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, '')}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
