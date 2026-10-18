/** Follow the current Atlas controls before opening the ordinary room-key editor. */
export async function openDesktopKeyFromAtlas(page){
 if(await page.locator('#campaign-atlas').isVisible()){
  await page.locator('#atlas-families button[data-family=interior]').click();
  const advanced=page.locator('#atlas-advanced');
  if(await advanced.getAttribute('open')===null)await advanced.locator(':scope > summary').click();
 }
 await page.locator('#key-open').click();
}

/** Existing sources stay visible beside the room text; adding uses the bounded search. */
export async function openDesktopKeyReferences(page){
 await page.locator('#key-reference-section').scrollIntoViewIfNeeded();
}
export async function linkDesktopKeyReference(page,label){
 const picker=page.locator('#key-reference-picker');
 if(await picker.getAttribute('open')===null)await picker.locator(':scope > summary').click();
 await page.locator('#key-reference-query').fill(label.replace(/^[^:]+:\s*/,''));
 await page.locator('#key-reference-matches').getByRole('button',{name:label,exact:true}).click();
}
