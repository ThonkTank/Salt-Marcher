# GM-E2E01-ATLAS-INSPECTOR-N04 Cloud-GM-Test

**Status:** completed, bounded visible product run. **Evidence:** `GM-E2E01-ATLAS-INSPECTOR-N04-GM-CLOUD-RETEST-20261011-01` in [Issue #80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80#issuecomment-6105151600).

## Source and installed build

The product was built from the exact current default head `active/installed-phase1` / `87ccdb2626c26622f15799f3af7faf05d9feee89` after the branch advanced from `d12d2ee` during the run. `git diff d12d2ee..87ccdb2` changes World Notes, build metadata, and tests; Atlas feature/editor sources and the `e2e01-spatial-v2` fixture are unchanged. `npm run build` passed with Node `v24.19.0`, `dirty:false`, and exact `sourceRevision=87ccdb2626c26622f15799f3af7faf05d9feee89`.

At report time Shared advanced to `a93fd4f7d4e61a327744cece448a0fbc30e94773` via PR #113. Its delta from the tested `87ccdb2` changes only City reference metadata; Atlas source and this UI result are unchanged. The test remains bound to the exact `87ccdb2` build below.

The built and installed plugin triplets matched before the visible app reload:

| File | SHA-256 |
| --- | --- |
| `main.js` | `2164be282b49bda3b56a9050d0d26888f7945271d51576e2a8de5109b4f9b0a0` |
| `styles.css` | `df11f8352b61e45d3984d29e0136fc0225aaabe85c7b004a3b55eb0c6cc52934` |
| `manifest.json` | `2acb4649cad04120636e891c96c5cbb9c84d5b91b1e4e378705b0f58d7a4bd64` |

## Isolated host and fixture

- Own container: `e49e330d328c1e2d97e6f46a677e34f5f288c4dab7b41db242d3584e4ab66b33` (`gm-city-cloud-isolated-20261011`), Obsidian `1.14.4`, Electron `43.7.7`; N04 process PID `2159`, own profile `/qa/gm-n04-profile`.
- Own synthetic vault: `/dev/shm/gm-n04-vault`, copied from `tests/fixtures/atlas-e2e-spatial-v2/input`; Atlas file `Atlanten/Gemeinsamer-Testatlas.overworld`. The fixture source has no changes between `d12d2ee` and `87ccdb2`.
- Visible host was controlled through its own CDP loopback at `127.0.0.1:9236`; Xvfb display `:99` is `1440x1000`; Obsidian app window/screenshot is `1024x800`. At 131% app zoom the measured viewport was `779x608` CSS px, `devicePixelRatio=1.3145341873`. This is cloud remote input, not physical-device evidence.

## Visible user path and result

1. Opened the preloaded `Atlanten/Gemeinsamer-Testatlas.overworld`, selected the visible `Torheim` marker, and inspected the shared `Orts-Key` fields. At 100%, the narrow right dock showed name, type, description, and the description text area without horizontal clipping; more content required vertical scrolling.
2. Used the visible Obsidian command palette `Zoom in` three times. At 131%, the right-side location inspector stayed within the viewport and the long `Vorhandenen Dungeon hier verorten` action wrapped onto two lines. The map viewing area became much smaller. Vertical scrolling remained necessary; I did not claim every target-search control was reachable without scrolling at 131%.
3. At 100%, scrolled to `Ziele in Torheim`, typed `Torraum` into the visible `Ziel suchen` field, and saw the exact results `Raum 1: Torraum` and `Raumabschnitt: Torraum`. Clicking `Raum 1: Torraum` opened the `Raum-Key` inspector in the same atlas tab, with fields `Raumname`, `Raumnummer`, and `Raumtext 1`.
4. Edited only the synthetic room note in the visible text area to add `Nur das dritte Klopfen antwortet.`; clicked `Übernehmen`, then `Atlas speichern`. The UI showed the saved state. I clicked `Zur Karte`, selected `Torheim` again, and found the same `Torraum` result still in the search field; selecting the room reopened the same Room-Key with the edited text visible.

**Observed friction:** locating the target search and returning to it requires vertical scrolling through a long inspector. At 131% the dock content is taller than the available viewport and the map area is compressed, although the captured action labels fit horizontally and wrap. The tested 100% target-search/edit/reuse route worked; no repair request is raised from this bounded run because vertical scrolling is retained by the N04 design and was already an explicit limit of its source receipt.

## Data oracle and evidence

The source fixture manifest is `FIXTURE-SHA256SUMS.txt`; it records the hashes bound to `tests/fixtures/atlas-e2e-spatial-v2/input` on `87ccdb2`. Screenshot SHA-256 values are in `SHA256SUMS.txt`. In the isolated vault, the intended save changed only these two of the eight fixture payloads:

- Dungeon `Dungeons/E2E-01-Testdungeon/Karte.dungeon`: `c6fe58d1b5de5c707000a39b0b8da2883d31867b7d8bf347f63830021e2df742` → `39b6896fef75f73fa6725d4792b07aca3de682d94c678353165fcf5e10286c9e`.
- Campaign snapshot `Kampagnen/SaltMarcher/E2E-01-Atlas-Save.campaign.json`: `e66a9c557016357d3dea7491fa7110f9db0eeccf6fed5d1f9510885f6990a6df` → `a2fd470149a9d9f546d6382dd67e4f881764c86351122345f0700aa680146366`.

The Overworld (`76e0a82a…16de07`), both terrain chunks (`4e09dbcf…b59e358`, `c32ba354…90f2f2`), both Locations (`ac888059…27ab7`, `57b45559…963b5b`) and City (`d7ac830f…6184c`) remained byte-identical to the fixture. The source fixture itself was untouched. These hashes bind the QA vault state; they do not replace the visible save/reuse steps.

Screenshots are original PNG captures from the visible isolated host. Their individual SHA-256 values are listed in `SHA256SUMS.txt`:

- [100% Torheim inspector](screenshots/01-torheim-inspector-100.png)
- [131% Torheim inspector](screenshots/02-torheim-inspector-131.png)
- [131% wrapped Dungeon action](screenshots/03-dungeon-action-131.png)
- [Visible Torraum search results](screenshots/04-room-search-torraum.png)
- [Room-Key after Apply and Save](screenshots/05-room-key-saved.png)
- [Return to map](screenshots/06-returned-to-map.png)
- [Torraum search reused](screenshots/07-target-reused.png)
- [Room-Key reopened in the same session](screenshots/08-room-key-reopened-in-session.png)

## Boundaries

Repository documentation check `npm run check:repo` passed; source-fixture and screenshot `sha256sum -c` manifests passed. No product/test source was changed. No test suite was run or used as UI evidence. This run demonstrates a same-session map-return/reuse after an explicit visible save; it did not close/reopen the file or start a fresh Obsidian process after the edit. No physical mouse/keyboard, latency, external clipping, original-map fidelity, large-map, recovery, player projection, or broad Atlas/Dungeon/E2E acceptance is demonstrated. A prior exploratory accidental `Stadt +` click was removed with visible `Rückgängig` before any Atlas save; the Atlas fixture hash stayed unchanged.

## N04 continuation: fresh Obsidian process and saved-room reuse

**Evidence ID:** `GM-E2E01-ATLAS-INSPECTOR-N04-FRESH-PROCESS-20261011-01`

### Product source, build and host

This follow-up continued the saved synthetic vault and exact installed `87ccdb2626c26622f15799f3af7faf05d9feee89` product build from the preceding N04 run. It did not rebuild or modify the product. Existing exact-build receipt: `npm run build` passed on Node 24.19.0 with `dirty:false`, `sourceRevision=87ccdb2626c26622f15799f3af7faf05d9feee89`; built and installed plugin files matched byte-for-byte:

| Installed file | SHA-256 |
| --- | --- |
| `main.js` | `2164be282b49bda3b56a9050d0d26888f7945271d51576e2a8de5109b4f9b0a0` |
| `styles.css` | `df11f8352b61e45d3984d29e0136fc0225aaabe85c7b004a3b55eb0c6cc52934` |
| `manifest.json` | `2acb4649cad04120636e891c96c5cbb9c84d5b91b1e4e378705b0f58d7a4bd64` |

The follow-up started a new Obsidian 1.14.4 / Electron 43.7.7 process (fresh app PID `3964`; prior N04 app PID `2159` had ended) against the same isolated container `e49e330d328c1e2d97e6f46a677e34f5f288c4dab7b41db242d3584e4ab66b33`, profile `/qa/gm-n04-profile`, and synthetic vault `/dev/shm/gm-n04-vault`. The fresh window used the tester-owned Xvfb display `:101` at 1440×1000; visible Obsidian content area was 1024×800 CSS px at devicePixelRatio 1. Input used this isolated Cloud host's visible UI over its own CDP endpoint. No laptop, other process, or user vault was used. The fresh process was closed normally through its own CDP `Browser.close`; its PID disappeared, with no force-kill.

Shared default was `10defd5aca37a5090918f96c04254e4326840f86` when this evidence branch was prepared. The intervening source diff from tested `87ccdb2` includes `src/main.ts`, `src/ui/atlas-city-building-panel.ts`, `src/ui/world-notes-panel.ts`, and `src/ui/world-notes-view.ts`; it does not change `src/ui/atlas-room-key-panel.ts` or `src/features/atlas/atlas-editor.ts`. This evidence is intentionally for the installed `87ccdb2` triplet and does not claim a UI run on `10defd5`.

### Visible follow-up and result

**Result: bounded PASS** for reopening the previously saved Torraum key text in a new Obsidian process and finding/reusing it through visible controls.

1. Before the fresh launch, the old N04 app was closed through its own CDP `Browser.close`; no `kill -9` or other forced termination was used.
2. In the fresh process, the synthetic `Atlanten/Gemeinsamer-Testatlas.overworld` opened visibly with `Gespeichert` and the Torheim marker (screenshot 09).
3. I clicked the visible Torheim marker (canvas location), then scrolled the visible right inspector to its search field. I typed `Torraum`; the visible result `Raum 1: Torraum` appeared (screenshots 10–11).
4. I activated that visible result. The same Atlas tab showed `Raum-Key`, room name `Torraum`, room number `1`, and the previously saved text:

   ```text
   ## Eingang
   Die Basalttür ist verschlossen.
   Nur das dritte Klopfen antwortet.
   ```

   The text was readable in the visible textarea (screenshot 12). This completes the requested fresh-process find/reuse check.
5. I made no edit and did not press Apply or Save in this continuation. This isolated follow-up therefore did not re-run save, Undo/Redo, a second close/reopen, or persistence after a new edit.

The isolated vault payloads remained unchanged during this read-only follow-up. SHA-256 values after the fresh-process UI run: Atlas `76e0a82a939f5c2b16c08f153cca827e4efd8d5920915c997ae2a3fc6d16de07`; Terrain -1 `4e09dbcf59e5f81a35f0c72c44511b35073696cf079613f5d001baceeb59e358`; Terrain 0 `c32ba3548aa7236e573e145ec0e3c6e75326cc6cd47134a19c2230d2d790f2f2`; Dungeon `39b6896fef75f73fa6725d4792b07aca3de682d94c678353165fcf5e10286c9e`; Campaign `a2fd470149a9d9f546d6382dd67e4f881764c86351122345f0700aa680146366`; Location 11 `ac888059f997b3c0f697e2152c9d59375543d6d2004356f1eef482fd4ec27ab7`; Location 12 `57b455592dc30e0ab9e3286a56f27a408453b7a2a3b617eee03ea089ed963b5b`; City `d7ac830f0b1a1b2e20a396a8515cf6afa0b777e46ee39f0a5b39a75bd8a6184c`. These match the preserved post-save N04 state; the source fixture remained untouched.

Original visible-host captures and SHA-256 entries 09–12 are preserved in `screenshots/` and `SHA256SUMS.txt`:

- [Fresh process with Atlas open](screenshots/09-fresh-process-atlas-open.png)
- [Torheim selected](screenshots/10-fresh-process-torheim-selected.png)
- [Visible Torraum search result](screenshots/11-fresh-process-room-search.png)
- [Room-Key and saved text after fresh process](screenshots/12-fresh-process-room-key-text.png)

### Scope limits

This proves visible saved-room/text findability after a newly started Obsidian app process, on the exact installed `87ccdb2` product triplet. It does not prove a new edit/save in that fresh process, a second fresh-process cycle, physical input, product latency, external window clipping, original-map parity, large-map behavior, recovery, player projection, or broad Atlas/Dungeon/E2E acceptance. No product source or test code changed; no automated product suite was run as a substitute for the UI route.
