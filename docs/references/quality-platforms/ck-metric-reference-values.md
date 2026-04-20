Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: CK metric threshold policy reference used by the Quality Platforms Standard.

# CK Metric Reference Values

Original URL: https://www.cs.purdue.edu/homes/apm/courses/BITSC461-fall03_SoftwareEngineering/metrics-slides/nasa-rosenberg-study.html
Local Source: Not mirrored; see Original URL.
Source Kind: `reference_article`
Accessed: 2026-04-20

# CK Metric Reference Values

This local note captures the external interpretation policy used for
SaltMarcher's CKJM thresholds.

## Why It Matters

- CKJM does not provide official threshold defaults.
- The NASA SATC object-oriented metrics reference treats the CK metrics as
  quality indicators and consistently interprets lower values as better for
  complexity, coupling, lack of cohesion, and inheritance risk.
- SaltMarcher needs stable numeric limits so contributors cannot raise the
  object-oriented metrics gate to the current worst classes without updating
  the documented policy.

## Key Reference Position

- `WMC`, `RFC`, `LCOM`, `CBO`, `DIT`, and `NOC` are useful object-oriented
  quality metrics.
- Lower values are preferred for method count/complexity, response set size,
  lack of cohesion, coupling, inheritance depth, and child count.
- The reference does not define official CKJM-compatible blocking thresholds;
  SaltMarcher therefore uses a conservative project policy derived from the
  lower-is-better interpretation.

## SaltMarcher Threshold Policy

- `WMC`: `11`
- `DIT`: `1`
- `NOC`: `0`
- `CBO`: `1`
- `RFC`: `43`
- `LCOM`: `78`
- `Ca`: `1`
- `NPM`: `11`

`Ca` follows the same low-coupling policy as `CBO`. `NPM` follows the same
method-count policy as `WMC`. `DIT` uses `1` because CKJM's Java output counts
ordinary classes from a root depth of `1`.

## Related Local Standards

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
