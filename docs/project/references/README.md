# Dialog design references

`world-location-dialog-reference.html` and its support script are byte-exact
copies from the approved `Besserer Orts-Creation Dialog.zip` handoff. Their
checksums are recorded beside them. They are design references, not production
code or Golden Masters.

Run `pnpm reference:dialog:render` to verify the checksums and render the
reference into `.tmp/dialog-reference/world-location-dialog.png`. The renderer
uses the current checked-in SaltMarcher tokens because the handoff archive did
not contain its `_ds` stylesheets. The command never writes to `tests/e2e/goldens`.
