// @ts-check
import { existsSync } from 'node:fs';
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

/**
 * URL pública del sitio (Open Graph, sitemap, robots.txt).
 * 1. SITE_URL si la definís a mano.
 * 2. En Vercel, la URL de producción del proyecto (la setea Vercel sola).
 * 3. En local, localhost.
 */
const site =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:4321');

/** Si existe public/logo.svg se usa; si no, se muestra el logo tipográfico "A y R". */
const hasLogo = existsSync(new URL('./public/logo.svg', import.meta.url));

/**
 * En Vercel se usa su adaptador. Para probar el build de producción en local
 * (tests end-to-end con los headers de seguridad reales) se puede usar el de Node:
 *   ASTRO_ADAPTER=node npm run build && node dist/server/entry.mjs
 */
const adapter = process.env.ASTRO_ADAPTER === 'node' ? node({ mode: 'standalone' }) : vercel();

export default defineConfig({
  site,
  // Todo se genera estático salvo la portada, que lee el catálogo en el servidor
  // (ver `export const prerender = false` en src/pages/index.astro).
  output: 'static',
  adapter,
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
  build: {
    // CSS siempre en archivos externos: permite una CSP estricta sin 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  env: {
    schema: {
      CATALOG_CSV_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Opcional: pisa SALES_PAUSED de src/config.ts (true/false). Útil para pruebas.
      SALES_PAUSED: envField.boolean({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Nunca incrustar scripts como inline: la CSP solo permite scripts propios ('self').
      assetsInlineLimit: 0,
    },
    define: {
      __HAS_LOGO__: JSON.stringify(hasLogo),
    },
  },
});
