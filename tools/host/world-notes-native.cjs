// Isolated real Obsidian Save -> fresh-process World Notes probe on synthetic Campaign input.
module.exports = ({ page, fs, path, assert, vault, out, checks }) => {
  const manifestPath = "Kampagnen/SaltMarcher/E2E-01-Atlas-Save.campaign.json";
  const open = async () => {
    await page.evaluate(() => app.commands.executeCommandById("dungeon-editor:open-world-notes"));
    const picker = page.locator(".dn-campaign-entry:visible").last();
    await picker.getByRole("button", { name: "Öffnen", exact: true }).click();
    const panel = page.locator(".dn-world-notes:visible").last();
    await panel.waitFor();
    return panel;
  };
  return {
    edit: async () => {
      const panel = await open();
      await panel.getByRole("button", { name: "NPC anlegen" }).click();
      const form = panel.locator("form");
      await form.locator("label").filter({ hasText: "Name" }).locator("input").fill("Maris vom Hafen");
      await form.locator("label").filter({ hasText: "Vorlesetext" }).locator("textarea").fill("Sie hebt die Laterne.");
      await form.locator("label").filter({ hasText: "GM-Notizen" }).locator("textarea").fill("Kennt den alten Kai.");
      await form.getByRole("button", { name: "Speichern", exact: true }).click();
      await panel.getByRole("status").filter({ hasText: "Gespeichert" }).waitFor();
      const manifest = JSON.parse(fs.readFileSync(path.join(vault, manifestPath), "utf8"));
      const owner = manifest.registry.owners.find((item) => item.ownerId === "world-notes");
      assert(owner && owner.records.length === 1);
      const record = owner.records[0], namespace = manifest.snapshot.namespace;
      const notePath = `Kampagnen/SaltMarcher/${namespace}/Weltwissen/npc/${record.id}.world-note.json`;
      const note = JSON.parse(fs.readFileSync(path.join(vault, notePath), "utf8"));
      assert.equal(note.title, "Maris vom Hafen");
      assert.equal(note.readAloud, "Sie hebt die Laterne.");
      assert.equal(note.gmNotes, "Kennt den alten Kai.");
      assert.equal(fs.existsSync(path.join(vault, manifestPath.replace(/\.campaign\.json$/, ".world-notes.journal"))), false);
      fs.writeFileSync(path.join(out, "saved-note.json"), JSON.stringify({ notePath, record, note }, null, 2));
      checks.push("Real Obsidian command, Campaign picker, NPC editor and native note+manifest Save PASS");
    },
    reopen: async () => {
      const panel = await open();
      await panel.getByRole("button", { name: "NPC: Maris vom Hafen" }).click();
      const form = panel.locator("form");
      assert.equal(await form.locator("label").filter({ hasText: "Vorlesetext" }).locator("textarea").inputValue(),
        "Sie hebt die Laterne.");
      assert.equal(await form.locator("label").filter({ hasText: "GM-Notizen" }).locator("textarea").inputValue(),
        "Kennt den alten Kai.");
      checks.push("Fresh real Obsidian process reopens the Campaign-confirmed native NPC text PASS");
    },
  };
};
