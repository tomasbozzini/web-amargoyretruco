/**
 * Datos fijos del negocio. Este es el archivo para editar a mano.
 * Lo marcado con `TODO` está pendiente de definir.
 *
 * Ojo: todo lo que esté acá puede terminar en el navegador. No pongas claves,
 * alias, CBU ni nada privado. La URL del CSV va en la variable de entorno
 * CATALOG_CSV_URL (ver README), no acá.
 */

import { formatPrice } from './lib/price';

export const BUSINESS = {
  name: 'Amargo y Retruco',
  /** Versión corta del nombre, la del logo. */
  shortName: 'A y R',
  city: 'Tandil',
  region: 'Buenos Aires',
  country: 'Argentina',
  countryCode: 'AR',
  tagline: 'Mate y truco, cosa seria',
  description:
    'Yerba mate de las marcas que te gustan, con delivery en Tandil o retiro en zona Campus universitario. Armá tu pedido y lo cerramos por WhatsApp.',
} as const;

/* ------------------------------------------------------------------ */
/* Contacto                                                            */
/* ------------------------------------------------------------------ */

/** Número en formato internacional, sin "+" ni espacios. */
export const WHATSAPP_NUMBER = '5491133907596';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
/** Mensaje para los botones de WhatsApp que no son del carrito. */
export const WHATSAPP_GREETING = '¡Hola Amargo y Retruco! Quería hacerles una consulta.';

export const INSTAGRAM_URL = 'https://www.instagram.com/amargoyretruco.tandil/';
export const INSTAGRAM_HANDLE = '@amargoyretruco.tandil';

/* ------------------------------------------------------------------ */
/* Entrega y pago                                                      */
/* ------------------------------------------------------------------ */

/**
 * Compra mínima (en pesos) para ofrecer delivery en Tandil.
 * Debajo de este monto solo se ofrece retiro.
 */
export const MIN_DELIVERY_AMOUNT = 15000;

/** Zona de retiro. La dirección exacta NO se publica: se coordina por WhatsApp. */
export const PICKUP_AREA = 'zona Campus universitario';

/**
 * Horarios de atención y entrega. `null` = todavía no definidos
 * (la web muestra "a coordinar por WhatsApp").
 * TODO: completar, por ejemplo 'Lunes a viernes de 10 a 20 h. Sábados de 10 a 14 h.'
 */
export const BUSINESS_HOURS: string | null = null;

/**
 * Costo del envío: se muestra en el carrito y en las preguntas frecuentes.
 * `null` = no se informa en la web (se coordina por WhatsApp).
 */
export const DELIVERY_FEE_INFO: string | null = 'El delivery es sin cargo.';

/** Nota debajo del total en el carrito (toma el mínimo de MIN_DELIVERY_AMOUNT). */
export const CART_DELIVERY_NOTE = `El delivery es sin cargo con una compra mínima de ${formatPrice(MIN_DELIVERY_AMOUNT)}.`;

export const PAYMENT_METHODS = ['Efectivo', 'Transferencia'] as const;

/* ------------------------------------------------------------------ */
/* Intro                                                               */
/* ------------------------------------------------------------------ */

/**
 * Intro al entrar (un termo ceba un mate, ~2,5 s; se saltea tocando la pantalla).
 * Se muestra una vez por pestaña y no aparece si el dispositivo pide "reducir movimiento".
 * false = sin intro.
 */
export const SHOW_INTRO = true;

/* ------------------------------------------------------------------ */
/* Modo de venta                                                       */
/* ------------------------------------------------------------------ */

export type SalesMode = 'normal' | 'encargo' | 'pausa';

/**
 * Cómo se vende ahora:
 * - 'normal'  → se vende con el stock del Sheets.
 * - 'encargo' → todavía no llegó la yerba: se arma el pedido y se manda por WhatsApp
 *               como ENCARGO, respetando el stock del Sheets (el que vas a tener).
 * - 'pausa'   → solo se ve el catálogo con un cartel; no se puede pedir nada.
 * Después de cambiarlo, guardá y publicá (push).
 */
export const SALES_MODE: SalesMode = 'normal';

/**
 * Cuándo llega la yerba (para los textos del modo 'encargo').
 * `null` = fecha sin confirmar: los textos dicen "Muy pronto".
 */
export const RESTOCK_DATE: string | null = null;

/** Cartel del catálogo en modo 'encargo'. */
export const PREORDER_TITLE = RESTOCK_DATE ? `Renovamos stock el ${RESTOCK_DATE}` : 'Muy pronto renovamos stock';
export const PREORDER_TEXT = RESTOCK_DATE
  ? `La yerba llega el ${RESTOCK_DATE}. Ya podés dejar tu encargo: armá tu pedido y mandalo por WhatsApp, y apenas llegue coordinamos la entrega.`
  : 'Ya podés dejar tu encargo: armá tu pedido y mandalo por WhatsApp. Te avisamos cuando llegue la yerba para coordinar la entrega.';

/** Aviso dentro del carrito en modo 'encargo'. */
export const PREORDER_CART_NOTE = RESTOCK_DATE
  ? `la yerba llega el ${RESTOCK_DATE}. Mandanos tu pedido y te avisamos por WhatsApp cuando esté, para coordinar la entrega.`
  : 'la yerba todavía no llegó. Mandanos tu pedido y te avisamos por WhatsApp cuando esté, para coordinar la entrega.';

/** Cartel del catálogo en modo 'pausa'. */
export const SALES_PAUSED_TITLE = 'Muy pronto renovamos stock';
export const SALES_PAUSED_TEXT =
  'Estamos esperando que llegue la yerba nueva. Mientras tanto podés mirar el catálogo y escribirnos por WhatsApp.';

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

/** Con este stock o menos se muestra "Últimas unidades". */
export const LOW_STOCK_THRESHOLD = 2;

/** Precios mayores a esto se consideran un error de carga y la fila se ignora. */
export const MAX_REASONABLE_PRICE = 1_000_000;

/** Caché del CDN de Vercel: un cambio en el Sheets se ve en unos 5 minutos sin redeploy. */
export const CATALOG_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600';

/** Tiempo máximo de espera al leer el CSV del Sheets. */
export const CATALOG_FETCH_TIMEOUT_MS = 5000;

/** Leyenda obligatoria en el carrito y en el mensaje de WhatsApp. */
export const ORDER_DISCLAIMER = 'Precios y stock sujetos a confirmación por WhatsApp';

/* ------------------------------------------------------------------ */
/* Textos derivados (no hace falta tocarlos)                           */
/* ------------------------------------------------------------------ */

export const HOURS_TEXT = BUSINESS_HOURS ?? 'Los horarios los coordinamos por WhatsApp.';
