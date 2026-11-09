import { _electron as electron } from "@playwright/test";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);

/** One real process launcher for the functional smoke and the measured scenarios. */
export async function launchAtlasDesktop({
  executablePath,
  lab = true,
  diagnostics = false,
  project,
  env: overrides = {},
} = {}) {
  const packaged = Boolean(executablePath);
  executablePath = packaged ? resolve(executablePath) : require("electron");
  const env = { ...process.env };
  // A previous diagnostic invocation must not silently change the next start.
  for (const key of Object.keys(env))
    if (key.startsWith("ATLAS_P0_") || key === "ELECTRON_RUN_AS_NODE")
      delete env[key];
  Object.assign(env, overrides);
  if (project) env.ATLAS_P0_PROJECT = project;
  if (diagnostics) env.ATLAS_P0_DIAGNOSTICS = "1";
  else delete env.ATLAS_P0_DIAGNOSTICS;
  delete env.ELECTRON_RUN_AS_NODE;
  const args = lab
    ? [
        "--ozone-platform=headless",
        "--ozone-override-screen-size=1600,1200",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ]
    : [];
  if (!packaged) args.push(join(root, "desktop-dist/main.cjs"));
  const app = await electron.launch({
    executablePath,
    args,
    env,
    timeout: 30_000,
  });
  const output = [];
  const errors = [];
  app.process().stdout?.on("data", (data) => output.push(String(data)));
  app.process().stderr?.on("data", (data) => output.push(String(data)));
  let closed = false;
  app.on("close", () => {
    closed = true;
  });
  let closing;
  const close = () => {
    if (closed) return Promise.resolve();
    return (closing ??= app.close().catch((error) => {
      if (!closed) throw error;
    }));
  };
  try {
    const page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(String(error)));
    // Pixi reports GLSL compilation/link failures through the console without
    // throwing a page error. Preserve those diagnostics alongside process output.
    page.on("console", (message) => {
      if (message.type() === "error")
        output.push(`[renderer-error] ${message.text()}\n`);
    });
    page.setDefaultTimeout(20_000);
    return { app, page, executablePath, packaged, args, errors, output, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Pixel content only; capturePage is deliberately never a presentation timestamp. */
export async function captureCanvas(session, name, samples) {
  const box = await session.page.locator("canvas").boundingBox();
  if (!box) throw new Error("Canvas unavailable for image check");
  const rect = {
    x: Math.ceil(box.x),
    y: Math.ceil(box.y),
    width: Math.floor(box.width),
    height: Math.floor(box.height),
  };
  const result = await session.app.evaluate(
    async ({ BrowserWindow }, { rect, samples }) => {
      const image =
        await BrowserWindow.getAllWindows()[0].webContents.capturePage(rect);
      const size = image.getSize();
      const bitmap = image.toBitmap();
      const pixels = samples.map(({ x, y }) => {
        if (x < 0 || y < 0 || x >= size.width || y >= size.height) return null;
        const offset = (y * size.width + x) * 4;
        return [
          bitmap[offset + 2],
          bitmap[offset + 1],
          bitmap[offset],
          bitmap[offset + 3],
        ];
      });
      return { size, pixels, png: image.toPNG().toString("base64") };
    },
    { rect, samples },
  );
  const bytes = Buffer.from(result.png, "base64");
  await writeFile(join(session.directory, `${name}.png`), bytes);
  return {
    file: `${session.instance.id}/${name}.png`,
    size: result.size,
    pixels: result.pixels,
    screenPoints: samples,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    method:
      "Electron capturePage outside timed interval; content evidence only",
  };
}
