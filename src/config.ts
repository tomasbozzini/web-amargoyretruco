/**
 * Datos fijos del negocio. Este es el archivo para editar a mano.
 * Lo marcado con `TODO` está pendiente de definir.
 *
 * Ojo: todo lo que esté acá puede terminar en el navegador. No pongas claves,
 * alias, CBU ni nada privado. La URL del CSV va en la variable de entorno
 * CATALOG_CSV_URL (ver README), no acá.
 */

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
 * TODO: definir el valor real. 20000 es PROVISORIO.
 */
export const MIN_DELIVERY_AMOUNT = 20000;

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
/* Pausa de ventas                                                     */
/* ------------------------------------------------------------------ */

/**
 * Pausa de ventas (por ejemplo, mientras llega la mercadería).
 * true  = el catálogo se ve, pero con un cartel y sin poder agregar nada al pedido.
 * false = se vende normalmente.
 * Para volver a vender: poné `false`, guardá y publicá (push).
 */
export const SALES_PAUSED = true;
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
