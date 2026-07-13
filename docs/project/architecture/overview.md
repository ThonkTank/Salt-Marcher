Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Project-wide architecture routing during active architecture
and document-size policy migrations.

# Architecture Overview

## Purpose

SaltMarcher's source-area architecture is currently governed by the migration
roadmap and ledger while the retired role-family doctrine is removed from the
repository. Document-size policy adoption has its own roadmap and ledger. This
overview routes readers to the documents that remain authoritative during those
migrations.

## Current Source Order

1. `docs/project/architecture/architecture-roadmap-phase2.md`
2. `docs/project/architecture/migration-ledger.md`
3. `docs/project/architecture/architecture-migration-roadmap.md`
4. `docs/project/architecture/doc-size-policy-vision-and-roadmap.md`
5. `docs/project/architecture/doc-size-policy-ledger.md`
6. `docs/project/documentation-specification.md`
7. retained behavior, contract, requirement, domain, and verification docs
8. surrounding production code for legacy areas
9. the pilot reference commit named in the ledger for migrated areas

Where a retained document still describes old structure, the roadmap and ledger
win for migration work. Behavior truth remains in feature requirements,
contracts, domain docs, behavior harnesses, and real application behavior.

## Repository Shape

```text
bootstrap/   application startup and generic discovery
shell/       passive cockpit host and shell contracts
src/features/ migrated feature-owned runtime code where the ledger says so
src/view/    legacy cockpit contributions until each area migrates
src/domain/  legacy and non-migrated application core by context
src/data/    outbound adapters; not migrated per area except gateway signatures
resources/   static resources and centralized stylesheets
docs/        project and feature documentation
tools/       build infrastructure, quality platforms, and scripts
```

## Retained Architecture Statements

- [Architecture Roadmap Phase 2](architecture-roadmap-phase2.md)
  owns the decomposition targets, W0-W4 work items, split-map rule, and
  Phase-1 metric repeal.
- [Architecture Migration Roadmap](architecture-migration-roadmap.md)
  owns the completed Phase-1 target principles, per-area cycle, and M0-M6
  migration milestones.
- [Migration Ledger](migration-ledger.md)
  owns current milestone, in-flight work, area state, and close-out notes
  across Phase 1 and Phase 2.
- [Source Architecture Statement](source-architecture.md) owns the current
  source-shape routing after the role-family migration.
- [Document Size Policy Roadmap](doc-size-policy-vision-and-roadmap.md) owns
  the roadmap replacing the hard Markdown size cap.
- [Document Size Policy Ledger](doc-size-policy-ledger.md) owns the current
  document-size policy adoption state.
- [Document Split Protocol](doc-split-protocol.md) owns split triggers,
  zero-loss obligations, and the judge checklist for documentation splits.
- [Layering Architecture Standard](patterns/layering-architecture.md)
  owns the retained package-level dependency direction statement.
- [Bootstrap Standard](patterns/bootstrap.md) and
  [Shell Layer Standard](patterns/shell-layer.md) own startup and shell hosting
  responsibilities that remain stable during migration.
- [Data Layer Standard](patterns/data-layer.md) owns the adapter-zone decision
  for `src/data/**`; data is excluded from per-area migration unless a migrated
  boundary requires a gateway signature change.
- [Styling Standard](patterns/styling.md) owns centralized styling rules.
- [Verification Core Architecture](verification-core.md) owns public
  verification surfaces and the retained outcome-check wiring.

## Migration Rule

Legacy areas match surrounding code until their ledger row starts. Migrated
areas match the pilot reference named in the ledger. New architecture pattern
documents are not introduced during the migration; durable design decisions are
recorded in the roadmap, ledger, owner docs, and journal as required.

## References

- [Documentation Standard](documentation.md)
- [Documentation Specification](../documentation-specification.md)
- [Agent Instruction Standard](agent-instructions.md)
- [Quality Platforms Standard](../verification/quality-platforms.md)
- [Harness Gaps](../verification/harness-gaps.md)
