Status: Confirmed Evidence
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

### Owner Answers 2026-07-23

> [Owner, wörtlich zu 1] ja.

A complete Campaign export is self-contained enough to restore the same
Campaign content, local assets, and resumable working state on another
compatible SaltMarcher installation without access to the original computer.

> [Owner, wörtlich zu 2] ja, aber monster/item und ähnliche nicht-primär custom
> daten mit großen volumen werden zwischen campaigns geteilt.

Existing Campaign-owned data remains unchanged when another Campaign is
imported. Large reusable reference collections such as general Monster and Item
data are deliberately installation-wide and shared between Campaigns rather
than duplicated into every Campaign. Import collision behavior for differing
versions of the same shared definition remains open.

> [Owner, wörtlich zu 3] refresh?

The term `refresh` was unclear and establishes no product behavior. The next
question uses the concrete case of installing a newer shared Monster or Item
data set.

> [Owner, wörtlich zu 4] a
>
> [Owner, korrigierend zu 4] ja

When local data is damaged, SaltMarcher automatically opens the newest
unambiguously safe recoverable state, tells the GM what was recovered and what
could not be preserved, and asks the GM to choose only when no single recovery
choice is clearly safe.

### Literal Evidence So Far

- A complete export restores the same Campaign, local assets, and resumable
  state on another compatible installation without the original computer.
- Campaign-owned data is isolated, while high-volume reusable Monster, Item,
  and similar reference collections are shared across Campaigns.
- Import must not alter existing Campaign-owned data; handling conflicting
  shared definitions is not yet decided.
- Damaged local data recovers automatically to the newest uniquely safe state,
  with visible disclosure of any loss and a choice only when safety is
  ambiguous.

## Third Breadth Block: Shared Data And Campaign Removal

1. Eine importierte Campaign benötigt eine geteilte Monster- oder
   Item-Definition. Wenn sie auf dem Zielrechner fehlt, soll SaltMarcher sie
   automatisch zur dortigen geteilten Sammlung hinzufügen. Was soll passieren,
   wenn dort bereits eine gleich bezeichnete Definition mit anderen Inhalten
   existiert: beide Varianten behalten, die vorhandene verwenden oder den GM
   beim Import entscheiden lassen?
2. Mit `Refresh` war folgender konkrete Fall gemeint: Der GM installiert eine
   neuere Ausgabe eines großen geteilten Monster-, Item- oder Regeldatensatzes.
   Braucht SaltMarcher so eine Aktualisierung ganzer Datensätze überhaupt? Falls
   ja, soll der GM vor der Übernahme die Änderungen sehen und einzelne
   Definitionen überspringen können?
3. Wenn der GM eine ganze Campaign löscht: Soll sie zunächst vollständig in
   einem Papierkorb wiederherstellbar bleiben und erst durch eine zusätzliche
   ausdrückliche Aktion endgültig gelöscht werden?

### Owner Answers 2026-07-23

> [Owner, wörtlich zu 1] Der Gm entscheidet ob eine von beiden verworfen oder
> beide getrennt behalten werden sollen.

When an imported shared definition conflicts with an existing one, the GM
chooses whether to discard either definition or retain both as separate
definitions. SaltMarcher must make the effect of that choice visible: keeping
both preserves both variants, discarding the imported variant makes the
imported Campaign use the retained definition, and discarding the existing
variant deliberately changes the shared definition available to existing
Campaigns. Import never makes that choice silently.

> [Owner, wörtlich zu 2] Monster/Item CRUD ist Spätes QOL feature.

Monster and Item definition management, including bulk data-set refresh, is
not a core workflow requirement. It is parked as a late quality-of-life
capability. The already confirmed sharing semantics still govern any later
definition change: current and future reads use the changed definition while
completed history is not recalculated.

> [Owner, wörtlich zu 3] Ja.

Deleting a Campaign first moves the complete Campaign into recoverable trash.
Permanent deletion requires a separate explicit action.

## Confirmed Consolidated Interpretation

The owner confirmed this complete interpretation on 2026-07-23. It is the
evidence promoted into the draft Program Capability Requirements. It
deliberately states observable outcomes without choosing storage, transaction,
file-format, backup, or synchronization mechanisms.

1. SaltMarcher preserves GM work automatically as soon as practical. Normal
   use does not depend on a manual Save action, should almost never lose
   confirmed work, and must not impose unnecessary user-visible load.
2. After restart, SaltMarcher restores as much of the prior useful working
   state as possible, including the active Campaign, focused Running Scene, and
   live Encounter, Chase, and Travel contexts. Technical design may identify
   effects which genuinely cannot resume, but there is no product-level list
   of deliberately discarded runtime state.
3. Backup schedules, retention, snapshot controls, restore granularity, and
   persistence mechanisms are delegated technical decisions. The binding
   product outcome is recovery of Campaign work and local assets without
   requiring the GM to understand or operate backup internals.
4. When local data is damaged, SaltMarcher automatically opens the newest
   uniquely safe recoverable state, reports what it recovered and any
   unavoidable loss, and asks the GM to choose only when no single recovery
   choice is clearly safe.
5. A complete Campaign export contains the Campaign data, maps, images, local
   audio, required reusable Creature, Item, and rule definitions, and its
   resumable working state. Partial Campaign export is not required.
6. On another compatible SaltMarcher installation, that export restores the
   same Campaign content, local assets, and resumable state without access to
   the original computer.
7. Import always creates a new independent Campaign and never merges Campaign
   content into an existing Campaign.
8. Campaign-owned data remains isolated between Campaigns. Large reusable
   Monster, Item, rule, and similar reference collections are installation-wide
   and shared between Campaigns rather than duplicated per Campaign.
9. Missing shared definitions required by an imported Campaign join the shared
   collection. When an imported definition conflicts with an existing one, the
   GM explicitly chooses whether to discard either variant or retain both as
   separate definitions. SaltMarcher does not silently choose, and it shows the
   consequences for the imported and existing Campaigns before applying the
   decision.
10. Managing Monster and Item definitions, including whole-data-set refresh,
    is a late quality-of-life feature rather than a core need. If definitions
    are changed later, current and future reads use their current definition
    while completed history remains unchanged.
11. Deleting a Campaign moves its complete data into recoverable trash.
    Permanent deletion requires a separate explicit GM action.

Workflow 6 is confirmed. The interview continues with Workflow 7:
cross-workflow completeness, failure semantics, scale, responsiveness, and
modular change, removal, replacement, and extension needs.

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Confirmed Spatial Travel And Progression](2026-07-22-spatial-travel-and-progression.md)
- [Confirmed Follow-Up, Progression, And History](2026-07-22-follow-up-progression-and-history.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
