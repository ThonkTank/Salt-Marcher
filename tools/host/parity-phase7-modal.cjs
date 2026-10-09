const SELECTOR = ".modal-container .modal";

async function withDungeonContentModal({ browser, page, fs, path, out, sleep }, action) {
  let found, observed = [];
  for (let attempt = 0; attempt < 120 && !found; attempt++) {
    const matches = [];
    observed = [];
    for (const candidate of browser.contexts().flatMap((context) => context.pages())) {
      if (candidate.isClosed()) continue;
      const modals = candidate.locator(SELECTOR).filter({ hasText: "Dungeon-Inhalte" });
      const count = await modals.count();
      observed.push({ url: candidate.url(), contentModals: count });
      for (let index = 0; index < count; index++) {
        const modal = modals.nth(index);
        if (await modal.getByRole("button", { name: "Vorkommen anlegen", exact: true }).count())
          matches.push({ owner: candidate, modal });
      }
    }
    if (matches.length > 1)
      throw new Error("Mehrere Dungeon-Inhalte-Dialoge: " + JSON.stringify(observed));
    found = matches[0];
    if (!found) await sleep(100);
  }
  if (!found)
    throw new Error("Dungeon-Inhalte-Dialog fehlt: " + JSON.stringify(observed));

  const { owner, modal } = found;
  fs.writeFileSync(path.join(out, "p7-content-dialog-window.json"), JSON.stringify({
    mainUrl: page.url(), modalUrl: owner.url(), separateWindow: owner !== page,
    matchedDialog: "Dungeon-Inhalte / Vorkommen anlegen",
  }, null, 2));
  await owner.bringToFront();
  let result, failure;
  try { result = await action(owner, modal); }
  catch (error) { failure = error; }
  try {
    if (!owner.isClosed() && await modal.count()) await owner.keyboard.press("Escape");
  } catch (error) { failure ??= error; }
  try { if (!page.isClosed()) await page.bringToFront(); }
  catch (error) { failure ??= error; }
  if (failure) throw failure;
  return result;
}

module.exports = { withDungeonContentModal };
