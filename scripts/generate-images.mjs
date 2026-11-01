#!/usr/bin/env node
/**
 * Genera public/og-image.png (1200x630, para compartir en WhatsApp/Instagram)
 * y public/apple-touch-icon.png (180x180) con Playwright.
 * Si existe public/logo.svg lo usa; si no, el logo tipográfico "A y R".
 *
 * Uso: npm run images
 */
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const logoPath = new URL('public/logo.svg', root);
const logoDataUri = existsSync(logoPath)
  ? `data:image/svg+xml;base64,${readFileSync(logoPath).toString('base64')}`
  : null;

const fonts =
  '<link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Bebas+Neue&family=DM+Sans:wght@500;700&display=block" rel="stylesheet">';

const typoLogo = (size) =>
  `<div style="font-family:'Abril Fatface';font-size:${size}px;line-height:1;color:#1E3A2B;display:flex;align-items:baseline">A<span style="font-style:italic;color:#B5543A;margin:0 .12em">y</span>R</div>`;
const logo = (size) => (logoDataUri ? `<img src="${logoDataUri}" style="width:${size * 1.6}px;height:${size * 1.6}px;object-fit:contain">` : typoLogo(size));

const suit = {
  espada: '<path d="M12 1.5 14 5v9.5h-4V5Z"/><path d="M6.5 14.5h11v2h-11Z"/><path d="M11 16.5h2v4.2h-2Z"/><circle cx="12" cy="21.6" r="1.4"/>',
  oro: '<path fill-rule="evenodd" d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Zm0 3.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name, size, color) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}">${suit[name]}</svg>`;

const card = (inner, style) =>
  `<div style="position:absolute;width:230px;height:322px;border-radius:22px;background:#FBF7EE;box-shadow:inset 0 0 0 8px #FBF7EE, inset 0 0 0 10px rgba(181,84,58,.4), 0 30px 60px -20px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;${style}">${inner}</div>`;

const ogHtml = `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
  *{margin:0;box-sizing:border-box} body{width:1200px;height:630px;overflow:hidden;background:#1E3A2B;font-family:'DM Sans';color:#F3EBD8;position:relative}
  .dots{position:absolute;inset:0;background-image:radial-gradient(circle at 20% 30%, rgba(243,235,216,.07) 0 2px, transparent 3px),radial-gradient(circle at 70% 60%, rgba(243,235,216,.05) 0 1.5px, transparent 2.5px);background-size:46px 46px,34px 34px}
</style></head><body><div class="dots"></div>
  <div style="position:absolute;left:72px;top:118px;width:640px">
    <div style="font-family:'Bebas Neue';font-size:34px;letter-spacing:.08em;color:#E9A58F">AMARGO Y RETRUCO · TANDIL</div>
    <div style="font-family:'Abril Fatface';font-size:84px;line-height:1.02;margin-top:14px">Mate y truco,<br><span style="font-style:italic;color:#E9A58F">cosa seria.</span></div>
    <div style="font-size:28px;margin-top:30px;color:rgba(243,235,216,.92)">Delivery en Tandil<br>Retiro en zona Campus universitario<br>Pedidos por WhatsApp</div>
  </div>
  <div style="position:absolute;right:110px;top:150px;width:230px;height:322px">
    ${card(`<div style="position:absolute;top:50%;left:16px;transform:translateY(-50%)">${icon('espada', 48, 'rgba(181,84,58,.85)')}</div>`, 'transform:translateX(-70px) rotate(-14deg);transform-origin:bottom center')}
    ${card(`<div style="position:absolute;top:50%;right:16px;transform:translateY(-50%)">${icon('oro', 48, 'rgba(107,74,47,.85)')}</div>`, 'transform:translateX(70px) rotate(14deg);transform-origin:bottom center')}
    ${card(logo(92), '')}
  </div>
</body></html>`;

const iconHtml = `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>*{margin:0} body{width:180px;height:180px;background:#F3EBD8;display:flex;align-items:center;justify-content:center}</style></head>
<body>${logoDataUri ? `<img src="${logoDataUri}" style="width:150px;height:150px;object-fit:contain">` : typoLogo(78)}</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(ogHtml, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL('public/og-image.png', root).pathname });

  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(iconHtml, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL('public/apple-touch-icon.png', root).pathname });
  console.log(`Listo: public/og-image.png y public/apple-touch-icon.png (${logoDataUri ? 'con public/logo.svg' : 'con el logo tipográfico'}).`);
} finally {
  await browser.close();
}
