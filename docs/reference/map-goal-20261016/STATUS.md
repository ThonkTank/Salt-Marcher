# Atlas workflow: implementation and open acceptance

Latest source synchronization (17 Oct): Main `bd88b480a` includes direct retained-paint generation (`5b5a2027b`) on the shared Canvas2D presentation. Atlas editing and GM travel remain separate UI workspaces over this one surface; the editor context returns on the same campaign token. The pre-Canvas mode candidate `4fd858995` passed complete exact-SHA CI39028117720 (4000pass/0fail/1 optional skip) and is preserved as `archive/atlas-qualified-4fd85899-20261017`. Canvas integration requires its own qualification; earlier SVG evidence does not qualify the replacement.

Source includes SaltMarcher Main `574f98bdc`, version 0.160.0, on the fresh Main-based branch `qa/atlas-blocks-20261017`. The owned Map/Atlas implementation is transferred from preserved qualified snapshots; retired Hex paint state stays removed and Main's opening-wave selection, localized excerpt actions and single campaign catalog remain intact. Main's bounded source-frame landscape, exact object reader and tiled export are retained together with independent viewport/selection readers and the authored interior visibility rules. Ordinary Main updates are merged into this topic; Main promotion must use squash to retain linear history. The continuous Goal stays paused. Work continues through the heartbeat; owner acceptance is still required.

The [connected-block and live-map follow-up](BLOCKS-LIVE-20261017.md) adds explicit side-street proposals, real shared endpoint identities, atomic street/house acceptance and stable regeneration. It also makes cancellation/decisions visible, settles completed room-draft loading feedback, guards house-to-interior navigation and places live camera actions directly beside the map.

## GM task

Prepare a region and market quarter, generate houses, protect and reposition a named tavern, write its notes, then create two interior rooms with a door and readable labels. Return to the house and reopen the interior with its contents intact. During play, focus a party, inspect remembered and currently visible map facts, travel through known areas, hide the separate player display, and export a public handout without GM information.

The same complete task must be performed in an available comparator. Earlier Dungeon Scrawl observations include rooms, a door, labels and a PNG download. Editable save/reopen and the complete live-play counterpart remain unverified. Hextml observations do not constitute a completed interior workflow. No comparative superiority is established.

## Changes

- One camera and author history connect canonical places, city buildings and interiors. Place creation saves the location and marker together; reading and editing use the same location document.
- Building placement has preview, cancel/accept and numeric position/angle correction. Protected buildings survive generation.
- Interior rectangles use the existing drawing controller. Door placement uses the wall point before grid snapping; physical passage openings are also rendered. Labels stay horizontal under building rotation. Returning to the house reuses the existing interior.
- Floor changes and city/house/room/scope navigation check open work. Started rooms remain available to finish or explicitly cancel. Campaign changes, hiding the Atlas and newer navigation invalidate waiting requests.
- Group view renders the canonical public projection and disables author gestures. Missing focus or failed reads leave a blank map with feedback. Previewing it does not unblank the separate player window.
- Public output reads a fresh projection and checks its revision against landscape reads. Current vector contours and raster tiles share a clip containing only currently visible cells. Remembered unseen terrain retains remembered facts and receives no current image.
- Lost World responses remain recoverable; verified read-only reconciliation settles only the matching nested Atlas command.
- Main's live-map fixes keep its canvas visible outside the Atlas inspector, retain scene tabs during map focus and bind Dungeon preview replies to the requested scene/destination. Replacing a preview notifies the Atlas immediately.
- Main now docks the same Atlas canvas, camera controls and local travel console into live play. The canonical Dungeon travel controls now remain in that console beside the live scene, including pose, current room text, pace, perception and decisions. Own interior drawing controls stay in place. Main's exposure guard avoids loading complete Dungeon context while this console is hidden. Named destination IDs remain attached when Atlas route selection appends waypoints; returning restores the original control nodes.
- Main's Hex preview redraw notifications are preserved: accepting or invalidating a route evaluation updates the shared Atlas without reloading its context or writing travel.
- Main's on-demand room reads are preserved. Map and drawing projections retain geometry rather than complete room prose; selected room text and drawing-element notes load through exact readers. The paged directory searches complete Markdown in its canonical worker. Places, public frames, door/wall rendering, draft guards and camera behavior remain connected to this boundary. The QA host also compiles the canonical room-directory worker.

## Technical evidence

Candidate `c8194665c` passed exact-head CI `38988804897`: 3,742 passed, zero failed, one optional skip. Its archive is `archive/atlas-qualified-c8194665-20261017`. The subsequent live-map/status patch passed 57 affected travel/shared-Atlas checks and three focused export/public checks, plus both type checks, repository check and desktop build. Its successor requires its own exact-head CI.

The following exact-head CI on `b0846cb65` (run `38978380905`) failed one case: the house-placement fixture attempted to redefine the non-configurable `value` accessor on an existing select moved into the Atlas by the new Dungeon console. Its 3,715 passed cases and one optional skip do not make that candidate qualified. The same case failed locally before repair and passes after retaining the existing fixture accessor; placement/camera/undo/redo assertions are unchanged. The new successor is qualified separately.

The preserved `f87ef98cc` candidate passed exact-head CI run `38973164668`: 3,712 passed, zero failed, one optional skip. Its immutable local reference is `archive/atlas-qualified-f87ef98c-20261017`. This does not qualify the later Dungeon-console integration.

The preserved `386540c0d` candidate passed exact-head CI run `38967126019`: 3,698 passed, zero failed, one optional skip. Its immutable local reference is `archive/atlas-qualified-386540c0-20261016`.

The preserved `243aefb9d` candidate passed exact-head CI run `38953400932`: 3,648 passed, zero failed, one optional skip. The immutable local reference is `archive/atlas-qualified-243aefb9-20261016`. That qualification does not transfer to later source changes.

After the live-map Main synchronization all 68 affected Dungeon/travel checks and five retained navigation cases passed. After the room-read integration, 61 city/Atlas cases, 35 drawing/room-boundary cases, 13 door/passage/label cases and four focused preparation cases passed, with normal process exits. These groups overlap earlier integration runs and are not a full-suite count. Both type checks, repository check and desktop build passed. Required exact-head CI qualifies the published successor separately; no duplicate complete local suite is run.

After integrating the shared live Atlas, all 116 affected city/Atlas/travel/portal cases passed, followed by the new full-controller interior portal case (one passed). The merged route case confirms waypoint accumulation and canonical destination identity in the actual preview request. The interior case uses the prepared house, Drawing controller and SQLite, then preserves the exact canvas/camera/selection through live mounting and return without author writes. Both type checks, repository check, desktop build and QA host build passed with normal exits. These are technical checks; actual UI acceptance remains open.

The Dungeon-console integration passed 34 affected Dungeon/travel/portal cases and 12 retained location/interior/navigation/public-output cases, all with normal exits. Both type checks, repository check, desktop build and QA browser build passed. No unchanged full local suite was repeated. The actual rebuilt browser startup shows the five preserved synthetic campaigns; no UI workflow completion is inferred.

After repairing the select fixture and synchronizing Main, the complete 55-case city/Atlas DOM file and four affected canonical-location/Hex-preview integration cases pass with normal exits. This includes the previously omitted placement case, preserving camera and undo/redo assertions. Both type checks, repository check, desktop build and QA build pass. The complete local suite was not duplicated; required exact-head CI owns full qualification.

The new integrated search case edits prose without changing section IDs, finds a prose-only term through the real directory worker and navigates to that room while the map retains no room sections. The 4,000-room boundary case also checks an explicit group preview and rejects an invalid group-view flag. Response-loss, stale navigation, public labels and remembered raster output remain covered. DOM/controller, storage and worker checks do not constitute actual UI acceptance.

## Open acceptance

The global browser input blocker is repaired. A native Electron confirmation from another comparator page had intercepted input outside the individual tab DOM/AX views; cancellation restored real trusted clicks. The actual tavern interior task now reaches two rooms, a bound door, house return, fresh-host reopening and a PNG export. Dungeon Scrawl was actually used to draw and export the same two-room floorplan. The observed false room count/opening action and broken GM export labels were corrected and visibly rechecked. [Workflow, limits and before/after artifacts](INPUT-REPAIR-20261017.md).

Live party travel through the prepared door, a fresh public PNG, fresh-host party/knowledge persistence, and actual separate browser player-display daylight/darkness/blanking checks now pass. [Live continuation and scope](LIVE-RESUME-20261017.md). Editable save/fresh reopen in Dungeon Scrawl, the complete region/city/live counterpart, darkvision, and native packaged player-window behavior remain open. The isolated native package at `727ce64b` is an older technical preview. Packaging, native UI qualification, comparison and owner acceptance remain separate claims. The draft is not promoted to Main on technical tests alone; promotion requires linear integration and its exact-SHA CI.

Die beobachtete manuelle zweite Türbindung, der nach Rücknahme fehlgeschlagene Elementzugriff und die überlagerte Hausrückkehr sind jetzt umgesetzt und tatsächlich nachgeprüft. [Tür-/Rückweg-Nachtest](DOOR-RETURN-20261017.md).

The bounded region integration retains precise place markers, exact house room counts, navigation guards and public projection. Actual regional search → location book → description-only live reuse passed; Hextml now has a real project export and independent fresh-file import, including recovered secret notes. The selected-house overlay no longer replaces neighboring city geometry. [Regional follow-up and remaining limits](REGIONAL-20261017.md).

Nach gezielter Hausauswahl lädt „Bebauen“ wieder die bestehende Viertel-/Straßengrundlage derselben Stadt. Die fertige Vorschau zeigt das ganze Viertel. Der tatsächliche Ablauf erreicht 99 Häuser bei erhaltener Taverne, Hausnotiz, Zwei-Raum-Innenraum und 21s Gruppenzeit. Ein Watabou-Durchlauf mit benanntem Ort, lokalem Geometriewurf und SVG-Ausgabe wurde tatsächlich durchgeführt; die grafischen und fachlichen Grenzen bleiben offen. [Bebauungsnachtest](INFILL-20261017.md).

Der Gruppenmarker über einem Haus blockiert dessen Bearbeitungsklick nicht mehr; Gruppenverschiebung bleibt auf „Erkunden“ begrenzt. Die passive Ereignisdiagnose, Korrektur und tatsächliche Wiederholung sind im Bebauungsnachtest festgehalten.

Viertel behalten jetzt ihre eigene Bauweise (Seed, Dichte, Hausgröße, Straßenabstand und Nutzung). Übernahme speichert Rezept und Häuser atomar; Wechsel, frisches Öffnen und Rücknahme behalten getrennte Einstellungen. Der tatsächliche Stadt-/Innenraum-/Live-Nachlauf erreicht drei Straßen, zwei abgegrenzte Viertel, 117 Häuser und die erhaltene Taverne. [Viertelbauweise und Watabou-Nachlauf](DISTRICTS-20261017.md).

Die frühe Stadtsuche öffnet jetzt auch bei einer kalten, begrenzten Kartenansicht den kanonischen Stadttreffer. Ein gleichnamiger gecachter Ortsmarker verdrängt ihn nicht mehr; spätere Suchantworten füllen eine getroffene Auswahl nicht erneut auf. Tatsächlicher Nachlauf ohne vorgeschaltete Ladepause sowie Ortsmappe → öffentlicher Vorlesetext → Live und Hextml-Projektimport/GM-Notiz erneut durchgeführt. [Suchnachlauf](SEARCH-20261017.md).

Straßen und Viertel lassen sich jetzt direkt mit Griffen und Vorschau umformen. Tatsächlicher Nachlauf: Knick und Viertelgrenze bearbeiten, verwerfen/übernehmen, Rückgängig/Wiederholen, neu bebauen, Taverne/Innenraum/Live wiederverwenden. Endstand 104 Häuser; Watabous organische Blockqualität bleibt unerreicht. [Formbearbeitung und Vergleich](SHAPE-20261017.md).

Die Bebauung bildet jetzt zuerst Straßenfronten und ergänzt freie Flächen, statt Häuser hauptsächlich auf einem verstreuten Raster zu verteilen. Tatsächliche Neubebauung beider Viertel, frischer Host, erhaltene Taverne/Innenräume und Live-Rückkehr ergeben 115 Häuser; der Rückweg zur Stadt leert den alten Hausinspektor. [Straßenfronten und Nachlauf](FRONTAGES-20261017.md).
