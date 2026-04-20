Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Lizard cyclomatic complexity threshold reference used by the Quality Platforms Standard.

# Lizard README

Original URL: https://github.com/terryyin/lizard
Local Source: Not mirrored; see Original URL.
Source Kind: `official_project_documentation`
Accessed: 2026-04-20

# Lizard README

This local note captures the Lizard cyclomatic complexity default used by
SaltMarcher's method-complexity gate.

## Why It Matters

- Lizard is SaltMarcher's blocking method-level cyclomatic complexity checker.
- Its `-C` option defines the cyclomatic complexity warning threshold.
- SaltMarcher's blocking threshold should not be above Lizard's documented
  default unless the quality standard explicitly accepts a weaker gate.

## Key Threshold Used

- Lizard cyclomatic complexity warning threshold default: `15`.

## SaltMarcher Read

SaltMarcher keeps the Lizard cyclomatic complexity limit at `15`, matching the
tool default.

## Related Local Standards

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
