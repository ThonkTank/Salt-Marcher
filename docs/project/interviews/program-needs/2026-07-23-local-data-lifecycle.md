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

### Owner Answers 2026-07-23

> [Owner, wörtlich zu 1] soweit möglich sollte alles resumen wie es war.

After restart, SaltMarcher resumes as much of the complete prior working state
as possible, including Campaign, focused Scene, and live runtime contexts. The
owner establishes no deliberate exclusion for music, dialogs, or another
surface; later technical work must identify genuinely non-resumable transient
effects without shrinking the general outcome.

> [Owner, wörtlich zu 2] Soweit möglich sollte alles immer sofort gespeichert
> werden. Solange es das Programm nicht unnötig belastet. Das fühlt sich aber
> wieder nach technischem detail an, also interessiert es mich nur insoweit
> dass ich meine Daten und meine Arbeit möglichst nie verlieren will.

The observable need is continuous automatic durability which does not rely on
a manual-save workflow to prevent loss: confirmed work persists as soon as
practical, does not impose unnecessary user-visible load, and should almost
never be lost. Exact write timing, draft persistence, crash boundaries, and
performance mechanisms belong to later technical-needs and architecture work.

> [Owner, wörtlich zu 3] Ja. Nein.

A Campaign export includes its Campaign data, maps, images, local audio, and
required reusable Creature, Item, and rule definitions. Selected partial export
is not required.

> [Owner, wörtlich zu 4] Ersteres.

Import always creates a new independent Campaign. It never merges into an
existing Campaign, so merge-conflict choices are not a required user workflow.

> [Owner, wörtlich zu 5] Auch hier wieder: Ich will meine Daten nicht verlieren.
> Für technische Details habe ich weder die expertise noch das interesse eine
> hilfreiche Entscheidung zu treffen.

The owner delegates backup interval, retention, snapshot controls, and restore
granularity to later technical design. The binding product outcome is that
Campaign work and local assets remain recoverable without requiring the GM to
understand or operate backup internals, and that ordinary failures should not
cause meaningful data loss.

### Literal Evidence So Far

- Restart resumes the complete useful working state wherever possible.
- Confirmed work persists automatically as soon as practical without relying
  on manual save or imposing unnecessary user-visible load.
- Campaign export is complete, including referenced local assets and reusable
  definitions; partial export is not required.
- Import always creates a new independent Campaign and never merges into an
  existing one.
- Backup and restore mechanisms are technical decisions; reliable recovery and
  near-zero loss of GM work are binding outcomes.

## Second Breadth Block: Observable Portability And Recovery

1. Soll ein vollständiger Campaign-Export auf einer anderen kompatiblen
   SaltMarcher-Installation ohne Zugriff auf den ursprünglichen Rechner sofort
   denselben Campaign-Inhalt, dieselben Assets und denselben fortsetzbaren
   Zustand bereitstellen?
2. Muss der Import garantiert jede bereits vorhandene Campaign und deren
   wiederverwendbare Referenzen unverändert lassen, auch wenn importierte Namen
   oder Definitionen identisch aussehen?
3. Wenn der GM wiederverwendbare Creature-, Item- oder Regeldaten aktualisiert:
   Soll SaltMarcher die Änderungen vorher anzeigen und einzelne Updates
   überspringen lassen, oder darf ein ausdrücklich gestartetes Refresh alle
   betroffenen Definitionen gemeinsam aktualisieren?
4. Welche sichtbare Recovery-Erfahrung ist erforderlich: Soll SaltMarcher nach
   beschädigten Daten automatisch den jüngsten sicheren Zustand öffnen, den GM
   über jede unvermeidbare Abweichung informieren und nur dann eine Auswahl
   alternativer Wiederherstellungspunkte zeigen, wenn Automatik nicht eindeutig
   sicher ist?

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Confirmed Spatial Travel And Progression](2026-07-22-spatial-travel-and-progression.md)
- [Confirmed Follow-Up, Progression, And History](2026-07-22-follow-up-progression-and-history.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
