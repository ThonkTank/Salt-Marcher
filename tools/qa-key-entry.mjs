/** Follow the current Atlas controls before opening the ordinary room-key editor. */
export async function openDesktopKeyFromAtlas(page, roomName) {
  if (await page.locator('#campaign-atlas').isVisible()) {
    await page.locator('#atlas-section').selectOption('interior');
    if (roomName) {
      await page.locator('#atlas-search').fill(roomName);
      const escaped = roomName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await page
        .locator('#atlas-search-results button')
        .filter({ hasText: new RegExp('^[^·]* · ' + escaped + '$') })
        .first()
        .click();
    }
  }
  await page.locator('#key-open').click();
}

/** Existing sources stay visible beside the room text; adding uses the bounded search. */
export async function openDesktopKeyReferences(page) {
  await page.locator('#key-reference-section').scrollIntoViewIfNeeded();
}
export async function linkDesktopKeyReference(page, label) {
  const picker = page.locator('#key-reference-picker');
  if ((await picker.getAttribute('open')) === null)
    await picker.locator(':scope > summary').click();
  await page.locator('#key-reference-query').fill(label.replace(/^[^:]+:\s*/, ''));
  await page
    .locator('#key-reference-matches')
    .getByRole('button', { name: label, exact: true })
    .click();
}

/** Switch rooms through the visible Atlas search, flushing the current key first. */
export async function selectDesktopKeyRoom(page, roomName) {
  if (await page.locator('#key-dialog').isVisible()) {
    await page.locator('#key-close').click();
    await page.locator('#key-dialog').waitFor({ state: 'hidden' });
  }
  await openDesktopKeyFromAtlas(page, roomName);
  await page.waitForFunction(
    (name) => document.getElementById('key-name').value === name,
    roomName,
  );
}

/** Room creation lives in the Atlas analysis controls, beside its room directory. */
export async function addDesktopKeyRoom(page) {
  await page.locator('#key-close').click();
  await page.locator('#key-dialog').waitFor({ state: 'hidden' });
  await page.locator('#atlas-analysis-open').click();
  await page.locator('#add-room').click();
  await page.waitForFunction(() =>
    document.getElementById('status').textContent.includes('Raum angelegt und gespeichert.'),
  );
  await page.locator('#rooms button[aria-pressed="true"]').click();
  await page.locator('#key-open').click();
  await page.locator('#key-name').waitFor({ state: 'visible' });
}

/** The visible Dungeon Binder searches authored key text and linked source labels. */
export async function searchDesktopKeyRooms(page, query, names) {
  await page.locator('#key-close').click();
  await page.locator('#key-dialog').waitFor({ state: 'hidden' });
  await page.locator('#atlas-analysis-open').click();
  await page.locator('#dungeon-binder-open').click();
  await page.locator('#dungeon-binder-search').fill(query);
  await page.waitForFunction((expected) => {
    const buttons = [...document.querySelectorAll('#dungeon-binder-list button')];
    return (
      buttons.length === expected.length &&
      expected.every((name) =>
        buttons.some((button) => button.firstChild?.textContent.includes(name)),
      )
    );
  }, names);
  const matches = await page.locator('#dungeon-binder-list button').allTextContents();
  await page
    .locator('#dungeon-binder')
    .getByRole('button', { name: 'Schließen', exact: true })
    .click();
  await page.locator('#dungeon-binder').waitFor({ state: 'hidden' });
  return { query, names, matches };
}
