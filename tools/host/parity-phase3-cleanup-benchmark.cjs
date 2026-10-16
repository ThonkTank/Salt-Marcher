module.exports = ({ page, fs, path, assert, crypto, out, checks }) => {
  const fixtures = require("./phase3-fixtures.cjs")({ fs, crypto, assert });
  const wood = ["pack", "dungeondraft-builtin-1.2.0.1", "tileset",
    "res://textures/tilesets/smart/tileset_wood_vertical.png"]
    .map(encodeURIComponent).join(":");
  const ring = (count, cx, cy, rx, ry) => Array.from({ length: count }, (_, index) => {
    const angle = index * 2 * Math.PI / count;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
  const building = (id, outer) => ({ id, kind: "building", floorId: "floor-1",
    polygons: [{ outer, holes: [] }], layer: 200, fill: 0xb28f6f,
    floorAlpha: 255, wall: 0xffffff, wallWidth: 0,
    material: { assetId: wood, assetPart: "image", tileSize: 8,
      tint: 0xb28f6f, rotation: 0 } });
  async function edit() {
    await fixtures.load(page, { qaWall: false });
    const rows = [];
    for (const [width, height] of [[20, 12], [128, 128]])
      for (const points of [32, 512])
        for (const others of [0, 6]) {
          const file = `Dungeons/Parity/Cleanup-${width}-${points}-${others}.dungeon`;
          const siblings = Array.from({ length: others }, (_, i) => building(
            `other-${i}`, ring(4, width * (0.16 + i * 0.1),
              height * (0.16 + (i % 3) * 0.23), width * 0.045, height * 0.045)));
          const map = { format: "dungeon-map", version: 3, id: file,
            settings: { name: file, width, height, feetPerField: 5,
              assetPacks: [], builtInAssets: true, wallShadows: true,
              objectShadows: false, buildingWear: 0, nativeBuildingWear: true },
            floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0,
              ambient: 1 }],
            entities: [building("edited", ring(points, width / 2, height / 2,
              width * 0.28, height * 0.28)), ...siblings],
            content: { definitions: [], occurrences: [], routes: [], archive: [] } };
          await page.evaluate(async ({ file, map }) => {
            await app.vault.createFolder("Dungeons/Parity").catch(() => {});
            await app.vault.create(file, JSON.stringify(map));
            await app.workspace.getLeaf(false).openFile(
              app.vault.getAbstractFileByPath(file));
          }, { file, map });
          await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
          await page.waitForFunction(() => !!app.workspace.activeLeaf?.view?.editor
            ?.renderer.visuals.get("edited")?.floorLayer, null, { timeout: 45000 });
          await page.evaluate(() => {
            const r = app.workspace.activeLeaf.view.editor.renderer;
            const source = r.session.entities.get("edited");
            r.previewBuildingShape(structuredClone(source), 0);
          });
          await page.waitForFunction(() => !!app.workspace.activeLeaf?.view?.editor
            ?.renderer.buildingPreview?.floorGeometry, null, { timeout: 45000 });
          const result = await page.evaluate(async () => {
            const r = app.workspace.activeLeaf.view.editor.renderer;
            const before = JSON.stringify(r.session.document());
            const source = r.session.entities.get("edited");
            const geometries = new Set(), shaders = new Set(), layers = new Set();
            const samplesMs = [];
            for (let step = 0; step < 9; step++) {
              const after = structuredClone(source);
              for (const point of after.polygons[0].outer) {
                point.x += (step % 5 - 2) * 0.04;
                point.y += (step % 3 - 1) * 0.04;
              }
              const start = performance.now();
              r.previewBuildingShape(after, 0);
              samplesMs.push(performance.now() - start);
              geometries.add(r.buildingPreview.floorGeometry);
              shaders.add(r.buildingPreview.floorShader);
              layers.add(r.buildingPreview.floorLayer);
              await new Promise(resolve => requestAnimationFrame(resolve));
            }
            const preview = r.buildingPreview;
            const refs = { geometry: preview.floorGeometry,
              shader: preview.floorShader, layer: preview.floorLayer,
              mask: preview.floorMask,
              underlay: preview.floorUnderlay ?? preview.floorLayer.children[0] };
            r.cancelPreview(["edited"]);
            const ordered = [...samplesMs].sort((a, b) => a - b);
            return { medianMs: ordered[4], samplesMs,
              distinctGeometries: geometries.size,
              distinctShaders: shaders.size, distinctLayers: layers.size,
              previewGone: !r.buildingPreview,
              sourceVisible: r.visuals.get("edited").container.visible,
              geometryDestroyed: refs.geometry.attributes === null,
              shaderDestroyed: refs.shader._destroyed === true,
              layerDestroyed: refs.layer.destroyed === true,
              maskDestroyed: refs.mask.destroyed === true,
              underlayDestroyed: refs.underlay.destroyed === true,
              documentUnchanged: before === JSON.stringify(r.session.document()) };
          });
          assert.equal(result.documentUnchanged, true);
          assert.equal(result.previewGone, true);
          assert.equal(result.sourceVisible, true);
          assert.equal(result.geometryDestroyed, true);
          assert.equal(result.shaderDestroyed, true);
          assert.equal(result.layerDestroyed, true);
          assert.equal(result.maskDestroyed, true);
          assert.equal(result.underlayDestroyed, true);
          rows.push({ width, height, points, otherBuildings: others, ...result });
        }
    fs.writeFileSync(path.join(out, "cleanup-preview-benchmark.json"),
      JSON.stringify({ pckSha256: fixtures.pckSha256, rows }, null, 2));
    checks.push("Eight Building preview sizes preserve the document and release floor resources");
  }
  return { edit };
};
