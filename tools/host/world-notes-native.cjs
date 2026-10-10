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
      await panel.getByRole("button", { name: "Fraktion anlegen" }).click();
      const factionForm = panel.locator("form");
      await factionForm.locator("label").filter({ hasText: "Name" }).locator("input").fill("Nebelbund");
      await factionForm.locator("label").filter({ hasText: "GM-Notizen" }).locator("textarea").fill("Treffen am Kai.");
      await factionForm.getByRole("button", { name: "Speichern", exact: true }).click();
      await panel.getByRole("status").filter({ hasText: "Gespeichert" }).waitFor();
      await panel.getByRole("button", { name: "NPC: Maris vom Hafen" }).click();
      const editForm = panel.locator("form");
      await editForm.locator("label").filter({ hasText: "GM-Notizen" }).locator("textarea").fill("Kennt den alten Kai und den Nebelbund.");
      await editForm.getByRole("combobox", { name: "Beziehungsziel" }).selectOption({ label: "Fraktion: Nebelbund" });
      await editForm.getByRole("textbox", { name: "Beziehungsname" }).fill("kennt");
      await editForm.getByRole("button", { name: "Beziehung hinzufügen" }).click();
      await editForm.getByRole("button", { name: "Speichern", exact: true }).click();
      await panel.getByRole("status").filter({ hasText: "Gespeichert" }).waitFor();
      const savedManifest = JSON.parse(fs.readFileSync(path.join(vault, manifestPath), "utf8"));
      const savedOwner = savedManifest.registry.owners.find((item) => item.ownerId === "world-notes");
      assert(savedOwner && savedOwner.records.length === 2);
      const faction = savedOwner.records.find((item) => item.recordType === "world-faction");
      assert(faction);
      const factionPath = `Kampagnen/SaltMarcher/${namespace}/Weltwissen/faction/${faction.id}.world-note.json`;
      assert.equal(JSON.parse(fs.readFileSync(path.join(vault, factionPath), "utf8")).gmNotes, "Treffen am Kai.");
      const updated = JSON.parse(fs.readFileSync(path.join(vault, notePath), "utf8"));
      assert.equal(updated.gmNotes, "Kennt den alten Kai und den Nebelbund.");
      assert.deepEqual(updated.relations, [{ targetId: faction.id, label: "kennt" }]);
      assert.equal(fs.existsSync(path.join(vault, manifestPath.replace(/\.campaign\.json$/, ".world-notes.journal"))), false);
      fs.writeFileSync(path.join(out, "saved-note.json"), JSON.stringify({ notePath, factionPath, updated, faction }, null, 2));
      checks.push("Real Obsidian picker, NPC and faction create, native update and relationship Save PASS");
    },
    reopen: async () => {
      const panel = await open();
      await panel.getByRole("button", { name: "NPC: Maris vom Hafen" }).click();
      const form = panel.locator("form");
      assert.equal(await form.locator("label").filter({ hasText: "Vorlesetext" }).locator("textarea").inputValue(),
        "Sie hebt die Laterne.");
      assert.equal(await form.locator("label").filter({ hasText: "GM-Notizen" }).locator("textarea").inputValue(),
        "Kennt den alten Kai und den Nebelbund.");
      assert.match(await form.locator("ul").innerText(), /kennt: Nebelbund/);
      await panel.getByRole("button", { name: "Entwurf verwerfen" }).click();
      await panel.getByRole("button", { name: "Verwerfen bestätigen" }).click();
      await panel.getByRole("button", { name: "Fraktion: Nebelbund" }).click();
      assert.equal(await panel.locator("form label").filter({ hasText: "GM-Notizen" }).locator("textarea").inputValue(),
        "Treffen am Kai.");
      checks.push("Fresh real Obsidian process reopens exact NPC/faction prose and native relationship PASS");
    },
  };
};
