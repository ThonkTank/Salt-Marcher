// Interrupt only this isolated Obsidian QA service after a completed Atlas CAS.
module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks, resolveQaAppCgroup, sleep }) => async () => {
  const cp = require("node:child_process");
  const fixture = JSON.parse(fs.readFileSync(path.join(qa, "hard-crash-case.json"), "utf8"));
  assert(Number.isInteger(fixture.boundary) && fixture.boundary >= 1 && fixture.boundary <= 8,
    "Hard-crash boundary must follow a completed prepared/target/committed CAS");
  const originalWrites = JSON.parse(fs.readFileSync(path.join(qa, "writes.json"), "utf8"));
  const journalPath = fixture.worldPath + ".journal";
  const paths = [...originalWrites.map((write) => write.path), journalPath];
  const read = (file) => {
    const full = path.join(vault, file);
    return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
  };
  const sha = (value) => value === null ? null : crypto.createHash("sha256").update(value).digest("hex");
  const snapshot = () => Object.fromEntries(paths.map((file) => [file, sha(read(file))]));
  const initial = snapshot();
  for (const write of originalWrites)
    assert.equal(read(write.path), write.before, "Initial source " + write.path);
  assert.equal(read(journalPath), null);

  await page.evaluate(async (file) => {
    const target = app.vault.getAbstractFileByPath(file);
    if (!target) throw new Error("Hard-crash QA world missing");
    await app.workspace.getLeaf(false).openFile(target);
  }, fixture.worldPath);
  await page.locator(".dn-atlas-viewport:visible canvas").last().waitFor({ state: "visible" });
  const source = await page.evaluate(() => {
    const view = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
    return { draft: view.repository.hasDraft, dirty: view.repository.dirty,
      references: view.editor.terrain.references().length,
      status: view.contentEl.querySelector(".dn-atlas-save-status")?.textContent };
  });
  assert.deepEqual(source, { draft: true, dirty: true, references: 5, status: "Entwurf gesichert" });

  await page.evaluate(({ boundary, journalPath }) => {
    const view = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
    const store = view.repository.store;
    const original = store.compareAndWrite.bind(store);
    let mainCount = 0;
    let mainTransaction = false;
    store.compareAndWrite = async (file, before, after) => {
      await original(file, before, after);
      if (file === journalPath && after !== null) {
        const journal = JSON.parse(after);
        if (journal.state === "prepared" && journal.writes.length === 6 &&
            journal.writes.filter((write) => write.path.includes("/terrain/")).length === 5 &&
            journal.writes.at(-1)?.path.endsWith(".draft")) {
          mainTransaction = true;
          mainCount = 0;
        }
      }
      if (mainTransaction && ++mainCount === boundary) {
        window.__dd036HardCrashPause = { count: mainCount, file };
        await new Promise(() => {});
      }
    };
  }, { boundary: fixture.boundary, journalPath });
  await page.locator(".dn-atlas-toolbar:visible").last()
    .getByRole("button", { name: "Atlas speichern", exact: true }).click();
  await page.waitForFunction((boundary) => window.__dd036HardCrashPause?.count === boundary,
    fixture.boundary, { timeout: 30000 });
  const pause = await page.evaluate(() => window.__dd036HardCrashPause);
  const journal = JSON.parse(read(journalPath));
  const state = fixture.boundary === 8 ? "committed" : "prepared";
  assert.equal(journal.state, state);
  assert.deepEqual(journal.writes.map((entry) => entry.path).sort(),
    originalWrites.filter((entry) => entry.path !== fixture.worldPath)
      .map((entry) => entry.path).sort());
  assert.equal(pause.file, fixture.boundary === 1 || fixture.boundary === 8
    ? journalPath : journal.writes[fixture.boundary - 2].path);
  for (let i = 0; i < journal.writes.length; i++)
    assert.equal(read(journal.writes[i].path),
      i < Math.min(fixture.boundary - 1, journal.writes.length)
        ? journal.writes[i].after : journal.writes[i].before,
      "Stopped target " + journal.writes[i].path);
  const interrupted = snapshot();

  const appProcess = resolveQaAppCgroup();
  cp.execFileSync("systemctl", ["--user", "kill", "--kill-whom=all", "--signal=SIGKILL", appProcess.serviceName],
    { timeout: 10000 });
  let gone = false;
  for (let n = 0; n < 100; n++) {
    if (appProcess.pids.every((pid) => !fs.existsSync(`/proc/${pid}`))) {
      gone = true;
      break;
    }
    await sleep(100);
  }
  assert(gone, "All owned Obsidian QA process identities must disappear after SIGKILL");
  const afterKill = snapshot();
  assert.deepEqual(afterKill, interrupted, "Killing paused app must not mutate Atlas files");

  const recovered = Object.fromEntries(paths.map((file) => {
    const write = journal.writes.find((entry) => entry.path === file);
    return [file, sha(file === journalPath ? null : write
      ? state === "committed" ? write.after : write.before : read(file))];
  }));
  const recoveryCase = { kind: state, boundary: fixture.boundary,
    worldId: fixture.worldId, before: afterKill, after: recovered };
  fs.writeFileSync(path.join(qa, "writes.json"), JSON.stringify(journal.writes, null, 2));
  fs.writeFileSync(path.join(qa, "dd036-s01-recovery-case.json"), JSON.stringify(recoveryCase, null, 2));
  fs.writeFileSync(path.join(out, "s01-hard-crash-result.json"), JSON.stringify({
    fixture, source, initial, pause, interrupted, afterKill, journal,
    recoveryCase, appProcess: { serviceName: appProcess.serviceName, pids: appProcess.pids },
    signal: "SIGKILL", allOwnedPidsGone: gone,
  }, null, 2));
  checks.push("DD-036.03 actual isolated Obsidian SIGKILL after " + state + " Atlas CAS boundary " + fixture.boundary);
};
