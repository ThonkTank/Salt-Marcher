import { createHash } from 'node:crypto'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync
} from 'node:fs'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { z } from 'zod'
import {
  newerRelease,
  releaseManifestSchema,
  releaseRepository,
  type ReleaseManifest
} from '../../shared/contracts/release.js'
import {
  durableJson,
  sha256,
  syncPath
} from '../../shared/maintenance/files.js'
const apiReleaseSchema = z.object({
  tag_name: z.string(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  body: z.string().nullable(),
  assets: z.array(
    z.object({ name: z.string(), browser_download_url: z.string().url() })
  )
})
export type AvailableRelease = {
  manifest: ReleaseManifest
  url: string
  notes: string
}
function assetUrl(raw: string, version: string, name: string): string {
  const expected = `https://github.com/${releaseRepository}/releases/download/v${version}/${name}`
  if (raw !== expected)
    throw new Error(
      'Update-Datei stammt nicht aus dem freigegebenen Repository.'
    )
  return expected
}
export async function checkRelease(
  current: string
): Promise<AvailableRelease | null> {
  const response = await fetch(
    `https://api.github.com/repos/${releaseRepository}/releases/latest`,
    {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(20_000)
    }
  )
  if (response.status === 404) return null
  if (!response.ok)
    throw new Error(
      'Updates konnten nicht geprüft werden. Bitte später erneut versuchen.'
    )
  const release = apiReleaseSchema.parse(await response.json())
  if (release.draft || release.prerelease || !release.tag_name.startsWith('v'))
    return null
  const version = release.tag_name.slice(1)
  if (!newerRelease(version, current)) return null
  const asset = release.assets.find(
    (entry) => entry.name === 'release-manifest.json'
  )
  if (!asset) throw new Error('Release-Manifest fehlt.')
  const metadata = await fetch(
    assetUrl(asset.browser_download_url, version, asset.name),
    { signal: AbortSignal.timeout(20_000) }
  )
  if (!metadata.ok)
    throw new Error('Release-Manifest konnte nicht geladen werden.')
  const text = await metadata.text()
  if (text.length > 32_768) throw new Error('Release-Manifest ist zu groß.')
  const manifest = releaseManifestSchema.parse(JSON.parse(text))
  if (manifest.version !== version)
    throw new Error('Release-Version stimmt nicht überein.')
  const binary = release.assets.find(
    (entry) => entry.name === manifest.artifact.name
  )
  if (!binary) throw new Error('AppImage fehlt.')
  return {
    manifest,
    url: assetUrl(binary.browser_download_url, version, binary.name),
    notes: (release.body ?? '').slice(0, 30_000)
  }
}
export async function downloadRelease(
  release: AvailableRelease,
  cache: string,
  progress: (fraction: number) => void
): Promise<string> {
  mkdirSync(cache, { recursive: true })
  const path = join(cache, release.manifest.artifact.name)
  if (existsSync(path) && sha256(path) === release.manifest.artifact.sha256)
    return path
  const temporary = `${path}.partial`
  rmSync(temporary, { force: true })
  try {
    const response = await fetch(release.url, {
      signal: AbortSignal.timeout(30 * 60_000)
    })
    if (!response.ok || !response.body)
      throw new Error('Download fehlgeschlagen. Bitte erneut versuchen.')
    let bytes = 0
    const hash = createHash('sha256')
    const validate = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length
        if (bytes > release.manifest.artifact.bytes)
          return callback(new Error('Update-Datei ist größer als angekündigt.'))
        hash.update(chunk)
        progress(bytes / release.manifest.artifact.bytes)
        callback(null, chunk)
      }
    })
    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      validate,
      createWriteStream(temporary, { flags: 'wx', mode: 0o700 })
    )
    if (
      bytes !== release.manifest.artifact.bytes ||
      hash.digest('hex') !== release.manifest.artifact.sha256
    )
      throw new Error(
        'Die heruntergeladene Datei ist unvollständig oder beschädigt.'
      )
    syncPath(temporary)
    renameSync(temporary, path)
    syncPath(cache)
    durableJson(`${path}.manifest.json`, release.manifest)
    return path
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}
