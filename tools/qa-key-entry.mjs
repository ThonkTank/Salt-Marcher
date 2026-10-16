/** Follow the current Atlas controls before opening the ordinary room-key editor. */
export async function openDesktopKeyFromAtlas(page){
 if(await page.locator('#campaign-atlas').isVisible()){
  await page.locator('#atlas-families button[data-family=interior]').click();
  const advanced=page.locator('#atlas-advanced');
  if(await advanced.getAttribute('open')===null)await advanced.locator(':scope > summary').click();
 }
 await page.locator('#key-open').click();
}
