# Domain Policy Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/domain-policy-enforcement.md`.

It keeps the tactical `policy/` proof route owner-pure and bundle-local:

- `errorprone/`
  `DomainPolicyRoleShape`,
  `DomainPolicyStatelessness`
- `build-harness/`
  `DomainPolicyEnforcementDocumentationRules`,
  `DomainPolicyEnforcementDocumentationCheckMain`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project compiler wiring and aggregate-task entrypoint
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

This bundle owns only the tactical `policy/` role itself. Generic
named-module topology, generic named-module communication boundaries, and the
neighboring `factory/` role stay in their owning bundles and documents.

Unified root entrypoint:

- `./gradlew checkDomainPolicyEnforcement --rerun-tasks --console=plain`
