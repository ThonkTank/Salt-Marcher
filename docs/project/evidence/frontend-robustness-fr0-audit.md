# Frontend robustness FR0 audit

- Date: 2026-08-24
- Baseline: `origin/main@7590d6653dc29f8c258529634caa28893320eebe`
- Phase: `FR0` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)

## Sources reviewed before implementation

- `AGENTS.md` and the canonical delivery contract;
- `docs/project/vision.md`, `program-technical-needs.md`,
  `target-architecture.md`, and `electron-greenfield-migration.md`;
- renderer capability, workspace, Session, Catalog, Planner, Hex, Travel,
  settings, passive-renderer, and spatial owner modules at the baseline SHA;
- current architecture, unit, integration, Electron, bundle, and runtime proof
  surfaces relevant to those owners.

## Implementation packet

FR0 owns documentation and executable characterization only. It adds the
normative roadmap, owner-family acceptance matrix, focused check manifest, and
semantic tests for the observed global readback/remount chain, uncoordinated
Campaign root, latest-only mutation owners, positive FIFO references, and loss
of operation mode in the renderer API type.

The phase does not change runtime behavior, choose the FR1 cache implementation,
or claim interaction-level acceptance. Authority keys and command keys remain
phase-specific decisions, constrained by the target invariants and matrix.

## Exit-condition review

| FR0 condition | Evidence | Assessment |
| --- | --- | --- |
| Every owner family is classified | [acceptance matrix](../architecture/frontend-robustness-acceptance-matrix.md) | covered at family granularity with state classes, current risk, target phase, and proof route |
| Known instability classes are represented | `frontend-robustness-baseline.test.ts` and the matrix journeys | executable where the current mechanism is a stable semantic fact; interaction requirements remain explicit journeys |
| Baseline does not normalize current behavior | roadmap invariants and test names | current latest-only writes and remount recovery are explicitly negative evidence |
| Focused and complete gates pass | `pnpm check:frontend-robustness`, then `pnpm check` | focused gate passed locally; complete local gate is host-blocked and remains open until qualified exact-SHA evidence exists |

## Negative findings and follow-up

1. The first roadmap draft made `FR1` through `FR7` too large for clean review.
   It was corrected with mandatory `FR1A` through `FR7C` sprint boundaries and
   a prohibition on combining adjacent rows without review.
2. The first inventory omitted Reference lookup, Creature/biome options,
   generator/settings editors, shell/modal state, and the passive renderer.
   Those families and their proof routes were added before closeout.
3. An initial FIFO characterization depended on a TypeScript literal shape and
   failed for `mode: 'queue' as const`. The assertion now checks semantic
   property and literal presence, avoiding syntax-shape coupling.
4. Family-level classification is manually reviewed rather than inferred from
   every capability call site. Generating a call-graph inventory now would add
   a second source of truth and still not prove runtime ownership. `FR1A` must
   instead add semantic execution-contract gates, and `FR7A` must prove the
   zero-legacy inventory. This is a bounded evidence limitation, not acceptance
   of an unclassified runtime owner.
5. No production interaction evidence is claimed in FR0. Controlled-promise,
   Electron, restart, latency, resource, installed-runtime, and owner evidence
   remain mandatory in the owning later sprint.
6. The complete local gate reached 187 passing test files and then failed five
   existing Encounter Generator UI tests by 30-second timeout and one existing
   Reference Matcher 16-ms budget. Both failures reproduce without any FR0
   runtime source in the isolated test set. The host is AC-powered but reports
   a `low-power` platform profile, a hard 800-MHz CPU maximum, and disabled
   turbo; the exact baseline SHA is green on GitHub. Tests and thresholds were
   not weakened. The final Candidate must obtain its full exact-SHA remote
   evidence on the repository's qualified runners, and the local gate remains
   explicitly non-green unless repeated on a qualified host.

The first five findings do not threaten an FR0 guarantee after their
corrections. Finding 6 blocks a local-green claim but not publication of a
Candidate for qualified remote verification. Runtime cutover may begin only
after the final Candidate passes the focused check, complete qualified
repository evidence, required remote checks, and the repository delivery
policy; the pull request must retain the local host limitation in its audit.
