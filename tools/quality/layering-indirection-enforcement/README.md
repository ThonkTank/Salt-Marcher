# Layering Indirection Enforcement Bundle

This bundle co-locates the focused SaltMarcher checks that back the relay-chain
and relay-wrapper proof routes referenced by
`docs/project/architecture/enforcement/layering-architecture-enforcement.md`.

It keeps the proof surface owner-pure:

- `jqassistant/`
  a blocker-grade substantive relay-wrapper and relay-chain analysis plus the
  report-only thin relay-stack diagnostic
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path for
  both public jQAssistant entrypoints

This bundle proves the compiled-code blockers that the older single-class PMD
source-pattern checks could miss when a wrapper spreads the same relay across
helper methods or when substantive tactical roles degrade into deeper same-scope
relay chains, while keeping the thin relay-stack review scan as a separate
report-only surface of the same owner.

Unified root entrypoint:

- `./gradlew checkLayeringIndirectionEnforcement --rerun-tasks --console=plain`
- `./gradlew checkLayeringIndirectionRelayCandidates --rerun-tasks --console=plain`
