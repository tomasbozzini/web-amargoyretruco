/// <reference types="astro/client" />

/** true si existe public/logo.svg al momento del build (ver astro.config.mjs). */
declare const __HAS_LOGO__: boolean;

/** true si el build corre en Vercel: se carga Vercel Web Analytics (ver astro.config.mjs). */
declare const __VERCEL_ANALYTICS__: boolean;
