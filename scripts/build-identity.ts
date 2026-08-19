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
import {
  classifyWorkspaceInput,
  projectWorkspaceInput,
  type WorkspaceInputClass
} from './workspace-input-classification.js'

export interface WorkspaceIdentity {
  readonly commit: string
  readonly dirty: boolean
  readonly workspaceFingerprint: string
  readonly appBuildInputFingerprint: string
}

export interface WorkspaceInputFingerprints {
  readonly appBuildInputFingerprint: string
  readonly qualificationInputFingerprint: string
  readonly deliveryInputFingerprint: string
}

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
  return computeWorkspaceInputFingerprint(workspaceRoot, 'app-build')
}

export function computeQualificationInputFingerprint(
  workspaceRoot = process.cwd()
): string {
  return computeWorkspaceInputFingerprint(workspaceRoot, 'qualification')
}

export function computeDeliveryInputFingerprint(
  workspaceRoot = process.cwd()
): string {
  return computeWorkspaceInputFingerprint(workspaceRoot, 'delivery-tooling')
}

export function readWorkspaceInputFingerprints(
  workspaceRoot = process.cwd()
): WorkspaceInputFingerprints {
  return {
    appBuildInputFingerprint: computeAppBuildInputFingerprint(workspaceRoot),
    qualificationInputFingerprint:
      computeQualificationInputFingerprint(workspaceRoot),
    deliveryInputFingerprint: computeDeliveryInputFingerprint(workspaceRoot)
  }
}

export function computeAppBuildInputFingerprintAtRef(
  workspaceRoot: string,
  ref: string
): string {
  return computeWorkspaceInputFingerprintAtRef(workspaceRoot, ref, 'app-build')
}

export function computeWorkspaceInputFingerprintAtRef(
  workspaceRoot: string,
  ref: string,
  inputClass: WorkspaceInputClass
): string {
  const output = gitBuffer(workspaceRoot, [
    'ls-tree',
    '-r',
    '-z',
    '--full-tree',
    ref
  ])
  const entries = output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const match = /^(\d+) blob ([0-9a-f]{40})\t(.+)$/.exec(record)
      if (!match?.[1] || !match[2] || !match[3])
        throw new Error(`Unsupported Git tree entry: ${record}`)
      return { mode: match[1], object: match[2], path: match[3] }
    })
    .filter(({ path }) => classifyWorkspaceInput(path).includes(inputClass))
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    )
  const hash = createHash('sha256')
  for (const entry of entries) {
    const content = projectWorkspaceInput(
      entry.path,
      gitBuffer(workspaceRoot, ['cat-file', 'blob', entry.object]),
      inputClass
    )
    hash.update(`${Buffer.byteLength(entry.path)}:`)
    hash.update(entry.path)
    hash.update(`:${entry.mode === '100755' ? 1 : 0}:${content.length}:`)
    hash.update(content)
  }
  return hash.digest('hex')
}

function computeWorkspaceInputFingerprint(
  workspaceRoot: string,
  inputClass: WorkspaceInputClass
): string {
  return computeFilesFingerprint(
    workspaceRoot,
    workspaceFiles(workspaceRoot).filter((path) =>
      classifyWorkspaceInput(path).includes(inputClass)
    ),
    inputClass
  )
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
  files: readonly string[],
  inputClass?: WorkspaceInputClass
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
    const content = projectWorkspaceInput(
      relativePath,
      fileContent(absolutePath, stats),
      inputClass ?? 'documentation'
    )
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
  return gitBuffer(workspaceRoot, arguments_).toString('utf8')
}

function gitBuffer(
  workspaceRoot: string,
  arguments_: readonly string[]
): Buffer {
  const result = spawnSync('git', arguments_, {
    cwd: workspaceRoot,
    maxBuffer: 64 * 1024 * 1024
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      result.stderr.toString('utf8').trim() ||
        `git ${arguments_.join(' ')} failed`
    )
  return result.stdout
}
