const VIEW = "dungeon-creature-catalog";
const COMMAND = "dungeon-editor:open-creature-catalog";

module.exports = ({ page, fs, path, assert, crypto, qa, out, checks, sleep }) => {
  const baseline = path.join(qa, "ce01-catalog-baseline.json");
  const root = () => page.locator(".dn-creature-catalog:visible").last();
  const serializable = (value) => JSON.parse(JSON.stringify(value));

  async function openViaPalette() {
    const paletteButton = page.locator([
      '.side-dock-ribbon-action[aria-label="Befehlspalette öffnen"]:visible',
      '.side-dock-ribbon-action[aria-label="Open command palette"]:visible',
    ].join(", ")).last();
    await paletteButton.waitFor({ state: "visible", timeout: 12000 });
    await paletteButton.click();
    const prompt = page.locator(".prompt-input:visible").last();
    await prompt.waitFor({ state: "visible" });
    await prompt.fill("Monsterkatalog öffnen");
    const item = page.locator(".suggestion-item:visible")
      .filter({ hasText: "Monsterkatalog öffnen" }).first();
    await item.waitFor({ state: "visible" });
    await page.keyboard.press("Enter");
    await root().waitFor({ state: "visible", timeout: 30000 });
  }

  async function snapshot() {
    return page.evaluate((viewType) => {
      const leaves = app.workspace.getLeavesOfType(viewType);
      const leaf = leaves[0];
      return {
        count: leaves.length,
        connected: !!leaf?.view?.containerEl?.isConnected,
        title: leaf?.view?.getDisplayText?.(),
        state: leaf?.view?.getState?.(),
      };
    }, VIEW);
  }

  async function assertOneLeaf() {
    await page.waitForFunction((viewType) =>
      app.workspace.getLeavesOfType(viewType).length === 1, VIEW);
    const current = await snapshot();
    assert.equal(current.count, 1);
    assert.equal(current.connected, true);
    assert.equal(current.title, "Monsterkatalog");
    return current;
  }

  async function layout(width, height, label) {
    await page.setViewportSize({ width, height });
    await sleep(250);
    const measured = await root().evaluate((element) => {
      const rect = (node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      };
      const results = element.querySelector(".dn-catalog-results");
      const detail = element.querySelector(".dn-catalog-detail");
      const filters = element.querySelector(".dn-catalog-filters");
      const status = element.querySelector(".dn-catalog-footer [role]");
      const license = element.querySelector('[data-focus-key="license"]');
      return {
        root: rect(element),
        filters: rect(filters),
        results: rect(results),
        detail: rect(detail),
        status: rect(status),
        license: rect(license),
        rootClientWidth: element.clientWidth,
        rootScrollWidth: element.scrollWidth,
        resultsClientWidth: results.clientWidth,
        resultsScrollWidth: results.scrollWidth,
      };
    });
    assert.ok(measured.root.width > 0 && measured.root.height > 0);
    assert.ok(measured.filters.height > 0 && measured.results.height > 0 && measured.detail.height > 0);
    assert.ok(measured.status.width > 0 && measured.license.width > 0);
    assert.ok(measured.rootScrollWidth <= measured.rootClientWidth + 1,
      `${label} catalog root overflows horizontally: ${JSON.stringify(measured)}`);
    fs.writeFileSync(path.join(out, `layout-${label}.json`), JSON.stringify(measured, null, 2));
    await page.screenshot({ path: path.join(out, `catalog-${label}.png`) });
    return measured;
  }

  async function verifyInteractiveState() {
    const catalog = root();
    const next = catalog.locator('[data-focus-key="page-next"]');
    await next.click();
    await catalog.getByText(/51–100 von 334/).waitFor();
    await catalog.locator('[data-focus-key="page-previous"]').click();
    await catalog.getByText(/1–50 von 334/).waitFor();

    let rows = catalog.locator("tbody tr");
    assert.ok((await rows.count()) >= 2);
    await rows.nth(0).focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await rows.nth(1).evaluate((element) => element === document.activeElement), true);
    await page.keyboard.press("Enter");
    await catalog.locator(".dn-catalog-detail h2").waitFor();
    await page.keyboard.press("Escape");
    await catalog.locator(".dn-catalog-detail h2").waitFor({ state: "detached" });

    await catalog.locator('[data-focus-key="search"]').fill("dragon");
    await sleep(260);
    await catalog.locator('select[data-focus-key="type"]').selectOption("Dragon");
    await catalog.locator('select[data-focus-key="size"]').selectOption("Large");
    await catalog.locator('[data-focus-key="sort-hp"]').click();
    rows = catalog.locator("tbody tr");
    assert.ok((await rows.count()) > 0);
    await rows.first().click();
    await catalog.locator(".dn-catalog-detail h2").waitFor();
    const selectedName = await catalog.locator(".dn-catalog-detail h2").textContent();
    await catalog.getByRole("button", { name: "Quelle & Lizenz", exact: true }).click();
    await catalog.locator(".dn-catalog-notice").waitFor({ state: "visible" });
    assert.match(await catalog.locator(".dn-catalog-notice").textContent(), /CC BY 4\.0/);
    const typeChip = catalog.locator(".dn-catalog-chip").filter({ hasText: "Typ: Dragon" });
    await typeChip.click();
    assert.equal(await typeChip.count(), 0);
    await catalog.locator('select[data-focus-key="type"]').selectOption("Dragon");
    await catalog.locator(".dn-catalog-results").evaluate((element) => { element.scrollTop = 96; });
    await catalog.locator(".dn-catalog-detail").evaluate((element) => { element.scrollTop = 48; });

    const beforeFocusSwitch = await snapshot();
    await page.evaluate(async (viewType) => {
      const catalogLeaf = app.workspace.getLeavesOfType(viewType)[0];
      const other = app.workspace.getLeaf("tab");
      await other.setViewState({ type: "empty", active: true });
      app.workspace.revealLeaf(other);
      app.workspace.setActiveLeaf(catalogLeaf, { focus: true });
      app.workspace.revealLeaf(catalogLeaf);
    }, VIEW);
    await root().waitFor({ state: "visible" });
    const afterFocusSwitch = await snapshot();
    assert.deepEqual(afterFocusSwitch.state, beforeFocusSwitch.state);
    assert.equal(await root().locator(".dn-catalog-detail h2").textContent(), selectedName);
    checks.push("Catalog paging, keyboard, combined filters, chips, detail, license and focus return retain state");
    return afterFocusSwitch.state;
  }

  async function edit() {
    assert.equal(await page.evaluate((command) => !!app.commands.commands[command], COMMAND), true);
    await openViaPalette();
    await assertOneLeaf();
    checks.push("Visible command palette opens one real Obsidian catalog leaf");

    await page.evaluate((viewType) => {
      for (const leaf of app.workspace.getLeavesOfType(viewType)) leaf.detach();
    }, VIEW);
    await page.waitForFunction((viewType) => app.workspace.getLeavesOfType(viewType).length === 0, VIEW);
    const accepted = await page.evaluate((command) => [
      app.commands.executeCommandById(command),
      app.commands.executeCommandById(command),
    ], COMMAND);
    assert.deepEqual(accepted, [true, true]);
    await assertOneLeaf();
    checks.push("Two overlapping catalog commands create and reveal exactly one leaf");

    const state = await verifyInteractiveState();
    const layouts = {
      narrow: await layout(900, 650, "900x650"),
      wide: await layout(1150, 700, "1150x700"),
    };
    await page.evaluate(() => app.workspace.requestSaveLayout());
    await sleep(500);
    const build = JSON.parse(fs.readFileSync(path.join(out, "build.json"), "utf8"));
    fs.writeFileSync(baseline, JSON.stringify({ build, state, layouts }, null, 2));
    fs.writeFileSync(path.join(out, "catalog-state.json"), JSON.stringify({ state, layouts }, null, 2));
    checks.push("900x650 and 1150x700 keep the catalog root bounded without horizontal main overflow");
  }

  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline, "utf8"));
    const currentBuild = JSON.parse(fs.readFileSync(path.join(out, "build.json"), "utf8"));
    assert.equal(currentBuild.sourceRevision, saved.build.sourceRevision);
    assert.equal(currentBuild.sha256, saved.build.sha256);
    assert.deepEqual(currentBuild.files, saved.build.files);
    const current = await assertOneLeaf();
    assert.deepEqual(serializable(current.state), saved.state);
    assert.equal(await root().locator('[data-focus-key="search"]').inputValue(), "dragon");
    assert.ok((await root().locator(".dn-catalog-detail h2").count()) === 1);
    await layout(900, 650, "restart-900x650");
    await layout(1150, 700, "restart-1150x700");
    checks.push("Fresh Obsidian process restores the exact serializable catalog state");

    await page.evaluate((viewType) => app.workspace.getLeavesOfType(viewType)[0].detach(), VIEW);
    await page.waitForFunction((viewType) => app.workspace.getLeavesOfType(viewType).length === 0, VIEW);
    await openViaPalette();
    const reopened = await assertOneLeaf();
    assert.equal(reopened.state.sort, "name");
    assert.equal(reopened.state.direction, "asc");
    assert.equal(reopened.state.page, 0);
    assert.equal(reopened.state.selectedId, undefined);
    assert.equal(await root().locator('[data-focus-key="search"]').inputValue(), "");
    await page.screenshot({ path: path.join(out, "catalog-close-reopen-default.png") });
    fs.writeFileSync(path.join(out, "catalog-state.json"), JSON.stringify({ restored: current.state,
      afterCloseReopen: reopened.state }, null, 2));
    checks.push("Closing and reopening yields one clean default catalog leaf");
  }

  async function damaged() {
    await page.evaluate((viewType) => {
      for (const leaf of app.workspace.getLeavesOfType(viewType)) leaf.detach();
      const original = globalThis.atob;
      globalThis.__ce01OriginalAtob = original;
      globalThis.atob = (payload) => {
        const binary = original(payload);
        return String.fromCharCode(binary.charCodeAt(0) ^ 0xff) + binary.slice(1);
      };
    }, VIEW);
    await openViaPalette();
    await assertOneLeaf();
    const alert = root().getByRole("alert");
    await alert.waitFor({ state: "visible" });
    assert.match(await alert.textContent(), /Monsterkatalog nicht verfügbar/);
    assert.match(await alert.textContent(), /Monsterkatalog konnte nicht geladen werden/);
    await page.screenshot({ path: path.join(out, "catalog-damaged-error.png") });
    await page.evaluate(() => {
      globalThis.atob = globalThis.__ce01OriginalAtob;
      delete globalThis.__ce01OriginalAtob;
    });
    await alert.getByRole("button", { name: "Erneut versuchen", exact: true }).click();
    await root().locator("tbody tr").first().waitFor({ state: "visible", timeout: 30000 });
    assert.equal((await snapshot()).count, 1);
    assert.equal(await root().getByRole("alert").count(), 0);
    const receipt = { fault: "one-shot corrupted atob gzip bytes", recoveredRows:
      await root().locator("tbody tr").count(), leafCount: (await snapshot()).count };
    fs.writeFileSync(path.join(out, "catalog-state.json"), JSON.stringify(receipt, null, 2));
    await page.screenshot({ path: path.join(out, "catalog-damaged-retry.png") });
    checks.push("Corrupted payload shows an explicit host error and the same-leaf retry recovers");
  }

  return { edit, reopen, damaged };
};
