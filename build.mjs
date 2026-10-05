import { build } from "esbuild";
const test = process.argv.includes("--test");
await build({
  entryPoints: [test ? "tests/core.test.ts" : "src/main.ts"],
  outfile: test ? ".build/tests.cjs" : "main.js",
  bundle: true,
  format: "cjs",
  platform: test ? "node" : "browser",
  target: "es2022",
  external: ["obsidian", "electron", "node:*", "util", "stream", "zlib", "assert", "buffer"],
  sourcemap: true,
  logLevel: "info",
  minify: !test,
  plugins: [
    {
      name: "compute-worker",
      setup(builder) {
        builder.onResolve({ filter: /^dungeon-compute-worker$/ }, () => ({
          path: "compute-worker",
          namespace: "worker",
        }));
        builder.onLoad({ filter: /.*/, namespace: "worker" }, async () => {
          const worker = await build({
            entryPoints: ["src/compute-worker.ts"],
            bundle: true,
            write: false,
            format: "iife",
            platform: "browser",
            target: "es2022",
            minify: true,
          });
          return {
            contents:
              "export default " + JSON.stringify(worker.outputFiles[0].text),
            loader: "js",
          };
        });
      },
    },
  ],
});
