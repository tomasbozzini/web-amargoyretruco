import { expect, test } from '@playwright/test';

test('escritorio: navegación visible, panel lateral y sin botón flotante', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
  await expect(page.locator('[data-whatsapp-fab]')).toBeHidden();

  await page.locator('[data-product]').first().locator('[data-add]').click();
  await page.locator('header [data-cart-open]').click();
  const panel = page.locator('[data-cart-dialog]');
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.width < viewport.width / 2).toBeTruthy();
  expect(box && viewport && Math.round(box.x + box.width)).toBe(viewport?.width);

  // Click en el fondo cierra el panel.
  await page.mouse.click(20, 300);
  await expect(panel).toBeHidden();
});
