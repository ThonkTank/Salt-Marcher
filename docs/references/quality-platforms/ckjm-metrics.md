Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: CKJM metric-definition reference used by the Quality Platforms Standard.

# CKJM Metrics

Original URL: https://www.spinellis.gr/sw/ckjm/
Local Source: Not mirrored; see Original URL.
Source Kind: `tool_documentation`
Accessed: 2026-04-20

# CKJM Metrics

This local note captures the CKJM metric definitions used by SaltMarcher's
object-oriented metric gate.

## Why It Matters

- CKJM is the tool that computes SaltMarcher's class-level object-oriented
  metrics.
- CKJM defines and reports the metric names but does not publish official
  blocking thresholds for a project.
- SaltMarcher therefore needs a separate reference policy for numeric limits.

## Key Metrics Used

- `WMC`: weighted methods per class.
- `DIT`: depth of inheritance tree.
- `NOC`: number of children.
- `CBO`: coupling between objects.
- `RFC`: response for class.
- `LCOM`: lack of cohesion in methods.
- `Ca`: afferent couplings.
- `NPM`: number of public methods.

## SaltMarcher Read

CKJM owns measurement. The Quality Platforms Standard owns the blocking
threshold policy and cites a separate CK metric reference for the selected
limits.

## Related Local Standards

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
