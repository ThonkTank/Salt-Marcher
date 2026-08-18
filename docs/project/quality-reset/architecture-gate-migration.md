# Architecture gate migration matrix

Status: 2026-08-18. This matrix inventories the protected rule families in
`architecture-boundaries.test.ts`, `refactor-requirements-alignment.test.ts`,
`developer-feedback.test.ts`, and `e2e-suite-registry.test.ts`. A rule remains
listed until its old text assertion is deleted or explicitly retained as a
product-contract assertion.

| Rule family | Current mechanism | Target mechanism | Controlled mutation | Delete old check when |
| --- | --- | --- | --- | --- |
| Campaign persistence locators and handle ownership | AST gate plus a few source assertions | `campaign-persistence-boundary.ts` | Add a forbidden locator method or call | All locator-name assertions route through the AST result |
| Runtime operation ownership and composition | Typed registry, source assertions | `runtime-registry-boundary.ts` plus registry composition | Add a central operation property | Fragment composition is the only operation catalog |
| Utility/preload completeness | `satisfies CoreHandlers`, runtime registry loops | Exact-key assertion plus AST gate | Remove an exact-key assertion; add/remove handler key | Utility and preload both fail before serving requests |
| Utility composition ownership | Source assertions | `runtime-registry-boundary.ts` | Add a top-level function to `application.ts` | Events, diagnostics, dispatch, and scheduling remain separate owners |
| Renderer process boundary | Import scans and direct-IPC text checks | TypeScript import-graph gate | Add renderer import of Node, Electron, persistence, or schema owner | Semantic import gate covers aliases and formatting |
| TypeScript dependency cycles | Parsed import graph | Retain parsed graph | Add a back-edge fixture | Cycle report names the complete path |
| SQL aggregate ownership | SQL-token/source assertions | AST/import ownership plus repository tests | Put another aggregate's table token in a store | Repository-level owner rule covers every SQL entrypoint |
| Schema initialization timing | Source assertions and integration tests | Bootstrap registry and initialization counters | Invoke schema initialization from a command path | Startup-only initialization is measured in tests |
| Party, combat, scene, and travel ownership | Focused source assertions | Capability repository/service tests | Move mutation into a read path or infer identity from row IDs | Query/command tests cover the invariant directly |
| Planner/Loot ownership and lazy UI leaves | Import/source assertions | Feature import graph and controller tests | Import a concrete owner across the boundary | Feature graph check reports the forbidden edge |
| Renderer capability injection | Source assertions and TypeScript types | Typed capability ports | Introduce mutable module-level capability state | All consumers receive an explicit port |
| Renderer styles and message ownership | File/source inventory | CSS/message ownership manifests | Add unowned CSS or visible literal copy | Manifests enumerate every feature leaf |
| Dialog, collection, reference, and popover primitives | Source assertions | Component contract tests | Bypass the shared primitive | Accessibility and behavior tests catch the bypass |
| Hex chunks, routes, placement, and location integration | Source plus domain tests | Domain invariant/property tests | Change chunk size, embed route blobs, or couple revision to placement | Domain tests cover persistence and projection |
| E2E suite/fixture ownership | Registry and source assertions | Executable suite manifest | Add an unregistered spec or positional selector | Runner consumes only the manifest |
| Lint/build/tooling partition ownership | File inventories and configuration tests | Executable ownership manifests | Assign a source to zero or two partitions | Every relevant file has exactly one owner |
| Qualification exclusion | HTML/import source assertions | Build graph and bundle inspection | Import qualification entry into normal build | Bundle gate reports the exact forbidden module |

## Implemented semantic gates

- `campaign-persistence-boundary.ts` parses TypeScript and reports forbidden
  raw locator declarations and calls with source locations. Its unit test
  proves the gate turns red for a real locator mutation.
- `runtime-registry-boundary.ts` parses the central registry, Utility root, and
  preload. Its mutation tests cover a central operation definition, inline
  Utility ownership, and removal of preload completeness validation.
- `composeOperationDefinitions` rejects duplicate keys before object merging;
  `assertExactOperationKeys` rejects missing and extra implementations.

Text checks are retained only where the literal itself is the product rule
(for example prohibited localized prose or a fixed SQL relationship), or
until the corresponding target mechanism and mutation proof above exist.
