/** Reach the real workspace navigation through its visible controls. */
export async function revealWorkspaceNavigation(page) {
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
  );
  const navigation = page.locator('#workspace-navigation');
  if (await navigation.isVisible()) return;
  const atlas = page.locator('#atlas-navigation');
  if (await atlas.isVisible()) await atlas.click();
  if (!(await navigation.isVisible())) await page.locator('#workspace-nav-summary').click();
  await navigation.waitFor({ state: 'visible' });
}

/** Choose a campaign through the start screen, including a real guarded return
 * when another campaign is already open. No hidden select or renderer mutation. */
export async function openNativeCampaign(page, campaignId) {
  const card = page.locator('.campaign-card[data-campaign-id="' + campaignId + '"]');
  if (!(await card.isVisible())) {
    await revealWorkspaceNavigation(page);
    await page.locator('#campaign-header-name').click();
    await card.waitFor({ state: 'visible' });
  }
  await card.getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ }).click();
  await page.waitForFunction(
    (id) =>
      document.querySelector('#campaigns').value === id && !document.querySelector('main').inert,
    campaignId,
  );
  await revealWorkspaceNavigation(page);
}
