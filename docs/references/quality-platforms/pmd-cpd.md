Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: PMD CPD duplicate-code threshold reference used by the Quality Platforms Standard.

# PMD CPD

Original URL: https://docs.pmd-code.org/pmd-doc-7.23.0/pmd_userdocs_cpd.html
Local Source: Not mirrored; see Original URL.
Source Kind: `official_documentation`
Accessed: 2026-04-20

# PMD CPD

This local note captures the PMD Copy/Paste Detector threshold convention used
by SaltMarcher's duplicate-code gate.

## Why It Matters

- CPD requires an explicit `--minimum-tokens` value for duplicate detection.
- PMD's CPD documentation uses `100` tokens in its Java examples.
- SaltMarcher's gate must remain at or below that documented example threshold
  to avoid becoming less sensitive than the commonly documented CPD usage.

## Key Threshold Used

- Documented Java example threshold: `--minimum-tokens 100`.

## SaltMarcher Read

SaltMarcher uses `minimumTokens = 80`. This is stricter than the documented
`100` token example and keeps duplicate-code detection meaningful as a blocking
local gate.

## Related Local Standards

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
