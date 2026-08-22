import ts from 'typescript'

export type RendererControllerBoundaryViolation = Readonly<{
  path: string
  line: number
  code:
    | 'missing_owner_source'
    | 'missing_required_import'
    | 'missing_required_call'
    | 'view_owns_controller_hook'
    | 'view_imports_capabilities'
    | 'view_accesses_global_capability'
    | 'multiple_group_reducer_owners'
    | 'group_controller_owns_local_state'
    | 'async_owner_missing_coordinator'
    | 'general_api_outside_adapter'
    | 'adapter_missing_api_boundary'
    | 'mutable_capability_adapter'
    | 'capability_adapter_bypasses_preload'
  detail: string
}>

type ModuleFacts = Readonly<{
  path: string
  imports: readonly Readonly<{
    specifier: string
    imported: string
    local: string
  }>[]
  calls: ReadonlySet<string>
  propertyPaths: ReadonlySet<string>
  identifiers: ReadonlySet<string>
  mutableTopLevelBindings: ReadonlySet<string>
}>

const sessionWorkspace = 'src/renderer/features/session/session-workspace.tsx'
const groupController =
  'src/renderer/features/session/use-group-manager-controller.ts'
const groupCommands =
  'src/renderer/features/session/use-group-manager-commands.ts'
const groupQueries =
  'src/renderer/features/session/use-group-manager-queries.ts'
const sessionMutations =
  'src/renderer/features/session/use-session-mutation-controller.ts'

const passiveViews = new Set([
  'src/renderer/features/session/scene-party-card.tsx',
  'src/renderer/features/session/session-group-card.tsx',
  'src/renderer/features/session/session-groups-panel.tsx',
  'src/renderer/features/catalog/npc-catalog-browser.tsx',
  'src/renderer/features/catalog/npc-catalog-inspector.tsx',
  'src/renderer/features/catalog/npc-catalog-editor.tsx'
])

const narrowPortOwners = new Map([
  [
    'src/renderer/features/session-planner',
    'src/renderer/features/session-planner/use-session-planner-ports.ts'
  ],
  ['src/renderer/features/loot', 'src/renderer/features/loot/use-loot-ports.ts']
])

/**
 * Enforces renderer ownership through syntax-tree relationships. Equivalent
 * formatting, aliases and local symbol names do not change the result.
 */
export function rendererControllerBoundaryViolations(
  sources: Readonly<Record<string, string>>
): readonly RendererControllerBoundaryViolation[] {
  const factsByPath = new Map(
    Object.entries(sources).map(([path, source]) => [path, facts(path, source)])
  )
  const violations: RendererControllerBoundaryViolation[] = []

  inspectSessionWorkspace(factsByPath, violations)
  inspectPassiveViews(factsByPath, violations)
  inspectGroupManager(factsByPath, violations)
  inspectNarrowPorts(factsByPath, violations)
  inspectFeatureCapabilityAdapters(factsByPath, violations)

  return violations.sort(
    (left, right) =>
      left.path.localeCompare(right.path, 'en') ||
      left.line - right.line ||
      left.code.localeCompare(right.code, 'en')
  )
}

function inspectSessionWorkspace(
  factsByPath: ReadonlyMap<string, ModuleFacts>,
  violations: RendererControllerBoundaryViolation[]
): void {
  const module = requireSource(sessionWorkspace, factsByPath, violations)
  if (!module) return
  requireImport(
    module,
    'useSessionWorkspaceController',
    './use-session-workspace-controller.js',
    violations
  )
  requireCall(
    module,
    'useSessionWorkspaceController',
    './use-session-workspace-controller.js',
    violations
  )
  for (const hook of [
    'useCapabilityApi',
    'sessionCapabilities',
    'useLootSceneController',
    'useState',
    'useEffect'
  ])
    if (hasImportedCall(module, hook) || hasCall(module, hook))
      violations.push(violation(module, 1, 'view_owns_controller_hook', hook))
}

function inspectPassiveViews(
  factsByPath: ReadonlyMap<string, ModuleFacts>,
  violations: RendererControllerBoundaryViolation[]
): void {
  for (const path of passiveViews) {
    const module = requireSource(path, factsByPath, violations)
    if (!module) continue
    for (const specifier of new Set(
      module.imports.map((dependency) => dependency.specifier)
    ))
      if (
        specifier.includes('/capabilities/') ||
        /-capabilities\.js$/.test(specifier)
      )
        violations.push(
          violation(module, 1, 'view_imports_capabilities', specifier)
        )
    for (const call of module.calls)
      if (
        call === 'useCapabilityApi' ||
        /Capabilities$/.test(call.split('.').at(-1) ?? '')
      )
        violations.push(violation(module, 1, 'view_owns_controller_hook', call))
    if (hasPropertyPrefix(module, 'window.saltMarcher'))
      violations.push(
        violation(
          module,
          1,
          'view_accesses_global_capability',
          'window.saltMarcher'
        )
      )
  }
}

function inspectGroupManager(
  factsByPath: ReadonlyMap<string, ModuleFacts>,
  violations: RendererControllerBoundaryViolation[]
): void {
  const groupModules = [...factsByPath.values()].filter(
    (module) =>
      module.path.includes('/features/session/') &&
      /(?:^|\/)(?:group-|use-group-)/.test(module.path)
  )
  const reducerOwners = groupModules.filter((module) =>
    hasCall(module, 'useReducer')
  )
  if (
    reducerOwners.length !== 1 ||
    reducerOwners[0]?.path !== groupController
  ) {
    const unexpected = reducerOwners.find(
      (module) => module.path !== groupController
    )
    violations.push({
      path: unexpected?.path ?? groupController,
      line: 1,
      code: 'multiple_group_reducer_owners',
      detail: reducerOwners.map((module) => module.path).join(',') || '<none>'
    })
  }

  const controller = requireSource(groupController, factsByPath, violations)
  if (controller) {
    for (const hook of ['useState', 'useRef'])
      if (hasImportedCall(controller, hook) || hasCall(controller, hook))
        violations.push(
          violation(controller, 1, 'group_controller_owns_local_state', hook)
        )
    for (const [binding, specifier] of [
      ['useGroupManagerCommands', './use-group-manager-commands.js'],
      ['useGroupManagerQueries', './use-group-manager-queries.js']
    ] as const) {
      requireImport(controller, binding, specifier, violations)
      requireCall(controller, binding, specifier, violations)
    }
  }

  for (const path of [sessionMutations, groupCommands, groupQueries]) {
    const module = requireSource(path, factsByPath, violations)
    if (!module) continue
    if (
      !hasImportFrom(
        module,
        'useAsyncCommandCoordinator',
        '../../async/use-async-command-coordinator.js'
      ) ||
      !hasImportedCall(
        module,
        'useAsyncCommandCoordinator',
        '../../async/use-async-command-coordinator.js'
      )
    )
      violations.push(
        violation(
          module,
          1,
          'async_owner_missing_coordinator',
          'useAsyncCommandCoordinator'
        )
      )
  }
}

function inspectNarrowPorts(
  factsByPath: ReadonlyMap<string, ModuleFacts>,
  violations: RendererControllerBoundaryViolation[]
): void {
  for (const [directory, adapterPath] of narrowPortOwners) {
    const adapter = requireSource(adapterPath, factsByPath, violations)
    if (adapter) {
      for (const boundary of ['useCapabilityApi', 'SaltMarcherApi'])
        if (!hasImport(adapter, boundary))
          violations.push(
            violation(adapter, 1, 'adapter_missing_api_boundary', boundary)
          )
      if (!hasImportedCall(adapter, 'useCapabilityApi'))
        violations.push(
          violation(
            adapter,
            1,
            'adapter_missing_api_boundary',
            'useCapabilityApi()'
          )
        )
    }
    for (const module of factsByPath.values()) {
      if (
        !module.path.startsWith(`${directory}/`) ||
        module.path === adapterPath
      )
        continue
      for (const boundary of ['useCapabilityApi', 'SaltMarcherApi'])
        if (hasImport(module, boundary) || hasImportedCall(module, boundary))
          violations.push(
            violation(module, 1, 'general_api_outside_adapter', boundary)
          )
    }
  }
}

function inspectFeatureCapabilityAdapters(
  factsByPath: ReadonlyMap<string, ModuleFacts>,
  violations: RendererControllerBoundaryViolation[]
): void {
  for (const module of factsByPath.values()) {
    if (!/\/features\/[^/]+\/[^/]+-capabilities\.ts$/.test(module.path))
      continue
    if (!hasImport(module, 'SaltMarcherApi'))
      violations.push(
        violation(module, 1, 'adapter_missing_api_boundary', 'SaltMarcherApi')
      )
    for (const binding of module.mutableTopLevelBindings)
      if (binding === 'api' || binding === 'capabilities')
        violations.push(
          violation(module, 1, 'mutable_capability_adapter', binding)
        )
    if (
      module.identifiers.has('ipcRenderer') ||
      hasPropertyPrefix(module, 'window.saltMarcher')
    )
      violations.push(
        violation(
          module,
          1,
          'capability_adapter_bypasses_preload',
          module.identifiers.has('ipcRenderer')
            ? 'ipcRenderer'
            : 'window.saltMarcher'
        )
      )
  }
}

function facts(path: string, source: string): ModuleFacts {
  const tree = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const imports: { specifier: string; imported: string; local: string }[] = []
  const calls = new Set<string>()
  const propertyPaths = new Set<string>()
  const identifiers = new Set<string>()
  const mutableTopLevelBindings = new Set<string>()

  for (const statement of tree.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const specifier = statement.moduleSpecifier.text
      const clause = statement.importClause
      if (clause?.name)
        imports.push({
          specifier,
          imported: 'default',
          local: clause.name.text
        })
      const named = clause?.namedBindings
      if (named && ts.isNamespaceImport(named))
        imports.push({
          specifier,
          imported: '*',
          local: named.name.text
        })
      if (named && ts.isNamedImports(named))
        for (const element of named.elements)
          imports.push({
            specifier,
            imported: element.propertyName?.text ?? element.name.text,
            local: element.name.text
          })
    }
    if (
      ts.isVariableStatement(statement) &&
      !(statement.declarationList.flags & ts.NodeFlags.Const)
    )
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name))
          mutableTopLevelBindings.add(declaration.name.text)
  }

  walk(tree, (node) => {
    if (ts.isIdentifier(node)) identifiers.add(node.text)
    if (ts.isCallExpression(node)) {
      const name = expressionName(node.expression)
      if (name) calls.add(name)
    }
    if (ts.isPropertyAccessExpression(node)) {
      const name = expressionName(node)
      if (name) propertyPaths.add(name)
    }
  })

  return {
    path,
    imports,
    calls,
    propertyPaths,
    identifiers,
    mutableTopLevelBindings
  }
}

function expressionName(node: ts.Expression): string | null {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) {
    const owner = expressionName(node.expression)
    return owner ? `${owner}.${node.name.text}` : node.name.text
  }
  return null
}

function hasCall(module: ModuleFacts, name: string): boolean {
  return [...module.calls].some(
    (call) => call === name || call.endsWith(`.${name}`)
  )
}

function hasImport(module: ModuleFacts, binding: string): boolean {
  return module.imports.some(
    (entry) => entry.imported === binding || entry.local === binding
  )
}

function hasImportFrom(
  module: ModuleFacts,
  binding: string,
  specifier: string
): boolean {
  return module.imports.some(
    (entry) => entry.imported === binding && entry.specifier === specifier
  )
}

function hasImportedCall(
  module: ModuleFacts,
  binding: string,
  specifier?: string
): boolean {
  return module.imports
    .filter(
      (entry) =>
        entry.imported === binding &&
        (specifier === undefined || entry.specifier === specifier)
    )
    .some((entry) => hasCall(module, entry.local))
}

function hasPropertyPrefix(module: ModuleFacts, prefix: string): boolean {
  return [...module.propertyPaths].some(
    (path) => path === prefix || path.startsWith(`${prefix}.`)
  )
}

function requireImport(
  module: ModuleFacts,
  binding: string,
  specifier: string,
  violations: RendererControllerBoundaryViolation[]
): void {
  if (
    !module.imports.some(
      (entry) => entry.specifier === specifier && entry.imported === binding
    )
  )
    violations.push(
      violation(
        module,
        1,
        'missing_required_import',
        `${binding} from ${specifier}`
      )
    )
}

function requireCall(
  module: ModuleFacts,
  binding: string,
  specifier: string,
  violations: RendererControllerBoundaryViolation[]
): void {
  if (!hasImportedCall(module, binding, specifier))
    violations.push(
      violation(module, 1, 'missing_required_call', `${binding}()`)
    )
}

function requireSource(
  path: string,
  factsByPath: ReadonlyMap<string, ModuleFacts>,
  violations: RendererControllerBoundaryViolation[]
): ModuleFacts | null {
  const module = factsByPath.get(path)
  if (module) return module
  violations.push({
    path,
    line: 1,
    code: 'missing_owner_source',
    detail: path
  })
  return null
}

function violation(
  module: ModuleFacts,
  line: number,
  code: RendererControllerBoundaryViolation['code'],
  detail: string
): RendererControllerBoundaryViolation {
  return { path: module.path, line, code, detail }
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}
