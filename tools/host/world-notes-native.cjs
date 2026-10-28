// Isolated real Obsidian Save -> fresh-process World Notes probe on synthetic Campaign input.
module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks, worldNotesFault, worldNotesRecovery }) => {
  const manifestPath = "Kampagnen/SaltMarcher/E2E-01-Atlas-Save.campaign.json";
  const journalPath = manifestPath.replace(/\.campaign\.json$/, ".world-notes.journal");
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
      if (true) {
        const zoom = await page.evaluate(() => {
          const electron = window.require?.("electron");
          if (!electron?.webFrame) return { available: false };
          electron.webFrame.setZoomFactor(1);
          return { available: true, factor: electron.webFrame.getZoomFactor() };
        });
        assert.equal(zoom.available, true, "Obsidian webFrame zoom must be available");
        assert.equal(zoom.factor, 1);
        const help = panel.locator("details summary");
        await help.focus();
        await page.keyboard.press("Enter");
        assert.equal(await panel.locator("details").evaluate((el) => el.open), true);
        const layout = await panel.evaluate((el) => ({
          viewport: window.innerWidth,
          left: el.getBoundingClientRect().left,
          right: el.getBoundingClientRect().right,
          buttons: [...el.querySelectorAll(".dn-world-notes-actions button")].map((button) => ({
            left: button.getBoundingClientRect().left,
            right: button.getBoundingClientRect().right,
          })),
        }));
        assert(layout.left >= 0 && layout.right <= layout.viewport, "World Notes panel fits 100% viewport");
        assert(layout.buttons.every((button) => button.left >= 0 && button.right <= layout.viewport),
          "World Notes actions fit 100% viewport");
        fs.writeFileSync(path.join(out, "world-notes-zoom.json"), JSON.stringify({ zoom, layout }, null, 2));
        await page.screenshot({ path: path.join(out, "world-notes-100-percent.png") });
        checks.push("Real Obsidian webFrame at 100%: keyboard help and action layout PASS");
      }
      await panel.getByRole("button", { name: "NPC anlegen" }).click();
      const form = panel.locator("form");
      await form.locator("label").filter({ hasText: "Name" }).locator("input").fill("Maris vom Hafen");
      await form.locator("label").filter({ hasText: "Vorlesetext" }).locator("textarea").fill("Sie hebt die Laterne.");
      await form.locator("label").filter({ hasText: "GM-Notizen" }).locator("textarea").fill("Kennt den alten Kai.");
      await form.getByRole("searchbox", { name: "Kreatur suchen" }).fill("goblin");
      await form.getByRole("button", { name: "Goblin (goblin) auswählen" }).click();
      assert.equal(await form.locator("label").filter({ hasText: "Kreaturreferenz" }).locator("input").inputValue(),
        "goblin");
      if (worldNotesFault) {
        const beforeManifest = fs.readFileSync(path.join(vault, manifestPath), "utf8");
        const namespace = JSON.parse(beforeManifest).snapshot.namespace;
        await page.evaluate(({ target, namespace }) => {
          const original = app.vault.process;
          let injected = false, nativePresentAtFailure = false;
          app.vault.process = async function (file, callback, options) {
            if (!injected && file.path === target) {
              injected = true;
              nativePresentAtFailure = app.vault.getFiles().some((item) =>
                item.path.startsWith(`Kampagnen/SaltMarcher/${namespace}/Weltwissen/npc/`));
              throw new Error("SMR-02 injected manifest CAS failure");
            }
            return original.call(this, file, callback, options);
          };
          window.__worldNotesFault = { restore: () => { app.vault.process = original; },
            evidence: () => ({ injected, nativePresentAtFailure }) };
        }, { target: manifestPath, namespace });
        await form.getByRole("button", { name: "Speichern", exact: true }).click();
        await panel.getByRole("alert").filter({ hasText: "Speicherung nicht bestätigt" }).waitFor();
        const failure = await page.evaluate(() => window.__worldNotesFault.evidence());
        assert.deepEqual(failure, { injected: true, nativePresentAtFailure: true });
        await page.evaluate(() => window.__worldNotesFault.restore());
        assert.equal(fs.readFileSync(path.join(vault, manifestPath), "utf8"), beforeManifest);
        const noteFolder = path.join(vault, `Kampagnen/SaltMarcher/${namespace}/Weltwissen/npc`);
        assert.equal(fs.existsSync(noteFolder) ? fs.readdirSync(noteFolder).length : 0, 0);
        assert.equal(fs.existsSync(path.join(vault, manifestPath.replace(/\.campaign\.json$/, ".world-notes.journal"))), false);
        fs.writeFileSync(path.join(out, "world-notes-rollback.json"), JSON.stringify({ ...failure,
          beforeManifestPreserved: true, nativeNotesAfterRollback: 0, journalAfterRollback: false }, null, 2));
        checks.push("Real Obsidian manifest CAS failure rolls note and journal back to exact Before bytes PASS");
      }
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
      assert.equal(note.creatureId, "goblin");
      assert.equal("hp" in note, false);
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
      for (const [kind, title, notes] of [
        ["Quest", "Wacht am Tor", "Die Glocke fehlt."],
        ["Gerücht", "Nebelzeichen", "Am Kai gesehen."],
      ]) {
        await panel.getByRole("button", { name: `${kind} anlegen` }).click();
        const entry = panel.locator("form");
        await entry.locator("label").filter({ hasText: "Name" }).locator("input").fill(title);
        await entry.locator("label").filter({ hasText: "GM-Notizen" }).locator("textarea").fill(notes);
        await entry.getByRole("button", { name: "Speichern", exact: true }).click();
        await panel.getByRole("status").filter({ hasText: "Gespeichert" }).waitFor();
      }
      await panel.getByRole("button", { name: "Gerücht: Nebelzeichen" }).click();
      let beforeRumorDelete = null;
      if (worldNotesRecovery) {
        const bytes = fs.readFileSync(path.join(vault, manifestPath), "utf8");
        const current = JSON.parse(bytes);
        const rumorRecord = current.registry.owners.find((owner) => owner.ownerId === "world-notes")
          ?.records.find((record) => record.recordType === "world-rumor");
        assert(rumorRecord);
        const notePath = `Kampagnen/SaltMarcher/${current.snapshot.namespace}/Weltwissen/rumor/${rumorRecord.id}.world-note.json`;
        beforeRumorDelete = { path: notePath, note: fs.readFileSync(path.join(vault, notePath), "utf8"), manifest: bytes };
      }
      await panel.getByRole("button", { name: "Löschen", exact: true }).click();
      await panel.getByRole("button", { name: "Löschen bestätigen" }).click();
      await panel.getByRole("status").filter({ hasText: "Gespeichert" }).waitFor();
      assert.equal(await panel.getByRole("button", { name: "Gerücht: Nebelzeichen" }).count(), 0);
      const savedManifest = JSON.parse(fs.readFileSync(path.join(vault, manifestPath), "utf8"));
      const savedOwner = savedManifest.registry.owners.find((item) => item.ownerId === "world-notes");
      assert(savedOwner && savedOwner.records.length === 4);
      const faction = savedOwner.records.find((item) => item.recordType === "world-faction");
      const quest = savedOwner.records.find((item) => item.recordType === "world-quest");
      const rumor = savedOwner.records.find((item) => item.recordType === "world-rumor");
      assert(faction && quest && rumor);
      const factionPath = `Kampagnen/SaltMarcher/${namespace}/Weltwissen/faction/${faction.id}.world-note.json`;
      const questPath = `Kampagnen/SaltMarcher/${namespace}/Weltwissen/quest/${quest.id}.world-note.json`;
      const rumorPath = `Kampagnen/SaltMarcher/${namespace}/Weltwissen/rumor/${rumor.id}.world-note.json`;
      assert.equal(JSON.parse(fs.readFileSync(path.join(vault, factionPath), "utf8")).gmNotes, "Treffen am Kai.");
      assert.equal(JSON.parse(fs.readFileSync(path.join(vault, questPath), "utf8")).gmNotes, "Die Glocke fehlt.");
      assert.equal(JSON.parse(fs.readFileSync(path.join(vault, rumorPath), "utf8")).deleted, true);
      const updated = JSON.parse(fs.readFileSync(path.join(vault, notePath), "utf8"));
      assert.equal(updated.gmNotes, "Kennt den alten Kai und den Nebelbund.");
      assert.deepEqual(updated.relations, [{ targetId: faction.id, label: "kennt" }]);
      assert.equal(fs.existsSync(path.join(vault, manifestPath.replace(/\.campaign\.json$/, ".world-notes.journal"))), false);
      if (beforeRumorDelete) {
        const journal = { kind: "atlas-file-transaction", version: 1, journalPath,
          transactionId: crypto.randomUUID(), state: "committed",
          writes: [
            { path: beforeRumorDelete.path, before: beforeRumorDelete.note,
              after: fs.readFileSync(path.join(vault, beforeRumorDelete.path), "utf8") },
            { path: manifestPath, before: beforeRumorDelete.manifest,
              after: fs.readFileSync(path.join(vault, manifestPath), "utf8") },
          ] };
        fs.writeFileSync(path.join(qa, "world-notes-recovery-case.json"), JSON.stringify({ journal }, null, 2));
        checks.push("Committed World Notes journal case sealed from actual native before/after bytes PASS");
      }
      fs.writeFileSync(path.join(out, "saved-note.json"), JSON.stringify({ notePath, factionPath, questPath, rumorPath,
        updated, faction, quest, rumor }, null, 2));
      checks.push("Real Obsidian creates all four kinds, updates a relationship and saves a native rumor tombstone PASS");
    },
    reopen: async () => {
      if (worldNotesRecovery)
        assert.equal(fs.existsSync(path.join(vault, journalPath)), true,
          "Committed World Notes journal must be present before fresh mount");
      const panel = await open();
      if (worldNotesRecovery) {
        assert.equal(fs.existsSync(path.join(vault, journalPath)), false,
          "Fresh World Notes activation removes the validated committed journal");
        checks.push("Fresh real Obsidian resolves the committed native journal before World Notes mount PASS");
      }
      if (true) {
        const zoom = await page.evaluate(() => {
          const webFrame = window.require?.("electron")?.webFrame;
          if (!webFrame) return null;
          webFrame.setZoomFactor(1);
          return webFrame.getZoomFactor();
        });
        assert.equal(zoom, 1);
        const search = panel.getByRole("searchbox", { name: "Notizen durchsuchen" });
        await search.focus();
        await page.keyboard.type("Maris");
        assert.equal(await panel.getByRole("button", { name: "NPC: Maris vom Hafen" }).count(), 1);
        await search.fill("");
      }
      const search = panel.getByRole("searchbox", { name: "Notizen durchsuchen" });
      await search.fill("goblin");
      assert.equal(await panel.getByRole("button", { name: "NPC: Maris vom Hafen" }).count(), 1);
      assert.equal(await panel.getByRole("button", { name: "Fraktion: Nebelbund" }).count(), 0);
      await search.fill("nebelbund");
      assert.equal(await panel.getByRole("button", { name: "NPC: Maris vom Hafen" }).count(), 1);
      assert.equal(await panel.getByRole("button", { name: "Fraktion: Nebelbund" }).count(), 1);
      await search.fill("kennt");
      assert.equal(await panel.getByRole("button", { name: "NPC: Maris vom Hafen" }).count(), 1);
      assert.equal(await panel.getByRole("button", { name: "Fraktion: Nebelbund" }).count(), 0);
      await search.fill("");
      await panel.getByRole("button", { name: "NPC: Maris vom Hafen" }).click();
      const form = panel.locator("form");
      if (true) {
        const layout = await form.evaluate((el) => ({
          viewport: window.innerWidth,
          right: el.getBoundingClientRect().right,
          inputs: [...el.querySelectorAll("input, textarea, select, button")].map((item) =>
            item.getBoundingClientRect().right),
        }));
        assert(layout.right <= layout.viewport && layout.inputs.every((right) => right <= layout.viewport),
          "World Notes edit controls fit the 100% viewport");
        fs.writeFileSync(path.join(out, "world-notes-reopen-zoom.json"), JSON.stringify({ zoom: 1, layout }, null, 2));
        await page.screenshot({ path: path.join(out, "world-notes-reopen-100-percent.png") });
      }
      assert.equal(await form.locator("label").filter({ hasText: "Vorlesetext" }).locator("textarea").inputValue(),
        "Sie hebt die Laterne.");
      assert.equal(await form.locator("label").filter({ hasText: "GM-Notizen" }).locator("textarea").inputValue(),
        "Kennt den alten Kai und den Nebelbund.");
      assert.equal(await form.locator("label").filter({ hasText: "Kreaturreferenz" }).locator("input").inputValue(),
        "goblin");
      assert.match(await form.innerText(), /Goblin \(goblin\)/);
      assert.match(await form.locator("ul").filter({ hasText: "kennt: Nebelbund" }).innerText(),
        /kennt: Nebelbund/);
      const notes = form.locator("label").filter({ hasText: "GM-Notizen" }).locator("textarea");
      await notes.fill("Ungespeicherter Entwurf");
      await form.getByRole("button", { name: "Fraktion Nebelbund öffnen" }).click();
      assert.equal(await notes.inputValue(), "Ungespeicherter Entwurf");
      assert.equal(await form.locator("label").filter({ hasText: "Name" }).locator("input").inputValue(),
        "Maris vom Hafen");
      await notes.fill("Kennt den alten Kai und den Nebelbund.");
      await form.getByRole("button", { name: "Fraktion Nebelbund öffnen" }).click();
      assert.equal(await panel.locator("form label").filter({ hasText: "Name" }).locator("input").inputValue(),
        "Nebelbund");
      const factionForm = panel.locator("form");
      assert.match(await factionForm.innerText(), /Verweise auf diesen Eintrag/);
      assert.match(await factionForm.innerText(), /kennt: NPC Maris vom Hafen/);
      const factionNotes = factionForm.locator("label").filter({ hasText: "GM-Notizen" }).locator("textarea");
      await factionNotes.fill("Ungespeicherter Fraktionsentwurf");
      await factionForm.getByRole("button", { name: "NPC Maris vom Hafen öffnen" }).click();
      assert.equal(await factionNotes.inputValue(), "Ungespeicherter Fraktionsentwurf");
      await factionNotes.fill("Treffen am Kai.");
      await factionForm.getByRole("button", { name: "NPC Maris vom Hafen öffnen" }).click();
      assert.equal(await panel.locator("form label").filter({ hasText: "Name" }).locator("input").inputValue(),
        "Maris vom Hafen");
      await panel.getByRole("button", { name: "Entwurf verwerfen" }).click();
      await panel.getByRole("button", { name: "Verwerfen bestätigen" }).click();
      await panel.getByRole("button", { name: "Fraktion: Nebelbund" }).click();
      assert.equal(await panel.locator("form label").filter({ hasText: "GM-Notizen" }).locator("textarea").inputValue(),
        "Treffen am Kai.");
      await panel.getByRole("button", { name: "Entwurf verwerfen" }).click();
      await panel.getByRole("button", { name: "Verwerfen bestätigen" }).click();
      await panel.getByRole("button", { name: "Quest: Wacht am Tor" }).click();
      assert.equal(await panel.locator("form label").filter({ hasText: "GM-Notizen" }).locator("textarea").inputValue(),
        "Die Glocke fehlt.");
      assert.equal(await panel.getByRole("button", { name: "Gerücht: Nebelzeichen" }).count(), 0);
      checks.push("Fresh real Obsidian searches relations, preserves unsaved drafts, opens outgoing and incoming links, and hides rumor tombstone PASS");
    },
  };
};
