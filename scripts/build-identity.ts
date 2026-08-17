import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  type Stats
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { BuildToolchain } from '../src/shared/contracts/build-info.js'

export interface WorkspaceIdentity {
  readonly commit: string
  readonly dirty: boolean
  readonly workspaceFingerprint: string
  readonly appBuildInputFingerprint: string
}

const appBuildInputRoots = ['src/', 'resources/']
const appBuildInputFiles = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'electron.vite.config.ts',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.renderer.json',
  'scripts/build-passive-preload.ts',
  'scripts/build-app.ts',
  'scripts/build-qualification.ts',
  'scripts/package-cli.ts',
  'scripts/write-build-info.ts',
  'scripts/write-build-receipt.ts',
  'scripts/build-receipt.ts',
  'scripts/build-identity.ts'
])

export function readWorkspaceIdentity(
  workspaceRoot = process.cwd()
): WorkspaceIdentity {
  const commit = git(workspaceRoot, ['rev-parse', '--verify', 'HEAD']).trim()
  if (!/^[0-9a-f]{40}$/.test(commit))
    throw new Error(`Git returned an invalid commit: ${commit}`)
  return {
    commit,
    dirty:
      git(workspaceRoot, ['status', '--porcelain=v1', '--untracked-files=all'])
        .length > 0,
    workspaceFingerprint: computeWorkspaceFingerprint(workspaceRoot),
    appBuildInputFingerprint: computeAppBuildInputFingerprint(workspaceRoot)
  }
}

export function computeWorkspaceFingerprint(
  workspaceRoot = process.cwd()
): string {
  return computeFilesFingerprint(workspaceRoot, workspaceFiles(workspaceRoot))
}

export function computeAppBuildInputFingerprint(
  workspaceRoot = process.cwd()
): string {
  const files = workspaceFiles(workspaceRoot).filter(
    (path) =>
      appBuildInputFiles.has(path) ||
      appBuildInputRoots.some((root) => path.startsWith(root))
  )
  return computeFilesFingerprint(workspaceRoot, files)
}

export function readBuildToolchain(
  workspaceRoot = process.cwd()
): BuildToolchain {
  const packageJson = JSON.parse(
    readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8')
  ) as {
    packageManager?: unknown
    devDependencies?: Record<string, unknown>
  }
  const versions = packageJson.devDependencies ?? {}
  const packageManager = packageJson.packageManager
  if (typeof packageManager !== 'string')
    throw new Error('package.json does not pin packageManager')
  const pnpmMatch = /^pnpm@([^+]+)(?:\+.*)?$/.exec(packageManager)
  if (!pnpmMatch?.[1])
    throw new Error(
      `package.json has an invalid pnpm packageManager: ${packageManager}`
    )
  return {
    node: process.version,
    pnpm: pnpmMatch[1],
    electron: dependencyVersion(versions, 'electron'),
    electronVite: dependencyVersion(versions, 'electron-vite'),
    electronBuilder: dependencyVersion(versions, 'electron-builder'),
    platform: process.platform,
    arch: process.arch
  }
}

function workspaceFiles(workspaceRoot: string): string[] {
  return git(workspaceRoot, [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z'
  ])
    .split('\0')
    .filter(Boolean)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
}

function computeFilesFingerprint(
  workspaceRoot: string,
  files: readonly string[]
): string {
  const hash = createHash('sha256')
  for (const relativePath of files) {
    const absolutePath = resolve(workspaceRoot, relativePath)
    if (!existsSync(absolutePath)) {
      hash.update(`${Buffer.byteLength(relativePath)}:`)
      hash.update(relativePath)
      hash.update(':missing')
      continue
    }
    const stats = lstatSync(absolutePath)
    const content = fileContent(absolutePath, stats)
    hash.update(`${Buffer.byteLength(relativePath)}:`)
    hash.update(relativePath)
    hash.update(`:${stats.mode & 0o111}:${content.length}:`)
    hash.update(content)
  }
  return hash.digest('hex')
}

function dependencyVersion(
  versions: Record<string, unknown>,
  name: string
): string {
  const value = versions[name]
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`package.json does not pin ${name}`)
  return value
}

function fileContent(path: string, stats: Stats): Buffer {
  if (stats.isSymbolicLink()) return Buffer.from(readlinkSync(path))
  if (!stats.isFile()) throw new Error(`Unsupported workspace entry: ${path}`)
  return readFileSync(path)
}

function git(workspaceRoot: string, arguments_: readonly string[]): string {
  const result = spawnSync('git', arguments_, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      result.stderr.trim() || `git ${arguments_.join(' ')} failed`
    )
  return result.stdout
}
