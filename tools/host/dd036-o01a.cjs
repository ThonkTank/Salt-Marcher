// DD-036-O01a: read-only, reference-free Overworld transport in an isolated vault.
module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks, restart }) => async () => {
  const original = "Atlanten/O01a Original.overworld";
  const transport = "Atlanten/O01a Transport.overworld";
  const baselinePath = path.join(qa, "dd036-o01a-baseline.json");
  const hash = (p) => crypto.createHash("sha256").update(fs.readFileSync(path.join(vault, p))).digest("hex");
  const files = () => ({ original: hash(original), transport: hash(transport) });
  const before = files();
  assert.equal(before.original, before.transport, "Transport is byte-identical before opening");
  const baseline = restart ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : before;
  assert.deepEqual(before, baseline, "Both single-file copies retain their baseline bytes");
  if (!restart) fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));

  await page.evaluate(() => {
    const calls = [];
    const coverage = [];
    const relevant = (value) => {
      const name = typeof value === "string" ? value : value?.path;
      return typeof name === "string" &&
        (/^Atlanten(?:\/|$)/.test(name) || /\.overworld(?:\.|$)/.test(name) || /^Atlasdaten(?:\/|$)/.test(name));
    };
    for (const [label, owner] of [["vault", app.vault], ["adapter", app.vault.adapter]]) {
      const names = new Set();
      for (let proto = owner; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto))
        for (const name of Reflect.ownKeys(proto))
          if (typeof name === "string" && /^(create|modify|process|append|write|copy|rename|remove|delete|trash|mkdir|rmdir)/i.test(name))
            names.add(name);
      for (const name of names) {
        const originalMethod = owner[name];
        if (typeof originalMethod !== "function") continue;
        const wrapped = function (...args) {
          if (args.some(relevant)) calls.push({ api: label, method: name, target: String(args[0]?.path ?? args[0]) });
          return originalMethod.apply(this, args);
        };
        owner[name] = wrapped;
        if (owner[name] !== wrapped) throw new Error("Atlas write method could not be instrumented: " + label + "." + name);
        coverage.push(label + "." + name);
      }
    }
    for (const required of ["vault.create", "vault.createBinary", "vault.modify", "vault.process", "vault.append", "vault.trash", "adapter.write", "adapter.writeBinary", "adapter.mkdir", "adapter.rmdir"])
      if (!coverage.includes(required)) throw new Error("Atlas write instrumentation missing: " + required);
    window.__dd036O01aWrites = calls;
    window.__dd036O01aCoverage = coverage.sort();
  });

  const chosen = restart ? transport : original;
  await page.evaluate(async (file) => {
    const target = app.vault.getAbstractFileByPath(file);
    if (!target) throw new Error("Missing owned transport fixture: " + file);
    await app.workspace.getLeaf(false).openFile(target);
  }, chosen);
  await page.locator(".dn-atlas-viewport:visible canvas").last().waitFor({ state: "visible", timeout: 30000 });
  const observed = await page.evaluate(() => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1);
    const editor = leaf?.view?.editor;
    return { path: leaf?.view?.file?.path, id: editor?.renderer?.world?.id,
      chunks: editor?.renderer?.world?.chunks?.length,
      placements: editor?.renderer?.world?.placements?.length,
      canvas: !!leaf?.view?.contentEl?.querySelector("canvas") };
  });
  assert.deepEqual(observed, { path: chosen, id: "dd036-o01a-world", chunks: 0, placements: 0, canvas: true });
  await page.screenshot({ path: path.join(out, restart ? "transport-open.png" : "original-open.png") });
  await page.evaluate(() => {
    for (const leaf of app.workspace.getLeavesOfType("dungeon-native-atlas")) leaf.detach();
  });
  await page.locator(".dn-atlas-viewport:visible").waitFor({ state: "detached" });
  const { writes, coverage } = await page.evaluate(() => ({
    writes: window.__dd036O01aWrites,
    coverage: window.__dd036O01aCoverage,
  }));
  assert.deepEqual(writes, [], "Opening and closing makes zero Atlas file write calls");
  const after = files();
  assert.deepEqual(after, baseline, "Opening and closing retains both exact file hashes");
  assert.deepEqual(fs.readdirSync(path.join(vault, "Atlanten")).sort(),
    ["O01a Original.overworld", "O01a Transport.overworld"]);
  assert(!fs.existsSync(path.join(vault, "Atlasdaten")), "No child, draft or journal files allocated");
  fs.writeFileSync(path.join(out, "o01a-result.json"), JSON.stringify({ chosen, before, after, observed, writes, coverage }, null, 2));
  checks.push("DD-036-O01a read-only reference-free Atlas open, stable world.id and byte-identical transport, zero Atlas write calls");
};
