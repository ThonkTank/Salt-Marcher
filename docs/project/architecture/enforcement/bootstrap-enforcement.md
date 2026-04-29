Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Mechanical enforcement for bootstrap-owned discovery and
startup invariants.

# Bootstrap Enforcement

## Goal

This document owns the mechanically enforced invariants for `bootstrap/`:
generic discovery boundaries, startup uniqueness checks, and the ban on
feature-specific implementation ownership.

## Enforced

| Rule ID | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- |
| `bootstrap-shell-feature-independence` | ArchUnit `bootstrapMustStayOutsideFeatureCode`, `bootstrapMustOnlyUseAppShellFromShellHost`, `shellMustNotReachFeatureInteractorsDomainOrData`, and `shellApiMustStayIndependentFromHostAndFeatureLayers`; PMD `SaltMarcherSourcePolicyRule` | `./gradlew checkArchitecture` | Bootstrap and shell stay outside concrete feature implementation except for the allowed shell host composition point. |
| `bootstrap-default-landing-uniqueness` | build-harness `ShellSurfaceRules` | `./gradlew checkArchitecture` | At most one left-bar root declares `defaultLanding=true`. |
| `bootstrap-default-landing-literal` | build-harness `ShellSurfaceRules` | `./gradlew checkArchitecture` | `ShellLeftBarTabSpec` roots expose a literal `defaultLanding` argument so startup uniqueness stays mechanically checkable. |

## Candidate

- proving that bootstrap discovery remains fully generic and does not acquire
  hidden feature-specific registries when the public entrypoint shape still
  passes

## Review-Owned

- whether deterministic registration order remains a useful UX default rather
  than merely a legal startup policy

## References

- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
