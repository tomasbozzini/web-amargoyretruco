import type { APIRoute } from 'astro';

export const prerender = true;

/** Sitio de una sola página: el sitemap tiene solo la portada. */
export const GET: APIRoute = ({ site }) => {
  const home = new URL('/', site).toString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${home}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
