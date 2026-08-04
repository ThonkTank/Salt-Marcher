# Live Session Domain

## Ownership

`LiveSession` projects the focused Scene into one three-column running-play
workspace. Scene owns focus and ordered, named creature groups; Live Session
owns neither Party membership nor creature facts.

Party publishes the current Roster, membership, and XP through `PartyApi`.
Creatures publishes current statblocks. Scene owns stable individual creature
group members, including current HP and conditions. Encounter references those
members and owns Initiative, card packing, turn, round, and Resolution state.

The live-play application service coordinates the membership transition with
Scene: a newly active Party member is assigned to the focused Scene in the same
transaction, while an inactive member is removed from every Scene. This policy
does not transfer ownership of Party membership to Scene.

## Invariants

- group identity and order remain stable
- a group has a non-blank name, an optional persisted note of at most 1,000
  characters, a visual disposition, an archive flag, and zero or more stable
  individual creature members grouped into separate living and dead counts
- group entries contain references only; current display and Combat facts are
  resolved through Creatures
- empty and archived groups cannot join Combat; archiving a linked group
  removes its members from the running Combat
- a Combat is keyed by Scene identity and retains selected group and member
  references without copying their mutable HP or conditions
- Resolution awards XP to the current active Party through an idempotent Combat
  identity
- finishing Combat clears only Encounter runtime state

Detail history and selected scenario are renderer state scoped by Scene. Left
control/group width, right scenario width, and the selected
Details/Katalog/Karte center tab are app-wide shell preferences, not campaign
domain state.

All public snapshots are immutable and revisioned. Mutations reject stale
revisions instead of silently targeting newer state.
