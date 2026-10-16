import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

test("production renderer bundles for a browser without privileged imports", async () => {
  const result = await build({
    entryPoints: ["src/renderer.ts"],
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2022",
    write: false,
    metafile: true,
    plugins: [{
      name: "isolated-compute-worker",
      setup(builder) {
        builder.onResolve({ filter: /^dungeon-compute-worker$/ }, () => ({
          path: "compute-worker", namespace: "worker",
        }));
        builder.onLoad({ filter: /.*/, namespace: "worker" }, async () => {
          const worker = await build({ entryPoints: ["src/compute-worker.ts"],
            bundle: true, platform: "browser", format: "iife",
            target: "es2022", write: false });
          return { contents: "export default " +
            JSON.stringify(worker.outputFiles[0].text), loader: "js" };
        });
      },
    }],
  });
  const forbidden = Object.keys(result.metafile.inputs).filter((name) =>
    /(^|\/)(obsidian|electron|pngjs)(\/|$)|node:/.test(name));
  assert.deepEqual(forbidden, []);
  assert(result.outputFiles[0].contents.length > 0);
});
