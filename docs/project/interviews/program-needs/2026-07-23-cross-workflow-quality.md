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

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Confirmed Session And Scene Preparation](2026-07-22-session-and-scene-preparation.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Confirmed Spatial Travel And Progression](2026-07-22-spatial-travel-and-progression.md)
- [Confirmed Follow-Up, Progression, And History](2026-07-22-follow-up-progression-and-history.md)
- [Confirmed Local Data Lifecycle](2026-07-23-local-data-lifecycle.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
