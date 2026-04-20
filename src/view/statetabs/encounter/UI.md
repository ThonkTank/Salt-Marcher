Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Encounter runtime state-pane dialog composition,
interactions, and visible states.

# Encounter Runtime State UI

## Component Purpose

The Encounter state tab owns the compact encounter dialog shown in the
global `COCKPIT_STATE` pane when the active left-bar tab does not provide its
own state content.

The dialog migrates the original Salt-Marcher encounter workflow into one
state-pane surface:

- encounter creation
- initiative entry
- combat tracking
- combat result resolution
- return to encounter creation

The creature catalog browser is not part of this surface. The catalog is a
separate tab and later supplies add-creature and stat-block hooks to this
dialog.

## Visible Surfaces

Current state:

- `Creation` shows filter and catalog-hook placeholders, encounter tuning
  controls, a difficulty meter, roster cards, and generate/start actions.
- `Initiative` shows one editable initiative row for each party member and
  encounter creature.
- `Combat` shows round status, combat cards, HP bars, AC and initiative badges,
  next-turn controls, and a two-step end-combat confirmation.
- `Resolution` shows defeated-enemy selection, XP and loot summaries, reward
  controls, and the action that returns to encounter creation.

The state pane uses centralized encounter selector roles for difficulty labels,
the difficulty meter, roster cards, role badges, initiative rows, combat card
states, HP bars, AC/init badges, edit popups, auto controls, and result
highlights. The creature catalog browser remains a separate tab in the current
state; this pane keeps only the placeholder hook controls.

The first implementation is intentionally demo-backed frontend state. Real
generation, catalog, combat, XP, and loot behavior are deferred integration
points behind the same ViewModel actions.

## Interactions

- `Generieren` creates a demo encounter roster.
- `+ Demo` simulates a future catalog add-creature hook.
- `Kampf starten` opens initiative entry when the roster has creatures.
- `Alle wuerfeln` updates visible initiative spinner values.
- Confirming initiative opens the combat tracker.
- `Weiter` advances the active combat turn and round display.
- HP bars open a compact damage/heal popup.
- Initiative badges open a compact set-initiative popup.
- `Kampf beenden` requires a second confirmation before showing results.
- `XP verteilen` marks the demo XP action as completed.
- `Abschliessen` returns to encounter creation.

## Visible States

- Empty roster: the creation view explains that creatures can be added through
  the future catalog hook or by generating demo content.
- Generated roster: difficulty, thresholds, adjusted XP, and creature cards are
  visible.
- Live combat: the active turn is highlighted and defeated monsters use the
  dead-card style.
- All enemies defeated: the end-combat button receives accent emphasis.
- Results awarded: the XP action becomes disabled and the status line confirms
  the demo award.

## References

- [Encounter Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/SPEC.md:1)
- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/DOMAIN.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
