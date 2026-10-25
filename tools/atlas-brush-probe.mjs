/** Native probes that require a particular world footprint use the visible fixed-size controls. */
export async function setBrushWorldRadius(page, id, value) {
  await page.locator('#' + id + '-fixed').check();
  await page.locator('#' + id + '-value').fill(String(value));
  await page.locator('#' + id + '-value').press('Tab');
}
export async function setHeightDirection(page, direction) {
  await page.locator(`#land-height-direction [data-direction="${direction}"]`).click();
}
export async function openTerrainDisplay(page) {
  if (!(await page.locator('#atlas-display-popup').isVisible()))
    await page.locator('#atlas-display').click();
  if (!(await page.locator('#land-relief-style').evaluate((n) => n.open)))
    await page.locator('#land-relief-style summary').click();
}
export async function setTerrainContours(page, interval) {
  await openTerrainDisplay(page);
  await page.locator('#land-contours').selectOption(interval);
  await page.keyboard.press('Escape');
}
