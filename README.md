# Amargo y Retruco: web

Web de **Amargo y Retruco**, venta de yerba mate en Tandil. Catálogo con carrito, y el pedido se cierra por WhatsApp.
La web **no cobra ni guarda datos de clientes**. Los precios y el stock salen de un Google Sheets.

- **Stack:** Astro 7 + Tailwind CSS 4 + TypeScript, con deploy en Vercel.
- **Datos:** el CSV público de la pestaña `Catalogo` del Sheets (sin base de datos ni backend propio).
- **Actualización:** un cambio en el Sheets se ve en la web en unos minutos, sin redeploy.

---

## 1. Correr el proyecto en tu compu

Necesitás **Node.js 22** (22.23.4 o más nuevo).

```bash
npm install
```

```bash
cp .env.example .env
```

Abrí `.env` y pegá la URL del CSV (ver punto 2). Después:

```bash
npm run dev
```

Se abre en <http://localhost:4321>. Si no definís `CATALOG_CSV_URL`, la web usa el catálogo de respaldo (`src/data/fallback-catalog.json`).

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (para Vercel) |
| `npm test` | Tests unitarios (precios, CSV, carrito, mensaje de WhatsApp, seguridad) |
| `npm run test:e2e` | Tests end-to-end en un navegador real (ver punto 9) |
| `npm run check` | Chequeo de tipos |
| `npm run fallback:update` | Actualiza el catálogo de respaldo desde el Sheets |
| `npm run images` | Regenera la imagen para compartir y el ícono (después de agregar el logo) |

---

## 2. Publicar el Sheets como CSV

La web solo lee el **CSV público de la pestaña `Catalogo`**. Nunca ve el resto del Sheets.

1. Abrí el Sheets **"Amargo y Retruco - Catálogo web"**.
2. **Archivo → Compartir → Publicar en la web**.
3. En "Vínculo", en el primer desplegable elegí **solo la pestaña `Catalogo`** (no "Todo el documento").
4. En el segundo desplegable elegí **Valores separados por comas (.csv)**.
5. En "Contenido publicado y configuración", dejá tildado **"Volver a publicar automáticamente cuando se realicen cambios"**.
6. Tocá **Publicar** y copiá la URL. Termina en `output=csv`, por ejemplo:
   `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv`

> ⚠️ **Importante:** lo publicado lo puede ver cualquiera que tenga el link. Publicá **solo** la pestaña `Catalogo` y no pongas costos, márgenes ni datos privados en esa pestaña. Si tenés otras pestañas con costos, no las publiques.

## 3. Configurar `CATALOG_CSV_URL` en Vercel

1. En Vercel: tu proyecto → **Settings → Environment Variables**.
2. Agregá `CATALOG_CSV_URL` con la URL del punto 2, para **Production** y **Preview**.
3. Hacé un **Redeploy** (solo esta vez: los cambios de variables de entorno necesitan un deploy nuevo).

La variable se lee **solo en el servidor**; nunca llega al navegador.

### Deploy

- **Opción A (recomendada):** en <https://vercel.com/new> importá este repositorio. Vercel detecta Astro solo. Cada push a la rama principal se publica automáticamente.
- **Opción B (desde la terminal):** `npx vercel deploy` (y `npx vercel deploy --prod` para producción).

No hace falta un dominio propio: la web queda en `https://<proyecto>.vercel.app`. La URL de producción se usa sola para Open Graph, sitemap y robots. Si algún día usás un dominio propio, definí `SITE_URL` en Vercel.

---

## 4. Cambiar precios, stock y fotos (desde el Sheets)

Editás el Sheets y listo. La web lo toma en unos minutos: Vercel cachea la página 5 minutos y Google también tarda unos minutos en actualizar el CSV publicado. **No hace falta redeploy.**

| Columna | Qué poner | Reglas |
| --- | --- | --- |
| `Marca` | `Baldo` | Obligatoria. Arma los filtros por marca. |
| `Producto` | `Baldo Tradicional` | Obligatoria. |
| `Presentación` | `500 g`, `1 kg` | Opcional. |
| `Precio` | `8600`, `$8.600` o `8.600,00` | Precio **por paquete**. Si está vacío, no es un número, es 0 o es mayor a $1.000.000, **la fila no se muestra**. |
| `Stock` | `6` | Entero. `0` muestra **Agotado** (no se puede agregar). `1` o `2` muestran **Últimas unidades**. Vacío o inválido cuenta como 0. El carrito no deja pedir más que el stock. |
| `Foto` | `https://...` | Opcional. Tiene que ser un link `https` a una imagen. Si falta o no carga, se muestra una ilustración con la marca. |
| `Visible` | `SI` | Solo se muestran las filas con `SI`. Para esconder un producto sin borrarlo, poné `NO`. |

**Fotos:** lo ideal es una imagen cuadrada (por ejemplo 800×800). Sirve cualquier link `https` directo a la imagen. También podés usar un link de **Google Drive**: subí la foto, tocá **Compartir → Cualquier persona con el enlace** y pegá el link en la columna `Foto`; la web lo convierte sola.

**Agregar una marca o un producto:** sumá una fila nueva con todas las columnas. Los filtros por marca se actualizan solos.

### Si el Sheets falla

La página no se rompe nunca:

1. Si el Sheets no responde, usa la **última copia buena** que tenga en memoria.
2. Si no tiene ninguna, usa `src/data/fallback-catalog.json` y avisa que la lista puede no estar actualizada.
3. Si tampoco hay productos válidos, muestra un mensaje con un botón para pedir la lista por WhatsApp.

Para actualizar el respaldo con lo que hay en el Sheets (conviene hacerlo de vez en cuando y commitear el cambio):

```bash
npm run fallback:update
```

---

## 5. Datos fijos: `src/config.ts`

Todo lo editable a mano está en **`src/config.ts`**, con comentarios:

- `WHATSAPP_NUMBER`, `INSTAGRAM_URL`: contacto.
- `MIN_DELIVERY_AMOUNT`: compra mínima para delivery (**provisorio: 20000**).
- `PICKUP_AREA`: zona de retiro (`zona Campus universitario`). La dirección exacta no se publica.
- `BUSINESS_HOURS`: horarios (`null` = "los coordinamos por WhatsApp").
- `DELIVERY_FEE_INFO`: texto sobre el costo del envío (hoy: "El delivery es sin cargo."; `null` = no se muestra).
- `LOW_STOCK_THRESHOLD`, `MAX_REASONABLE_PRICE`, `CATALOG_CACHE_CONTROL`: reglas del catálogo.

Lo pendiente está marcado con `// TODO`.

> No pongas alias, CBU ni claves en `config.ts`: todo lo que está ahí puede llegar al navegador.

### Intro al entrar

Al entrar a la web aparece una intro corta (un termo ceba un mate, unos 2,5 segundos). Se saltea tocando la pantalla, no se repite si recargás en la misma pestaña y no se muestra si el celular tiene activado "reducir movimiento". Para sacarla: `SHOW_INTRO = false` en `src/config.ts`.

### Pausar las ventas (por ejemplo, mientras llega la yerba)

En `src/config.ts`:

- `SALES_PAUSED = true`: el catálogo se sigue viendo, pero arriba aparece el cartel **"Muy pronto renovamos stock"**, los botones dicen "Muy pronto" y no se puede agregar nada al pedido. También se oculta el botón "Pedido".
- `SALES_PAUSED = false`: se vende normalmente.

El título y el texto del cartel están en `SALES_PAUSED_TITLE` y `SALES_PAUSED_TEXT`. Después de cambiarlo, hay que publicar (push) para que Vercel lo despliegue.
También se puede pisar desde Vercel con la variable de entorno `SALES_PAUSED` (`true` o `false`) y un redeploy, sin tocar el código.

## 6. "Quiénes somos"

Editá **`src/content/quienes-somos.md`**. Es Markdown: párrafos separados por una línea en blanco, `**negrita**` y `*cursiva*`. Arriba (entre los `---`) podés cambiar el título y la etiqueta.

## 7. Logo

Copiá tu logo a **`public/logo.svg`**. Si no existe, se usa el logo tipográfico "A y R" (con la "y" en cursiva terracota). Después de agregarlo:

```bash
npm run images
```

Regenera `public/og-image.png` (la imagen que aparece al compartir el link en WhatsApp o Instagram) y `public/apple-touch-icon.png`. El favicon está en `public/favicon.svg`.

---

## 8. Cómo funciona el pedido

1. La persona elige yerbas y cantidades (con un máximo igual al stock).
2. En el carrito elige **Delivery sin cargo en Tandil** o **Retiro en zona Campus universitario**.
   - Si elige delivery y el total no llega a `MIN_DELIVERY_AMOUNT`, la web le muestra cuánto falta, **bloquea el pedido con delivery** y le ofrece cambiar a retiro.
3. El **nombre es obligatorio**. Si elige delivery, también tiene que poner la **dirección de entrega**; si elige retiro, solo el nombre. Hasta completarlos, el botón de WhatsApp no se habilita. Estos datos **no se guardan**: solo se agregan al mensaje.
4. El botón **Pedir por WhatsApp** abre `wa.me/5491133907596` con el mensaje armado: saludo, productos (cantidad × producto, presentación, precio), total, entrega, nombre, dirección (solo delivery) y la leyenda **"Precios y stock sujetos a confirmación por WhatsApp"**.

El pedido **no se guarda**: vive solo mientras la página está abierta. Si se recarga la página o se vuelve a entrar otro día, arranca vacío. Los precios salen del catálogo cargado en la página. Como el mensaje se arma en el navegador, alguien podría modificarlo: por eso siempre lleva la leyenda de confirmación y los precios se confirman por WhatsApp.

## 9. Tests

```bash
npm test
```

```bash
npm run test:e2e
```

Los end-to-end hacen el build de producción y lo prueban en Chromium contra un **Sheets simulado** (`tests/e2e/mock-sheet-server.mjs`) que lee `tests/fixtures/catalogo-prueba.csv`. **Los precios de ese archivo son de prueba, no son reales.** La primera vez puede hacer falta instalar el navegador: `npx playwright install chromium`.

Cubren: catálogo y estados de stock, texto del Sheets mostrado como texto plano, foto rota con ilustración de reemplazo, filtros, buscador y orden, carrito con mínimo de delivery y mensaje de WhatsApp, límite de stock, pedido que se reinicia al recargar, `localStorage` bloqueado, headers de seguridad, SEO, y el Sheets caído (con y sin copia en memoria).

## 10. Seguridad

- Todo el texto del Sheets se muestra como **texto plano**, con largo limitado y sin caracteres de control. En el cliente se usa `textContent`, nunca `innerHTML`. Un test lo verifica.
- Sin claves en el cliente. La URL del CSV solo la conoce el servidor.
- Headers en `vercel.json` y `src/middleware.ts` (deben coincidir; un test lo verifica): CSP estricta (`script-src 'self'`, sin `unsafe-inline`; imágenes `https:`; Google Fonts), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` y `frame-ancestors`, `Permissions-Policy`.
- Todos los links externos llevan `rel="noopener noreferrer"`.
- Para verificar los headers después del deploy: `curl -I https://<proyecto>.vercel.app`.

## Estructura

```
src/
  config.ts                 ← datos fijos editables (TODOs)
  content/quienes-somos.md  ← texto de "Quiénes somos"
  data/fallback-catalog.json← respaldo del catálogo
  lib/                      ← lógica: CSV, precios, catálogo, carrito, WhatsApp, headers
  scripts/app.ts            ← JS del navegador (filtros + carrito)
  components/               ← secciones de la página
  layouts/Base.astro        ← <head>, SEO, Open Graph, JSON-LD
  pages/                    ← portada (SSR), 404, robots.txt, sitemap.xml
public/                     ← favicon, imagen para compartir, (logo.svg)
scripts/                    ← actualizar respaldo, generar imágenes
tests/                      ← unitarios, end-to-end y datos de prueba
```
