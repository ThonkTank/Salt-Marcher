# Layering Indirection Relay Candidates Bundle

This bundle co-locates the report-only SaltMarcher jQAssistant diagnostics for
thin relay stacks that are worth review but are not part of the blocking
production-handoff path.

It reuses the same relay-graph rule inventory as the blocker bundle while
selecting only the thin-role candidate group.

Unified root entrypoint:

- `./gradlew checkLayeringIndirectionRelayCandidates --rerun-tasks --console=plain`
