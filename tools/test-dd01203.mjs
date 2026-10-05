import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const inputs = [
  "tests/bau-building-point-gestures.test.mjs",
  "tests/bau-building-preview-renderer.test.mjs",
];
const outputs = [];
for (const [index, entry] of inputs.entries()) {
  const outfile = `.build/dd01203-${index}.test.cjs`;
  await build({
    entryPoints: [entry], outfile, bundle: true, platform: "node", format: "cjs",
    plugins: [{
      name: "stub-unused-render-worker",
      setup(builder) {
        builder.onResolve({ filter: /^dungeon-compute-worker$/ }, () => ({
          path: "stub", namespace: "worker",
        }));
        builder.onLoad({ filter: /.*/, namespace: "worker" }, () => ({
          contents: 'export default ""', loader: "js",
        }));
      },
    }],
  });
  outputs.push(outfile);
}
const result = spawnSync(process.execPath, ["--test", ...outputs], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
