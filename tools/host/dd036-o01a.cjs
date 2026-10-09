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
    const relevant = (value) => {
      const name = typeof value === "string" ? value : value?.path;
      return typeof name === "string" &&
        (/^Atlanten\/O01a /.test(name) || /\.overworld(?:\.|$)/.test(name) || /^Atlasdaten\//.test(name));
    };
    for (const [owner, names] of [
      [app.vault, ["create", "modify", "process", "trash", "delete", "rename", "createFolder"]],
      [app.vault.adapter, ["write", "remove", "rename", "append", "writeBinary"]],
    ]) for (const name of names) {
      const originalMethod = owner[name];
      if (typeof originalMethod !== "function") continue;
      owner[name] = function (...args) {
        if (args.some(relevant)) calls.push({ method: name, target: String(args[0]?.path ?? args[0]) });
        return originalMethod.apply(this, args);
      };
    }
    window.__dd036O01aWrites = calls;
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
  const writes = await page.evaluate(() => window.__dd036O01aWrites);
  assert.deepEqual(writes, [], "Opening and closing makes zero Atlas file write calls");
  const after = files();
  assert.deepEqual(after, baseline, "Opening and closing retains both exact file hashes");
  assert.deepEqual(fs.readdirSync(path.join(vault, "Atlanten")).sort(),
    ["O01a Original.overworld", "O01a Transport.overworld"]);
  assert(!fs.existsSync(path.join(vault, "Atlasdaten")), "No child, draft or journal files allocated");
  fs.writeFileSync(path.join(out, "o01a-result.json"), JSON.stringify({ chosen, before, after, observed, writes }, null, 2));
  checks.push("DD-036-O01a read-only reference-free Atlas open, stable world.id and byte-identical transport, zero Atlas write calls");
};
