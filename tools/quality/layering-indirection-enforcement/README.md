# Layering Indirection Enforcement Bundle

This bundle co-locates the focused SaltMarcher checks that back the relay-chain
and relay-wrapper proof routes referenced by
`docs/project/architecture/enforcement/layering-architecture-enforcement.md`.

It keeps the proof surface owner-pure:

- `jqassistant/`
  a blocker-grade relay-only role analysis plus a non-blocking thin-role relay
  stack diagnostic
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle proves the stronger compiled-code relay blocker that the older
single-class PMD source-pattern checks could miss when a wrapper spreads the
same relay across helper methods or multiple owner-local calls.

Unified root entrypoint:

- `./gradlew checkLayeringIndirectionEnforcement --rerun-tasks --console=plain`
