# Shared UI Components

## Purpose & Audience
This overview targets engineers extending Salt Marcher's shared UI layer. It explains the component catalog, where to find documentation, and how to keep runtime copy compliant with the English language policy.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `docs/ui/README.md` | Entry point for shared UI documentation. | _This document_ |
| `docs/ui/map-manager-overview.md` | Deep dive into the map manager workflow and deletion safeguards. | [`map-manager-overview.md`](map-manager-overview.md) |
| `docs/ui/terminology.md` | Canonical glossary for runtime UI terminology. | [`terminology.md`](terminology.md) |
| `src/ui/` | Source code for reusable dialogs, headers, and workflows. | [`UiOverview.txt`](../../src/ui/UiOverview.txt) |

## Key Workflows
1. **Consult the glossary first.** Pull approved labels from [`terminology.md`](terminology.md) before creating or updating UI copy.
2. **Use shared copy objects.** Import constants from `src/ui/copy.ts` (e.g., `MAP_HEADER_COPY`, `MODAL_COPY`) instead of hard-coding strings.
3. **Mirror changes in tests.** When adjusting copy, update the relevant Vitest suites under `tests/ui/` to assert against the shared constants.
4. **Run the language policy test.** Execute `npm test` to ensure the `language-policy.test.ts` suite flags no non-English literals.

## Linked Docs
- [Documentation Style Guide](../../style-guide.md) – repository-wide documentation and language standards.
- [Cartographer documentation](../cartographer/README.md) – feature-level usage of shared UI.
- [Library documentation](../library/README.md) – demonstrates integration of shared components in another workspace.

## Standards & Conventions
- Runtime UI copy, comments, and notices must use U.S. English and align with the phrasing defined in [`terminology.md`](terminology.md).
- New UI strings belong in `src/ui/copy.ts`; code and tests must import from these central constants.
- The Vitest suite `tests/ui/language-policy.test.ts` enforces the no-German rule by scanning shared UI sources and key entry points. Keep the allow-list short to avoid masking regressions.
- Update this documentation and the glossary whenever a new UI concept or phrase is introduced.
