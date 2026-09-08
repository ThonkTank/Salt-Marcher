import { profileBackupSchema } from '../../shared/contracts/profile-backup.js'
import { MaintenanceCoordinator } from '../../shared/maintenance/coordinator.js'
import {
  profilePreparationSchema,
  type ProfilePreparation
} from '../../shared/contracts/maintenance.js'
import { relaunchRelease } from './relaunch.js'
import { tmpdir } from 'node:os'
import { rollbackRelease } from './recovery.js'
import { capabilityEvents } from '../../shared/contracts/events.js'
import { app, BrowserWindow, dialog } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import {
  backupSummarySchema,
  releaseManifestSchema,
  type ReleaseStatus
} from '../../shared/contracts/release.js'
import { durableJson, sha256 } from '../../shared/maintenance/files.js'
import {
  checkRelease,
  downloadRelease,
  type AvailableRelease
} from './github-release.js'
import {
  installLauncher,
  stageDeployment,
  currentProgram,
  deploymentProgram
} from './deployment.js'
import { maintenanceWorker } from './maintenance-worker.js'
import { releaseRoot } from './paths.js'

export class ReleaseController {
  private value: ReleaseStatus
  private available: AvailableRelease | null = null
  private downloaded: string | null = null
  private busy = false
  private readonly root = releaseRoot()
  constructor(
    enabled: boolean,
    private readonly stopCore: () => Promise<void>,
    private readonly resumeCore: () => void
  ) {
    this.value = {
      enabled,
      installed: enabled && existsSync(join(this.root, 'current')),
      currentVersion: app.getVersion(),
      phase: 'idle',
      availableVersion: null,
      notes: '',
      progress: 0,
      message: ''
    }
  }
  isMaintaining(): boolean {
    return this.value.phase === 'maintenance'
  }
  status(): ReleaseStatus {
    return { ...this.value }
  }
  private update(changes: Partial<ReleaseStatus>): ReleaseStatus {
    this.value = { ...this.value, ...changes }
    for (const window of BrowserWindow.getAllWindows())
      if (!window.webContents.isDestroyed())
        window.webContents.send(
          capabilityEvents['updates.onStatus'].channel,
          this.status()
        )
    return this.status()
  }
  async automaticCheck(): Promise<void> {
    if (!this.value.enabled) return
    const path = join(this.root, 'last-check.json')
    try {
      if (existsSync(path)) {
        const last = JSON.parse(readFileSync(path, 'utf8')) as { at: number }
        if (Number.isFinite(last.at) && Date.now() - last.at < 86_400_000)
          return
      }
      durableJson(path, { at: Date.now() })
      await this.check()
    } catch {
      /* Update availability never blocks play. */
    }
  }
  private async operation(action: () => Promise<void>): Promise<ReleaseStatus> {
    if (!this.value.enabled || this.busy) return this.status()
    this.busy = true
    try {
      await action()
    } catch (error) {
      this.update({
        phase: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Vorgang fehlgeschlagen. Bitte erneut versuchen.'
      })
    } finally {
      this.busy = false
    }
    return this.status()
  }
  check() {
    return this.operation(async () => {
      this.update({ phase: 'checking', message: '' })
      this.available = await checkRelease(app.getVersion())
      this.downloaded = null
      this.update({
        phase: this.available ? 'available' : 'idle',
        availableVersion: this.available?.manifest.version ?? null,
        notes: this.available?.notes ?? '',
        message: this.available
          ? 'Eine neue Version ist verfügbar.'
          : 'Du verwendest die aktuelle Version.'
      })
    })
  }
  download() {
    return this.operation(async () => {
      if (!this.available) throw new Error('Bitte zuerst nach Updates suchen.')
      this.update({ phase: 'downloading', progress: 0, message: '' })
      this.downloaded = await downloadRelease(
        this.available,
        join(this.root, 'cache'),
        (progress) => this.update({ progress })
      )
      this.update({ phase: 'downloaded', progress: 1 })
    })
  }
  async backups() {
    if (!this.value.enabled) return []
    return backupSummarySchema.array().parse(
      await maintenanceWorker({
        root: this.root,
        version: app.getVersion(),
        operation: 'list'
      })
    )
  }
  install() {
    return this.operation(async () => {
      if (!this.available || !this.downloaded)
        throw new Error('Bitte das Update zuerst herunterladen.')
      const deployment = stageDeployment(
        this.root,
        this.downloaded,
        this.available.manifest
      )
      await this.activate(deployment)
    })
  }
  setup() {
    return this.operation(async () => {
      if (this.value.installed) return
      const source = process.env['APPIMAGE']
      if (!source)
        throw new Error('Bitte das heruntergeladene AppImage starten.')
      const adjacent = join(dirname(source), 'release-manifest.json')
      let rawManifest: unknown
      if (existsSync(adjacent))
        rawManifest = JSON.parse(readFileSync(adjacent, 'utf8'))
      else {
        const response = await fetch(
          `https://github.com/ThonkTank/Salt-Marcher/releases/download/v${app.getVersion()}/release-manifest.json`,
          { signal: AbortSignal.timeout(20_000) }
        )
        if (!response.ok)
          throw new Error(
            'Das Release-Manifest fehlt. Bitte zusammen mit dem AppImage herunterladen und im selben Ordner ablegen.'
          )
        rawManifest = await response.json()
      }
      const manifest = releaseManifestSchema.parse(rawManifest)
      if (
        manifest.version !== app.getVersion() ||
        statSync(source).size !== manifest.artifact.bytes ||
        sha256(source) !== manifest.artifact.sha256
      )
        throw new Error(
          'Dieses AppImage stimmt nicht mit dem veröffentlichten Release überein.'
        )
      const deployment = stageDeployment(this.root, source, manifest)
      await this.activate(deployment)
    })
  }
  private profileCandidates() {
    return [
      {
        id: 'local' as const,
        label: 'SaltMarcher Local',
        path: join(
          dirname(this.root),
          'salt-marcher-local',
          'profile',
          'campaign-data'
        )
      },
      {
        id: 'electron' as const,
        label: 'Bisherige Electron-App',
        path: join(app.getPath('appData'), 'salt-marcher', 'campaign-data')
      },
      {
        id: 'development' as const,
        label: 'Electron-Entwicklungsprofil',
        path: join(app.getPath('appData'), 'salt-marcher', 'development-data')
      }
    ].filter((entry) => existsSync(join(entry.path, 'installation.sqlite')))
  }
  profiles() {
    return this.value.enabled
      ? this.profileCandidates().map(({ id, label }) => ({ id, label }))
      : []
  }
  newProfile() {
    return this.operation(() =>
      this.activateCurrent({ source: join(this.root, `empty-${randomUUID()}`) })
    )
  }
  importProfile(id?: 'local' | 'electron' | 'development') {
    return this.operation(async () => {
      const source = id
        ? this.profileCandidates().find((entry) => entry.id === id)?.path
        : undefined
      if (id && !source)
        throw new Error('Das ausgewählte Profil ist nicht mehr vorhanden.')
      const selection = await dialog.showOpenDialog({
        title:
          'Geprüfte SaltMarcher-Sicherung auswählen (Ordner mit manifest.json und data)',
        properties: ['openDirectory'],
        ...(source
          ? { defaultPath: join(dirname(dirname(source)), 'backups') }
          : {})
      })
      if (selection.canceled || !selection.filePaths[0]) return
      const backupDirectory = selection.filePaths[0]
      let bytes: Buffer
      let manifest: ReturnType<typeof profileBackupSchema.parse>
      try {
        bytes = readFileSync(join(backupDirectory, 'manifest.json'))
        manifest = profileBackupSchema.parse(JSON.parse(bytes.toString('utf8')))
      } catch (cause) {
        throw new Error(
          'Dieser Ordner enthält kein lesbares SaltMarcher-Sicherungsmanifest. Bitte einen Sicherungsordner mit manifest.json und data auswählen.',
          { cause }
        )
      }
      if (!manifest.restorable)
        throw new Error(
          'Diese Sicherung ist nicht wiederherstellbar. Bitte eine andere Sicherung auswählen.'
        )
      const expectedManifestSha256 = createHash('sha256')
        .update(bytes)
        .digest('hex')
      const confirmation = await dialog.showMessageBox({
        type: 'warning',
        title: 'Ausgewählte Sicherung übernehmen',
        message:
          manifest.formatVersion === 2
            ? 'Das gesamte Profil durch diese Sicherung ersetzen?'
            : 'Diese ältere Sicherung enthält nur Kampagnendaten. Das gesamte Profil ersetzen?',
        detail: `Version ${manifest.version} · ${new Date(manifest.createdAt).toLocaleString('de-DE')}\n${
          manifest.formatVersion === 2
            ? 'Die Sicherung umfasst das vollständige Profil einschließlich eigener Dateien.'
            : 'Zusätzliche Dateien des aktuellen Profils sind darin nicht enthalten; sie bleiben in der vorher erstellten Sicherung erhalten.'
        }\nDer aktuelle Stand wird zuerst gesichert. Die Quelle bleibt erhalten. Vor der Übernahme werden Inhalt und Kompatibilität geprüft.`,
        buttons: ['Abbrechen', 'Sicherung übernehmen'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      })
      if (confirmation.response !== 1) return
      await this.activateCurrent({ backupDirectory, expectedManifestSha256 })
    })
  }
  restore(id: string) {
    return this.operation(() => this.activateCurrent({ id }))
  }
  private async activateCurrent(options: {
    source?: string
    id?: string
    backupDirectory?: string
    expectedManifestSha256?: string
  }) {
    if (!this.value.installed)
      throw new Error('Bitte SaltMarcher zuerst installieren.')
    const installed = currentProgram(this.root)
    if (!installed) throw new Error('Die installierte Programmversion fehlt.')
    const deployment = installed.deployment
    await this.activate(deployment, options)
  }
  private async activate(
    deployment: string,
    options: {
      source?: string
      id?: string
      backupDirectory?: string
      expectedManifestSha256?: string
    } = {}
  ) {
    this.update({
      phase: 'maintenance',
      message: 'Sicherung und Datenprüfung laufen. Bitte warten.'
    })
    await this.stopCore()
    const target = join(
      this.root,
      'deployments',
      deployment,
      'SaltMarcher.AppImage'
    )
    try {
      const transactionId = randomUUID()
      const prepared = await this.runTarget(target, transactionId, options)
      const coordinator = new MaintenanceCoordinator(this.root)
      const previous = currentProgram(this.root)
      const activation = coordinator.begin({
        id: prepared.id,
        formatVersion: prepared.journalVersion ?? 2,
        backup: prepared.backup,
        previous,
        next: deploymentProgram(this.root, deployment),
        operation: options.id
          ? 'restore'
          : options.source || options.backupDirectory
            ? 'import'
            : previous
              ? 'update'
              : 'install'
      })
      installLauncher(this.root, activation.next)
      coordinator.activate()
      relaunchRelease(target, ['--release-complete', activation.id])
      app.quit()
    } catch (error) {
      rollbackRelease()
      this.resumeCore()
      throw error
    }
  }
  private runTarget(
    target: string,
    transactionId: string,
    options: {
      source?: string
      id?: string
      backupDirectory?: string
      expectedManifestSha256?: string
    } = {}
  ): Promise<ProfilePreparation> {
    const token = randomUUID()
    mkdirSync(this.root, { recursive: true })
    durableJson(join(this.root, 'maintenance-request.json'), {
      token,
      parent: process.pid,
      sourceVersion: app.getVersion(),
      operation: options.id
        ? 'restore'
        : options.backupDirectory
          ? 'import-backup'
          : 'prepare',
      transactionId,
      ...options
    })
    return new Promise((resolve, reject) => {
      const scratch = mkdtempSync(join(tmpdir(), 'salt-release-worker-'))
      const child = spawn(target, ['--release-maintenance', token], {
        stdio: 'ignore',
        env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1', TMPDIR: scratch }
      })
      child.once('error', reject)
      child.once('exit', (code) => {
        rmSync(scratch, { recursive: true, force: true })
        const path = join(this.root, `maintenance-result-${token}.json`)
        try {
          if (code !== 0 || !existsSync(path))
            throw new Error(
              'Die Zielversion konnte die Wartung nicht abschließen.'
            )
          const result = JSON.parse(readFileSync(path, 'utf8')) as {
            ok: boolean
            message?: string
            result?: unknown
          }
          rmSync(path)
          if (!result.ok)
            throw new Error(result.message ?? 'Wartung fehlgeschlagen.')
          const prepared = profilePreparationSchema.parse(result.result)
          if (prepared.id !== transactionId)
            throw new Error(
              'Die Arbeitskopie gehört zu einem anderen Wartungsauftrag.'
            )
          resolve(prepared)
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error('Wartung fehlgeschlagen.')
          )
        }
      })
    })
  }
}
