Status: Active Evidence
Owner: Aaron
Last Reviewed: 2026-07-23
Source of Truth: Verbatim owner answers and confirmed interpretations for
program-wide completeness, failure isolation, responsiveness, scale, optional
use, and modular change needs.

# Cross-Workflow Quality Interview 2026-07-23

## Scope

This final workflow establishes the qualities the complete local GM core must
preserve across all previously confirmed capabilities. It covers observable
offline availability, responsiveness, failure isolation, scale, optional use,
and safe change without choosing modules, processes, storage, frameworks,
threads, caches, or other architecture.

The transcript is evidence only. Confirmed interpretations enter the
[Program Capability Requirements](../../requirements/requirements-program-capabilities.md).
Architecture work resumes only after this workflow and the final complete
needs baseline are explicitly confirmed.

## Carried-Forward Confirmed Evidence

- The binding product horizon is the local GM-operated core. Player-operated
  and remote-play features are parked; the passive GM-controlled second display
  remains in scope.
- During play, the GM should not have to leave the Scene tab. Supplementary
  information and controls remain available through the top bar, detail pane,
  and state-pane tabs.
- Confirmed work persists automatically as soon as practical without
  unnecessary user-visible load and resumes after restart wherever possible.
- Campaign maps are unbounded in authored extent, may contain several zoom
  levels, and may coexist in one Campaign.
- Weather, ambience, music, generation, travel, Encounters, Chases, maps, and
  optional future Actor Autonomy all contribute to workflows but do not define
  the Campaign, Running Scene, or authored World by themselves.
- The original review goal requires a clean, modular, readily extensible
  development process in which behavior can be added, changed, removed, or
  replaced without disproportionate unrelated work.

## First Breadth Block: Availability, Responsiveness, And Isolation

1. Soll das vollständige lokale GM-Kernprodukt ohne Internetverbindung
   funktionieren, solange die benötigten Regeln, Medien und Campaign-Daten
   bereits lokal vorhanden sind? Netzwerkzugriff wäre dann nur für ausdrücklich
   gestartete Importe, Downloads oder spätere Online-Funktionen nötig.
2. Während des Spiels: Sollen gewöhnliche Aktionen wie Scene-Wechsel, Auswahl,
   Suche, Würfe, HP-Änderungen und das Öffnen von Detail- oder State-Panes ohne
   spürbare Wartezeit reagieren? Längere Vorgänge wie Generierung, Import oder
   umfangreiche Simulation würden sichtbar im Hintergrund laufen, abbrechbar
   sein und die laufende Scene weiter bedienbar lassen.
3. Wenn ein unterstützendes System wie Musik, Wetter, Karte, Generierung oder
   autonome World-Fortschreibung ausfällt: Müssen Scene, Encounter und manuelle
   Bearbeitung weiter funktionieren, bereits bestätigte Arbeit erhalten bleiben
   und nur die betroffene Funktion mit verständlichem Fehler und Retry ausfallen?
4. Soll SaltMarcher für praktisch große, über Jahre gewachsene Campaigns ohne
   künstliche Inhaltsgrenzen ausgelegt sein und bei sehr großen Datenmengen
   kontrolliert langsamer werden, statt Daten abzuschneiden oder Funktionen
   unvorhersehbar ausfallen zu lassen? Feste garantierte Maximalgrößen könnten
   später aus realistischen Tests abgeleitet werden.
5. Sollen Musik, Wetter, Ambience, Generation, Dungeon-Karten, Encounters,
   Chases und ähnliche Funktionsbereiche jeweils weggelassen oder später
   ersetzt werden können, ohne dass unbeteiligte Workflows oder vorhandene
   Campaign-Daten brechen? Neue Masken, Inhaltsarten und Einflüsse sollen sich
   entsprechend ergänzen lassen, ohne bestehende Features neu bauen zu müssen.

### Owner Answers 2026-07-23

> [Owner, wörtlich zu 1] ja
>
> [Owner, wörtlich zu 2] ja
>
> [Owner, wörtlich zu 3] ja
>
> [Owner, wörtlich zu 4] ja
>
> [Owner, wörtlich zu 5] ja

The complete local GM core works offline when its required rules, media, and
Campaign data are present locally. Network use is limited to explicit imports,
downloads, and future online capabilities rather than ordinary preparation or
play.

Ordinary live-play actions respond without perceptible delay. Long-running
generation, import, and simulation work remains visible and cancellable in the
background without making the Running Scene unusable.

Failure of supporting music, weather, map, generation, or World-progression
behavior does not disable Running Scenes, Encounters, manual editing, or
preservation of confirmed work. Only the affected capability reports a clear
failure and offers retry.

SaltMarcher supports practically large, long-lived Campaigns without artificial
content limits. Under exceptional load it degrades predictably rather than
truncating data or failing unpredictably. Concrete supported scale and response
budgets remain to be derived from representative scenarios and tests.

Capability areas may be omitted, added, removed, or replaced without breaking
unrelated workflows or existing Campaign data. New runtime masks, content
types, and influences can be integrated without rebuilding existing features.

## Second Breadth Block: Interrupted Work, Upgrades, And Missing Capabilities

1. Wenn ein längerer Vorgang wie Import, Generierung oder Simulation abgebrochen
   wird oder fehlschlägt: Sollen nur bereits einzeln bestätigte Ergebnisse
   bestehen bleiben, während alle noch nicht bestätigten Teilergebnisse sauber
   verworfen werden?
2. Wenn SaltMarcher neue Änderungen gerade nicht sicher speichern kann, etwa
   wegen vollem Datenträger oder fehlendem Zugriff: Soll es das sofort sichtbar
   melden und Änderungen nicht fälschlich als gespeichert bestätigen? Lesen,
   Exportieren und ein erneuter Speicherversuch sollen soweit sicher möglich
   bleiben.
3. Nach einem Programmupdate: Müssen alle bestehenden Campaigns und ihre
   fortsetzbaren Zustände automatisch weiter nutzbar sein? Falls eine nötige
   Umstellung fehlschlägt, soll der vorherige Datenstand unangetastet und mit
   der vorherigen Programmversion wieder nutzbar bleiben?
4. Wenn nur ein einzelner Datensatz beschädigt ist: Soll die restliche Campaign
   trotzdem geöffnet werden, während SaltMarcher den betroffenen Datensatz
   isoliert, verständlich markiert und Wiederherstellung oder ausdrückliches
   Löschen anbietet?
5. Wenn ein optionaler Funktionsbereich zeitweise nicht installiert oder
   deaktiviert ist: Sollen seine vorhandenen Campaign-Daten unangetastet
   erhalten und exportiert werden, auch wenn sie gerade nicht bearbeitet werden
   können, und nach Rückkehr der Funktion wieder verfügbar sein?

### Owner Answers 2026-07-23

> [Owner, wörtlich zu 1] ja
>
> [Owner, wörtlich zu 2] ja
>
> [Owner, wörtlich zu 3] ja
>
> [Owner, wörtlich zu 4] ja
>
> [Owner, wörtlich zu 5] ja

Cancellation or failure of a long-running import, generation, or simulation
keeps only results the GM has already accepted independently. Unconfirmed
partial results are discarded cleanly rather than leaking into Campaign state.

If SaltMarcher cannot safely persist new changes, it reports that state
immediately and never presents affected work as safely stored. Reading,
exporting, and retrying persistence remain available wherever they are safe.

Application updates preserve every existing Campaign and resumable runtime
state. If required data conversion fails, it leaves the prior data untouched
and usable with the prior application version rather than producing a partial
upgrade.

Damage to one record does not prevent the rest of its Campaign from opening.
SaltMarcher isolates and clearly identifies the affected record and offers
recovery or explicit deletion.

Data owned by a temporarily disabled or unavailable capability remains intact,
is included in complete Campaign export, cannot be silently discarded, and
becomes usable again when that capability returns.

## Third Breadth Block: Platform, Resources, And Trust Boundary

1. Welche Desktop-Betriebssysteme gehören zum Ziel des lokalen Kernprodukts:
   Linux, Windows und macOS oder zunächst nur eine Teilmenge davon?
2. Soll SaltMarcher auf einem gewöhnlichen aktuellen Laptop ohne dedizierte GPU
   oder Server-Hardware flüssig nutzbar sein? Aufwendige Wetter- oder
   World-Simulation müsste ihre Detailtiefe dann kontrolliert an verfügbare
   Ressourcen anpassen, statt den Live-Betrieb zu blockieren.
3. Soll die Installation für den GM eine eigenständige Desktop-Anwendung sein,
   ohne dass er zusätzlich einen Datenbankserver, Webserver, eine Laufzeit oder
   andere Infrastruktur installieren und administrieren muss?
4. Ist die bestätigte Kernnutzung genau ein lokal bearbeitender GM pro Campaign?
   Die passive Zweitanzeige darf denselben Zustand lesen, aber gleichzeitige
   Bearbeitung derselben Campaign durch mehrere Prozesse, Rechner oder Nutzer
   wäre kein Kernbedarf.
5. Sollen Campaign-Daten, Notizen, Karten, Bilder, Audio und Nutzungsdaten den
   Rechner niemals ohne eine konkrete, verständliche und vom GM ausgelöste
   Aktion verlassen? Insbesondere gäbe es keine verpflichtende Cloud,
   versteckten Uploads oder standardmäßig aktive Telemetrie.

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Confirmed Session And Scene Preparation](2026-07-22-session-and-scene-preparation.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Confirmed Spatial Travel And Progression](2026-07-22-spatial-travel-and-progression.md)
- [Confirmed Follow-Up, Progression, And History](2026-07-22-follow-up-progression-and-history.md)
- [Confirmed Local Data Lifecycle](2026-07-23-local-data-lifecycle.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
