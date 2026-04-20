Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: PMD Java design-rule threshold defaults used by the Quality Platforms Standard.

# PMD Java Design Rules

Original URL: https://docs.pmd-code.org/pmd-doc-7.23.0/pmd_rules_java_design.html
Local Source: Not mirrored; see Original URL.
Source Kind: `official_documentation`
Accessed: 2026-04-20

# PMD Java Design Rules

This local note captures the PMD Java design rule defaults used by
SaltMarcher's non-architecture PMD reports.

## Why It Matters

- PMD is the source of truth for the default thresholds of its Java design
  rules.
- SaltMarcher's PMD ruleset should not silently raise thresholds above those
  defaults because that would make the reports weaker than the tool's standard
  guidance.
- Rules that intentionally use stricter values must be documented as stricter
  project policy.

## Key Thresholds Used

- `CognitiveComplexity` default report level: `15`.
- `CyclomaticComplexity` default method report level: `10`.
- `CyclomaticComplexity` default class report level: `80`.
- `NPathComplexity` default report level: `200`.
- `CouplingBetweenObjects` default threshold: `20`.
- `AvoidDeeplyNestedIfStmts` default problem depth: `3`.
- `NcssCount` default method report level: `30`.
- `ExcessiveParameterList` default minimum: `10`.

## SaltMarcher Read

SaltMarcher keeps the PMD defaults for complexity, coupling, nesting, and NCSS
metrics. It intentionally sets `ExcessiveParameterList` to `6`, which is
stricter than PMD's default `10`.

## Related Local Standards

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
