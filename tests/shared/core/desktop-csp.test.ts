import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const source = (name:string) => readFile(path.join(process.cwd(), "src", "app", name), "utf8");

test("desktop renderers keep styles compatible with the strict CSP", async () => {
  const [index, playerDisplay, renderer, items, player] = await Promise.all([
    source("workspace/index.html"),
    source("runtime/player-display.html"),
    source("workspace/renderer.ts"),
    source("catalog/items-ui.ts"),
    source("runtime/player-render.ts"),
  ]);

  for (const html of [index, playerDisplay]) {
    assert.match(html, /style-src 'self'/);
    assert.doesNotMatch(html, /\sstyle\s*=/i);
  }
  for (const script of [renderer, items, player]) assert.doesNotMatch(script, /\.style\./);
});
