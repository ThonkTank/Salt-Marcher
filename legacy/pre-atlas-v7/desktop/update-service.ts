import { randomUUID } from 'node:crypto';
import { writeFile, mkdir, rm, rename, open, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import type { UpdateStatus } from '../src/app/workspace/update-contracts';
import { atomicJSON, readJSON, requireSpace } from './update-files';
import {
  manifestName,
  newerVersion,
  releaseCandidates,
  releaseAssetURL,
  updateRepository,
  verifyManifest,
  type UpdateManifest,
} from './update-manifest';
import { unpackUpdate } from './update-package';
export interface DownloadedUpdate {
  directory: string;
  manifest: UpdateManifest;
  manifestBytes: string;
  signature: string;
}
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
const allowedHosts = new Set([
  'api.github.com',
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
]);
export async function githubFetch(
  url: string,
  init: RequestInit = {},
  request: Fetcher = fetch,
): Promise<Response> {
  for (let n = 0; n < 6; n++) {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password || !allowedHosts.has(u.hostname))
      throw new Error('Unerlaubtes Updateziel.');
    const r = await request(url, {
      ...init,
      redirect: 'manual',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SaltMarcher-Updater' },
    });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      await r.body?.cancel();
      const next = r.headers.get('location');
      if (!next) throw new Error('Ungültige GitHub-Weiterleitung.');
      url = new URL(next, url).href;
      continue;
    }
    if (!r.ok) {
      await r.body?.cancel();
      throw new Error(
        r.status === 403 || r.status === 429
          ? 'GitHub begrenzt die Anfragen. Bitte später erneut prüfen.'
          : `GitHub-Updateabruf fehlgeschlagen (${r.status}).`,
      );
    }
    return r;
  }
  throw new Error('Zu viele Updateweiterleitungen.');
}
async function limitedBytes(response: Response, limit: number) {
  let size = 0;
  const parts: Buffer[] = [];
  if (!response.body) throw new Error('Leere Updateantwort.');
  for await (const part of response.body as unknown as AsyncIterable<Uint8Array>) {
    size += part.length;
    if (size > limit) throw new Error('Updateantwort ist zu groß.');
    parts.push(Buffer.from(part));
  }
  return Buffer.concat(parts);
}
export class UpdateService {
  private state: UpdateStatus;
  private controller: AbortController | null = null;
  private manifest: UpdateManifest | null = null;
  private signed: Buffer | null = null;
  private signature: Buffer | null = null;
  private prepared: DownloadedUpdate | null = null;
  constructor(
    private config: {
      version: string;
      root: string | null;
      settings: string;
      publicKey: string;
      emit: (s: UpdateStatus) => void;
      request?: Fetcher;
    },
  ) {
    this.state = {
      phase: config.root ? 'idle' : 'unsupported',
      currentVersion: config.version,
      automatic: true,
      lastChecked: null,
      available: null,
      received: 0,
      total: 0,
      message: config.root
        ? ''
        : 'Für In-App-Updates SaltMarcher mit Installieren.sh im Benutzerkonto installieren.',
    };
  }
  status() {
    return structuredClone(this.state);
  }
  private publish(patch: Partial<UpdateStatus>) {
    Object.assign(this.state, patch);
    this.config.emit(this.status());
    return this.status();
  }
  async init() {
    try {
      const p = await readJSON<{ automatic: boolean; lastChecked: string | null }>(
        this.config.settings,
      );
      if (typeof p.automatic === 'boolean') this.state.automatic = p.automatic;
      if (
        p.lastChecked === null ||
        (typeof p.lastChecked === 'string' && Number.isFinite(Date.parse(p.lastChecked)))
      )
        this.state.lastChecked = p.lastChecked;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
        this.publish({
          automatic: false,
          message:
            'Updateeinstellungen konnten nicht gelesen werden. Automatische Suche bleibt aus.',
        });
    }
    if (this.config.root) {
      const previous = await readJSON<{ message: string }>(
        path.join(this.config.root, '.update-error.json'),
      ).catch(() => null);
      if (previous && typeof previous.message === 'string')
        this.publish({
          phase: 'error',
          message: 'Letztes Update fehlgeschlagen: ' + previous.message,
        });
    }
    return this.status();
  }
  private save() {
    return atomicJSON(this.config.settings, {
      automatic: this.state.automatic,
      lastChecked: this.state.lastChecked,
    });
  }
  async automatic(enabled: boolean) {
    if (typeof enabled !== 'boolean') throw new Error('Updateeinstellung ungültig.');
    this.state.automatic = enabled;
    await this.save();
    return this.publish({});
  }
  async autoCheck() {
    if (
      this.config.root &&
      this.state.automatic &&
      (!this.state.lastChecked || Date.now() - Date.parse(this.state.lastChecked) >= 86400000)
    )
      await this.check();
  }
  private root() {
    if (!this.config.root) throw new Error(this.state.message);
    return this.config.root;
  }
  async check() {
    this.root();
    if (this.controller || this.state.phase === 'installing') return this.status();
    const control = new AbortController();
    this.controller = control;
    const signal = AbortSignal.any([control.signal, AbortSignal.timeout(30000)]);
    this.publish({ phase: 'checking', message: 'Nach Updates suchen…' });
    try {
      this.state.lastChecked = new Date().toISOString();
      await this.save();
      let candidate: {
        manifest: UpdateManifest;
        signed: Buffer;
        signature: Buffer;
        notes: string;
      } | null = null;
      // Scan past historical releases; never trust GitHub's latest pointer alone.
      for (let page = 1; page <= 10; page++) {
        const list = JSON.parse(
          (
            await limitedBytes(
              await githubFetch(
                `https://api.github.com/repos/${updateRepository}/releases?per_page=100&page=${page}`,
                { signal },
                this.config.request,
              ),
              4 * 1024 ** 2,
            )
          ).toString(),
        );
        for (const release of releaseCandidates(list, this.config.version)) {
          const signed = await limitedBytes(
            await githubFetch(
              releaseAssetURL(release.version, manifestName),
              { signal },
              this.config.request,
            ),
            65536,
          );
          const signature = await limitedBytes(
            await githubFetch(
              releaseAssetURL(release.version, manifestName + '.sig'),
              { signal },
              this.config.request,
            ),
            64,
          );
          const manifest = verifyManifest(signed, signature, this.config.publicKey);
          if (manifest.version !== release.version)
            throw new Error('Releasetag und Manifestversion stimmen nicht überein.');
          if (!candidate || newerVersion(manifest.version, candidate.manifest.version))
            candidate = { manifest, signed, signature, notes: release.notes };
        }
        if (list.length < 100) break;
      }
      if (!candidate) {
        this.manifest = null;
        this.prepared = null;
        return this.publish({
          phase: 'idle',
          available: null,
          message: 'Keine neuere freigegebene Version verfügbar.',
        });
      }
      if (this.prepared?.manifest.version !== candidate.manifest.version) this.prepared = null;
      this.manifest = candidate.manifest;
      this.signed = candidate.signed;
      this.signature = candidate.signature;
      return this.publish({
        phase: this.prepared ? 'ready' : 'available',
        available: { version: candidate.manifest.version, notes: candidate.notes },
        total: candidate.manifest.bytes,
        received: 0,
        message: this.prepared ? 'Update ist bereit.' : 'Eine neue Version ist verfügbar.',
      });
    } catch (e) {
      return this.publish({ phase: 'error', message: (e as Error).message });
    } finally {
      this.controller = null;
    }
  }
  cancel() {
    this.controller?.abort();
    return this.status();
  }
  async download() {
    const root = this.root();
    if (this.controller || this.state.phase === 'installing') return this.status();
    if (!this.manifest || !this.signed || !this.signature)
      throw new Error('Zuerst nach Updates suchen.');
    const manifest = this.manifest,
      control = new AbortController();
    this.controller = control;
    const signal = AbortSignal.any([control.signal, AbortSignal.timeout(30 * 60 * 1000)]),
      base = path.join(root, '.updates');
    let archive = '';
    this.publish({
      phase: 'downloading',
      received: 0,
      total: manifest.bytes,
      message: 'Update wird heruntergeladen…',
    });
    try {
      await access(root, constants.W_OK);
      await requireSpace(root, manifest.bytes + manifest.unpackedBytes);
      await mkdir(base, { recursive: true, mode: 0o700 });
      archive = path.join(base, manifest.sha256 + '-' + randomUUID() + '.partial');
      await rm(archive, { force: true });
      const h = await open(archive, 'wx', 0o600);
      try {
        const response = await githubFetch(
          releaseAssetURL(manifest.version, manifest.archive),
          { signal },
          this.config.request,
        );
        if (!response.body) throw new Error('Leere Paketantwort.');
        let received = 0,
          last = 0;
        for await (const part of response.body as unknown as AsyncIterable<Uint8Array>) {
          signal.throwIfAborted();
          received += part.length;
          if (received > manifest.bytes)
            throw new Error('Update überschreitet die signierte Paketgröße.');
          await h.writeFile(part);
          if (Date.now() - last > 150) {
            last = Date.now();
            this.publish({ received });
          }
        }
        if (received !== manifest.bytes)
          throw new Error('Update wurde nicht vollständig heruntergeladen.');
        await h.sync();
      } finally {
        await h.close();
      }
      const directory = await unpackUpdate(archive, base, manifest, () => signal.throwIfAborted());
      await writeFile(path.join(directory, manifestName), this.signed);
      await writeFile(path.join(directory, manifestName + '.sig'), this.signature);
      this.prepared = {
        directory,
        manifest,
        manifestBytes: this.signed.toString('base64'),
        signature: this.signature.toString('base64'),
      };
      await rename(archive, path.join(base, manifest.sha256 + '.zip'));
      archive = '';
      return this.publish({
        phase: 'ready',
        received: manifest.bytes,
        message: 'Update geprüft. Du kannst es jetzt installieren und neu starten.',
      });
    } catch (e) {
      return this.publish({
        phase: control.signal.aborted ? 'available' : 'error',
        message: control.signal.aborted ? 'Download abgebrochen.' : (e as Error).message,
      });
    } finally {
      if (archive) await rm(archive, { force: true });
      this.controller = null;
    }
  }
  installation() {
    if (!this.prepared || this.state.phase !== 'ready')
      throw new Error('Kein geprüftes Update bereit.');
    return this.prepared;
  }
  installing() {
    this.publish({
      phase: 'installing',
      message: 'Arbeit abschließen, sichern und Update installieren…',
    });
  }
  installationFailed(error: unknown) {
    this.publish({ phase: this.prepared ? 'ready' : 'error', message: (error as Error).message });
  }
}
