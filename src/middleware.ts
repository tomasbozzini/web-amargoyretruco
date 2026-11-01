import { defineMiddleware } from 'astro:middleware';
import { SECURITY_HEADERS } from './lib/security-headers';

/**
 * Agrega los headers de seguridad a las respuestas del servidor.
 * En desarrollo no se aplican porque Vite necesita scripts y estilos inline.
 */
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (import.meta.env.PROD) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(name, value);
    }
  }
  return response;
});
