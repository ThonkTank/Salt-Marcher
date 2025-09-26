# Layout Editor Bridge – Lifecycle Review

## Lifecycle Trace
1. **Setup invocation** (`setupLayoutEditorBridge(plugin)`): resolves the Layout Editor API via `app.plugins.getPlugin("layout-editor")?.getApi?.()` and guards the lookup with feature detection. A successful lookup installs a `registerViewBinding` call and captures an `unregister` closure for later teardown.【F:salt-marcher/src/app/layout-editor-bridge.ts†L58-L109】
2. **Initial registration attempts**: `tryRegister` runs on setup and again on the Obsidian `layout-ready` event. Both invocations are gated by the `unregister` sentinel to avoid duplicate registrations.【F:salt-marcher/src/app/layout-editor-bridge.ts†L83-L109】
3. **Plugin enable hook**: when the Layout Editor plugin is activated after our setup ran, the bridge listens to the global `plugin-enabled` event and re-issues `tryRegister`. Listener binding goes through `bindLifecycleEmitter` so we can detach using the token returned by `on`.【F:salt-marcher/src/app/layout-editor-bridge.ts†L45-L75】【F:salt-marcher/src/app/layout-editor-bridge.ts†L111-L125】
4. **Plugin disable hook**: on `plugin-disabled` for the Layout Editor, the bridge calls the captured `unregister` closure to remove our binding while keeping the handler subscribed for potential re-enables.【F:salt-marcher/src/app/layout-editor-bridge.ts†L119-L123】
5. **Teardown**: the disposer returned from `setupLayoutEditorBridge` first executes `unregister` and then detaches the lifecycle listeners by calling `app.plugins.off` with the tokens returned from the earlier `on` calls.【F:salt-marcher/src/app/layout-editor-bridge.ts†L125-L133】

## Review Update (2024-05)
- **Typed lifecycle emitter**: `bindLifecycleEmitter` now wraps `app.plugins` and binds `on/off`, so listeners retain the correct context and dispose handles. We gracefully handle environments without `off` to avoid runtime failures.【F:salt-marcher/src/app/layout-editor-bridge.ts†L45-L75】
- **Operational telemetry**: `emitIntegrationIssue` funnels resolution, registration and teardown failures through `reportIntegrationIssue`, which emits deduplicated notices and console errors. This provides user-facing signals in addition to developer logs.【F:salt-marcher/src/app/layout-editor-bridge.ts†L31-L43】【F:salt-marcher/src/app/integration-telemetry.ts†L1-L39】
- **Lifecycle tests**: `tests/app/layout-editor-bridge.test.ts` now covers deferred registration, plugin enable/disable flows and error handling for both register/unregister paths.【F:salt-marcher/tests/app/layout-editor-bridge.test.ts†L1-L146】

## Remaining Watchpoints
- **Plugin manager contract**: Obsidian still documents neither the return value nor argument signature of `app.plugins.on/off`. If upstream changes to a different emitter, we may need to harden `bindLifecycleEmitter` further (e.g., by asserting token types before storing them).
- **Layout Editor API drift**: Our feature detection protects against missing `registerViewBinding`, but future API changes (additional parameters, async registration) will require another review.

## References
- Implementation: [`src/app/layout-editor-bridge.ts`](../salt-marcher/src/app/layout-editor-bridge.ts)
- Tests: [`tests/app/layout-editor-bridge.test.ts`](../salt-marcher/tests/app/layout-editor-bridge.test.ts)
- Bootstrap context: [`docs/app/layout-editor-bridge.md`](../salt-marcher/docs/app/layout-editor-bridge.md)
