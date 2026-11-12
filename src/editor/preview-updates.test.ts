import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  comparePreviewBuilds,
  fetchPreviewAsset,
  installPreviewRpm,
  parsePreviewManifest,
  PREVIEW_DOWNLOAD_URL,
  PREVIEW_MANIFEST_URL,
  PreviewUpdater,
  RpmInstallationUncertainError,
  type PreviewManifest,
  type RpmCommand,
} from "../../desktop/updates";

const payload = Buffer.from("verified RPM fixture bytes");
const current = {
  version: "0.3.1",
  revision: "42940000000.1",
  commit: "a".repeat(40),
};
function release(): PreviewManifest {
  const asset = (name: string) => ({
    name,
    url: PREVIEW_DOWNLOAD_URL + name,
    sha256: createHash("sha256").update(payload).digest("hex"),
    size: payload.length,
  });
  return {
    schema: 1,
    channel: "atlas-preview",
    version: "0.3.1",
    revision: "42940000001.1",
    commit: "b".repeat(40),
    publishedAt: "2026-11-11T12:00:00Z",
    rpm: asset("saltmarcher-atlas-p0-0.3.1-42940000001.1.x86_64.rpm"),
    zip: asset("saltmarcher-atlas-p0-0.3.1-42940000001.1.linux-x64.zip"),
  };
}

let directory: string;
const instances: PreviewUpdater[] = [];
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "atlas-update-test-"));
});
afterEach(async () => {
  await Promise.all(instances.splice(0).map((updater) => updater.dispose()));
  await rm(directory, { recursive: true, force: true });
});

function setup({
  manifest = release(),
  bytes = payload,
  supported = true,
  canInstall = true,
} = {}) {
  const install = vi.fn(async () => {});
  const fetch = vi.fn(async (url: string) =>
    url === PREVIEW_MANIFEST_URL
      ? Response.json(manifest)
      : new Response(bytes),
  );
  const changed = vi.fn();
  const updater = new PreviewUpdater({
    current,
    supported,
    canInstall,
    cacheDirectory: directory,
    fetch,
    install,
    changed,
  });
  instances.push(updater);
  return { updater, fetch, install, changed };
}

describe("preview selection and download integrity", () => {
  it("finds a newer build, streams verified bytes and only installs after the explicit action", async () => {
    const { updater, fetch, install, changed } = setup();
    expect((await updater.check()).status).toBe("available");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(install).not.toHaveBeenCalled();
    const downloaded = await updater.download();
    expect(downloaded.status).toBe("ready");
    expect(downloaded.downloadedBytes).toBe(payload.length);
    expect(install).not.toHaveBeenCalled();
    install.mockImplementationOnce(async (...args: unknown[]) => {
      expect(await readFile(args[0] as string)).toEqual(payload);
      expect(args[1]).toEqual(release());
    });
    expect((await updater.install()).status).toBe("installed");
    expect(install).toHaveBeenCalledTimes(1);
    expect(await readdir(directory)).toEqual([]);
    expect(
      changed.mock.calls.some(([state]) => state.status === "downloading"),
    ).toBe(true);
  });

  it.each(["42940000000.1", "42939999999.99"])(
    "does not offer same/older revision %s",
    async (revision) => {
      const manifest = { ...release(), revision };
      const { updater, install } = setup({ manifest });
      expect((await updater.check()).status).toBe("current");
      expect(updater.snapshot().available).toBeNull();
      await updater.download();
      await updater.install();
      expect(install).not.toHaveBeenCalled();
    },
  );

  it("orders retries and large build identifiers without numeric rounding", () => {
    expect(
      comparePreviewBuilds(
        { version: "0.3.1", revision: "9007199254740993.1" },
        { version: "0.3.1", revision: "9007199254740992.99" },
      ),
    ).toBe(1);
    expect(
      comparePreviewBuilds({ ...current, revision: "42940000000.2" }, current),
    ).toBe(1);
    expect(
      comparePreviewBuilds(
        { version: "0.3.0", revision: "99999999999.1" },
        current,
      ),
    ).toBe(-1);
    expect(
      comparePreviewBuilds(current, { version: "0.3.1", revision: null }),
    ).toBe(1);
  });

  it.each([
    ["same-sized corruption", Buffer.alloc(payload.length, 120)],
    ["truncation", payload.subarray(0, -1)],
    ["oversized body", Buffer.concat([payload, Buffer.from("extra")])],
  ])("refuses %s and leaves no installable file", async (_name, bytes) => {
    const { updater, install } = setup({ bytes });
    await updater.check();
    expect((await updater.download()).status).toBe("error");
    expect(updater.snapshot().downloaded).toBe(false);
    expect(await readdir(directory)).toEqual([]);
    await updater.install();
    expect(install).not.toHaveBeenCalled();
  });

  it("rechecks a downloaded file immediately before invoking the system installer", async () => {
    const { updater, install } = setup();
    await updater.check();
    await updater.download();
    const [download] = await readdir(directory);
    await writeFile(
      join(directory, download, release().rpm.name),
      Buffer.alloc(payload.length),
    );
    expect((await updater.install()).status).toBe("error");
    expect(updater.snapshot().downloaded).toBe(false);
    expect(install).not.toHaveBeenCalled();
  });

  it("serializes repeated downloads and installation attempts", async () => {
    const { updater, fetch, install } = setup();
    await updater.check();
    let finish!: () => void;
    fetch.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return new Response(payload);
    });
    const first = updater.download();
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    expect((await updater.download()).status).toBe("downloading");
    expect((await updater.install()).status).toBe("downloading");
    finish();
    expect((await first).status).toBe("ready");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(install).not.toHaveBeenCalled();
  });

  it("reports a network failure and allows a later successful check", async () => {
    const { updater, fetch } = setup();
    fetch.mockRejectedValueOnce(new Error("offline"));
    expect((await updater.check()).message).toContain("offline");
    expect((await updater.check()).status).toBe("available");
  });

  it("does not make network calls from an unsupported local build", async () => {
    const { updater, fetch, install } = setup({ supported: false });
    expect((await updater.check()).status).toBe("unsupported");
    await updater.download();
    await updater.install();
    expect(fetch).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
  });

  it("keeps a verified download after a rejected system prompt and allows retry", async () => {
    const { updater, install } = setup();
    await updater.check();
    await updater.download();
    install.mockRejectedValueOnce(new Error("Systemfreigabe abgebrochen"));
    const failed = await updater.install();
    expect(failed.status).toBe("error");
    expect(failed.downloaded).toBe(true);
    expect((await updater.install()).status).toBe("installed");
    expect(install).toHaveBeenCalledTimes(2);
  });

  it("cannot install on a system without RPM/DNF support", async () => {
    const { updater, install } = setup({ canInstall: false });
    await updater.check();
    await updater.download();
    expect((await updater.install()).status).toBe("error");
    expect(install).not.toHaveBeenCalled();
  });

  it("requires a restart without claiming success when system files may have changed", async () => {
    const { updater, install, fetch } = setup();
    await updater.check();
    await updater.download();
    install.mockRejectedValueOnce(
      new RpmInstallationUncertainError("Paketversion nicht bestätigt"),
    );
    expect((await updater.install()).status).toBe("restart-required");
    expect((await updater.check()).status).toBe("restart-required");
    expect((await updater.download()).status).toBe("restart-required");
    expect((await updater.install()).status).toBe("restart-required");
    expect(install).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("channel boundary", () => {
  it.each([
    { channel: "stable" },
    { revision: "0.1" },
    { revision: "1e30.1" },
    { version: "0.3.1-preview" },
    { commit: "not-a-commit" },
    { schema: 2 },
    { publishedAt: "invalid" },
  ])("rejects unrelated or malformed release data %j", (change) => {
    expect(() => parsePreviewManifest({ ...release(), ...change })).toThrow();
  });

  it.each([
    { url: "https://example.org/installer.rpm" },
    { name: "../escape.x86_64.rpm" },
    { name: "other.aarch64.rpm" },
    { sha256: "wrong" },
    { size: 0 },
    { size: 513 * 1024 * 1024 },
  ])("rejects an untrusted RPM descriptor %j", (change) => {
    const manifest = release();
    expect(() =>
      parsePreviewManifest({
        ...manifest,
        rpm: { ...manifest.rpm, ...change },
      }),
    ).toThrow();
  });

  it("follows an HTTPS GitHub asset redirect and rejects other hosts before contacting them", async () => {
    const fetch = vi.fn(async () => new Response(payload));
    fetch.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: {
          location:
            "https://release-assets.githubusercontent.com/github-production-release-asset/file?signature=example",
        },
      }),
    );
    const response = await fetchPreviewAsset(
      release().rpm.url,
      new AbortController().signal,
      fetch,
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(payload);
    expect(fetch).toHaveBeenCalledTimes(2);
    fetch.mockClear();
    fetch.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://untrusted.example/download" },
      }),
    );
    await expect(
      fetchPreviewAsset(release().rpm.url, new AbortController().signal, fetch),
    ).rejects.toThrow("unerlaubte");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects HTTPS downgrade and cyclic redirects", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            location:
              "http://github.com/ThonkTank/Salt-Marcher/releases/download/atlas-preview/a",
          },
        }),
    );
    await expect(
      fetchPreviewAsset(release().rpm.url, new AbortController().signal, fetch),
    ).rejects.toThrow("unerlaubte");
    fetch.mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: release().rpm.url },
        }),
    );
    await expect(
      fetchPreviewAsset(release().rpm.url, new AbortController().signal, fetch),
    ).rejects.toThrow("Zu viele");
  });
});

describe("actual package-manager contract", () => {
  const identity = (
    revision: string,
    version = "0.3.1",
    name = "saltmarcher-atlas-p0",
  ) => `${name}\n${version}\n${revision}\nx86_64\n`;
  function commands({
    installed = current.revision,
    after = release().revision,
    rpm = identity(release().revision),
    failure = false,
  } = {}) {
    let queried = 0;
    const run = vi.fn<RpmCommand>(async (file, args) => {
      if (args[0] === "-qp") return rpm;
      if (file === "/usr/bin/pkexec") {
        if (failure) throw new Error("authorization denied");
        return "installed";
      }
      return identity(queried++ ? after : installed!);
    });
    return run;
  }

  it("uses a fixed argv command and verifies the installed version after success", async () => {
    const run = commands();
    const path = "/private/cache/rpm with spaces.x86_64.rpm";
    await installPreviewRpm(path, release(), run);
    expect(run.mock.calls[2]).toEqual([
      "/usr/bin/pkexec",
      ["/usr/bin/dnf", "install", "--assumeyes", path],
      true,
    ]);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it.each([current.revision, "42949999999.1"])(
    "refuses an unconfirmed installed result %s even after exit zero",
    async (after) => {
      await expect(
        installPreviewRpm("/cache/package.rpm", release(), commands({ after })),
      ).rejects.toThrow("nicht bestätigt");
    },
  );

  it("does not downgrade the installed RPM even when the running app is older", async () => {
    const run = commands({ installed: "42949999999.1" });
    await expect(
      installPreviewRpm("/cache/package.rpm", release(), run),
    ).rejects.toThrow("keine ältere");
    expect(run.mock.calls.some(([file]) => file === "/usr/bin/pkexec")).toBe(
      false,
    );
  });

  it("rejects an RPM with another package identity before invoking privileged installation", async () => {
    const run = commands({
      rpm: identity(release().revision, "0.3.1", "other-package"),
    });
    await expect(
      installPreviewRpm("/cache/package.rpm", release(), run),
    ).rejects.toThrow("Paketidentität");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("preserves a failed or cancelled system installation as a failure", async () => {
    await expect(
      installPreviewRpm(
        "/cache/package.rpm",
        release(),
        commands({ failure: true }),
      ),
    ).rejects.toThrow("authorization denied");
  });
});
