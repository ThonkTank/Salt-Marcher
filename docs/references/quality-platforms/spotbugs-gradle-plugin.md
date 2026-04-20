Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: SpotBugs Gradle plugin effort and report-level reference used by the Quality Platforms Standard.

# SpotBugs Gradle Plugin

Original URL: https://spotbugs.github.io/spotbugs-gradle-plugin/spotbugs-gradle-plugin/com.github.spotbugs.snom/-spot-bugs-extension/index.html
Local Source: Not mirrored; see Original URL.
Source Kind: `official_documentation`
Accessed: 2026-04-20

# SpotBugs Gradle Plugin

This local note captures the SpotBugs Gradle plugin settings used by
SaltMarcher's bytecode bug and security-smell report.

## Why It Matters

- The Gradle plugin defines the `effort` and `reportLevel` knobs used by
  SaltMarcher's `spotbugsMain` task.
- `reportLevel` controls confidence filtering; raising it would hide lower
  confidence findings and weaken the report.
- `effort` controls analysis depth; `MAX` is the strongest configured level.

## Key Settings Used

- `reportLevel = MEDIUM` keeps the report at the normal medium-confidence
  level rather than filtering only high-confidence findings.
- `effort = MAX` asks SpotBugs to use its most thorough analysis effort.

## SaltMarcher Read

SaltMarcher keeps `reportLevel = MEDIUM` and `effort = MAX`. The result is an
informational report with a normal confidence threshold and maximum analysis
effort; it is not weakened by a high-confidence-only filter.

## Related Local Standards

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
