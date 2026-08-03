# Live Session Persistence

The utility process alone opens campaign SQLite. Feature-owned adapters own
their SQL and prepared statements.

Live Session stores metadata, group headers, and group entries. Party stores
the seeded Roster, membership, XP, and applied Combat award identities.
Encounter stores one Zod-validated Combat memento per Scene identity. Focusing
another Scene changes the projected Combat but never clears or overwrites the
previous Scene's memento.

The stored Combat memento includes phase, source groups, initiative sources,
individual combatants, card membership, current HP, turn order, active turn,
round, Resolution selection, sliders, and award status. Readback validates the
complete memento before publication.

An XP award first records the Combat identity in Party's idempotency set. A
retry with the same identity changes no XP. Session and Encounter never write
Party rows directly.

Before the first released data format, feature initializers create the current
schema directly. They do not introduce a generic ORM or expose SQLite carriers
through public contracts.

The shared column width, right-side Details/Scenario divider, and Details/Karte
tab are validated shell preferences stored by Electron main below `userData`.
Renderer code accesses them only through the restricted preload capability and
never reads files or browser storage directly. Retired topology preferences
retain their former column width and right-side divider when first read.
