# Clean Encounter

## Purpose

`src/clean/encounter` owns the runtime encounter state rendered in the shell scene pane. Keep session encounter behavior here, because the lower-right scene surface is the persistent runtime area of the clean app.

## Canonical Types And APIs

- `EncounterObject.composeEncounter(ComposeEncounterInput)` - returns the shell registration hook and the command seam used to add creatures into the active encounter.

## Where New Code Goes

- Keep roster, tracker, combat-start, save, and future encounter session behavior here, because they all mutate the same runtime state.
- Publish encounter UI through the shell scene registry, because encounter is a persistent runtime surface rather than a top-level tab.

## Forbidden Drift

- Keep creature selection and browsing in `clean.creatures`, because encounter consumes creatures but does not own catalog behavior.
- Keep top-level navigation in `clean.featuretabs`, because encounter runtime belongs in the scene pane, not the primary sidebar roster.
