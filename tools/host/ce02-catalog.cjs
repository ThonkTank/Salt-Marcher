const VIEW = "dungeon-creature-catalog";
const SECTIONS = [
  ["creatures", "Monster"],
  ["items", "Items"],
  ["savedEncounters", "Gespeicherte Encounter"],
  ["npcs", "NSCs"],
  ["factions", "Fraktionen"],
  ["places", "Orte"],
  ["encounterTables", "Encounter-Tabellen"],
];

module.exports = ({ page, fs, path, assert, crypto, pluginRoot, qa, vault, out, checks, sleep }) => {
  const baseline = path.join(qa, "ce02-catalog-baseline.json");
  const workspace = () => page.locator(".dn-catalog-workspace:visible").last();
  const tab = (key) => workspace().locator(`[data-catalog-section="${key}"]`);
  const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

  function verifyInstalledTriplet() {
    const files = Object.fromEntries(["main.js", "manifest.json", "styles.css"].map((name) => {
      const expected = hash(path.join(pluginRoot, name));
      const installed = hash(path.join(vault, ".obsidian/plugins/dungeon-editor", name));
      assert.equal(installed, expected, `Installed ${name} differs from build`);
      return [name, { sha256: installed, bytes: fs.statSync(path.join(pluginRoot, name)).size }];
    }));
    fs.writeFileSync(path.join(out, "installed-triplet.json"), JSON.stringify(files, null, 2));
    checks.push("Installed main.js, manifest.json and styles.css match the tested build byte for byte");
    return files;
  }

  async function state() {
    return page.evaluate((viewType) => {
      const leaves = app.workspace.getLeavesOfType(viewType);
      return { count: leaves.length, state: leaves[0]?.view?.getState?.() };
    }, VIEW);
  }

  async function assertShell(active) {
    await workspace().waitFor({ state: "visible", timeout: 30000 });
    assert.equal(await workspace().getByRole("tab").count(), SECTIONS.length);
    assert.equal(await tab(active).getAttribute("aria-selected"), "true");
    assert.equal(await workspace().getByRole("tabpanel").count(), 1);
    assert.equal((await state()).count, 1);
  }

  async function openViaPalette() {
    const palette = page.locator([
      '.side-dock-ribbon-action[aria-label="Befehlspalette öffnen"]:visible',
      '.side-dock-ribbon-action[aria-label="Open command palette"]:visible',
    ].join(", ")).last();
    await palette.waitFor({ state: "visible", timeout: 12000 });
    await palette.click();
    const prompt = page.locator(".prompt-input:visible").last();
    if (!(await prompt.waitFor({ state: "visible", timeout: 1200 }).then(() => true).catch(() => false)))
      await page.keyboard.press("Control+p");
    await prompt.waitFor({ state: "visible" });
    await prompt.fill("Monsterkatalog öffnen");
    await page.keyboard.press("Enter");
    await assertShell("creatures");
  }

  async function choose(key) {
    await tab(key).click();
    await assertShell(key);
    if (key !== "creatures") {
      await workspace().getByText("Datenquelle für diesen Bereich ist noch nicht implementiert.").waitFor();
      assert.equal(await workspace().locator("tbody tr").count(), 0);
    }
  }

  async function edit() {
    const files = verifyInstalledTriplet();
    await openViaPalette();
    await workspace().getByText(/1–50 von 334/).waitFor({ timeout: 30000 });
    checks.push("Visible palette opens one Obsidian catalog leaf with all seven sections and live Monster results");

    for (const [key] of SECTIONS.slice(1)) await choose(key);
    checks.push("All six pending sections show an explicit unavailable provider state without stale Monster rows");

    await choose("creatures");
    const search = workspace().locator('[data-focus-key="search"]');
    await search.fill("dragon");
    await choose("items");
    await sleep(300);
    assert.equal(await workspace().locator("tbody tr").count(), 0);
    await choose("creatures");
    assert.equal(await workspace().locator('[data-focus-key="search"]').inputValue(), "dragon");
    await workspace().getByText(/von 334/).waitFor({ state: "detached", timeout: 12000 });
    checks.push("Rapid section switch isolates pending search results and restores the Monster search draft");

    await choose("items");
    await page.evaluate(() => app.workspace.requestSaveLayout());
    await sleep(500);
    const snapshot = await state();
    assert.equal(snapshot.state.activeSection, "items");
    assert.equal(snapshot.state.sections.creatures.textDraft, "dragon");
    await page.screenshot({ path: path.join(out, "ce02-items-before-restart.png") });
    fs.writeFileSync(baseline, JSON.stringify({ files, snapshot }, null, 2));
  }

  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline, "utf8"));
    const files = verifyInstalledTriplet();
    assert.deepEqual(files, saved.files);
    await assertShell("items");
    const restored = await state();
    assert.deepEqual(JSON.parse(JSON.stringify(restored.state)), saved.snapshot.state);
    await page.screenshot({ path: path.join(out, "ce02-items-after-restart.png") });
    await choose("creatures");
    assert.equal(await workspace().locator('[data-focus-key="search"]').inputValue(), "dragon");
    await workspace().locator("tbody tr").first().waitFor({ state: "visible", timeout: 30000 });
    await page.screenshot({ path: path.join(out, "ce02-monsters-after-restart.png") });
    checks.push("Fresh Obsidian process restores selected section and Monster search with exact workspace state");
  }

  return { edit, reopen };
};
