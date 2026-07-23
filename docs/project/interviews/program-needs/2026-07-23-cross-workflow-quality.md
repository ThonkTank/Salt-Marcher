Status: Confirmed Evidence
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

### Owner Answers 2026-07-23

> [Owner, wörtlich zu 1-5] ja

The answer to question 1 is interpreted as including all three named desktop
targets: Linux, Windows, and macOS. The complete core behavior and Campaign
portability apply across those supported systems.

SaltMarcher runs fluidly on an ordinary current laptop without requiring a
dedicated GPU or server hardware. Resource-intensive simulation adapts its
detail or pace to available resources rather than blocking live play.

The GM installs a self-contained desktop application and does not separately
install or administer a database server, web server, runtime, or other
infrastructure.

One local GM is the only writer for a Campaign in the confirmed core. The
passive second display may read the live state, but concurrent editing of one
Campaign by several processes, computers, or users is not required.

Campaign data, notes, maps, images, audio, and usage data leave the computer
only through a concrete, understandable action initiated by the GM. The core
has no mandatory cloud dependency, hidden upload, or telemetry enabled by
default.

## Fourth Breadth Block: Rules, Extension Surface, And Accessibility

1. Ist D&D 5e 2014 das einzige verbindliche Regelsystem des Kernprodukts, oder
   soll dieselbe Installation später unterschiedliche D&D-Versionen oder ganz
   andere Rollenspielsysteme pro Campaign unterstützen können?
2. Bedeutet die bestätigte Modularität nur, dass wir SaltMarcher intern sauber
   weiterentwickeln können, oder soll der GM später auch Erweiterungen, Plugins
   oder Skripte von Dritten installieren können?
3. Welche Oberflächensprachen gehören zum Ziel: zunächst nur Englisch, Deutsch
   und Englisch, oder grundsätzlich eine lokalisierbare Oberfläche für weitere
   Sprachen? Eigene Campaign-Inhalte bleiben davon unabhängig beliebiger Text.
4. Soll der vollständige Kern mit Tastatur bedienbar sein sowie skalierbare
   Schrift und Oberfläche, ausreichende Kontraste und Informationen bieten, die
   nicht ausschließlich über Farbe vermittelt werden?
5. Soll die Desktop-Oberfläche auf üblichen Laptop-Auflösungen ebenso wie auf
   hochauflösenden und mehreren Monitoren vollständig nutzbar bleiben? Touch,
   Mobilgeräte und kleine Smartphone-Layouts wären dagegen kein Kernbedarf.

### Owner Answers 2026-07-23

> [Owner, wörtlich zu 1] erstmal nur 2014, mehrere Systeme wären sehr spätes
> QOL.

D&D 5e 2014 is the only binding rules profile for the core. Supporting several
D&D versions or other game systems is parked as very late quality-of-life work
and does not require a generic multi-system core now.

> [Owner, wörtlich zu 2] Letzteres

Modularity is both an internal change-quality need and a future user-facing
extension capability: the GM can install third-party extensions, plugins, or
scripts. Delivery timing and the concrete extension mechanism remain outside
this needs interview.

> [Owner, wörtlich zu 3] Grundsätzlich lokalisierbar.

The complete interface is localizable for additional languages. Campaign-authored
text remains arbitrary user content and is not coupled to interface language.

> [Owner, wörtlich zu 4] ja, solange das die UI nicht unübersichtlicher macht
> oder workflows verlangsamt.

The complete core supports keyboard operation, scalable text and interface,
sufficient contrast, and information which does not rely on color alone.
Accessibility must not clutter the default interface or slow the confirmed
low-friction workflows; alternative input and presentation paths preserve the
same efficient actions.

> [Owner, wörtlich zu 5] ja

The desktop interface remains fully usable on common laptop resolutions,
high-density displays, and multi-monitor arrangements. Touch devices, mobile
devices, and small smartphone layouts are not core targets.

## Final Targeted Clarifications: Third-Party Extensions

1. Muss der GM jede Erweiterung ausdrücklich installieren und vor der
   Aktivierung verständlich sehen, auf welche Campaign-Daten, Dateien,
   Netzwerkfunktionen oder anderen Fähigkeiten sie zugreifen möchte?
2. Soll eine Erweiterung standardmäßig weder Netzwerkzugriff noch Zugriff auf
   Dateien außerhalb ihrer freigegebenen Daten erhalten und zusätzliche
   Berechtigungen nur nach ausdrücklicher Zustimmung des GM nutzen dürfen?
3. Wenn eine Erweiterung fehlerhaft, beschädigt oder nicht mehr vorhanden ist:
   Müssen SaltMarcher und die Campaign ohne sie weiter starten, die Erweiterung
   deaktiviert und verständlich markiert sowie ihre Daten unangetastet erhalten
   werden?
4. Wenn eine Erweiterung nach einem SaltMarcher-Update nicht kompatibel ist:
   Soll nur die Erweiterung deaktiviert werden, ohne Update, Campaign oder
   Kernfunktionen zu blockieren oder Daten umzuschreiben?
5. Dürfen Erweiterungen neue Inhaltsarten, Runtime-Masken, Generatoren,
   Importeure und Darstellungen ergänzen, aber bestätigte Sicherheitsgrenzen
   wie explizite Löschung, lokale Datenkontrolle und unverfälschte History nicht
   unbemerkt umgehen?

### Owner Answers 2026-07-23

> [Owner, wörtlich zu 1-5] ja

Every extension is explicitly installed by the GM and discloses its requested
access to Campaign data, files, network functions, and other capabilities
before activation.

Extensions have no default network access or unrestricted file access.
Additional permissions require explicit GM consent. A faulty, damaged,
missing, or update-incompatible extension is disabled and clearly identified
without preventing SaltMarcher or the Campaign from opening. Its data remains
intact and an application update does not let it rewrite Campaign data merely
because compatibility failed.

Extensions may add content kinds, runtime masks, generators, importers, and
presentations. They cannot silently bypass confirmed safety boundaries such as
explicit deletion, local control of data, or truthful Campaign history.

## Repository Inventory Completeness Audit

The current vision, roadmap, and feature documentation were inspected only as
discovery prompts. Campaign knowledge, Catalog lookup, Party, Session planning
and generation, Running Scenes, Encounters, follow-up, Items, World records,
Dungeon and Hex maps, travel, weather, music and ambience, and optional Actor
Autonomy all map to confirmed interview behavior or an explicit parked scope.

The inventory exposed four product gaps which the earlier workflow questions
did not decide explicitly: calendar and scheduled-event behavior, whether
Encounter Tables are a real user concept, whether SaltMarcher provides general
dice rolling, and the intended boundary of a PC record. The following block
closes those gaps rather than inheriting the current implementation.

## Final Completeness Block: Calendar, Tables, Dice, And PCs

1. Braucht jede Campaign einen konfigurierbaren Fantasy-Kalender mit eigenen
   Monaten, Tageslängen, Wochentagen und Jahreszählung, oder reicht ein fester
   realweltlicher Kalender plus frei verstellbare Uhrzeit?
2. Soll der GM Ereignisse und Erinnerungen auf einen Campaign-Zeitpunkt legen
   können, die sichtbar werden, sobald eine Running Scene diesen Zeitpunkt
   erreicht? Sie würden den GM informieren oder vorbereitete Inhalte anbieten,
   aber keine erzählerische Konsequenz ohne seine Entscheidung ausführen.
3. Sind ausdrücklich benannte, vom GM bearbeitbare `Encounter Tables` mit
   gewichteten Monster- oder Gruppeneinträgen ein gewünschtes Konzept, das an
   Orte und Fraktionen gehängt und als Quelle für Generierung genutzt wird?
   Oder sollen allein Tags, Terrain, Fraktionen und andere Faktoren den
   Kandidatenpool bestimmen, ohne eigene Tabellenobjekte?
4. Braucht SaltMarcher einen allgemeinen Würfelroller für den GM, oder würfelt
   der GM weiterhin physisch und nur automatische Generatoren und Simulationen
   verwenden intern Zufall?
5. Soll ein PC-Datensatz neben Name und frei ergänzbaren Notizen als optionale
   strukturierte Kerndaten mindestens Level, XP, aktuelle/maximale HP,
   Bewegungsraten und relevante Sinne enthalten, weil Planung, Encounter,
   Reisen und Sicht sie benötigen? Ein vollständiger Charakterbogen mit
   Klassenfähigkeiten, Zaubern und regelvollständigem Equipment wäre weiterhin
   kein Kernbedarf.

### Owner Answers 2026-07-23

> [Owner, wörtlich zu 1] ersteres

Each Campaign has a configurable fantasy calendar with authored month lengths,
day length, weekdays, and year counting rather than being limited to a
real-world calendar.

> [Owner, wörtlich zu 2] ja, events wie feiertage oder sowas sollten im
> kallender angelegt werden können. Sie sollten zeit und ortsgebunden sein
> können.

The GM can author calendar events such as holidays. An event may be bound to a
time, a place, or both and becomes relevant to a Running Scene according to that
Scene's time and location. It informs the GM or offers prepared content without
automatically deciding narrative consequences.

> [Owner, wörtlich zu 3] ersteres. Sie sind die Grundlage für Fraktionen und
> anderes.

Named, GM-editable Encounter Tables with weighted Monster or group entries are
a real Campaign concept. Factions, places, and other context reference those
tables as a foundational source for Encounter candidate pools and generation;
contextual tags and other factors may further influence selection.

> [Owner, wörtlich zu 4] nein

SaltMarcher does not provide a general-purpose GM dice roller. The GM continues
to roll ordinary table dice physically; generators and simulations may use
internal randomness for their own automatic behavior.

> [Owner, wörtlich zu 5] ja, alle für automatische systeme relevanten stats
> müssen getrackt werden.

A PC record tracks every structured statistic required by enabled automatic
systems, including applicable level, XP, current and maximum HP, movement, and
senses. Only the name remains universally required; a specific automatic
workflow may require its relevant optional statistics before it can run. This
does not turn SaltMarcher into a complete character-sheet, spell, class-feature,
or rules-complete equipment manager.

## Confirmed Consolidated Interpretation

The owner confirmed this complete interpretation on 2026-07-23. It is the
evidence promoted into the draft Program Capability Requirements. It
establishes program-wide observable qualities and product boundaries without
choosing architecture, storage, frameworks, extension technology, or delivery
order.

1. The complete local GM core works offline when its required rules, media, and
   Campaign data are present locally. Network use occurs only through explicit
   imports, downloads, GM-approved extension permissions, or future online
   capabilities.
2. Ordinary live-play actions respond without perceptible delay. Longer
   generation, import, and simulation work is visible, cancellable, and runs
   without making the Running Scene unusable.
3. Failure of supporting music, weather, maps, generation, or World progression
   affects only that capability. Running Scenes, Encounters, manual editing,
   and preservation of confirmed work remain usable, with a clear error and
   retry for the affected function.
4. SaltMarcher supports practically large, long-lived Campaigns without
   artificial content limits. Under exceptional load it degrades predictably
   instead of truncating data or failing unpredictably. Representative scale
   and response budgets are derived later through realistic scenarios and
   tests.
5. Capability areas can be added, omitted, removed, or replaced without
   breaking unrelated workflows or Campaign data. New runtime masks, content
   kinds, influences, and supporting systems can integrate without rebuilding
   existing features.
6. Cancellation or failure of a long operation keeps only independently
   accepted results. Unconfirmed partial results are discarded cleanly.
7. If new work cannot be persisted safely, SaltMarcher reports that immediately
   and never presents it as stored. Safe reading, export, and retry remain
   available.
8. Application updates preserve Campaigns and resumable runtime state. A failed
   data conversion leaves prior data untouched and usable with the prior
   application version.
9. Damage to one record does not prevent the remaining Campaign from opening.
   SaltMarcher isolates and identifies the record and offers recovery or
   explicit deletion.
10. Data belonging to a disabled, missing, or temporarily unavailable
    capability remains intact, stays in complete exports, and becomes usable
    again when the capability returns.
11. Linux, Windows, and macOS are supported desktop targets with portable
    Campaign behavior across them.
12. SaltMarcher runs fluidly on an ordinary current laptop without a dedicated
    GPU or server hardware. Resource-intensive simulation adapts to available
    resources rather than blocking live play.
13. The GM installs a self-contained desktop application without separately
    administering a database server, web server, runtime, or other
    infrastructure.
14. One local GM is the sole Campaign writer in the confirmed core. The passive
    second display reads live state; concurrent multi-process, multi-computer,
    or multi-user Campaign editing is not required.
15. Campaign data, notes, maps, images, audio, and usage data leave the computer
    only through a concrete, understandable GM action. There is no mandatory
    cloud dependency, hidden upload, or telemetry enabled by default.
16. D&D 5e 2014 is the only binding core rules profile. Supporting several D&D
    versions or other game systems is parked as very late quality-of-life work
    and does not require a generic multi-system core now.
17. The interface is localizable for additional languages. Campaign-authored
    text remains arbitrary user content independent of interface language.
18. The complete core supports keyboard operation, scalable text and
    interface, sufficient contrast, and information which does not rely on
    color alone. These alternatives do not clutter the default interface or
    slow its low-friction workflows.
19. The interface remains usable at common laptop resolutions, on high-density
    displays, and across multiple monitors. Touch, mobile, and smartphone
    layouts are not core targets.
20. The GM can install third-party extensions, plugins, or scripts. Each is
    installed explicitly and discloses requested Campaign-data, file, network,
    and other access before activation.
21. Extensions have no default network or unrestricted file access. Additional
    permissions require explicit GM consent.
22. A faulty, damaged, missing, or update-incompatible extension is disabled
    and identified without preventing SaltMarcher or the Campaign from opening.
    Its data remains intact and an application update does not let it rewrite
    Campaign data because compatibility failed.
23. Extensions may add content kinds, runtime masks, generators, importers, and
    presentations. They cannot silently bypass explicit deletion, local data
    control, truthful history, or other confirmed safety boundaries.
24. Each Campaign has a configurable fantasy calendar with authored month
    lengths, day length, weekdays, and year counting.
25. The GM can author calendar events such as holidays. Events may be bound to
    time, place, or both and become relevant according to each Running Scene's
    time and location without automatically deciding narrative consequences.
26. Named, GM-editable Encounter Tables contain weighted Monster or group
    entries. Factions, places, and other context use them as foundational
    sources for Encounter candidate pools and generation, alongside applicable
    contextual influences.
27. SaltMarcher has no general-purpose GM dice roller. Ordinary table dice stay
    physical; automatic generators and simulations may use internal randomness.
28. A PC tracks every structured statistic required by enabled automatic
    systems. Only its name is universally required; an automatic workflow may
    require its relevant optional statistics before running. SaltMarcher does
    not thereby become a complete character-sheet or rules-complete inventory
    manager.

Workflow 7 and the repository-inventory completeness audit are confirmed. All
seven interview workflows now have owner-confirmed interpretations. The draft
Program Capability Requirements still require one final whole-baseline
consistency review and owner confirmation before becoming the active target for
technical-needs derivation.

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Confirmed Session And Scene Preparation](2026-07-22-session-and-scene-preparation.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Confirmed Spatial Travel And Progression](2026-07-22-spatial-travel-and-progression.md)
- [Confirmed Follow-Up, Progression, And History](2026-07-22-follow-up-progression-and-history.md)
- [Confirmed Local Data Lifecycle](2026-07-23-local-data-lifecycle.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
- [Project Vision](../../vision.md)
- [Project Roadmap](../../roadmap.md)
