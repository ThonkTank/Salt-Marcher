Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: CK metric hotspot policy reference used by the Quality Platforms Standard.

# CK Metric Reference Values

Original URL: https://www.cs.purdue.edu/homes/apm/courses/BITSC461-fall03_SoftwareEngineering/metrics-slides/nasa-rosenberg-study.html
Local Source: Not mirrored; see Original URL.
Source Kind: `reference_article`
Accessed: 2026-04-20

# CK Metric Reference Values

This local note captures the external interpretation policy used for
SaltMarcher's CKJM hotspot gate.

## Why It Matters

- CKJM does not provide official threshold defaults.
- The NASA SATC object-oriented metrics reference treats the CK metrics as
  quality indicators and consistently interprets lower values as better for
  complexity, coupling, lack of cohesion, and inheritance risk.
- SaltMarcher needs stable hotspot limits so contributors cannot raise the
  object-oriented metrics baseline without updating the documented policy.

## Key Reference Position

- `WMC`, `RFC`, `LCOM`, `CBO`, `DIT`, and `NOC` are useful object-oriented
  quality metrics.
- Lower values are preferred for method count/complexity, response set size,
  lack of cohesion, coupling, inheritance depth, and child count.
- The reference does not define official CKJM-compatible blocking thresholds;
  SaltMarcher therefore uses a project-specific hotspot and baseline-regression
  policy derived from the lower-is-better interpretation.

## SaltMarcher Hotspot Policy

CKJM blocks on meaningful regressions in hotspot candidates rather than on
low absolute thresholds for every class.

- Blocking hotspot metrics: `WMC`, `CBO`, `RFC`, `LCOM`, `NPM`.
- Report-only context metrics: `DIT`, `NOC`, `Ca`.
- Attention thresholds: `WMC>=50`, `CBO>=40`, `RFC>=120`, `LCOM>=500`,
  `NPM>=40`.
- Extreme thresholds: `WMC>=100`, `CBO>=60`, `RFC>=200`, `LCOM>=1500`,
  `NPM>=60`.
- Meaningful regression deltas: `WMC +5`, `CBO +5`, `RFC +15`,
  `LCOM +150`, `NPM +5`.

A class is a hotspot candidate when it meets at least two attention thresholds
or at least one extreme threshold. The accepted baseline lives in
`tools/quality/config/ckjm/baseline.tsv`.

## Related Local Standards

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
