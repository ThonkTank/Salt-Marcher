import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const worker = process.argv.includes("--atlas-network-worker");

async function main() {
  if (!worker) {
    const { build } = await import("esbuild");
    const directory = await mkdtemp(join(tmpdir(), "atlas-update-network-"));
    try {
      const outfile = join(directory, "network-test.cjs");
      await build({
        entryPoints: [fileURLToPath(import.meta.url)],
        outfile,
        bundle: true,
        platform: "node",
        target: "node24",
        format: "cjs",
        external: ["electron", "esbuild"],
        define: {
          "import.meta.url": JSON.stringify(import.meta.url),
        },
      });
      const result = spawnSync(
        require("electron"),
        [
          "--ozone-platform=headless",
          "--disable-gpu",
          outfile,
          "--atlas-network-worker",
        ],
        { encoding: "utf8", timeout: 30_000, maxBuffer: 1024 * 1024 },
      );
      if (result.error)
        throw new Error(`${result.error}\n${result.stdout}\n${result.stderr}`);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      process.stdout.write(result.stdout);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  } else {
    const { app } = require("electron");
    const { fetchElectronUpdate } =
      await import("../desktop/update-network.ts");
    const { fetchPreviewAsset, PREVIEW_MANIFEST_URL } =
      await import("../desktop/updates.ts");
    app.disableHardwareAcceleration();
    await app.whenReady();
    const seen = [];
    let streamRelease;
    let streamFinished = false;
    const streamWait = new Promise((resolve) => {
      streamRelease = resolve;
    });
    const server = createServer(async (request, response) => {
      seen.push(request.url);
      const path = new URL(request.url, "http://local.test").pathname;
      if (path === "/redirect") {
        response.writeHead(302, {
          location: "https://release-assets.githubusercontent.com/stream",
        });
        response.end();
      } else if (path === "/http") {
        response.writeHead(302, {
          location: "http://release-assets.githubusercontent.com/never",
        });
        response.end();
      } else if (path === "/foreign") {
        response.writeHead(302, {
          location: "https://untrusted.invalid/never",
        });
        response.end();
      } else if (path === "/stream") {
        response.writeHead(200, {
          "content-type": "application/octet-stream",
          "x-content-type-options": "nosniff",
          "cache-control": "no-store",
        });
        response.write(Buffer.from("first"));
        await streamWait;
        for (let i = 0; i < 256; i++) {
          if (!response.write(Buffer.alloc(64 * 1024, i % 256)))
            await once(response, "drain");
        }
        response.end("last");
        streamFinished = true;
      } else if (path === "/abort") {
        response.writeHead(200, {
          "content-type": "application/octet-stream",
          "x-content-type-options": "nosniff",
        });
        response.write("started");
      } else if (path === "/truncated") {
        response.writeHead(200, {
          "content-length": "1024",
          "content-type": "application/octet-stream",
          "x-content-type-options": "nosniff",
        });
        response.write("short");
        setTimeout(() => response.destroy(), 10);
      } else if (path === "/empty") {
        response.writeHead(204);
        response.end();
      } else {
        response.writeHead(404);
        response.end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const local = `http://127.0.0.1:${server.address().port}`;
    let checks = 0;
    try {
      // The production validator still receives only its real HTTPS endpoints.
      // This test-only adapter maps accepted transport requests to a local fixture.
      const mapped = (route) => (url, init) => {
        const path =
          url === PREVIEW_MANIFEST_URL ? route : new URL(url).pathname;
        return fetchElectronUpdate(`${local}${path}`, init);
      };
      const response = await fetchPreviewAsset(
        PREVIEW_MANIFEST_URL,
        new AbortController().signal,
        mapped("/redirect"),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(seen.splice(0), ["/redirect", "/stream"]);
      const reader = response.body.getReader();
      assert.equal(
        Buffer.from((await reader.read()).value).toString(),
        "first",
      );
      assert.equal(
        streamFinished,
        false,
        "Headers and first chunk must arrive before the installer body completes",
      );
      streamRelease();
      let bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
      }
      assert.equal(bytes, 256 * 64 * 1024 + 4);
      checks++;

      for (const route of ["/http", "/foreign"]) {
        await assert.rejects(
          fetchPreviewAsset(
            PREVIEW_MANIFEST_URL,
            new AbortController().signal,
            mapped(route),
          ),
          /unerlaubte Adresse/,
        );
        assert.deepEqual(
          seen.splice(0),
          [route],
          "Rejected redirect must never cause another request",
        );
        checks++;
      }

      const aborted = new AbortController();
      const abortResponse = await fetchElectronUpdate(`${local}/abort`, {
        signal: aborted.signal,
        redirect: "manual",
      });
      const abortReader = abortResponse.body.getReader();
      assert.equal(
        Buffer.from((await abortReader.read()).value).toString(),
        "started",
      );
      const pending = abortReader.read();
      aborted.abort();
      await assert.rejects(pending);
      checks++;

      const alreadyAborted = new AbortController();
      alreadyAborted.abort();
      const before = seen.length;
      await assert.rejects(
        fetchElectronUpdate(`${local}/never`, {
          signal: alreadyAborted.signal,
        }),
      );
      assert.equal(seen.length, before);
      checks++;

      const truncated = await fetchElectronUpdate(`${local}/truncated`, {});
      await assert.rejects(
        truncated.arrayBuffer(),
        /ERR_CONTENT_LENGTH_MISMATCH|abgebrochen|aborted|premature/i,
      );
      checks++;

      const empty = await fetchElectronUpdate(`${local}/empty`, {});
      assert.equal(empty.status, 204);
      assert.equal(empty.body, null);
      checks++;

      console.log(
        `Preview network: ${checks}/${checks} PASS on Electron ${process.versions.electron}; real redirects, 16 MiB streamed body, denied destinations and aborts.`,
      );
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      streamRelease();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      app.exit(process.exitCode ?? 0);
    }
  }
}
void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
