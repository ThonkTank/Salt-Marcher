// DD-036-O01b terrain-child subset: nonempty transport and fail-closed child loading.
module.exports = ({ page, fs, path, assert, crypto, vault, out, checks, variant }) => async () => {
  const world = "Atlanten/O01b Welt.overworld";
  const child = "Atlasdaten/dd036-o01b-world/terrain/0_0_0.json";
  const hash = (name) => crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(vault, name))).digest("hex");
  const manifest = () => ({ world: hash(world), child: fs.existsSync(path.join(vault, child)) ? hash(child) : null });
  const before = manifest();
  const sourceRoot = path.join(path.dirname(path.dirname(vault)), "original/vault");
  const source = variant === "original" ? null : {
    world: crypto.createHash("sha256").update(fs.readFileSync(path.join(sourceRoot, world))).digest("hex"),
    child: crypto.createHash("sha256").update(fs.readFileSync(path.join(sourceRoot, child))).digest("hex"),
  };
  assert.equal(variant === "missing", before.child === null);
  if (source) {
    assert.equal(before.world, source.world, "Transport retains exact world bytes");
    if (variant === "transport") assert.equal(before.child, source.child, "Transport retains exact terrain child bytes");
    if (variant === "foreign") assert.notEqual(before.child, source.child, "Foreign case changes child identity only");
  }
  const rawWorld = JSON.parse(fs.readFileSync(path.join(vault, world), "utf8"));
  assert.equal(rawWorld.id, "dd036-o01b-world");
  assert.deepEqual(rawWorld.chunks.map((ref) => ref.file), ["terrain/0_0_0.json"]);
  if (variant === "original" || variant === "transport")
    assert.equal(JSON.parse(fs.readFileSync(path.join(vault, child), "utf8")).worldId, rawWorld.id);
  if (variant === "foreign")
    assert.equal(JSON.parse(fs.readFileSync(path.join(vault, child), "utf8")).worldId, "foreign-world");

  await page.evaluate(() => {
    const calls = [], coverage = [];
    const relevant = (value) => {
      const name = typeof value === "string" ? value : value?.path;
      return typeof name === "string" &&
        (/^Atlanten(?:\/|$)/.test(name) || /^Atlasdaten(?:\/|$)/.test(name));
    };
    for (const [label, owner] of [["vault", app.vault], ["adapter", app.vault.adapter]]) {
      const names = new Set();
      for (let proto = owner; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto))
        for (const name of Reflect.ownKeys(proto))
          if (typeof name === "string" && /^(create|modify|process|append|write|copy|rename|remove|delete|trash|mkdir|rmdir)/i.test(name)) names.add(name);
      for (const name of names) {
        const original = owner[name];
        if (typeof original !== "function") continue;
        const wrapped = function (...args) {
          if (args.some(relevant)) calls.push({ api: label, method: name, target: String(args[0]?.path ?? args[0]) });
          return original.apply(this, args);
        };
        owner[name] = wrapped;
        if (owner[name] !== wrapped) throw new Error("Write monitor missing " + label + "." + name);
        coverage.push(label + "." + name);
      }
    }
    for (const required of ["vault.create", "vault.createBinary", "vault.modify", "vault.process", "vault.append", "vault.trash", "adapter.write", "adapter.writeBinary", "adapter.mkdir", "adapter.rmdir"])
      if (!coverage.includes(required)) throw new Error("Write monitor missing " + required);
    window.__dd036O01bWrites = calls;
    window.__dd036O01bCoverage = coverage.sort();
  });

  await page.evaluate(async (name) => {
    const file = app.vault.getAbstractFileByPath(name);
    if (!file) throw new Error("Missing O01b world fixture");
    await app.workspace.getLeaf(false).openFile(file);
  }, world);
  await page.locator(".dn-atlas-viewport:visible canvas").last().waitFor({ state: "visible", timeout: 30000 });
  if (variant === "original" || variant === "transport") {
    await page.waitForFunction(() => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1)?.view?.editor;
      return editor?.terrain?.cells()?.length === 2;
    }, null, { timeout: 30000 });
  } else {
    await page.locator(".dn-atlas-save-status:visible")
      .filter({ hasText: "Landschaft konnte nicht geladen werden" }).waitFor({ timeout: 30000 });
  }
  const observed = await page.evaluate(() => {
    const view = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1)?.view;
    const editor = view?.editor;
    return { path: view?.file?.path, id: editor?.renderer?.world?.id,
      references: editor?.renderer?.world?.chunks?.map((ref) => ref.file),
      cells: editor?.terrain?.cells()?.map((cell) => ({ q: cell.q, r: cell.r, terrain: cell.terrain })),
      status: view?.contentEl?.querySelector(".dn-atlas-save-status")?.textContent,
      canvas: !!view?.contentEl?.querySelector("canvas") };
  });
  assert.equal(observed.path, world);
  assert.equal(observed.id, "dd036-o01b-world");
  assert.deepEqual(observed.references, ["terrain/0_0_0.json"]);
  assert.equal(observed.canvas, true);
  if (variant === "original" || variant === "transport")
    assert.deepEqual(observed.cells, [
      { q: 0, r: 0, terrain: "plain" }, { q: 1, r: 0, terrain: "forest" },
    ]);
  else {
    assert.deepEqual(observed.cells, []);
    assert.match(observed.status, variant === "missing"
      ? /Ein Landschaftsbereich fehlt/ : /Landschaftsbereich passt nicht zum Atlas/);
  }
  await page.screenshot({ path: path.join(out, variant + "-open.png") });
  await page.evaluate(() => {
    for (const leaf of app.workspace.getLeavesOfType("dungeon-native-atlas")) leaf.detach();
  });
  await page.locator(".dn-atlas-viewport:visible").waitFor({ state: "detached" });
  const { writes, coverage } = await page.evaluate(() => ({
    writes: window.__dd036O01bWrites, coverage: window.__dd036O01bCoverage,
  }));
  assert.deepEqual(writes, [], "Open and close do not write Atlas files");
  const after = manifest();
  assert.deepEqual(after, before, "World and child retain exact bytes");
  assert.deepEqual(fs.readdirSync(path.join(vault, "Atlanten")), ["O01b Welt.overworld"]);
  const expectedChildren = variant === "missing" ? [] : [child];
  const actualChildren = fs.existsSync(path.join(vault, "Atlasdaten"))
    ? fs.readdirSync(path.join(vault, "Atlasdaten/dd036-o01b-world/terrain"))
      .map((name) => "Atlasdaten/dd036-o01b-world/terrain/" + name) : [];
  assert.deepEqual(actualChildren, expectedChildren);
  fs.writeFileSync(path.join(out, "o01b-result.json"), JSON.stringify({ variant, source, before, after, observed, writes, coverage }, null, 2));
  checks.push("DD-036-O01b terrain-child subset: nonempty read-only open or fail-closed missing/foreign child");
};
