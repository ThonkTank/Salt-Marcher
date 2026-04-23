Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-23
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
- saved encounter open/save
- initiative entry
- combat tracking
- combat result resolution
- return to encounter creation

The creature catalog browser and encounter filter/tuning controls are separate
left-bar tab content. They publish add-creature, filter, difficulty intent, and
generator tuning signals to this dialog through runtime session state.

## Visible Surfaces

Current state:

- `Creation` shows the original compact encounter roster dialog: title row,
  difficulty and party summary, difficulty meter, thresholds, adjusted XP,
  roster cards, saved-plan actions, previous/next alternative controls, and
  generate/start actions.
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
  the latest catalog type, subtype, biome, difficulty, amount, balance, and
  diversity selections. Auto difficulty or Auto tuning values are resolved by
  the generator for that request and reported in the generation status line.
  When catalog encounter tables are selected, generation uses those table IDs
  instead of the type, subtype, and biome candidate source.
- Previous and next controls sit in the generator action row and switch among
  the currently generated alternatives.
- `Speichern` stores the current roster as a saved encounter plan.
- `Oeffnen` shows saved encounter plans from the title row. Selecting one
  replaces the builder roster, returns to Creation mode, and clears generated
  alternatives, initiative, combat, and result state.
- Catalog `+Add` actions append the selected creature to the runtime roster in
  creation mode and add the selected creature as a reinforcement in active
  combat.
- Roster `+`, `-`, and remove controls adjust slot quantity or remove a slot;
  a single undo action can restore the most recently removed slot.
- A roster creature name opens the creature details inspector.
- `Kampf starten` opens initiative entry when the roster has creatures.
- `Alle wuerfeln` updates visible initiative spinner values.
- Confirming initiative opens the combat tracker.
- Combat internally keeps one entry per individual monster. A combat card may
  still show a runtime mob projection when at least four alive monsters share
  the same creature identity and initiative.
- `Weiter` advances the active combat turn and round display.
- `SC hinzufuegen` opens a compact popup for active party members that are not
  already in the running combat; each row accepts an initiative value before
  adding that character to the turn order.
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
- Auto-resolved generation: the status line includes the resolved target and
  tuning summary; fallback generation adds a fallback note.
- Saved plan available: the title-row open action is enabled and shows the
  saved plan name, generated label, and creature count.
- Encounter-table loot conflict: the Catalog controls show `Loot-Konflikt`;
  combat start remains available because loot assignment is not part of this
  runtime surface.
- Removed roster slot: a one-action undo notice is visible until another roster
  or generator mutation replaces it.
- Live combat: the active turn is highlighted and defeated monsters use the
  dead-card style.
- Combat reinforcement: catalog `+Add` creates a new combat monster without
  mutating the creation roster, preserves the current active turn highlight,
  and includes the reinforcement in result XP eligibility.
- Missing combat party member: the add-SC action is disabled when every active
  party member is already represented, and adding an SC preserves the current
  active turn highlight.
- Runtime mob combat: three or fewer matching monsters stay as individual
  cards, four to ten matching monsters become one `xN` mob card, and larger
  matching groups split into mob cards of four to ten members. Mob damage
  spills into the lowest-HP members first, mob healing restores the lowest-HP
  alive member, and mob initiative edits apply to every member in that mob
  card.
- All enemies defeated: the end-combat button receives accent emphasis.
- Results awarded: the XP action becomes disabled and the status line confirms
  the party award.

## References

- [Encounter Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/SPEC.md:1)
- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/DOMAIN.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
