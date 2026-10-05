// Import this narrow probe into the existing objekte-03 edit scenario after its
// Colorable QA package is selected. The shared runner owns the graphics slot.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const tileSelector = 'img.dn-asset-preview[alt="Paketobjekt Vorschau"]';

async function documentState(page) {
  return page.evaluate(() => {
    const editor =
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    return {
      document: editor.session.document(),
      historySize: editor.session.historySize,
      dirty: editor.session.dirty,
      defaults: { ...editor.settings.object },
    };
  });
}

async function tilePixels(page) {
  const src = await page.locator(tileSelector).getAttribute("src");
  assert(
    src?.startsWith("data:image/png;base64,"),
    "Colorable-Kachel erhielt keine gerenderte PNG-Vorschau",
  );
  const bytes = Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  const png = PNG.sync.read(bytes);
  return { png, hash: digest(bytes), byteCount: bytes.length };
}

function transitionedPixels(before, after, fromAlpha, toAlpha, rgbChange) {
  if (before.width !== after.width || before.height !== after.height) return 0;
  let count = 0;
  for (let offset = 0; offset < before.data.length; offset += 4) {
    if (
      before.data[offset + 3] !== fromAlpha ||
      after.data[offset + 3] !== toAlpha
    )
      continue;
    const changed = [0, 1, 2].some(
      (channel) =>
        before.data[offset + channel] !== after.data[offset + channel],
    );
    if (!rgbChange || changed) count++;
  }
  return count;
}

async function waitForTileTransition(
  page,
  previous,
  fromAlpha,
  toAlpha,
  rgbChange = false,
) {
  const deadline = Date.now() + 5000;
  do {
    try {
      const result = await tilePixels(page);
      if (
        result.hash !== previous.hash &&
        transitionedPixels(
          previous.png,
          result.png,
          fromAlpha,
          toAlpha,
          rgbChange,
        ) > 0
      )
        return result;
    } catch (error) {
      if (!String(error).includes("keine gerenderte PNG-Vorschau")) throw error;
    }
    await page.waitForTimeout(50);
  } while (Date.now() < deadline);
  throw new Error(
    `Bibliothekskachel zeigt A=${fromAlpha}→${toAlpha} nicht vor Picker-Schluss.`,
  );
}

async function waitForTileHash(page, expectedHash) {
  const deadline = Date.now() + 5000;
  do {
    try {
      const result = await tilePixels(page);
      if (result.hash === expectedHash) return result;
    } catch (error) {
      if (!String(error).includes("keine gerenderte PNG-Vorschau")) throw error;
    }
    await page.waitForTimeout(50);
  } while (Date.now() < deadline);
  throw new Error("Bibliothekskachel verlor ihre Farbe nach Panel-Neuaufbau.");
}

async function refreshPanel(page) {
  await page.evaluate(() => {
    app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.refreshProperties();
  });
}

function compareAlpha(a128, a0) {
  assert.equal(a128.width, a0.width);
  assert.equal(a128.height, a0.height);
  let transparentColorable = 0;
  let fixedVisible = 0;
  for (let offset = 0; offset < a128.data.length; offset += 4) {
    const half = a128.data[offset + 3];
    const zero = a0.data[offset + 3];
    if (half > 0 && half < 255 && zero === 0) transparentColorable++;
    if (
      half === 255 &&
      zero === 255 &&
      a128.data
        .subarray(offset, offset + 3)
        .every((value, channel) => value === a0.data[offset + channel])
    )
      fixedVisible++;
  }
  assert(
    transparentColorable > 0,
    "A128/A0 änderten keine färbbaren Kachelpixel",
  );
  assert(fixedVisible > 0, "Feste Kachelpixel blieben nicht sichtbar erhalten");
  return { transparentColorable, fixedVisible };
}

module.exports = async function objectLibraryTileFlow({ page, out, assetId }) {
  const tile = page.locator(tileSelector);
  await page
    .getByRole("combobox", { name: "Paketobjekt", exact: true })
    .selectOption(assetId);
  assert.equal(await tile.isVisible(), true);
  const color = page.locator('input[aria-label="Objektfarbe"]');
  await color.fill("#ff0000");
  await color.press("Tab");
  const alpha = page.locator('input[aria-label="Objektfarbe Alpha (0–255)"]');
  await alpha.fill("255");
  await alpha.press("Tab");
  const before = await documentState(page);
  const opener = page.getByRole("button", {
    name: "Objektfarbe RGBA öffnen",
    exact: true,
  });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Objektfarbe RGBA" });
  await dialog.waitFor();
  await page.waitForFunction(
    ({ selector }) => {
      const src = document.querySelector(selector)?.getAttribute("src");
      return src?.startsWith("data:image/png;base64,");
    },
    { selector: tileSelector },
  );
  const initial = await tilePixels(page);
  await dialog.getByRole("textbox", { name: "Hex ARGB" }).fill("4080c0");
  await dialog.getByRole("spinbutton", { name: "A", exact: true }).fill("128");
  assert.equal(
    await dialog.getByRole("textbox", { name: "Hex ARGB" }).inputValue(),
    "804080c0",
  );
  const half = await waitForTileTransition(page, initial, 255, 128, true);
  await tile.screenshot({
    path: path.join(out, "object-library-tile-a128-before-accept.png"),
  });
  await dialog.screenshot({
    path: path.join(out, "object-picker-tile-a128-before-accept.png"),
  });
  const beforeAccept = await documentState(page);
  assert.deepEqual(beforeAccept.document, before.document);
  assert.equal(beforeAccept.historySize, before.historySize);
  assert.equal(beforeAccept.dirty, before.dirty);
  await dialog.getByRole("button", { name: "Accept", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  const accepted = await documentState(page);
  assert.equal(accepted.defaults.color, 0x4080c0);
  assert.equal(accepted.defaults.alpha, 128);
  assert.deepEqual(accepted.document, before.document);
  assert.equal(accepted.historySize, before.historySize);
  await refreshPanel(page);
  await waitForTileHash(page, half.hash);
  await tile.screenshot({
    path: path.join(out, "object-library-tile-a128-after-refresh.png"),
  });

  await opener.click();
  await dialog.waitFor();
  await dialog.getByRole("spinbutton", { name: "A", exact: true }).fill("0");
  assert.equal(
    await dialog.getByRole("textbox", { name: "Hex ARGB" }).inputValue(),
    "004080c0",
  );
  const zero = await waitForTileTransition(page, half, 128, 0);
  await tile.screenshot({
    path: path.join(out, "object-library-tile-a0-before-escape.png"),
  });
  await dialog.press("Escape");
  await dialog.waitFor({ state: "detached" });
  const escaped = await documentState(page);
  assert.equal(escaped.defaults.color, 0x4080c0);
  assert.equal(escaped.defaults.alpha, 0);
  assert.deepEqual(escaped.document, before.document);
  assert.equal(escaped.historySize, before.historySize);
  assert.equal(escaped.dirty, before.dirty);
  assert.equal((await tilePixels(page)).hash, zero.hash);
  await refreshPanel(page);
  await waitForTileHash(page, zero.hash);
  await tile.screenshot({
    path: path.join(out, "object-library-tile-a0-after-refresh.png"),
  });
  const pixels = compareAlpha(half.png, zero.png);
  const result = {
    caseId: "DD-028.06",
    assetId,
    before: {
      historySize: before.historySize,
      dirty: before.dirty,
    },
    a128BeforeAccept: { hash: half.hash, bytes: half.byteCount },
    a0BeforeEscape: { hash: zero.hash, bytes: zero.byteCount },
    a128AfterRefresh: half.hash,
    a0AfterRefresh: zero.hash,
    pixels,
    afterEscape: {
      historySize: escaped.historySize,
      dirty: escaped.dirty,
      color: escaped.defaults.color,
      alpha: escaped.defaults.alpha,
    },
  };
  fs.writeFileSync(
    path.join(out, "object-library-tile-result.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  return result;
};

// Call after objekte-03's real tool placement. The editor selects that new
// instance and rebuilds Properties, so the tile must retain its tool color.
module.exports.verifyAfterPlacement = async function verifyAfterPlacement({
  page, out, expectedHash,
}) {
  await waitForTileHash(page, expectedHash);
  await page.locator(tileSelector).screenshot({
    path: path.join(out, "object-library-tile-after-placement.png"),
  });
};
