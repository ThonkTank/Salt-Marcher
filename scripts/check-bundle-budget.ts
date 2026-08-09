import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import {
  bundleGraphGrowth,
  bundleGraphRatchets,
  excessiveBundleGrowth
} from './bundle-budget-policy.js'

type ManifestEntry = {
  file: string
  src?: string
  isEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
  css?: string[]
  assets?: string[]
}

const KiB = 1024
const MiB = KiB * KiB
const rendererRoot = join(process.cwd(), 'out', 'renderer')
const manifest = JSON.parse(
  readFileSync(join(rendererRoot, '.vite', 'manifest.json'), 'utf8')
) as Record<string, ManifestEntry>

const entryKey = entryForSource('index.html')
const workspaceKey = Object.keys(manifest).find(
  (key) =>
    key.startsWith('_workspace-') &&
    !key.startsWith('_workspace-runtime') &&
    manifest[key]?.file.endsWith('.js')
)
if (!workspaceKey) throw new Error('Workspace chunk is missing')
const sessionKey = entryForSource(
  'features/workspace/surfaces/session-surface.tsx'
)
const catalogKey = entryForSource(
  'features/workspace/surfaces/catalog-surface.tsx'
)
const hexKey = entryForSource('features/workspace/surfaces/hex-surface.tsx')
const referenceKey = entryForSource('features/reference/reference-ui.tsx')
const pixiKey = Object.keys(manifest).find((key) =>
  key.startsWith('_hex-map-canvas-pixi-')
)
if (!pixiKey) throw new Error('Pixi leaf chunk is missing')

const shellInitial = staticFilesFor(entryKey)
const workspaceGraph = staticFilesFor(workspaceKey)
const sessionGraph = difference(staticFilesFor(sessionKey), workspaceGraph)
const catalogGraph = difference(staticFilesFor(catalogKey), workspaceGraph)
const hexStaticGraph = staticFilesFor(hexKey)
const hexGraph = difference(hexStaticGraph, workspaceGraph)
const referenceGraph = difference(staticFilesFor(referenceKey), workspaceGraph)
// Vite records the HTML entry as a static import of dynamic leaves. Stop that
// back-edge or an incremental Pixi graph incorrectly absorbs every sibling
// route reachable from the application entry.
const pixiGraph = difference(
  reachableFilesFor(pixiKey, new Set([entryKey])),
  hexStaticGraph
)
const reachableRenderer = reachableFilesFor(entryKey)

const measuredGraphs = {
  shell: fileBytes(shellInitial),
  workspace: fileBytes(workspaceGraph),
  session: fileBytes(sessionGraph),
  catalog: fileBytes(catalogGraph),
  hex: fileBytes(hexGraph),
  reference: fileBytes(referenceGraph),
  pixi: fileBytes(pixiGraph),
  reachable: fileBytes(reachableRenderer)
}
const measurementDirectory = join(process.cwd(), '.tmp')
mkdirSync(measurementDirectory, { recursive: true })
writeFileSync(
  join(measurementDirectory, 'renderer-bundle-measurements.json'),
  `${JSON.stringify({ graphs: measuredGraphs }, null, 2)}\n`
)

const graphBudgets = [
  graphBudget('Shell initial graph', shellInitial, 896 * KiB),
  graphBudget('Common Workspace graph', workspaceGraph, 1280 * KiB),
  graphBudget('Session lazy graph', sessionGraph, 448 * KiB),
  graphBudget('Catalog lazy graph', catalogGraph, 384 * KiB),
  graphBudget('Hex lazy graph without Pixi', hexGraph, 384 * KiB),
  graphBudget('Reference lazy graph', referenceGraph, 128 * KiB),
  graphBudget('Pixi dynamic leaf graph', pixiGraph, 1792 * KiB)
]

// Preserve the pre-inventory limits with their original accounting semantics.
const shellEntryBytes = fileBytes(new Set([manifest[entryKey]!.file]))
assertBudget('Shell entry JavaScript', shellEntryBytes, 32 * KiB)
const workspaceJavaScriptBytes = fileBytes(
  staticJavaScriptFilesFor(workspaceKey)
)
assertBudget(
  'Common Workspace JavaScript graph',
  workspaceJavaScriptBytes,
  900 * KiB
)

const hardRendererBudget = 3.2 * MiB
const warningLimit = hardRendererBudget * 0.9
const reachableBytes = fileBytes(reachableRenderer)
if (reachableBytes > hardRendererBudget)
  throw new Error(
    `Reachable renderer is ${reachableBytes} bytes; hard ceiling is ${Math.floor(hardRendererBudget)} bytes`
  )
if (reachableBytes > warningLimit)
  console.warn(
    `WARNING: reachable renderer uses ${percentage(reachableBytes, hardRendererBudget)}, above the 90% warning threshold.`
  )

const baselineDocument = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      'docs',
      'project',
      'architecture',
      'renderer-bundle-baseline.json'
    ),
    'utf8'
  )
) as { graphs: Record<string, number> }
const growth = bundleGraphGrowth(measuredGraphs, baselineDocument.graphs)
const excessiveGrowth = excessiveBundleGrowth(
  measuredGraphs,
  baselineDocument.graphs
)
for (const entry of growth) {
  console.warn(
    `GROWTH ${entry.graph}: +${entry.growth} bytes over baseline ${entry.baseline}.`
  )
  reportLargestFiles(graphFiles(entry.graph), 5)
}
if (excessiveGrowth.length > 0) {
  if (!process.argv.includes('--measure-only'))
    throw new Error(
      'Bundle graph growth exceeded 16 KiB. Update the baseline with an explicit dependency and chunk rationale.'
    )
}
const ratchets = bundleGraphRatchets(measuredGraphs, baselineDocument.graphs)
for (const entry of ratchets)
  console.log(
    `RATCHET ${entry.graph}: remove ${entry.reduction} bytes from baseline ${entry.baseline}.`
  )
if (ratchets.length > 0 && !process.argv.includes('--measure-only'))
  throw new Error(
    'Bundle graphs shrank. Ratchet the checked baseline down to the current measurements.'
  )

if ([...shellInitial].some((file) => /reference-(?:ui|runtime)/.test(file)))
  throw new Error('Reference document/Floating UI code is in the initial graph')
if (
  [...workspaceGraph].some((file) =>
    /hex-map-canvas-pixi|browserAll|webworkerAll|WebGLRenderer|WebGPURenderer|CanvasRenderer/.test(
      file
    )
  )
)
  throw new Error('Pixi renderer code is reachable from the workspace graph')
if ([...hexStaticGraph].some((file) => /hex-map-canvas-pixi/.test(file)))
  throw new Error('Pixi renderer code is statically reachable from Hex')
if (!reachableRenderer.has(manifest[pixiKey]!.file))
  throw new Error('Pixi leaf is not dynamically reachable from the application')
if (
  [...pixiGraph].some((file) => /campaign-menu|encounter-generator/.test(file))
)
  throw new Error('Unrelated Workspace dialogs leaked into the Pixi graph')
if ([...reachableRenderer].some((file) => /qualification|babylon/i.test(file)))
  throw new Error('Qualification-only rendering code is reachable from the app')
if ([...reachableRenderer].some((file) => file.endsWith('.woff')))
  throw new Error(
    'Legacy WOFF duplicates are bundled; Electron requires WOFF2 only'
  )

const referenceDatabase = readFileSync(
  join(process.cwd(), 'resources', 'reference', 'srd-5.1.sqlite')
)
const JavaScriptFiles = javascriptFiles(join(process.cwd(), 'out'))
if (
  JavaScriptFiles.some((file) => readFileSync(file).includes(referenceDatabase))
)
  throw new Error('Generated reference SQLite was embedded in JavaScript')

console.log('Renderer bundle inventory')
console.log(
  budgetLine('Shell entry JavaScript', shellEntryBytes, 32 * KiB),
  '(legacy gate)'
)
console.log(
  budgetLine(
    'Common Workspace JavaScript graph',
    workspaceJavaScriptBytes,
    900 * KiB
  ),
  '(legacy gate)'
)
for (const graph of graphBudgets)
  console.log(budgetLine(graph.label, graph.bytes, graph.budget, graph.files))
console.log(
  `${budgetLine('Reachable renderer', reachableBytes, hardRendererBudget, reachableRenderer)}; warning threshold ${Math.floor(warningLimit)} bytes`
)

function graphFiles(graph: string): ReadonlySet<string> {
  const files: Record<string, ReadonlySet<string>> = {
    shell: shellInitial,
    workspace: workspaceGraph,
    session: sessionGraph,
    catalog: catalogGraph,
    hex: hexGraph,
    reference: referenceGraph,
    pixi: pixiGraph,
    reachable: reachableRenderer
  }
  return files[graph] ?? new Set()
}

function reportLargestFiles(files: ReadonlySet<string>, limit: number): void {
  const largest = [...files]
    .map((file) => ({ file, bytes: statSync(join(rendererRoot, file)).size }))
    .toSorted((left, right) => right.bytes - left.bytes)
    .slice(0, limit)
  for (const entry of largest)
    console.warn(
      `  ${entry.bytes} bytes ${entry.file}; import path ${manifestPathForFile(entry.file)}`
    )
}

function manifestPathForFile(file: string): string {
  const target = Object.entries(manifest).find(
    ([, entry]) => entry.file === file
  )
  if (!target) return '(asset)'
  const targetKey = target[0]
  const queue: Array<{ key: string; path: string[] }> = [
    { key: entryKey, path: [entryKey] }
  ]
  const seen = new Set<string>()
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.key === targetKey) return current.path.join(' -> ')
    if (seen.has(current.key)) continue
    seen.add(current.key)
    const entry = manifest[current.key]
    for (const dependency of [
      ...(entry?.imports ?? []),
      ...(entry?.dynamicImports ?? [])
    ])
      queue.push({ key: dependency, path: [...current.path, dependency] })
  }
  return target[1].src ?? targetKey
}

function entryForSource(source: string): string {
  const key = Object.keys(manifest).find(
    (candidate) => manifest[candidate]?.src === source
  )
  if (!key) throw new Error(`Manifest entry is missing for ${source}`)
  return key
}

function graphBudget(label: string, files: Set<string>, budget: number) {
  const bytes = fileBytes(files)
  assertBudget(label, bytes, budget)
  return { label, files, bytes, budget }
}

function assertBudget(label: string, bytes: number, budget: number): void {
  if (bytes > budget)
    throw new Error(`${label} is ${bytes} bytes; budget is ${budget} bytes`)
}

function budgetLine(
  label: string,
  bytes: number,
  budget: number,
  files?: ReadonlySet<string>
): string {
  const compressed =
    process.env['BUNDLE_REPORT_GZIP'] === '1' && files
      ? `; gzip ${compressedBytes(files)} bytes`
      : ''
  return `${label}: ${bytes} bytes (${percentage(bytes, budget)}); budget ${Math.floor(budget)} bytes; reserve ${Math.floor(budget - bytes)} bytes${compressed}`
}

function percentage(bytes: number, budget: number): string {
  return `${((bytes / budget) * 100).toFixed(1)}%`
}

function fileBytes(files: ReadonlySet<string>): number {
  return [...files].reduce(
    (total, file) => total + statSync(join(rendererRoot, file)).size,
    0
  )
}

function compressedBytes(files: ReadonlySet<string>): number {
  return [...files].reduce(
    (total, file) =>
      total + gzipSync(readFileSync(join(rendererRoot, file))).byteLength,
    0
  )
}

function staticFilesFor(key: string): Set<string> {
  return filesFor(key, false)
}

function reachableFilesFor(
  key: string,
  boundaries: ReadonlySet<string> = new Set()
): Set<string> {
  return filesFor(key, true, boundaries)
}

function filesFor(
  key: string,
  includeDynamic: boolean,
  boundaries: ReadonlySet<string> = new Set()
): Set<string> {
  const result = new Set<string>()
  const seen = new Set<string>()
  const collect = (current: string): void => {
    if (boundaries.has(current)) return
    if (seen.has(current)) return
    seen.add(current)
    const entry = manifest[current]
    if (!entry) throw new Error(`Manifest import missing: ${current}`)
    result.add(entry.file)
    for (const file of [...(entry.css ?? []), ...(entry.assets ?? [])])
      result.add(file)
    for (const dependency of entry.imports ?? []) collect(dependency)
    if (includeDynamic)
      for (const dependency of entry.dynamicImports ?? []) collect(dependency)
  }
  collect(key)
  return result
}

function staticJavaScriptFilesFor(key: string): Set<string> {
  const result = new Set<string>()
  const seen = new Set<string>()
  const collect = (current: string): void => {
    if (seen.has(current)) return
    seen.add(current)
    const entry = manifest[current]
    if (!entry) throw new Error(`Manifest import missing: ${current}`)
    result.add(entry.file)
    for (const dependency of entry.imports ?? []) collect(dependency)
  }
  collect(key)
  return result
}

function difference(
  files: ReadonlySet<string>,
  baseline: ReadonlySet<string>
): Set<string> {
  return new Set([...files].filter((file) => !baseline.has(file)))
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
