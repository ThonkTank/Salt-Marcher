# Layout Editor Bridge – Lifecycle Review

## Lifecycle Trace
1. **Setup invocation** (`setupLayoutEditorBridge(plugin)`): immediately resolves the Layout Editor API via `app.plugins.getPlugin("layout-editor")?.getApi?.()`. A successful lookup installs a `registerViewBinding` call and captures an `unregister` closure for later teardown.
2. **Initial registration attempts**: `tryRegister` runs on setup and again on the Obsidian `layout-ready` event. Both invocations are gated by the `unregister` sentinel to avoid duplicate registrations.
3. **Plugin enable hook**: when the Layout Editor plugin is activated after our setup ran, the bridge listens to the global `plugin-enabled` event and re-issues `tryRegister`.
4. **Plugin disable hook**: on `plugin-disabled` for the Layout Editor, the bridge calls the captured `unregister` closure to remove our binding while keeping the handler subscribed for potential re-enables.
5. **Teardown**: the disposer returned from `setupLayoutEditorBridge` first executes `unregister` and then detaches the lifecycle listeners by calling `app.plugins.off` with the tokens returned from the earlier `on` calls.

## Assumptions & Hazards
- **Plugin manager emitter contract**: we treat `app.plugins.on/off` as EventEmitter-style hooks that return opaque tokens suitable for later `off` calls. This behaviour is undocumented; if Obsidian changes to a different emitter shape the bridge will leak listeners.
- **API surface from `layout-editor`**: the bridge assumes the plugin exposes a synchronous `getApi()` returning `registerViewBinding`/`unregisterViewBinding`. Missing or versioned APIs are silently ignored today, so failed registrations are only visible via console errors.
- **Error handling scope**: try/catch only wraps the direct registration/unregistration call, not the surrounding API discovery. If `getApi()` throws, the exception propagates to Obsidian’s event queue.
- **Idempotency expectation**: `unregisterViewBinding` is invoked without guarding against repeated calls; we rely on the layout editor to tolerate duplicate unregister attempts triggered by manual teardown plus `plugin-disabled`.
- **No telemetry or user feedback**: failures are logged to the console, meaning plugin users receive no in-app feedback when the bridge fails to register. Operational visibility is limited.

## References
- Implementation: [`src/app/layout-editor-bridge.ts`](../salt-marcher/src/app/layout-editor-bridge.ts)
- Follow-ups tracked in [`todo/layout-editor-bridge-review.md`](../todo/layout-editor-bridge-review.md)
