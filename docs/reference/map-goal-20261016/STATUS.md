# Atlas workflow: implementation and open acceptance

Source includes SaltMarcher Main `5b5d8d7bb`, version 0.160.0, on `qa/atlas-navigation-20261016`. Published commits, older checkouts and qualified snapshots remain preserved. The continuous Goal is paused by user request. Work continues only through the 90-minute heartbeat; explicit owner acceptance is still required.

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
- Main now docks the same Atlas canvas, camera controls and local travel console into live play. Named destination IDs remain attached when Atlas route selection appends waypoints; returning restores the original control nodes.
- Main's on-demand room reads are preserved. Map and drawing projections retain geometry rather than complete room prose; selected room text and drawing-element notes load through exact readers. The paged directory searches complete Markdown in its canonical worker. Places, public frames, door/wall rendering, draft guards and camera behavior remain connected to this boundary. The QA host also compiles the canonical room-directory worker.

## Technical evidence

The preserved `386540c0d` candidate passed exact-head CI run `38967126019`: 3,698 passed, zero failed, one optional skip. Its immutable local reference is `archive/atlas-qualified-386540c0-20261016`.

The preserved `243aefb9d` candidate passed exact-head CI run `38953400932`: 3,648 passed, zero failed, one optional skip. The immutable local reference is `archive/atlas-qualified-243aefb9-20261016`. That qualification does not transfer to later source changes.

After the live-map Main synchronization all 68 affected Dungeon/travel checks and five retained navigation cases passed. After the room-read integration, 61 city/Atlas cases, 35 drawing/room-boundary cases, 13 door/passage/label cases and four focused preparation cases passed, with normal process exits. These groups overlap earlier integration runs and are not a full-suite count. Both type checks, repository check and desktop build passed. Required exact-head CI qualifies the published successor separately; no duplicate complete local suite is run.

After integrating the shared live Atlas, all 116 affected city/Atlas/travel/portal cases passed, followed by the new full-controller interior portal case (one passed). The merged route case confirms waypoint accumulation and canonical destination identity in the actual preview request. The interior case uses the prepared house, Drawing controller and SQLite, then preserves the exact canvas/camera/selection through live mounting and return without author writes. Both type checks, repository check, desktop build and QA host build passed with normal exits. These are technical checks; actual UI acceptance remains open.

The new integrated search case edits prose without changing section IDs, finds a prose-only term through the real directory worker and navigates to that room while the map retains no room sections. The 4,000-room boundary case also checks an explicit group preview and rejects an invalid group-view flag. Response-loss, stale navigation, public labels and remembered raster output remain covered. DOM/controller, storage and worker checks do not constitute actual UI acceptance.

## Open acceptance

The browser surface loads the product and the five synthetic QA campaigns. Supported input on “Fortsetzen” has not changed the chooser. Read-only DOM inspection found an enabled button, normal pointer events and the button itself at its center; this does not identify an application defect. No native save dialog was confirmed. Native app control is unavailable in this task.

The complete visible task above, its usable comparator counterpart, fresh-host persistence and actual live/public handout inspection remain open. The isolated native package at `727ce64b` is an older technical preview and does not contain the current navigation or room-read integration. Packaging, native UI qualification, comparison and owner acceptance remain separate claims. The draft is not promoted to Main on technical tests alone; promotion requires linear integration and its exact-SHA CI.
