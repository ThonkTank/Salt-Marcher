Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Encounter runtime state-pane dialog composition,
interactions, and visible states.

# Encounter Runtime State UI

## Component Purpose

The Encounter state tab owns the compact encounter dialog shown in the
global `COCKPIT_STATE` pane when the active left-bar tab does not provide its
own state content.

The dialog visually mirrors the original Salt-Marcher encounter state-pane
workflow in one local state-tab surface:

- encounter creation
- initiative entry
- combat tracking
- combat result resolution
- return to encounter creation

The creature catalog browser and encounter filter/tuning controls are separate
left-bar tab content. They publish add-creature, filter, and difficulty intent
signals to this dialog through runtime session state.

## Visible Surfaces

Current state:

- `Creation` shows the original compact encounter roster dialog: title row,
  difficulty and party summary, difficulty meter, thresholds, adjusted XP,
  generator controls, roster cards, and generate/start actions.
- `Initiative` shows one editable initiative row for each party member and
  encounter creature.
- `Combat` shows round status, combat cards, HP bars, AC and initiative badges,
  next-turn controls, and a two-step end-combat confirmation.
- `Resolution` shows defeated-enemy selection, XP and loot summaries, reward
  controls, and the action that returns to encounter creation.

The state pane uses centralized encounter selector roles for difficulty labels,
the difficulty meter, roster cards, role badges, initiative rows, combat card
states, HP bars, AC/init badges, edit popups, and result highlights. It reads
active-party thresholds from the encounter application service and resolves
creature details through the creature application service.

## Interactions

- `Generieren` creates ranked encounter alternatives from the active party and
  the latest catalog type, subtype, biome, and difficulty selections.
- Previous and next controls switch among the currently generated alternatives.
- `Reroll` regenerates alternatives from the latest catalog filters and active
  difficulty.
- `Lock` stores the current roster as generator locks for following rerolls.
- `Exclude` adds the current creature IDs to generator exclusions, clears active
  locks, and rerolls immediately.
- `Clear` removes active generator locks and exclusions.
- Catalog `+Add` actions append the selected creature to the runtime roster.
- Roster `+`, `-`, and remove controls adjust slot quantity or remove a slot;
  a single undo action can restore the most recently removed slot.
- A roster creature name opens the creature details inspector.
- `Kampf starten` opens initiative entry when the roster has creatures.
- `Alle wuerfeln` updates visible initiative spinner values.
- Confirming initiative opens the combat tracker.
- `Weiter` advances the active combat turn and round display.
- HP bars open a compact damage/heal popup.
- Initiative badges open a compact set-initiative popup.
- `Kampf beenden` requires a second confirmation before showing results.
- `XP verteilen` awards the current per-player XP result to the active party.
- `Abschliessen` returns to encounter creation.

## Visible States

- Empty roster: the creation view mirrors the original `+Add` placeholder and
  can be populated through catalog `+Add` or `Generieren`.
- Generated roster: difficulty, thresholds, adjusted XP, generator title, and
  creature cards are visible.
- Active generator constraints: a compact Locks/Excluded summary is visible in
  the creation summary row.
- Removed roster slot: a one-action undo notice is visible until another roster
  or generator mutation replaces it.
- Live combat: the active turn is highlighted and defeated monsters use the
  dead-card style.
- All enemies defeated: the end-combat button receives accent emphasis.
- Results awarded: the XP action becomes disabled and the status line confirms
  the party award.

## References

- [Encounter Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/SPEC.md:1)
- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/DOMAIN.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
