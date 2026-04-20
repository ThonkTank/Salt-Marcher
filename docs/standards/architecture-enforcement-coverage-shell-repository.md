Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Mechanical and review-owned enforcement coverage for shell,
resources, styling, repository topology, and documentation governance.

# Shell And Repository Enforcement Coverage

## Goal

This document maps shell, discovery, resource, styling, repository topology,
and documentation-governance rules to local quality gates.

## Enforced

- Shell sources may live only under `shell/api` or `shell/host`, owned by
  `build-harness`.
- Shell code must not depend on view, domain, data, or bootstrap; `shell.api`
  must remain independent from `shell.host`, bootstrap, and feature layers;
  non-bootstrap code must not reach shell host internals, owned by ArchUnit
  shell rules.
- Service and view contribution registration must stay in the documented
  feature entrypoints and must not bypass service-registry placement rules,
  owned by Error Prone `ServiceRegistryRegistrationPlacement`,
  `FeatureShellApiAllowlist`, and `ShellLifecycleHookOwnership`.
- Java source roots are limited to `bootstrap/`, `shell/`, and `src/`, owned by
  `build-harness`.
- Resource, style, and generated-output placement are blocked by repository
  structure checks in the harness and PMD source policy where the violation is
  visible from source or path shape.
- Non-ADR documents outside `AGENTS.md` must declare `Status`, `Owner`,
  `Last Reviewed`, and `Source of Truth`; document splitting and canonical
  source placement are governed by documentation checks and review.

## Source-Pattern Checks

Source-pattern gates are useful for imports, shell API bypasses, legacy
registration names, and path-shape violations. They do not prove runtime
registration behavior beyond the statically visible entrypoints.

## Review-Owned

- whether shell API additions are minimal and stable
- whether feature discovery remains understandable for a new contributor
- whether documentation summaries duplicate a canonical source instead of
  linking to it
- whether styling and resource choices preserve the intended product quality
