// Focused QA pilot for the first Bau group. The coordinator owns the host,
// graphics slot, build and common group recorder; this file owns only gestures.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const pointGestures = require("./bau-point-gestures.cjs");

const openReasons = {
  "DD-011.04": "Ein gesonderter schmaler Polygonzug mit Wandwirkung ist in diesem Pilot noch nicht beidseitig gemessen.",
  "DD-011.06": "Shift-Kurve, Vorschau und gespeicherte Building-Topologie sind im Host-Pilot noch nicht durch dieselbe Geste verglichen.",
  "DD-011.08": "Für den Alt-Ellipsenschnitt fehlt bereits eine direkte Original-Kartenwirkung.",
  "DD-011.09": "Für den Alt-Polygonschnitt fehlt bereits eine direkte Original-Kartenwirkung.",
  "DD-011.11": "Die native Wirkung eines vor dem Zeichnen gewechselten Bodenmotivs ist nicht isoliert belegt.",
  "DD-011.12": "Die native Tint-Wirkung auf eine gezeichnete Bodenfläche ist nicht isoliert belegt.",
  "DD-011.13": "Der globale Snap-OFF-Schalter und seine Building-Punktwirkung sind in diesem Host-Pilot noch nicht ausgeführt.",
  "DD-012.01": "Native Edit-Points-Griffe und der abweichende Editor-Auswahlweg sind in diesem Pilot nicht als gleiche Bedienfolge geprüft.",
  "DD-012.02": "Der native Ellipsenpunktzug wurde wegen eines Save-Dialogs nicht frisch wieder geöffnet; ein gleicher Host-Punktzug fehlt.",
  "DD-012.03": "Punktvorschau während gedrückter Taste ist in diesem Host-Pilot nicht gemessen.",
  "DD-013.01": "Native Delete-Punktlöschung ist zwischen älterem Treffer und neuer erfolgloser Wiederholung widersprüchlich.",
  "DD-013.02": "Ein erfolgreicher nativer Backspace-Punktlöschfall fehlt.",
  "DD-013.03": "Native Mindestpunktzahl beim Löschen einer Kontur ist nicht gemessen.",
  "DD-014.01": "Native Kantenzieh-Einfügung ist sichtbar, aber gespeicherte Koordinaten und frischer Start fehlen.",
  "DD-014.02": "Portalbindung nach eingefügtem Konturpunkt und native gespeicherte Einzelzugwirkung fehlen.",
};
const mapName = "BauGroupQA";
const savedName = "bau-01-saved.json";
const wallFixture = "/home/aaron/.cache/dungeon-native-qa/audit-20261004/grundriss-bau/" +
  "DD015-017-fixtures/qa-wall-pack.dungeondraft_pack";
const wallFixtureSha256 = "eaad533f4da8880bf8c0339d9d6ae66dd3d8e1c1d60917288ab0a91242d51ad9";
const wallSavedName = "bau-02-wall-choice-saved.json";
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const buildings = (snap) => snap.document.entities.filter((entity) => entity.kind === "building");
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const inRing = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > point.y) !== (b.y > point.y) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
};
const onFloor = (entity, point) => entity?.polygons?.some((polygon) =>
  inRing(point, polygon.outer) && !polygon.holes.some((hole) => inRing(point, hole)));

module.exports = async function bau01({ page, out, qa, vault, restart, group, record }) {
  const savedPath = path.join(qa, savedName);
  const stepsPath = path.join(out, "bau-01-steps.json");
  const screens = path.join(out, "screens");
  fs.mkdirSync(screens, { recursive: true });
  const steps = { phase: restart ? "reopen" : "edit", groupId: group.id,
    mapPath: null, stages: [], errors: [] };
  const outcomes = new Map();
  const set = (id, state, observation, gap = null, evidence = []) => {
    if (!group.caseIds.includes(id) || outcomes.has(id))
      throw new Error(`Invalid Bau result ${id}`);
    outcomes.set(id, { state, observation, gap, evidence });
  };
  const snap = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    if (!editor) return null;
    return {
      document: editor.session.document(),
      dirty: editor.session.dirty,
      history: editor.session.historySize,
      tool: editor.tool,
      draft: editor.pathDraft?.points.map((point) => ({ ...point })) ?? null,
      gesture: editor.gesture?.tool ?? null,
      previewInstructions: editor.renderer.preview.context.instructions.length,
      paintActive: !!editor.paintWorker,
    };
  });
  const stage = async (name, withScreen = false) => {
    const value = await snap();
    const image = withScreen ? path.join(screens, `${name}.png`) : null;
    if (image) await page.screenshot({ path: image });
    steps.stages.push({ name, value, image });
    return value;
  };
  const finish = () => {
    fs.writeFileSync(stepsPath, JSON.stringify(steps, null, 2) + "\n");
    for (const id of group.caseIds) {
      const item = outcomes.get(id) ?? {
        state: "open", observation: null,
        gap: openReasons[id] ?? (group.id === "bau-02"
          ? "Dieser Fall wurde im auf DD-015.01/.02 begrenzten Wandwahllauf noch nicht ausgeführt."
          : "Diese Bedienfolge wurde im begrenzten Bau-Pilot noch nicht ausgeführt."),
        evidence: [],
      };
      record.add(id, item.state, item.observation,
        item.state === "open" ? item.evidence : [stepsPath, ...item.evidence], item.gap);
    }
  };
  const runPointGestures = async () => {
    if (group.id !== "bau-01") return;
    try {
      const findings = restart
        ? await pointGestures.verifyReopen({ page, out, qa, vault })
        : await pointGestures.runEdit({ page, out, qa, vault });
      for (const id of pointGestures.caseIds) {
        const item = findings[id];
        if (!item) throw new Error(`Punktgesten-Ergebnis fehlt: ${id}`);
        set(id, item.state, item.observation, item.gap, item.evidence);
      }
    } catch (error) {
      steps.errors.push(String(error?.stack ?? error));
      for (const id of pointGestures.caseIds)
        if (!outcomes.has(id)) set(id, "open", null,
          `Punktgesten-Hostfolge nicht auswertbar: ${error?.message ?? error}`);
    }
  };
  const at = (point) => page.evaluate((point) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    const x = box.x + renderer.camera.x + point.x * renderer.camera.scale;
    const y = box.y + renderer.camera.y + point.y * renderer.camera.scale;
    if (x < box.x || y < box.y || x >= box.right || y >= box.bottom)
      throw new Error(`World point outside canvas: ${point.x},${point.y}`);
    return { x, y };
  }, point);
  const choose = async (tool) => {
    await page.locator(".dn-group-rail").getByRole("button", { name: "Bauwerk", exact: true }).click();
    await page.locator(".dn-tool-rail").getByRole("button", { name: tool, exact: true }).click();
  };
  const click = async (point) => {
    const position = await at(point);
    await page.mouse.click(position.x, position.y);
  };
  const drag = async (a, b, previewName) => {
    const from = await at(a), to = await at(b);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    const preview = await stage(previewName, true);
    await page.mouse.up();
    return preview;
  };
  const waitPaint = () => page.waitForFunction(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    return !!editor && !editor.paintWorker;
  }, null, { timeout: 12000 });
  const waitBuildings = (count) => page.waitForFunction((count) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    return !!editor && !editor.paintWorker &&
      editor.session.document().entities.filter((entity) => entity.kind === "building").length >= count;
  }, count, { timeout: 12000 });

  // DD-015 is catalogued in bau-02. The bau-02 entrypoint delegates here so
  // this pilot can reuse the established snapshot, gesture and record helpers.
  if (group.id === "bau-02") {
    const wallSavedPath = path.join(qa, wallSavedName);
    const wallRender = (id) => page.evaluate((id) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor?.renderer;
      const visual = renderer?.visuals.get(id);
      if (!visual) return null;
      let sprites = 0;
      const walk = (node) => {
        if (node.texture && typeof node.texture !== "function") sprites++;
        for (const child of node.children ?? []) walk(child);
      };
      walk(visual.container);
      const graphics = visual.container.children.find((child) => child.context);
      const actions = graphics?.context?.instructions?.map((item) => item.action) ?? [];
      return { sprites, actions, shadow: !!visual.shadow };
    }, id);
    const markMissing = (reason) => {
      for (const id of ["DD-015.01", "DD-015.02"])
        if (!outcomes.has(id)) set(id, "open", null, reason, [stepsPath]);
    };
    try {
      if (restart) {
        const saved = JSON.parse(fs.readFileSync(wallSavedPath, "utf8"));
        steps.mapPath = saved.mapPath;
        await page.evaluate(async (mapPath) => {
          const file = app.vault.getAbstractFileByPath(mapPath);
          if (!file) throw new Error(`QA-Karte fehlt: ${mapPath}`);
          await app.workspace.getLeaf(false).openFile(file);
        }, saved.mapPath);
        await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
        const reopened = await stage("wall-choice-fresh-open", true);
        const disk = path.join(vault, saved.mapPath);
        const exact = !!reopened && !reopened.dirty &&
          equal(reopened.document, saved.document) && digest(disk) === saved.sha256;
        await page.waitForFunction((id) => {
          const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor?.renderer;
          const visual = renderer?.visuals.get(id);
          return !!visual && visual.container.children.some((child) =>
            child.children?.some((grandchild) => !!grandchild.texture));
        }, saved.packageId, { timeout: 12000 }).catch(() => {});
        const packageRender = await wallRender(saved.packageId);
        const noneRender = await wallRender(saved.noneId);
        const packageEntity = buildings(reopened).find((entity) => entity.id === saved.packageId);
        const noneEntity = buildings(reopened).find((entity) => entity.id === saved.noneId);
        const packageOkay = exact && packageEntity?.wallAssetId === saved.assetId &&
          packageEntity.wallWidth > 0 && packageRender?.sprites > 0;
        const noneOkay = exact && noneEntity?.wallWidth === 0 &&
          !noneEntity.wallAssetId && noneRender?.sprites === 0 &&
          noneRender?.actions?.includes("fill") &&
          !noneRender.actions.includes("stroke");
        steps.wallChoice = { saved, exact, packageRender, noneRender,
          packageEntity, noneEntity };
        for (const [id, okay, detail] of [
          ["DD-015.01", packageOkay, `Paketwand ${saved.assetId}; Textursprites=${packageRender?.sprites}`],
          ["DD-015.02", noneOkay, `None wallWidth=${noneEntity?.wallWidth}; Sprites=${noneRender?.sprites}; Aktionen=${noneRender?.actions}`],
        ]) {
          const edit = saved.editOutcomes[id];
          const renderKnown = id !== "DD-015.02" || noneRender?.actions?.includes("fill");
          const state = id === "DD-015.02" && okay ? "open"
            : edit?.state !== "pass" || !renderKnown
              ? "open" : okay ? "pass" : "deviation";
          set(id, state,
            `Frischöffnung: Dokument/Datei bytegleich=${exact}; ${detail}.`,
            state === "pass" ? null : id === "DD-015.02" && okay
              ? "Wandlose Bodenwirkung bleibt wegen des ungepaarten Schattenrands im Original offen."
              : edit?.state !== "pass"
              ? (edit?.state !== "pass"
                ? `Editphase nicht bestanden: ${edit?.gap ?? edit?.observation ?? "ohne Ergebnis"}`
                : "Wandloses Rendering im Host nicht eindeutig introspektierbar.")
              : "Paketwand oder wandlose Kartenwirkung wich nach frischem Öffnen vom gespeicherten Zustand ab.",
            [stepsPath, wallSavedPath, path.join(screens, "wall-choice-fresh-open.png")]);
        }
      } else {
        const bytes = fs.readFileSync(wallFixture);
        if (crypto.createHash("sha256").update(bytes).digest("hex") !== wallFixtureSha256)
          throw new Error("QA-Wandpaket hat eine andere Prüfsumme.");
        fs.writeFileSync(path.join(out, "qa-wall-pack.dungeondraft_pack"), bytes);
        await page.evaluate(async () =>
          app.plugins.getPlugin("dungeon-editor").create("BauWallChoiceGroupQA", 18, 12));
        await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
        if (!(await page.locator(".dungeon-native-editor.dn-maximized").count())) {
          await page.getByRole("button", { name: "Maximieren", exact: true }).click();
          await page.locator(".dungeon-native-editor.dn-maximized").waitFor();
        }
        steps.mapPath = await page.evaluate(() =>
          app.workspace.getLeavesOfType("dungeon-native-map")[0].view.file.path);
        await page.evaluate(() => {
          const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
          renderer.fit();
          renderer.zoom(40 / renderer.camera.scale);
        });
        await page.evaluate(async (encoded) => {
          const payload = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
          const plugin = app.plugins.getPlugin("dungeon-editor");
          await plugin.assets.add([new Blob([payload])]);
          await plugin.reloadAssets();
          const session = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session;
          const before = session.settings;
          session.execute({ label: "QA-Paket für Baukarte aktivieren",
            settings: { before, after: { ...before, assetPacks: ["QAWall01"] } } });
        }, bytes.toString("base64"));
        const asset = await page.evaluate(() =>
          app.plugins.getPlugin("dungeon-editor").listAssets()
            .find((item) => item.packId === "QAWall01" && item.kind === "wall"));
        if (!asset) throw new Error("QAWall01 wurde im isolierten Host nicht als Wand geladen.");
        await choose("Ellipse");
        const choice = page.getByRole("combobox", { name: "Wand für Grundriss", exact: true });
        const choices = await choice.locator("option").evaluateAll((options) =>
          options.map((option) => ({ value: option.value, label: option.textContent?.trim() })));
        await choice.selectOption(asset.id);
        const packageValue = await choice.inputValue();
        const selectedPackage = await stage("wall-package-choice", true);
        const packagePreview = await drag({ x: 2, y: 2 }, { x: 7, y: 5 }, "wall-package-preview");
        await waitBuildings(1);
        const placedPackage = await stage("wall-package-placed", true);
        const packageEntity = buildings(placedPackage)[0];
        await page.waitForFunction((id) => {
          const visual = app.workspace.getLeavesOfType("dungeon-native-map")[0]
            ?.view?.editor?.renderer?.visuals.get(id);
          return !!visual && visual.container.children.some((child) =>
            child.children?.some((grandchild) => !!grandchild.texture));
        }, packageEntity?.id, { timeout: 12000 }).catch(() => {});
        const packageRender = packageEntity && await wallRender(packageEntity.id);
        await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
        const packageUndo = await stage("wall-package-undo", true);
        await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
        const packageRedo = await stage("wall-package-redo", true);
        const packageOkay = packageValue === asset.id &&
          choices.some((item) => item.value === asset.id) &&
          packageEntity?.wallAssetId === asset.id &&
          packageEntity.wallWidth > 0 && packageEntity.polygons?.[0]?.outer?.length === 32 &&
          packageRender?.sprites > 0 && packagePreview.previewInstructions > 0 &&
          equal(packagePreview.document, selectedPackage.document) &&
          equal(packageUndo.document, selectedPackage.document) &&
          equal(packageRedo.document, placedPackage.document);

        await choose("Rechteck"); // Tool choice clears the placed Building selection.
        const noneChoice = page.getByRole("combobox", { name: "Wand für Grundriss", exact: true });
        await noneChoice.selectOption("__no_wall__");
        const noneValue = await noneChoice.inputValue();
        const selectedNone = await stage("wall-none-choice", true);
        const nonePreview = await drag({ x: 10, y: 2 }, { x: 14, y: 5 }, "wall-none-preview");
        await waitBuildings(2);
        const placedNone = await stage("wall-none-placed", true);
        const noneEntity = buildings(placedNone).find((entity) => entity.id !== packageEntity?.id);
        const noneRender = noneEntity && await wallRender(noneEntity.id);
        await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
        const noneUndo = await stage("wall-none-undo", true);
        await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
        const noneRedo = await stage("wall-none-redo", true);
        const noneOkay = noneValue === "__no_wall__" &&
          choices.some((item) => item.value === "__no_wall__") &&
          noneEntity?.wallWidth === 0 && !noneEntity.wallAssetId &&
          noneRender?.sprites === 0 && noneRender?.actions?.includes("fill") &&
          !noneRender.actions.includes("stroke") &&
          nonePreview.previewInstructions > 0 &&
          equal(nonePreview.document, selectedNone.document) &&
          equal(noneUndo.document, selectedNone.document) &&
          equal(noneRedo.document, placedNone.document) &&
          buildings(placedNone).find((entity) => entity.id === packageEntity?.id)?.wallAssetId === asset.id;
        await page.getByRole("button", { name: "Speichern", exact: true }).click();
        await page.waitForFunction(() =>
          !app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor?.session?.dirty);
        const saved = await stage("wall-choice-saved", true);
        const disk = path.join(vault, steps.mapPath);
        const savedOkay = fs.existsSync(disk) && !saved.dirty &&
          equal(JSON.parse(fs.readFileSync(disk, "utf8")), saved.document);
        steps.wallChoice = { asset, fixtureSha256: wallFixtureSha256, choices,
          packageValue, noneValue,
          selectedPackage, packageEntity, packageRender, packageOkay,
          selectedNone, noneEntity, noneRender, noneOkay, savedOkay };
        for (const [id, okay, detail, images] of [
          ["DD-015.01", packageOkay, `Ellipse ${packageEntity?.id}: asset=${packageEntity?.wallAssetId}, 32 Punkte, Textursprites=${packageRender?.sprites}, Undo/Redo=${equal(packageUndo.document, selectedPackage.document)}/${equal(packageRedo.document, placedPackage.document)}`,
            ["wall-package-choice", "wall-package-preview", "wall-package-placed", "wall-package-redo"]],
          ["DD-015.02", noneOkay, `None ${noneEntity?.id}: wallWidth=${noneEntity?.wallWidth}, Textursprites=${noneRender?.sprites}, Zeichenaktionen=${noneRender?.actions}, vorherige Paketwand erhalten=${buildings(placedNone).find((entity) => entity.id === packageEntity?.id)?.wallAssetId === asset.id}`,
            ["wall-none-choice", "wall-none-preview", "wall-none-placed", "wall-none-redo"]],
        ]) {
          const renderKnown = id !== "DD-015.02" || noneRender?.actions?.includes("fill");
          const state = !savedOkay || !renderKnown ? "open"
            : id === "DD-015.02" && okay ? "open"
            : okay ? "pass" : "deviation";
          set(id, state, `${detail}; Save=${savedOkay}.`,
            state === "pass" ? null : id === "DD-015.02" && okay
              ? "Schattenwirkung der wandlosen Bodenfläche im Original nicht gepaart vermessen."
              : !savedOkay
              ? "Karte konnte nicht als exakter QA-Stand gespeichert werden."
              : !renderKnown
                ? "Wandloses Rendering im Host nicht eindeutig introspektierbar."
              : "Paketwand oder wandlose Bodenwirkung weicht im isolierten Host vom Originalfall ab.",
            [stepsPath, path.join(out, "qa-wall-pack.dungeondraft_pack"),
              ...images.map((name) => path.join(screens, `${name}.png`))]);
        }
        if (savedOkay) fs.writeFileSync(wallSavedPath, JSON.stringify({
          mapPath: steps.mapPath, document: saved.document, sha256: digest(disk),
          assetId: asset.id, packageId: packageEntity.id, noneId: noneEntity.id,
          fixtureSha256: wallFixtureSha256, editOutcomes: Object.fromEntries(outcomes),
        }, null, 2) + "\n");
      }
    } catch (error) {
      steps.errors.push(String(error?.stack ?? error));
      markMissing(`DD-015-Wandwahlfolge nicht auswertbar: ${error?.message ?? error}`);
    }
    await runPointGestures();
    finish();
    return;
  }

  if (restart) {
    try {
      const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
      steps.mapPath = saved.mapPath;
      await page.evaluate(async (mapPath) => {
        const file = app.vault.getAbstractFileByPath(mapPath);
        if (!file) throw new Error(`Missing saved map ${mapPath}`);
        await app.workspace.getLeaf(false).openFile(file);
      }, saved.mapPath);
      await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
      const reopened = await stage("fresh-open", true);
      const file = path.join(vault, saved.mapPath);
      const persisted = !!reopened && !reopened.dirty &&
        equal(reopened.document, saved.document) && digest(file) === saved.sha256;
      steps.saved = saved;
      steps.persisted = persisted;
      for (const [id, item] of Object.entries(saved.editOutcomes)) {
        if (item.state !== "pass") {
          set(id, "open", null, `Edit-Phase für ${id} war ${item.state}: ${item.gap ?? item.observation ?? "keine gleichwertige Kartenwirkung"}.`,
            [savedPath]);
        } else if (["DD-011.05", "DD-011.10", "DD-011.14"].includes(id)) {
          set(id, "not_applicable", "Diese Geste hat keinen eigenen fortbestehenden Kartenstatus.", null,
            [savedPath]);
        } else {
          set(id, persisted ? "pass" : "fail",
            "Im frischen Hostprozess stimmen Kartendokument und Dateiprüfsumme mit dem gespeicherten Stand überein.",
            null, [savedPath]);
        }
      }
      if (!outcomes.has("DD-011.15"))
        set("DD-011.15", persisted ? "pass" : "fail",
          "Die gespeicherte Baukarte wurde in einem frischen Hostprozess geöffnet und bytegleich verglichen.",
          null, [savedPath]);
    } catch (error) {
      steps.errors.push(String(error?.stack ?? error));
      set("DD-011.15", "open", null,
        `Frisches Öffnen nicht auswertbar: ${error?.message ?? error}`);
    }
    finish();
    return;
  }

  try {
    await page.evaluate(async (name) => app.plugins.getPlugin("dungeon-editor").create(name, 18, 12), mapName);
    const canvas = page.locator(".dn-canvas canvas").last();
    await canvas.waitFor({ timeout: 30000 });
    if (!(await page.locator(".dungeon-native-editor.dn-maximized").count())) {
      await page.getByRole("button", { name: "Maximieren", exact: true }).click();
      await page.locator(".dungeon-native-editor.dn-maximized").waitFor();
    }
    steps.mapPath = await page.evaluate(() =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.file.path);
    await page.evaluate(() => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
      renderer.fit();
      renderer.zoom(40 / renderer.camera.scale);
      renderer.canvas.focus();
    });
    await choose("Rechteck");
    const beforeRect = await stage("rectangle-before", true);
    const rectPreview = await drag({ x: 2, y: 2 }, { x: 7, y: 5 }, "rectangle-preview");
    await waitBuildings(1);
    const afterRect = await stage("rectangle-after", true);
    const rectangle = buildings(afterRect)[0];
    const rectPreviewOkay = rectPreview?.gesture === "room" &&
      rectPreview.previewInstructions > 0 && equal(rectPreview.document, beforeRect.document);
    const rectPoints = rectangle?.polygons?.[0]?.outer;
    const rectBounds = rectPoints && {
      minX: Math.min(...rectPoints.map((point) => point.x)),
      maxX: Math.max(...rectPoints.map((point) => point.x)),
      minY: Math.min(...rectPoints.map((point) => point.y)),
      maxY: Math.max(...rectPoints.map((point) => point.y)),
    };
    const rectOkay = rectPreviewOkay && rectPoints?.length === 4 &&
      equal(rectBounds, { minX: 2, maxX: 7, minY: 2, maxY: 5 }) &&
      rectangle.wallWidth > 0 && onFloor(rectangle, { x: 4, y: 3.5 });
    set("DD-011.01", rectOkay ? "pass" : "fail",
      `Rechteck: Vorschau=${rectPreviewOkay}, Grenzen=${JSON.stringify(rectBounds)}, Punkte=${rectPoints?.length}, Wandbreite=${rectangle?.wallWidth}.`,
      null, [path.join(screens, "rectangle-preview.png"), path.join(screens, "rectangle-after.png")]);

    await page.keyboard.press("Control+z");
    const undo = await stage("rectangle-undo");
    await page.keyboard.press("Control+y");
    const redo = await stage("rectangle-redo", true);
    const historyOkay = equal(undo.document, beforeRect.document) &&
      equal(redo.document, afterRect.document);
    set("DD-011.14", historyOkay ? "pass" : "fail",
      `Strg+Z entfernte das Rechteck=${equal(undo.document, beforeRect.document)}; Strg+Y stellte es wieder her=${equal(redo.document, afterRect.document)}.`,
      null, [path.join(screens, "rectangle-redo.png")]);
    if (!equal(redo.document, afterRect.document)) {
      await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
      await stage("rectangle-control-recovered");
    }

    const beforeEscape = await stage("escape-before");
    const escapeFrom = await at({ x: 8, y: 7 });
    const escapeTo = await at({ x: 10, y: 9 });
    await page.mouse.move(escapeFrom.x, escapeFrom.y);
    await page.mouse.down();
    await page.mouse.move(escapeTo.x, escapeTo.y, { steps: 6 });
    const escapePreview = await stage("escape-preview", true);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await waitPaint();
    const afterEscape = await stage("escape-after", true);
    const escapeOkay = escapePreview.previewInstructions > 0 &&
      equal(beforeEscape.document, afterEscape.document) && !afterEscape.draft;
    set("DD-011.10", escapeOkay ? "pass" : "fail",
      `Escape bei aktiver Rechteckvorschau ließ Dokument unverändert=${equal(beforeEscape.document, afterEscape.document)}.`,
      null, [path.join(screens, "escape-preview.png"), path.join(screens, "escape-after.png")]);

    await choose("Ellipse");
    const beforeEllipse = await stage("ellipse-before");
    const ellipsePreview = await drag({ x: 11, y: 2 }, { x: 16, y: 5 }, "ellipse-preview");
    await waitBuildings(2);
    const afterEllipse = await stage("ellipse-after", true);
    const ellipse = buildings(afterEllipse).find((entity) => entity.id !== rectangle?.id);
    const ellipseOkay = ellipsePreview?.gesture === "ellipse" &&
      ellipsePreview.previewInstructions > 0 && equal(ellipsePreview.document, beforeEllipse.document) &&
      ellipse?.polygons?.[0]?.outer?.length === 32 && ellipse.wallWidth > 0;
    set("DD-011.02", ellipseOkay ? "pass" : "fail",
      `5×3-Ellipse: Vorschau=${ellipsePreview.previewInstructions > 0}, Punkte=${ellipse?.polygons?.[0]?.outer?.length}, Wandbreite=${ellipse?.wallWidth}.`,
      null, [path.join(screens, "ellipse-preview.png"), path.join(screens, "ellipse-after.png")]);

    await choose("Rechteck");
    const beforeErase = await stage("erase-before");
    await page.keyboard.down("Alt");
    const erasePreview = await drag({ x: 3, y: 3 }, { x: 5, y: 4 }, "erase-preview");
    await page.keyboard.up("Alt");
    await page.waitForFunction((before) => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
      return !editor.paintWorker &&
        JSON.stringify(editor.session.document()) !== before;
    }, JSON.stringify(beforeErase.document), { timeout: 12000 });
    const erased = await stage("erase-after", true);
    await page.keyboard.press("Control+z");
    const eraseUndo = await stage("erase-undo");
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    const eraseRedo = await stage("erase-redo", true);
    const eraseBeforeFloor = buildings(beforeErase).some((entity) =>
      onFloor(entity, { x: 4, y: 3.5 }));
    const eraseAfterFloor = buildings(erased).some((entity) =>
      onFloor(entity, { x: 4, y: 3.5 }));
    const eraseWall = buildings(erased).some((entity) =>
      entity.polygons.some((polygon) => polygon.holes.length > 0) && entity.wallWidth > 0);
    const eraseOkay = erasePreview.previewInstructions > 0 &&
      !equal(erased.document, beforeErase.document) &&
      eraseBeforeFloor && !eraseAfterFloor && eraseWall &&
      equal(eraseUndo.document, beforeErase.document) &&
      equal(eraseRedo.document, erased.document);
    set("DD-011.07", eraseOkay ? "pass" : "fail",
      `Alt-Rechteck entfernte Bodenpunkt=${eraseBeforeFloor && !eraseAfterFloor}, Lochkontur mit Wand=${eraseWall}; Undo=${equal(eraseUndo.document, beforeErase.document)}, Redo=${equal(eraseRedo.document, erased.document)}.`,
      null, [path.join(screens, "erase-preview.png"), path.join(screens, "erase-after.png"),
        path.join(screens, "erase-redo.png")]);

    await choose("Polygon");
    const beforePolygon = await stage("polygon-before");
    for (const point of [{ x: 9, y: 7 }, { x: 12, y: 7 }, { x: 12, y: 10 }, { x: 9, y: 10 }])
      await click(point);
    const polygonFour = await stage("polygon-four", true);
    await page.keyboard.press("Backspace");
    const polygonThree = await stage("polygon-backspace", true);
    const backspaceOkay = polygonFour.draft?.length === 4 &&
      polygonThree.draft?.length === 3 && equal(beforePolygon.document, polygonThree.document);
    set("DD-011.05", backspaceOkay ? "pass" : "fail",
      `Polygonentwurf: Backspace verringerte Punkte ${polygonFour.draft?.length}→${polygonThree.draft?.length}; Karte unverändert.`,
      null, [path.join(screens, "polygon-four.png"), path.join(screens, "polygon-backspace.png")]);
    const doublePosition = await at({ x: 8, y: 9 });
    await page.mouse.dblclick(doublePosition.x, doublePosition.y, { delay: 90 });
    await waitPaint();
    const polygonAfter = await stage("polygon-doubleclick", true);
    const polygonOkay = polygonAfter.draft === null &&
      buildings(polygonAfter).length > buildings(beforePolygon).length;
    set("DD-011.03", polygonOkay ? "pass" : "fail",
      `Nativer Doppelklick-Abschluss: Entwurf geschlossen=${polygonAfter.draft === null}, zusätzliche Building-Kontur=${buildings(polygonAfter).length > buildings(beforePolygon).length}.`,
      null, [path.join(screens, "polygon-doubleclick.png")]);
    if (polygonAfter.draft !== null) {
      await page.keyboard.press("Escape");
      await stage("polygon-cleanup");
    }

    await page.evaluate(async () => {
      const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
      await editor.save();
    });
    const saved = await stage("saved", true);
    const file = path.join(vault, steps.mapPath);
    const fileSaved = !!saved && !saved.dirty && fs.existsSync(file);
    const threeBuildings = saved && buildings(saved).length >= 3;
    set("DD-011.15", !fileSaved ? "fail" : threeBuildings ? "pass" : "open",
      `Baukarte gespeichert: dirty=${saved?.dirty}, Datei vorhanden=${fs.existsSync(file)}, Baukonturen=${saved && buildings(saved).length}.`,
      fileSaved && !threeBuildings
        ? "Dritte Building-Kontur fehlt als Folge des offenen Doppelklick-Abschlusses DD-011.03; der Zweikonturen-Stand wird separat frisch geöffnet."
        : null, [path.join(screens, "saved.png")]);
    if (fileSaved) fs.writeFileSync(savedPath, JSON.stringify({
      mapPath: steps.mapPath, document: saved.document, sha256: digest(file),
      editOutcomes: Object.fromEntries(outcomes),
    }, null, 2) + "\n");
  } catch (error) {
    steps.errors.push(String(error?.stack ?? error));
    for (const id of group.caseIds)
      if (!outcomes.has(id) && !openReasons[id])
        openReasons[id] = `Pilotablauf vor diesem Fall abgebrochen: ${error?.message ?? error}`;
  }
  await runPointGestures();
  finish();
};
