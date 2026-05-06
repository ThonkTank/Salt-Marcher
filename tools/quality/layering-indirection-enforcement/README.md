# Layering Indirection Enforcement Bundle

This bundle co-locates the focused SaltMarcher checks that back the relay-chain
and relay-wrapper proof routes referenced by
`docs/project/architecture/enforcement/layering-architecture-enforcement.md`.

It keeps the proof surface owner-pure:

- `jqassistant/`
  a blocker-grade relay-only role analysis for substantive tactical roles
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle proves the stronger compiled-code relay blocker that the older
single-class PMD source-pattern checks could miss when a wrapper spreads the
same relay across helper methods or multiple owner-local calls.

The companion report-only thin relay-stack diagnostic now lives in
`tools/quality/layering-indirection-relay-candidates/` so the blocking
architecture path does not emit smell-style candidate findings on every run.

Unified root entrypoint:

- `./gradlew checkLayeringIndirectionEnforcement --rerun-tasks --console=plain`
