Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Permanent dependency direction inside and between features.

# Feature Boundary Standard

## Dependency Direction

Each `features/<name>/` area may contain these roles:

```text
api              commands, results, immutable state, public capabilities
domain           feature truth and invariants
application      orchestration over domain and ports
adapter/sqlite   persistence mechanics and translation, when stored truth exists
adapter/javafx   presentation and shell contribution, when JavaFX UI exists
<feature root>   composition entry point used only by app
```

Roles are capability-driven, not a required folder template. A feature MUST
NOT create an empty adapter package merely to match this list.

- Cross-feature dependencies originate only from application or composition
  code and MUST target the provider's `api` package. The Dungeon and Hex JavaFX
  adapters may additionally consume `features.maps.api` for their documented
  passive canvases.
- `api` MUST NOT depend on feature implementation packages or platform code.
- `domain` MUST NOT depend on API carriers, application, adapters, feature
  composition, SQL, JavaFX, shell, platform, or foreign-feature code.
- `application` MAY depend on its API, domain, `platform.execution`,
  `platform.state`, and `platform.diagnostics`; it MUST NOT depend on adapters
  or shell code.
- `adapter/sqlite` MAY implement feature-owned ports and use
  `platform.persistence` plus `platform.diagnostics`. It MUST NOT depend on
  JavaFX adapters.
- `adapter/javafx` MAY depend on the feature API, `shell.api`, and
  `platform.ui`. It MUST NOT reach into domain, application, SQLite packages,
  or other platform capabilities.
- The feature composition entry point MAY construct all packages of its own
  feature, wire any platform capability, and receives foreign APIs explicitly
  from `app`.
- Boundary values remain typed: enums and value types cross as themselves;
  string round-trips, duplicate enum vocabularies, and stringly typed `kind`
  constants are forbidden where a type exists.
- One representation serves one purpose. State is reshaped only at a real
  consumer boundary that requires a different shape; forwarding duplicates and
  parallel carrier models are not compatibility surfaces.

The target-package dependency and cycle rules are mechanically enforced by
`architectureTest` and therefore by `check`.

## References

- [Source Architecture](../source-architecture.md)
- [Application Composition Standard](application-composition.md)
- [Shell Layer Standard](shell-layer.md)
