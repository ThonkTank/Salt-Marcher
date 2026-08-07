import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

type ManifestEntry = {
  file: string
  src?: string
  isEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
  css?: string[]
  assets?: string[]
}

const rendererRoot = join(process.cwd(), 'out', 'renderer')
const manifest = JSON.parse(
  readFileSync(join(rendererRoot, '.vite', 'manifest.json'), 'utf8')
) as Record<string, ManifestEntry>
const entryKey = Object.keys(manifest).find(
  (key) =>
    manifest[key]?.isEntry === true && manifest[key]?.src === 'index.html'
)
if (!entryKey) throw new Error('Normal renderer entry missing from manifest')

const files = new Set<string>()
const visited = new Set<string>()
function visit(key: string): void {
  if (visited.has(key)) return
  visited.add(key)
  const entry = manifest[key]
  if (!entry) throw new Error(`Manifest import missing: ${key}`)
  files.add(entry.file)
  for (const file of [...(entry.css ?? []), ...(entry.assets ?? [])])
    files.add(file)
  for (const dependency of [
    ...(entry.imports ?? []),
    ...(entry.dynamicImports ?? [])
  ])
    visit(dependency)
}
visit(entryKey)

const initialFiles = new Set<string>()
const initialVisited = new Set<string>()
function visitInitial(key: string): void {
  if (initialVisited.has(key)) return
  initialVisited.add(key)
  const entry = manifest[key]
  if (!entry) throw new Error(`Manifest import missing: ${key}`)
  initialFiles.add(entry.file)
  for (const dependency of entry.imports ?? []) visitInitial(dependency)
}
visitInitial(entryKey)
if ([...initialFiles].some((file) => /reference-(?:ui|runtime)/.test(file)))
  throw new Error('Reference document/Floating UI code is in the initial graph')

const byteCount = [...files].reduce(
  (total, file) => total + statSync(join(rendererRoot, file)).size,
  0
)
const normalRendererBudgetMiB = 2.8
const budget = normalRendererBudgetMiB * 1024 * 1024
if (byteCount > budget)
  throw new Error(
    `Normal renderer is ${(byteCount / 1024 / 1024).toFixed(2)} MiB; budget is ${normalRendererBudgetMiB.toFixed(2)} MiB`
  )
if ([...files].some((file) => /qualification|babylon/i.test(file)))
  throw new Error('Qualification-only rendering code is reachable from the app')

const referenceDatabase = readFileSync(
  join(process.cwd(), 'resources', 'reference', 'srd-5.1.sqlite')
)
const JavaScriptFiles = javascriptFiles(join(process.cwd(), 'out'))
if (
  JavaScriptFiles.some((file) => readFileSync(file).includes(referenceDatabase))
)
  throw new Error('Generated reference SQLite was embedded in JavaScript')

const budgetEntry = (
  label: string,
  predicate: (key: string, entry: ManifestEntry) => boolean,
  bytes: number
) => {
  const match = Object.entries(manifest).find(([key, entry]) =>
    predicate(key, entry)
  )
  if (!match) throw new Error(`${label} chunk is missing from the manifest`)
  const size = statSync(join(rendererRoot, match[1].file)).size
  if (size > bytes)
    throw new Error(
      `${label} is ${(size / 1024).toFixed(1)} KiB; budget is ${(bytes / 1024).toFixed(0)} KiB`
    )
  return size
}

const shellBytes = budgetEntry(
  'Shell entry',
  (_key, entry) => entry.isEntry === true && entry.src === 'index.html',
  32 * 1024
)
const workspaceEntry = Object.entries(manifest).find(
  ([key, entry]) => key.startsWith('_workspace-') && entry.file.endsWith('.js')
)
if (!workspaceEntry) throw new Error('Workspace chunk is missing')
const workspaceInitialFiles = staticFilesFor(workspaceEntry[0])
const workspaceBytes = [...workspaceInitialFiles].reduce(
  (total, file) => total + statSync(join(rendererRoot, file)).size,
  0
)
if (workspaceBytes > 900 * 1024)
  throw new Error(
    `Common Workspace graph is ${(workspaceBytes / 1024).toFixed(1)} KiB; budget is 900 KiB`
  )
if (
  [...workspaceInitialFiles].some((file) =>
    /hex-map-canvas-pixi|WebGLRenderer|WebGPURenderer|CanvasRenderer/.test(file)
  )
)
  throw new Error('Pixi renderer code is reachable from the workspace graph')

if ([...files].some((file) => file.endsWith('.woff')))
  throw new Error(
    'Legacy WOFF duplicates are bundled; Electron requires WOFF2 only'
  )
const catalogBytes = budgetEntry(
  'Catalog lazy entry',
  (_key, entry) =>
    entry.src === 'features/workspace/surfaces/catalog-surface.tsx',
  256 * 1024
)
const hexBytes = budgetEntry(
  'Hex lazy entry',
  (_key, entry) => entry.src === 'features/workspace/surfaces/hex-surface.tsx',
  256 * 1024
)
const referenceBytes = budgetEntry(
  'Reference renderer lazy entry',
  (_key, entry) => entry.src === 'features/reference/reference-ui.tsx',
  128 * 1024
)

console.log(
  [
    `Normal renderer: ${(byteCount / 1024 / 1024).toFixed(2)} MiB / ${normalRendererBudgetMiB.toFixed(2)} MiB`,
    `shell ${(shellBytes / 1024).toFixed(1)} KiB`,
    `workspace ${(workspaceBytes / 1024).toFixed(1)} KiB`,
    `catalog ${(catalogBytes / 1024).toFixed(1)} KiB`,
    `hex ${(hexBytes / 1024).toFixed(1)} KiB`,
    `reference ${(referenceBytes / 1024).toFixed(1)} KiB`
  ].join('; ')
)

function staticFilesFor(entryKey: string): Set<string> {
  const result = new Set<string>()
  const seen = new Set<string>()
  const collect = (key: string): void => {
    if (seen.has(key)) return
    seen.add(key)
    const entry = manifest[key]
    if (!entry) throw new Error(`Manifest import missing: ${key}`)
    result.add(entry.file)
    for (const dependency of entry.imports ?? []) collect(dependency)
  }
  collect(entryKey)
  return result
}

function javascriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory()
      ? javascriptFiles(path)
      : entry.isFile() && entry.name.endsWith('.js')
        ? [path]
        : []
  })
}
