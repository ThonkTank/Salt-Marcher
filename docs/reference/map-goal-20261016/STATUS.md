# Atlas workflow: implementation and open acceptance

Source base: SaltMarcher Main `a44f458d3340f93a50a3f7f118427cdd4da303ea`, version 0.160.0. The owned Atlas changes were transferred to `qa/atlas-navigation-20261016`; the previous published candidate and all older checkouts remain preserved. The continuous Goal is paused by user request. Work continues only through the 90-minute heartbeat; the explicit owner acceptance condition is unchanged.

## GM task

Prepare a region and market quarter, generate houses, protect and reposition a named tavern, write its notes, then create two interior rooms with a door and readable labels. Return to the house and reopen the interior with its contents intact. During play, focus a party, inspect its remembered and currently visible map, travel through known areas, hide the separate player display, and export a public handout without GM information.

The same complete task must be performed in an available comparator. Earlier Dungeon Scrawl observations include drawing rooms, a door and labels and downloading a PNG. Editable save/reopen and the full live-play counterpart remain unverified. Hextml observations also do not constitute a completed interior workflow. No comparative superiority is established.

## Changes carried forward

- One camera and author history connect canonical places, city buildings and interiors. Place creation saves the location and marker together; reading and editing use the same location document.
- Building placement has an explicit preview, cancel/accept and numeric position/angle correction. Protected buildings survive generation.
- Interior rectangles use the existing drawing controller. Door placement uses the wall point before grid snapping. Labels stay horizontal under building rotation. Returning to the house reuses the existing interior.
- Floor changes flush open work and reject stale replies. A started rectangle remains assigned to its original floor.
- City, house, room and dungeon-scope search navigation also checks open editors before leaving. A started room can be finished or explicitly cancelled; navigation no longer silently throws it away. Pending navigation is invalidated on campaign changes, hiding the Atlas or a newer city/room/scope request.
- Group view renders the existing public projection and disables author gestures. Missing focus or failed reads leave a blank map with feedback. Travel acknowledgements carry the corresponding public frame; previewing it does not unblank the separate player window.
- Public export reads a fresh projection and checks its Atlas revision against the landscape read. Current landscape is clipped to currently visible cells; remembered unseen terrain retains remembered facts.
- Lost World write responses now remain recoverable through the World editor. A verified read-only reconciliation also settles the exact matching nested Atlas pending command, so later edits can save without replaying an unresolved write.

## Verification boundary

The previous published candidate `7452de70` passed its required exact-head CI (run `38916251233`). Its local suite reported 3,336 passed, zero failed and one optional skip; the outer session ended with signal 143, so a normal local process exit was not observed. Earlier scoped map checks and response-loss regressions are retained with that candidate.

The current integration preserves Main's bounded landscape queries, paged search, compact commits, tiled exports and export cancellation. Public raster tiles and vector contours share a clip containing only currently visible cells. No current image layer is drawn when all cells are remembered-only. A raster-specific assertion extends the existing remembered-terrain regression. The new exhaustive Atlas command validator also recognizes `location-create`; the first integration run exposed this missing contract entry in three place/group-view cases. After repair, all 48 city/Atlas DOM cases passed, including canonical place creation, same-command recovery and the visible-versus-remembered raster clip. The 15 Main Atlas-transition checks, location-flow check and 21 World DOM checks passed in the first integration run. Both type checks, repository check and both builds passed after the contract repair. The final sync also retains Main's marker-blur uncertainty guard. Focused recovery checks are repeated after that sync. Under current AGENTS.md the required exact-SHA Candidate CI owns full-suite qualification; no duplicate complete local suite is started. The preserved `727ce64b` candidate passed exact-head CI run `38931027837` (3,369 passed, zero failed, one optional skip). Its isolated Linux package passed technical SQLite probes; it has no native UI qualification. The new navigation candidate based on `a44f458d3` needs its own exact-head CI, separately recorded in the task checkpoint.

A technical regression reproduced both unfinished-room navigation losses before the fix: selecting a city changed the tool family, and selecting another dungeon changed the drawing scope. Both now retain the original draft. Focused tests also cover finishing the retained room, explicit cancellation, delayed editor flush, newer navigation and a late read across campaign activation. All 51 city/Atlas cases passed after the fix; after extending the assertions, all five final focused navigation cases passed. Both type checks, repository checks and the desktop build also passed on this base. These are DOM/controller and SQLite evidence, not a completed actual UI workflow.

The task's browser surface loads the current product and existing synthetic QA campaign, but supported click and keyboard actions do not reach the page. Reload, fresh tabs, controller reset, documented alternatives and Escape did not restore interaction. No native save dialog was confirmed. Technical and DOM tests are not the missing actual UI rerun.

Next acceptance step: restore supported UI input, perform the entire task above in this build and a usable comparator, inspect persistence after a fresh host, and show the result for Aaron's explicit acceptance in the goal chat. Packaging, installation, native qualification and owner acceptance remain open. The continuous Goal remains paused; the heartbeat continues the unfinished task.
