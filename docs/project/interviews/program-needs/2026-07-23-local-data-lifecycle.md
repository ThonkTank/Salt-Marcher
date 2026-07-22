Status: Active Evidence
Owner: Aaron
Last Reviewed: 2026-07-23
Source of Truth: Verbatim owner answers and confirmed interpretations for
restart, import, export, reference refresh, backup, restore, recovery, and
other local data-lifecycle needs.

# Local Data Lifecycle Interview 2026-07-23

## Scope

This workflow covers what the GM expects when SaltMarcher closes, restarts,
moves Campaign data between installations, refreshes reusable reference data,
backs up or restores local work, or encounters damaged or unavailable local
data. It asks for observable safety and recovery behavior without choosing file
formats, databases, transaction mechanisms, or backup technology.

The transcript is evidence only. Confirmed interpretations enter the
[Program Capability Requirements](../../requirements/requirements-program-capabilities.md).
Architecture, contracts, persistence, APIs, and delivery order remain out of
scope.

## Carried-Forward Confirmed Evidence

- SaltMarcher stores several Campaigns and switches between them immediately.
  Each Campaign's Running Scenes, Encounters, and travel state remain preserved
  for later continuation.
- Campaign content references reusable definitions; current and future play
  reads the current definition, while completed history is not retroactively
  recalculated after a definition update.
- Explicit deletion removes current use but leaves explanatory history with an
  unknown or recoverable-trash reference.
- Hex maps support import and export, but the portable scope and collision
  behavior have not yet been confirmed.
- No confirmed workflow yet defines application restart, automatic saving,
  whole-Campaign portability, backup retention, restore, or corruption
  recovery.

## First Breadth Block: Restart, Portability, And Backup

1. Nach einem normalen Beenden und Neustart: Soll SaltMarcher die zuletzt
   geöffnete Campaign, fokussierte Scene sowie jeden laufenden Encounter-,
   Chase- und Travel-Zustand exakt wiederherstellen? Welche flüchtigen Dinge,
   etwa aktuell spielende Musik oder offene Dialoge, sollen bewusst nicht
   fortgesetzt werden?
2. Soll jede bestätigte GM-Änderung sofort dauerhaft gespeichert werden, sodass
   es keinen manuellen Save-Button gibt? Wie viel Arbeit darf bei einem Absturz
   höchstens verloren gehen, insbesondere bei noch offenen Editierdialogen?
3. Was muss ein Campaign-Export enthalten: nur Campaign-Daten oder auch ihre
   verwendeten Karten, Bilder, lokalen Audio-Dateien und wiederverwendbaren
   Creature-, Item- und Regeldefinitionen? Soll der GM auch ausgewählte
   Teilmengen exportieren können?
4. Darf ein Import nur eine neue unabhängige Campaign erstellen, oder auch in
   eine bestehende Campaign zusammenführen? Was soll der GM bei gleichen IDs,
   Namen oder bereits vorhandenen Referenzdefinitionen entscheiden können?
5. Welche Backup-Bedienung braucht der GM: automatische rollierende Backups,
   einen manuellen Snapshot, eine sichtbare Liste mit Zeitpunkt und Umfang und
   eine Vorschau vor Restore? Bezieht sich ein Restore auf eine Campaign oder
   auf die gesamte lokale SaltMarcher-Installation?

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Confirmed Spatial Travel And Progression](2026-07-22-spatial-travel-and-progression.md)
- [Confirmed Follow-Up, Progression, And History](2026-07-22-follow-up-progression-and-history.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
