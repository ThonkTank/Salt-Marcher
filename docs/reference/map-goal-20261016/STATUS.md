# Atlas workflow: implementation and open acceptance

Source base: SaltMarcher migration candidate `33c37b56a4568aa0f6fdda3eaf9eeb3bfc1152d3`, version 0.157.0. These map changes are unfinished work on `qa/saltmarcher-maps`; migration CI success does not qualify this changed tree. The migration owner is preparing a linear replacement of the candidate. Transfer only these owned changes onto its accepted Main, preserving the old branches.

## GM task

Prepare a region and market quarter, generate houses, protect and reposition a named tavern, write its notes, then create two interior rooms with a door and readable labels. Return to the house and reopen the interior with its contents intact. During play, focus a party, inspect its remembered and currently visible map, travel through known areas, hide the separate player display, and export a public handout without GM information.

The same complete task must be performed in an available comparator. Earlier Dungeon Scrawl observations include drawing rooms, a door and labels and downloading a PNG. Editable save/reopen and the full live-play counterpart remain unverified. Hextml observations also do not constitute a completed interior workflow. No comparative superiority is established.

## Changes carried forward

- One camera and author history connect canonical places, city buildings and interiors. Place creation saves the location and marker together; reading and editing use the same location document.
- Building placement has an explicit preview, cancel/accept and numeric position/angle correction. Protected buildings survive generation.
- Interior rectangles use the existing drawing controller. Door placement uses the wall point before grid snapping. Labels stay horizontal under building rotation. Returning to the house reuses the existing interior.
- Floor changes flush open work and reject stale replies. A started rectangle remains assigned to its original floor.
- Group view renders the existing public projection and disables author gestures. Missing focus or failed reads leave a blank map with feedback. Travel acknowledgements carry the corresponding public frame; previewing it does not unblank the separate player window.
- Public export reads a fresh projection and checks its Atlas revision against the landscape read. Current landscape is clipped to currently visible cells; remembered unseen terrain retains remembered facts.
- Lost World write responses now remain recoverable through the World editor. A verified read-only reconciliation also settles the exact matching nested Atlas pending command, so later edits can save without replaying an unresolved write.

## Verification boundary

On this base, the six targeted city, location-flow, path, knowledge, Atlas and export test files passed 110/110. Both type checks, repository check, adapter build and desktop build passed before the final World recovery repair. The complete World DOM suite then passed 21/21. The same before/after-commit response-loss cases failed against the archived pre-repair modules and passed after repair. Additional assertions check that reconciliation leaves both World and Atlas database tables unchanged and creates no duplicate Atlas command.

The broader test run and post-repair build checks are recorded separately in the task workspace and are still pending at the time of this note. Do not interpret targeted results as a global pass or exact published-SHA qualification.

The task's browser surface loads the current product and existing synthetic QA campaign, but supported click and keyboard actions do not reach the page. Reload, fresh tabs, controller reset, documented alternatives and Escape did not restore interaction. No native save dialog was confirmed. Technical and DOM tests are not the missing actual UI rerun.

Next acceptance step: restore supported UI input, perform the entire task above in this build and a usable comparator, inspect persistence after a fresh host, and show the result for Aaron's explicit acceptance in the goal chat. Packaging, installation, native qualification and owner acceptance remain open. The goal stays active.
