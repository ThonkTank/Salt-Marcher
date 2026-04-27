Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Detailed rule-shape taxonomy for assigning primary
mechanical ownership inside the architecture enforcement harness.

# Architecture Enforcement Harness Rule Shapes

## Purpose

This subordinate standard defines the rule-shape taxonomy used by the
architecture enforcement harness. It explains how SaltMarcher classifies a
documented architecture rule before assigning its primary mechanical owner.

The umbrella owner model, rule-status vocabulary, execution model, and review
boundary remain defined in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1).

## Rule Shape Taxonomy

SaltMarcher assigns mechanical ownership by the dominant shape of the rule.

### Repository Topology And Presence Rules

These rules are defined by file placement, allowed buckets, package-path
alignment, or required roots and schema declarations.

For `src/domain/**`, these rules prove that Java files live under allowed
tactical role packages; they do not prove that every tactical role exists or is
needed. For `src/data/**`, they prove the current physical adapter layout:
composition adapter root, port-adapter packages, source-adapter packages,
source model, optional mapper, and shared infrastructure.

### Source Policy Rules

These rules inspect Java source structure, naming, required methods, and
forbidden textual or AST-local usage patterns without full compiler type
resolution across public signatures.

### Compiler-Precise Rules

These rules require javac-resolved types, signature visibility, or precise
referenced-type analysis.

### Bytecode Dependency Rules

These rules are about package-level dependency direction, boundary crossing,
and cycles visible after compilation.

### Graph Topology Rules

These rules are whole-slice or whole-codebase structural constraints that are
most naturally expressed as graph queries rather than per-file checks.

### Gradle-Owned Build And Resource Rules

These rules are repository policy checks expressed most naturally as typed
Gradle verification tasks over files, resources, or packaging metadata.

## References

- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- [Architecture Enforcement Harness Operations](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness-operations.md:1)
