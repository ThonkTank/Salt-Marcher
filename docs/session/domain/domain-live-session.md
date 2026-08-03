# Live Session Domain

## Ownership

`LiveSession` projects the focused Scene into one four-panel running-play
workspace. Scene owns focus and ordered, named creature groups; Live Session
owns neither Party membership nor creature facts.

Party publishes the current Roster, membership, and XP through `PartyApi`.
Creatures publishes current statblocks. Encounter owns the active Combat
memento, including Initiative, individual combatants, HP, turn, round, and
Resolution state.

## Invariants

- group identity and order remain stable
- a group has a non-blank name and at least one positive creature quantity
- group entries contain references only; current display and Combat facts are
  resolved through Creatures
- a Combat is keyed by Scene identity and captures its selected group
  identities and runtime combat profiles
- Resolution awards XP to the current active Party through an idempotent Combat
  identity
- finishing Combat clears only Encounter runtime state

Detail history and selected scenario are renderer state scoped by Scene. Panel
column width, right-side divider height, and selected Details/Karte tab are
app-wide shell preferences, not campaign domain state.

All public snapshots are immutable and revisioned. Mutations reject stale
revisions instead of silently targeting newer state.
