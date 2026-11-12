import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, mkdtemp, open, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type {
  PreviewBuild,
  PreviewUpdateState,
} from "../src/editor/preview-updates";

export const PREVIEW_RELEASE_URL =
  "https://github.com/ThonkTank/Salt-Marcher/releases/tag/atlas-preview";
export const PREVIEW_DOWNLOAD_URL =
  "https://github.com/ThonkTank/Salt-Marcher/releases/download/atlas-preview/";
export const PREVIEW_MANIFEST_URL = `${PREVIEW_DOWNLOAD_URL}atlas-preview.json`;
const PACKAGE = "saltmarcher-atlas-p0";
const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const REVISION = /^[1-9][0-9]*\.[1-9][0-9]*$/;
const RPM_QUERY = "%{NAME}\n%{VERSION}\n%{RELEASE}\n%{ARCH}\n";

export interface PreviewAsset {
  name: string;
  url: string;
  sha256: string;
  size: number;
}

export interface PreviewManifest {
  schema: 1;
  channel: "atlas-preview";
  version: string;
  revision: string;
  commit: string;
  publishedAt: string;
  rpm: PreviewAsset;
  zip: PreviewAsset;
}

/** Program files may have changed, but the expected installed version is unconfirmed. */
export class RpmInstallationUncertainError extends Error {}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Der Vorschaukanal enthält ungültige Update-Daten.");
  return value as Record<string, unknown>;
}

export function parsePreviewManifest(value: unknown): PreviewManifest {
  const manifest = object(value);
  if (
    manifest.schema !== 1 ||
    manifest.channel !== "atlas-preview" ||
    typeof manifest.version !== "string" ||
    manifest.version.length > 50 ||
    !VERSION.test(manifest.version) ||
    typeof manifest.revision !== "string" ||
    manifest.revision.length > 50 ||
    !REVISION.test(manifest.revision) ||
    typeof manifest.commit !== "string" ||
    !/^[a-f0-9]{40}$/.test(manifest.commit) ||
    typeof manifest.publishedAt !== "string" ||
    !Number.isFinite(Date.parse(manifest.publishedAt))
  )
    throw new Error("Der Vorschaukanal enthält keine gültige Buildidentität.");
  const asset = (value: unknown, extension: string): PreviewAsset => {
    const candidate = object(value);
    if (
      typeof candidate.name !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,190}$/.test(candidate.name) ||
      !candidate.name.endsWith(extension) ||
      candidate.url !== `${PREVIEW_DOWNLOAD_URL}${candidate.name}` ||
      typeof candidate.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(candidate.sha256) ||
      !Number.isSafeInteger(candidate.size) ||
      (candidate.size as number) <= 0 ||
      (candidate.size as number) > MAX_PACKAGE_BYTES
    )
      throw new Error("Das Update enthält kein gültiges Linux-x64-Paket.");
    return {
      name: candidate.name,
      url: candidate.url,
      sha256: candidate.sha256,
      size: candidate.size,
    } as PreviewAsset;
  };
  return {
    schema: 1,
    channel: "atlas-preview",
    version: manifest.version,
    revision: manifest.revision,
    commit: manifest.commit,
    publishedAt: manifest.publishedAt,
    rpm: asset(manifest.rpm, ".x86_64.rpm"),
    zip: asset(manifest.zip, ".zip"),
  };
}

/** All published RPM versions and revisions use decimal components, not SemVer prereleases. */
export function comparePreviewBuilds(
  left: Pick<PreviewBuild, "version" | "revision">,
  right: Pick<PreviewBuild, "version" | "revision">,
): number {
  for (const key of ["version", "revision"] as const) {
    const a = (left[key] ?? "0").split(".").map(BigInt);
    const b = (right[key] ?? "0").split(".").map(BigInt);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] ?? 0n) > (b[i] ?? 0n)) return 1;
      if ((a[i] ?? 0n) < (b[i] ?? 0n)) return -1;
    }
  }
  return 0;
}

export type UpdateFetch = (url: string, init: RequestInit) => Promise<Response>;

/** GitHub release downloads redirect to its asset CDN; no HTTP or arbitrary host is accepted. */
export async function fetchPreviewAsset(
  url: string,
  signal: AbortSignal,
  fetcher: UpdateFetch,
): Promise<Response> {
  for (let redirects = 0; redirects <= 4; redirects++) {
    const target = new URL(url);
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.port ||
      !(
        (target.hostname === "github.com" &&
          target.pathname.startsWith(
            "/ThonkTank/Salt-Marcher/releases/download/atlas-preview/",
          )) ||
        target.hostname === "release-assets.githubusercontent.com" ||
        target.hostname === "objects.githubusercontent.com"
      )
    )
      throw new Error(
        "Der Download wurde auf eine unerlaubte Adresse umgeleitet.",
      );
    const response = await fetcher(url, {
      signal,
      redirect: "manual",
      cache: "no-store",
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location)
        throw new Error("Der Update-Download hat kein gültiges Ziel.");
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        response.status === 404
          ? "Der Vorschau-Download ist gerade nicht verfügbar. Bitte später erneut prüfen."
          : `GitHub konnte das Update nicht liefern (HTTP ${response.status}).`,
      );
    }
    return response;
  }
  throw new Error("Zu viele Weiterleitungen beim Update-Download.");
}

async function readSmallJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Die Update-Antwort ist leer.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 64 * 1024) throw new Error("Die Update-Antwort ist zu groß.");
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel();
  }
}

async function verifyFile(path: string, asset: PreviewAsset) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    size += chunk.length;
    if (size > asset.size)
      throw new Error("Die heruntergeladene Datei wurde verändert.");
    hash.update(chunk);
  }
  if (size !== asset.size || hash.digest("hex") !== asset.sha256)
    throw new Error(
      "Größe oder Prüfsumme des Updates stimmt nicht. Bitte erneut herunterladen.",
    );
}

export class PreviewUpdater {
  private state: PreviewUpdateState;
  private manifest: PreviewManifest | null = null;
  private directory: string | null = null;
  private packagePath: string | null = null;
  private busy = false;
  private disposed = false;
  private abort: AbortController | null = null;

  constructor(
    private readonly options: {
      current: PreviewBuild;
      supported: boolean;
      canInstall: boolean;
      cacheDirectory: string;
      fetch: UpdateFetch;
      install: (path: string, release: PreviewManifest) => Promise<void>;
      changed: (state: PreviewUpdateState) => void;
    },
  ) {
    this.state = {
      status: options.supported ? "idle" : "unsupported",
      current: { ...options.current },
      available: null,
      downloadedBytes: 0,
      totalBytes: 0,
      message: options.supported
        ? "Vorschau-Updates werden beim Start geprüft."
        : "Updates sind in der gepackten Linux-x64-Anwendung verfügbar.",
      canInstall: options.supported && options.canInstall,
      downloaded: false,
    };
  }

  snapshot(): PreviewUpdateState {
    return structuredClone(this.state);
  }

  private change(update: Partial<PreviewUpdateState>) {
    this.state = { ...this.state, ...update };
    if (!this.disposed) this.options.changed(this.snapshot());
  }

  private async operation(action: () => Promise<void>) {
    if (this.busy || this.disposed || !this.options.supported)
      return this.snapshot();
    this.busy = true;
    try {
      await action();
    } catch (error) {
      this.change({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.busy = false;
    }
    return this.snapshot();
  }

  private async network<T>(
    milliseconds: number,
    action: (signal: AbortSignal) => Promise<T>,
  ) {
    const controller = new AbortController();
    this.abort = controller;
    const timeout = setTimeout(() => controller.abort(), milliseconds);
    try {
      return await action(controller.signal);
    } finally {
      clearTimeout(timeout);
      this.abort = null;
    }
  }

  private async clearDownload() {
    if (this.directory)
      await rm(this.directory, { recursive: true, force: true });
    this.directory = null;
    this.packagePath = null;
    this.change({ downloaded: false, downloadedBytes: 0, totalBytes: 0 });
  }

  check() {
    return this.operation(async () => {
      if (["installed", "restart-required"].includes(this.state.status)) return;
      this.change({
        status: "checking",
        message: "Vorschau-Updates werden geprüft …",
      });
      const manifest = await this.network(20_000, async (signal) =>
        parsePreviewManifest(
          await readSmallJson(
            await fetchPreviewAsset(
              PREVIEW_MANIFEST_URL,
              signal,
              this.options.fetch,
            ),
          ),
        ),
      );
      await this.clearDownload();
      this.manifest = null;
      this.change({ available: null });
      if (comparePreviewBuilds(manifest, this.state.current) <= 0) {
        this.change({
          status: "current",
          message:
            "Diese Vorschau ist auf dem neuesten veröffentlichten Stand.",
        });
        return;
      }
      this.manifest = manifest;
      this.change({
        status: "available",
        available: {
          version: manifest.version,
          revision: manifest.revision,
          commit: manifest.commit,
          publishedAt: manifest.publishedAt,
        },
        message: this.state.canInstall
          ? "Ein neuer Teststand ist verfügbar."
          : "Ein neuer Teststand ist verfügbar. Die Installation in der App benötigt die installierte Fedora-RPM-Ausgabe mit DNF und Polkit.",
      });
    });
  }

  download() {
    return this.operation(async () => {
      if (
        !this.manifest ||
        ["installed", "restart-required"].includes(this.state.status)
      )
        return;
      await this.clearDownload();
      const release = this.manifest;
      this.change({
        status: "downloading",
        message: "Update wird heruntergeladen …",
        totalBytes: release.rpm.size,
      });
      try {
        await mkdir(this.options.cacheDirectory, { recursive: true });
        this.directory = await mkdtemp(
          join(this.options.cacheDirectory, "atlas-preview-"),
        );
        const temporary = join(this.directory, `${release.rpm.name}.part`);
        const destination = join(this.directory, release.rpm.name);
        await this.network(10 * 60_000, async (signal) => {
          const response = await fetchPreviewAsset(
            release.rpm.url,
            signal,
            this.options.fetch,
          );
          const reader = response.body?.getReader();
          if (!reader) throw new Error("Der Paketdownload ist leer.");
          const file = await open(temporary, "wx", 0o600);
          const hash = createHash("sha256");
          let bytes = 0;
          let notified = 0;
          try {
            for (;;) {
              const chunk = await reader.read();
              if (chunk.done) break;
              bytes += chunk.value.byteLength;
              if (bytes > release.rpm.size)
                throw new Error(
                  "Der Paketdownload ist größer als angekündigt.",
                );
              await file.writeFile(chunk.value);
              hash.update(chunk.value);
              if (Date.now() - notified >= 150) {
                this.change({ downloadedBytes: bytes });
                notified = Date.now();
              }
            }
            if (
              bytes !== release.rpm.size ||
              hash.digest("hex") !== release.rpm.sha256
            )
              throw new Error(
                "Größe oder Prüfsumme des Updates stimmt nicht. Bitte erneut herunterladen.",
              );
            await file.sync();
          } finally {
            await file.close();
            await reader.cancel();
          }
        });
        await rename(temporary, destination);
        this.packagePath = destination;
        this.change({
          status: "ready",
          downloaded: true,
          downloadedBytes: release.rpm.size,
          message: this.state.canInstall
            ? "Download geprüft. Die Installation benötigt deine Bestätigung im Systemdialog."
            : "Download geprüft. Installiere die Fedora-RPM-Ausgabe über die Release-Seite, um Updates direkt in der App einzuspielen.",
        });
      } catch (error) {
        await this.clearDownload();
        throw error;
      }
    });
  }

  install() {
    return this.operation(async () => {
      if (["installed", "restart-required"].includes(this.state.status)) return;
      if (
        !this.state.canInstall ||
        !this.manifest ||
        !this.packagePath ||
        !this.state.downloaded
      )
        throw new Error("Es liegt kein geprüftes, installierbares Update vor.");
      this.change({
        status: "installing",
        message:
          "Update wird installiert. Bitte die Systemabfrage bestätigen …",
      });
      try {
        await verifyFile(this.packagePath, this.manifest.rpm);
      } catch (error) {
        await this.clearDownload();
        throw error;
      }
      try {
        await this.options.install(this.packagePath, this.manifest);
      } catch (error) {
        if (!(error instanceof RpmInstallationUncertainError)) throw error;
        this.change({ status: "restart-required", message: error.message });
        return;
      }
      // Removal is housekeeping; a cleanup failure cannot undo a verified system
      // installation or enable another attempt to install the same version.
      await this.clearDownload().catch(() => {});
      this.change({
        status: "installed",
        message:
          "Die neue Paketversion ist installiert. Zum Verwenden bitte neu starten.",
      });
    });
  }

  async dispose() {
    this.disposed = true;
    this.abort?.abort();
    // Do not remove a package while the system package manager is reading it.
    if (!this.busy) await this.clearDownload();
  }
}

export type RpmCommand = (
  file: string,
  args: string[],
  installing?: boolean,
) => Promise<string>;
const execute = promisify(execFile);

export const runRpmCommand: RpmCommand = async (
  file,
  args,
  installing = false,
) => {
  if (!installing) {
    const result = await execute(file, args, {
      timeout: 10_000,
      maxBuffer: 64 * 1024,
    });
    return result.stdout;
  }
  // A transaction must never be killed by an output-buffer limit or UI timeout.
  return new Promise<string>((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let tail = "";
    const collect = (chunk: Buffer) => {
      tail = (tail + chunk.toString("utf8")).slice(-8_192);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(tail);
      else if (code === 126 || code === 127)
        reject(
          new Error(
            "Die Systemfreigabe wurde abgebrochen oder nicht erteilt. Das Update wurde nicht bestätigt.",
          ),
        );
      else
        reject(
          new RpmInstallationUncertainError(
            `Die Paketinstallation konnte nicht bestätigt werden (${code}). Bitte die App neu starten, bevor du weiterarbeitest. ${tail.trim().slice(-1_000)}`,
          ),
        );
    });
  });
};

function parseRpmIdentity(output: string) {
  const [name, version, revision, arch, ...rest] = output.trim().split("\n");
  if (
    name !== PACKAGE ||
    !version ||
    !VERSION.test(version) ||
    !revision ||
    !/^[0-9]+(?:\.[0-9]+)*$/.test(revision) ||
    arch !== "x86_64" ||
    rest.length
  )
    throw new Error(
      "Die RPM-Paketidentität passt nicht zum Atlas-Vorschaukanal.",
    );
  return { version, revision };
}

export async function canInstallRpm(
  executable: string,
  run: RpmCommand = runRpmCommand,
) {
  if (process.platform !== "linux" || process.arch !== "x64") return false;
  try {
    await Promise.all(
      ["/usr/bin/pkexec", "/usr/bin/dnf", "/usr/bin/rpm"].map((path) =>
        access(path, constants.X_OK),
      ),
    );
    parseRpmIdentity(
      await run("/usr/bin/rpm", [
        "-qf",
        executable,
        "--queryformat",
        RPM_QUERY,
      ]),
    );
    return true;
  } catch {
    return false;
  }
}

export async function installPreviewRpm(
  path: string,
  release: PreviewManifest,
  run: RpmCommand = runRpmCommand,
) {
  const candidate = parseRpmIdentity(
    await run("/usr/bin/rpm", ["-qp", "--queryformat", RPM_QUERY, path]),
  );
  if (
    candidate.version !== release.version ||
    candidate.revision !== release.revision
  )
    throw new Error(
      "Das RPM enthält eine andere Version als der geprüfte Download.",
    );
  const installed = parseRpmIdentity(
    await run("/usr/bin/rpm", ["-q", "--queryformat", RPM_QUERY, PACKAGE]),
  );
  if (comparePreviewBuilds(candidate, installed) <= 0)
    throw new Error(
      "Diese oder eine neuere Paketversion ist bereits installiert. Es wird keine ältere Version installiert.",
    );
  await run(
    "/usr/bin/pkexec",
    ["/usr/bin/dnf", "install", "--assumeyes", path],
    true,
  );
  try {
    const result = parseRpmIdentity(
      await run("/usr/bin/rpm", ["-q", "--queryformat", RPM_QUERY, PACKAGE]),
    );
    if (
      result.version !== candidate.version ||
      result.revision !== candidate.revision
    )
      throw new Error(
        "Die Installation hat die erwartete Paketversion nicht bestätigt.",
      );
  } catch (error) {
    throw new RpmInstallationUncertainError(
      `${error instanceof Error ? error.message : String(error)} Bitte die App neu starten, bevor du weiterarbeitest.`,
    );
  }
}
