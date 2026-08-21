import { readdirSync, readFileSync } from 'node:fs'
import { expect } from 'vitest'
import {
  architectureGate,
  legitimateLiteralGate
} from './support/architecture-gate.js'
import {
  codeFiles,
  hasImport,
  readTypeScriptModule
} from './support/typescript-module.js'

for (const path of [
  'src/renderer/features/session/session-workspace.css',
  'src/renderer/features/session/session-control-panel.css',
  'src/renderer/features/session/session-center-panel.css',
  'src/renderer/features/session/session-groups-panel.css',
  'src/renderer/features/session/session-scenario-panel.css',
  'src/renderer/features/encounter/encounter.css'
])
  legitimateLiteralGate({
    name: `scopes ${path} to the Session surface`,
    path,
    owner: 'session-ui',
    rationale:
      'CSS scope syntax is a stylesheet literal contract and is not represented in the TypeScript AST.',
    inspect: (content) => {
      expect(content.trimStart().startsWith('@scope (.session-mockup)')).toBe(
        true
      )
    }
  })

legitimateLiteralGate({
  name: 'keeps core encounter selectors singular',
  path: 'src/renderer/features/encounter/encounter.css',
  owner: 'encounter-ui',
  rationale:
    'Selector uniqueness is a CSS cascade invariant that requires inspecting stylesheet selectors.',
  inspect: (content) => {
    for (const selector of [
      '.scenario-content > footer',
      '.initiative-list',
      '.combat-cards',
      '.combat-card',
      '.resolution-panel'
    ])
      expect(selectorDefinitionCount(content, selector), selector).toBe(1)
  }
})

architectureGate(
  'import-dependency-boundary',
  'keeps renderer styling in tokens, shell and owning features',
  () => {
    for (const feature of ['session', 'party', 'catalog', 'encounter', 'hex'])
      expect(
        readdirSync(`src/renderer/features/${feature}`).some((file) =>
          file.endsWith('.css')
        ),
        feature
      ).toBe(true)
    expect(
      readFileSync(
        'src/renderer/features/creatures/creatures.css',
        'utf8'
      ).trim().length
    ).toBeGreaterThan(0)
  }
)

legitimateLiteralGate({
  name: 'keeps feature selectors out of the shell stylesheet',
  path: 'src/renderer/shell/app.css',
  owner: 'renderer-shell',
  rationale:
    'Feature selector ownership is a CSS naming boundary and therefore a legitimate stylesheet literal gate.',
  inspect: (content) => {
    for (const prefix of [
      '.catalog-',
      '.session-',
      '.encounter-',
      '.hex-',
      '.party-',
      '.group-',
      '.creature-'
    ])
      expect(content).not.toContain(prefix)
  }
})

legitimateLiteralGate({
  name: 'keeps Session and Hex selectors within their owning feature',
  path: 'src/renderer/features/session/session-workspace.css',
  owner: 'session-and-hex-ui',
  rationale:
    'Cross-feature CSS selector ownership cannot be expressed by the TypeScript import graph.',
  inspect: () => {
    const sessionCss = stylesIn('src/renderer/features/session')
    const hexCss = stylesIn('src/renderer/features/hex')
    expect(sessionCss).not.toContain('.hex-')
    expect(sessionCss).not.toContain('.travel-')
    expect(hexCss).not.toContain('.session-')
  }
})

architectureGate(
  'import-dependency-boundary',
  'keeps shared creature and dialog primitives independent of consumers',
  () => {
    const creatures = readTypeScriptModule(
      'src/renderer/features/creatures/creature-controls.tsx'
    )
    expect(hasImport(creatures, '../../shell/searchable-select.js')).toBe(true)
    expect(
      creatures.imports.some(({ specifier }) =>
        specifier.includes('reference-multi-select')
      )
    ).toBe(false)
    for (const path of [
      'src/renderer/features/hex/hex-editor-panes.tsx',
      'src/renderer/features/catalog/catalog-controls.tsx'
    ])
      expect(
        readTypeScriptModule(path).identifiers.has('ReferenceMultiSelect'),
        path
      ).toBe(false)
    const modal = readTypeScriptModule('src/renderer/shell/modal-dialog.tsx')
    expect(hasImport(modal, './modal-dialog.css')).toBe(true)
    expect(modal.exportedDeclarations.has('ModalForm')).toBe(true)
    expect(modal.typeProperties).not.toContainEqual({
      name: 'form',
      optional: true
    })
  }
)

legitimateLiteralGate({
  name: 'keeps modal styling owned by the shell primitive',
  path: 'src/renderer/shell/modal-dialog.css',
  owner: 'renderer-shell',
  rationale:
    'Modal selector ownership is enforced at the CSS layer and has no runtime type representation.',
  inspect: (modalCss) => {
    expect(modalCss).not.toContain('.modal-form-content')
    expect(stylesIn('src/renderer/features/session')).not.toContain(
      '.modal-backdrop'
    )
  }
})

architectureGate(
  'typed-contract',
  'gives every renderer feature a screen, hook, adapter and owned CSS',
  () => {
    const screens = {
      session: 'session-workspace.tsx',
      catalog: 'catalog-workspace.tsx',
      hex: 'hex-editor.tsx',
      party: 'party-controls.tsx',
      encounter: 'encounter-panels.tsx'
    } as const
    for (const [feature, screen] of Object.entries(screens)) {
      const directory = `src/renderer/features/${feature}`
      const files = readdirSync(directory)
      expect(files).toContain(screen)
      expect(files).toContain(`${feature}-capabilities.ts`)
      expect(files.some((file) => file.endsWith('.css'))).toBe(true)
      expect(
        files.some(
          (file) => file.startsWith('use-') || file.endsWith('-state.ts')
        )
      ).toBe(true)
      for (const path of codeFiles(directory))
        if (!path.endsWith(`${feature}-capabilities.ts`))
          expect(
            readTypeScriptModule(path).propertyAccesses.some((entry) =>
              entry.startsWith('window.saltMarcher')
            ),
            path
          ).toBe(false)
    }
  }
)

architectureGate(
  'typed-contract',
  'keeps static UI copy behind typed message keys',
  () => {
    const paths = [
      ...codeFiles('src/renderer/features'),
      'src/renderer/passive.tsx'
    ].filter((path) => path.endsWith('.tsx'))
    for (const path of paths) {
      const module = readTypeScriptModule(path)
      expect(
        module.jsxText.filter(
          (value) =>
            /[A-Za-zÄÖÜäöü]/.test(value) &&
            !new Set(['q', '· r', 'EP', 'EP ·', 'XP']).has(value)
        ),
        `${path} contains static visible JSX copy`
      ).toEqual([])
      expect(
        module.jsxStringAttributes.filter(
          ({ name, value }) =>
            ['aria-label', 'title', 'placeholder'].includes(name) &&
            /[A-Za-zÄÖÜäöü]/.test(value)
        ),
        `${path} contains a static accessibility label`
      ).toEqual([])
    }
  }
)

architectureGate(
  'import-dependency-boundary',
  'uses the shared accessible dialog primitive for application dialogs',
  () => {
    for (const path of codeFiles('src/renderer')) {
      if (path.endsWith('modal-dialog.tsx')) continue
      const module = readTypeScriptModule(path)
      expect(module.jsxTags, path).not.toContain('dialog')
      expect(module.jsxAttributeNames, path).not.toContain('aria-modal')
    }
  }
)

architectureGate(
  'import-dependency-boundary',
  'composes both creature collection editors through the shared manager',
  () => {
    for (const path of [
      'src/renderer/features/session/group-manager-view.tsx',
      'src/renderer/features/encounter-table/encounter-table-manager.tsx'
    ])
      expect(readTypeScriptModule(path).jsxTags, path).toContain(
        'CreatureCollectionManagerDialog'
      )
  }
)

architectureGate(
  'import-dependency-boundary',
  'routes registered read-only prose surfaces through the reference primitive',
  () => {
    for (const path of [
      'src/renderer/features/reference/creature-inspector.tsx',
      'src/renderer/features/encounter/combat-card.tsx',
      'src/renderer/features/session/session-group-card.tsx',
      'src/renderer/features/session/session-center-panel.tsx'
    ])
      expect(readTypeScriptModule(path).jsxTags, path).toContain(
        'ReadOnlyProse'
      )
    expect(
      readTypeScriptModule(
        'src/renderer/features/reference/read-only-prose.tsx'
      ).identifiers.has('ReferenceRichText')
    ).toBe(true)
  }
)

architectureGate(
  'typed-contract',
  'uses the shared non-modal surface for reference popovers and windows',
  () => {
    const reference = readTypeScriptModule(
      'src/renderer/features/reference/reference-ui.tsx'
    )
    expect(reference.jsxTags).toContain('NonModalSurface')
    expect(reference.jsxAttributeNames).not.toContain('aria-modal')
    expect(
      reference.jsxStringAttributes.filter(
        ({ name, value }) => name === 'role' && value === 'dialog'
      )
    ).toEqual([])
  }
)

legitimateLiteralGate({
  name: 'records the bounded Catalog search escalation profile',
  path: 'docs/project/architecture/target-architecture.md',
  owner: 'catalog-architecture',
  rationale:
    'The escalation thresholds are durable prose requirements rather than executable TypeScript contracts.',
  inspect: (content) => {
    for (const literal of [
      '2,000 locations',
      '5 MiB',
      '150 ms p95',
      'server-side paginated query port'
    ])
      expect(content).toContain(literal)
  }
})

function stylesIn(directory: string): string {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(`${directory}/${file}`, 'utf8'))
    .join('\n')
}

function selectorDefinitionCount(content: string, selector: string): number {
  return content
    .split('{')
    .slice(0, -1)
    .filter((prefix) =>
      prefix
        .split('}')
        .at(-1)
        ?.split(',')
        .some((candidate) => candidate.trim() === selector)
    ).length
}
