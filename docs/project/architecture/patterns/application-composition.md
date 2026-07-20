Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Application composition and startup dependency ownership.

# Application Composition Standard

## Concern

The application must reveal startup dependencies at compile time while the
shell remains passive and feature behavior remains feature-owned.

## Rules

- `app` MUST construct platform services and feature entry points explicitly in
  dependency order.
- `app` MUST compose immutable feature storage definitions and complete
  owner-scoped storage preparation before constructing or starting any service
  that can enqueue persistence work.
- `app` may import a feature's exact composition-root package and public API;
  it MUST NOT import that feature's domain, application, or adapter packages.
- `app` MUST pass typed dependencies into feature and shell constructors.
- Feature entry points MAY expose their public API and constructed shell
  contributions to `app`; they MUST NOT expose internal repositories or
  adapters as application-wide services.
- Startup MUST register each shell contribution exactly once, preserve
  deterministic ordering, and choose at most one default landing target.
- Runtime classpath scanning, reflective contribution construction, suffix
  discovery, service registries, and service locators are forbidden.
- `app` MUST own lifecycle shutdown for executors, database resources, and the
  JavaFX application. It MUST NOT own feature state or business decisions.
- Startup phases are explicit: compose definitions, prepare storage, construct
  services, start feature work, register shell contributions. Constructor or
  composition side effects MUST NOT perform persistence work.

`architectureTest` mechanically enforces the target dependency direction.
Startup behavior remains production-route JUnit proof.

## References

- [Source Architecture](../source-architecture.md)
- [Feature Boundary Standard](feature-boundaries.md)
- [Shell Layer Standard](shell-layer.md)
