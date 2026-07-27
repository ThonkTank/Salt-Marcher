# Application Composition Standard

## Concern

The application must reveal startup dependencies at compile time while the
shell remains passive and feature behavior remains feature-owned.

## Rules

- `app` MUST construct platform services and feature entry points explicitly in
  dependency order.
- `app` MUST compose immutable installation and Campaign feature-storage
  definitions into their owning persistence lifecycles and complete
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
- Installation services and the active Campaign graph MUST have separate
  lifetimes. One installation-owned coordinator serializes Campaign activation,
  prepares a survivor-capable core candidate, fences and drains prior writes,
  commits the durable active-Campaign generation, publishes the new Campaign
  shell root, and closes the prior runtime. Before the durable commit a failure
  restores the prior runtime; after it, recovery rolls forward to the committed
  Campaign. Candidate readiness uses semantic survivor readback plus a
  non-payload transactional rollback probe; it never mutates user-authored
  truth as a health check. The exact next durable feature mutation is qualified
  on a disposable Campaign through the production route. Optional-capability
  readiness cannot block core publication.
- Startup phases are explicit: compose definitions, prepare storage, construct
  services, start feature work, register shell contributions. Constructor or
  composition side effects MUST NOT perform persistence work.

## References

- [Source Architecture](../source-architecture.md)
- [Feature Boundary Standard](feature-boundaries.md)
- [Shell Layer Standard](shell-layer.md)
