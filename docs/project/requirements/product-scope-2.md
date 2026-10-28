# SMR-07 – Reise, Kalender und autoritative Zeit

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: project
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

### SMR-07 – Reise, Kalender und autoritative Zeit

- Kalender-/Zeitkern und providerneutrale Reise parallel entwickeln. Kalenderregeln
  warten nicht auf die fertige Reise; autoritative Scene-Zeit konsumiert den
  bestätigten Scene-/Owner-/Publishvertrag. Bestehenden Fachbesitz in [Campaign-Datenvertrag](../../campaign/contract/archive.md) erhalten.
- Den realen Sceneweg liefern: vollständige/partielle PC-Gruppe wählen → Ziel oder
  geordnete Wegpunkte auswerten → ausdrücklich reisen → am Checkpoint pausieren/
  inspizieren/fortsetzen oder abbrechen → frisch öffnen. Ortswechsel der kompletten
  Gruppe erhält die Scene, Teilgruppenwechsel erstellt/betritt eine andere; Suborte
  verfeinern nur die Position. Administrative Platzierung ist keine Reise und
  erzeugt keine automatische Zeit-/Eventwirkung. Position und Scene-Zeit committen
  gemeinsam; Präsentationsgeschwindigkeit ändert nicht die In-World-Dauer. Faktor-
  und Enddaueroverride zeigen, Enddauer gewinnt. Provider validieren reale Hex-/
  Dungeon-/Atlasfakten; kein paralleler Route-/Positionstore. Cross-map-Routing
  bleibt optionale spätere Bequemlichkeit.
- Event, Trap, relevante Spur oder entdeckter NPC hält vor weiterem Routefortschritt
  zur GM-Inspektion an; keinen Encounter automatisch starten. Tracks aus bestätigter
  Bewegung mit Quellen-/Zeit-/Richtungsfakten erzeugen, einzeln korrigieren/
  unterdrücken und zeitabhängig verfallen lassen. Entdeckung per bestätigtem
  Perception/Survival-/GM-Ergebnis; segmentweise Verfolgung stoppt bei verlorener
  oder mehrdeutiger Spur. Fehlende optionale PC-Werte sperren nur die benötigte
  Automatik, nicht manuelle Reise oder andere PC-Funktionen.
- Gerichtete Wahrnehmung und dauerhaftes Wissen getrennt führen: D&D-2014-Sinne,
  Licht/Sichtlinie/Distanz/Deckung/Höhe, Wetter und Schall konsumieren bestätigte
  Raum-/Umweltfakten. Aktives GM-Ergebnis und Known/Unknown-Override bleiben bis
  ausdrücklicher Freigabe/Neubewertung wirksam. Neue Partygefahr pausiert Route und
  betroffene Autonomy vor Auflösung. Dieselben Fakten liefern anschließend die
  sichere Anzeige in SMR-10; unabhängige Wissens-/Spurinspektion bleibt möglich.
- Kampagnenkalender mit Monats-/Tageslängen, Wochentagen und Jahreszählung bearbeiten,
  Feiertag/Event an Zeit und/oder Ort binden → Relevanz in zwei unterschiedlich
  fortgeschrittenen Scenes sehen → speichern/frisch öffnen. Eventrelevanz ist pro
  Scene zu bewerten, bestätigte gemeinsame Worldfolge dagegen exakt einmal bei
  Retry/Restart/Catch-up. Frühere Zeitkonflikte warnen, bleiben erlaubt und sichtbar
  bis ausdrücklicher Auflösung; keine narrative Entscheidung oder globale Zeit-
  Rückabwicklung. Mehrstufiges kausales Reise-Undo/Redo erhält spätere fremde Fakten.
  Quellen: Hex/Dungeon Travel und State, SRC-T01–04/Q05, TN-08–14/23/24;
  [Campaign-Datenvertrag](../../campaign/contract/archive.md); [LiveScene-Vertrag](../../runtime/contract/smr03-live-scene-contract.md); [Atlasstand](../../atlas/requirements/atlas.md); [Dungeonanforderungen](../../dungeon/requirements/smr04-spatial-coverage.md), SMR-AC-08/09. UI, erforderliche Persistenz und Consumeranschluss
  gehören zum selben Ergebnis, nicht nur ein Clock-/Providerport.

### SMR-08 – Shops, Wetter und Musik

Drei eigenständige Produktlieferungen verbinden sich über bestätigte
World-/Scene-/Zeitprojektionen. Die Quellen sind [SRC-P04/L03/L04/T05/S01–03](sources.json)
auf SaltMarcher `9de85c1a26f526acbc1af332ac5962e185c0aab2`, TN-14/25/26.
Konkrete Datenverträge stehen im [Campaign-Datenvertrag](../../campaign/contract/archive.md), Hostgrenzen in [Plattform-ADR](../architecture/platform-decision.md).

- **Shops / SMR-AC-10:** genau einen NPC-/Ortowner und Stock/Preise bearbeiten,
  Scenezugriff herstellen, Kauf/Verkauf atomar mit Charakterledger verbinden;
  keine automatische Münzabbuchung. Danach manuellen, festen oder gewichteten
  Restock an Kalender/Zeit binden. Owner-Trash/Restore, Retry, Undo und Neustart
  müssen Bestand und Ledger gemeinsam erhalten.
- **Wetter / SMR-AC-11:** Kartenfallback und regionale Klimazonen bearbeiten;
  saisonale Baselines und kohärent bewegte Phänomene aus Ort/Terrain/Klima und
  autoritativer Scene-Zeit ableiten. GM kann Wetterereignisse mit Gebiet,
  Intensität, Bewegung, Dauer, Notizen und Effekten anlegen/pausieren/ändern/beenden.
  Kein Sessionplan oder Generator ist Voraussetzung. Der Wetterowner muss vor
  Qualifikation Modell, räumlich/zeitliche Auflösung und maximale Änderungen
  pro Schritt bestätigen (TN-25); diese Entscheidung ist noch kein gelieferter
  Algorithmus. Gleiche etablierte Inputs verwenden dasselbe Ergebnis; Sprünge
  brauchen explizite Ursache. Getrennte Scene-Zeiten, regionale Kontinuität,
  Override bis Freigabe und Restart prüfen. Strukturierte Sicht-/Reise-/
  Perception-/Temperatur-/Ambienceeffekte an Consumer liefern; relevante Meldung
  bleibt bis Wetterende/Dismiss, stoppt Reise nicht selbst. Kampfhinweise
  bleiben GM-Auflösung. Keine zweite WorldClock oder Live-Wettersimulation im
  wall-clock-Hintergrund erfinden.
- **Musik / SMR-AC-12:** lokale portable Songs hinzufügen, Mood/Intensity/
  Vibe/Genre bearbeiten/suchen und über tatsächlichen Audioport abspielen;
  manuelle Queue, Auswahl, Stop/Skip/Back, Loop und Fade samt durable Entscheidungen
  bis Reopen/Complete-Transfer verfolgen. Beschädigte/langsame/fehlende Medien
  isolieren; Scene, Bearbeitung und Speicherung laufen weiter. Moodachsen und
  Kategorisierung bleiben Produktprüfung, keine erfundene Taxonomie.
  Den [vorhandenen Vertragskandidaten](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/codex/smr-08-music-library-contract/ROADMAP-SALTMARCHER-SMR-08-MUSIC-LIBRARY-PLAN.md)
  konsumieren; er liefert noch keinen Player und keine Hostfreigabe. Bibliothek
  und manueller Player benötigen keinen Reise-/Wetterabschluss.
  Danach optionalen Autoplay an die fokussierte Scene und ihre Sliders/
  Inhalts-Tags binden; Kontextwechsel aktualisiert Queue und blendet unpassende
  Songs aus. Umwelt-/Wetterlayer automatisch mischen; GM kann Sounds hinzufügen
  oder unterdrücken. Manuelle Entscheidungen bleiben vorrangig bis Ende/
  Freigabe; Automatik setzt aus **aktuellem** Kontext fort. Fokuswechsel,
  stale Antworten, Campaignwechsel, Overridefreigabe und Neustart direkt prüfen;
  konkrete Cursor-/Transport-Recovery nach bestätigt vorhandenem Vertrag,
  nicht aus einem Bibliotheks-/Medieninventar-PASS ableiten.

Ortsverschachtelung liefert Wetter-/Musik-/Ambiencefaktoren über bestätigte
Readonly-Projektionen: je Faktorgruppe additiv (Default) oder ausdrücklich
ersetzend. SMR-07 bindet Zeitfolgen, SMR-01 Speicher-/Importautorität; SMR-04
liefert räumliche Eingänge. Domäne/Bearbeitung können parallel entstehen;
produktive abhängige Wirkung wartet auf diese konkreten Ports. E2E-03 verbindet
Reise → Zeit → Wetter/Shops/Musik; seine Kurzfassung ersetzt keine der drei
Fachabnahmen und rechtfertigt keinen eigenen Shop-/Wetter-/Music-Snapshotstore.

### SMR-09 – Actor Autonomy

- GM aktiviert einen bestehenden NPC/eine Gruppe, konfiguriert Bedürfnisse,
  Prioritäten und Konsequenzgrenzen und weist einen erreichbaren Job zu. Needs,
  World-/Raumangebote, Routen und exklusive Reservierungen führen zur erklärbaren
  deterministischen Jobwahl; ungültige Ziele betreffen nur ihre Jobs. Keine neue
  Actoridentität, Autoreninhalte oder autonome Partyentscheidung.
- Bestätigte Campaignzeit konsumieren → Job/Bewegung/Owneroperation ausführen →
  Resultat im realen Kontext inspizieren → Pause/Cancel/Override → frisch öffnen.
  Gruppenwechsel erhalten Individuen; unterbrochene Jobs resumieren nur bei gültigen
  Voraussetzungen. Kein wall-clock-/Downtimefortschritt. Raum, Perception, Traps,
  Inventory und Actorfolgen bleiben bei ihren Ownern; fehlende Operation macht
  einen Job unzulässig statt eine fremde Wahrheit zu kopieren.
- Vor Partygefahr/GM-Entscheidung pausieren und passenden Kontext anzeigen.
  Begrenzte Nicht-Party-Konflikte dürfen abstrakte D&D-2014-Würfe verwenden;
  Inputs/Würfe/Folgen dauerhaft loggen und konfigurierte Schutzgrenzen respektieren.
  Deterministische Jobwahl ist keine Behauptung deterministischer Zufallskonflikte.
- Ein Zeitschritt publiziert alle betroffenen Folgen atomar oder keine; fehlgeschlagene
  Ownerwirkung erhält die vorige bestätigte Zeit. Cancel vor Commit ohne Wirkung,
  danach Korrektur durch Owneroverride mit verlinktem Log, kein Runtime-Undo.
  Inaktive Kontexte holen bestätigte Zeit genau einmal nach und stoppen vor dem
  ersten GM-Entscheidungspunkt. Sichtbare Jobgründe und kompakte Konfliktfolgen
  liefern, vollständige Kandidatenauswertung nicht als permanente Historie anhängen.
  200 Akteure, ≤2 s p95, Fortschritt ≤100 ms und passende Cancel-/Kamerafreiheit
  nach Quellbedingungen qualifizieren. Quelle: Actor Autonomy Requirements;
  [Campaign-Datenvertrag](../../campaign/contract/archive.md), SMR-AC-13. Domäne/Jobangebote parallel entwickeln; produktive Steps benötigen
  konkrete Scene-/Zeit-/Owner-/Publishports, nicht den Abschluss aller Reisefunktionen.

### SMR-10 – Zweites Display, Extensions und vollständige Portabilität

- P03-Beweiskanal an echte Scene-/Kenntnis-/Perceptionprojektion anschließen:
  fokussierte Scene zeigt freigegebene Karte/Art, GM kann blanken/ersetzen;
  Secrets/Mechanik bleiben unsichtbar, auch nach Fokuswechsel und Restart.
  Der synthetische Fensterprototyp ist ein Eingang, keine Produktanzeige-Abnahme.
- Wissen pro Charakter, aktuelle Sicht und rein temporäre GM-Anzeigeentscheidung
  auseinanderhalten. Travelmap zeigt bekannte Geometrie getrennt von aktuell
  sichtbaren Details; Orte zeigen Art, NPC-Art nur ausdrücklich hervorgehoben
  beziehungsweise im bestätigten Encounter-/Chase-Automatikscope. Split/Fokuswechsel,
  manuelles Reveal/Hide/Blank und Reopen dürfen kein fremdes Scenewissen, Secrets
  oder nicht wahrgenommene Live-Details offenlegen; Präsentationsoverride verändert
  keine Discoverywahrheit. Quellkonflikt in #44; [Plattform-ADR](../architecture/platform-decision.md); [Campaign-Datenvertrag](../../campaign/contract/archive.md): Dungeon Travel nennt
  komplette Partyunion/Explorationkamera, SRC-L05/T04 fokussierte Sceneunion.
  Nicht beide Filter zugleich als Sicherheitsvertrag freigeben; P03 liefert nur
  den Beweiskanal, nicht diese Fachentscheidung. SMR-AC-14/TN-24 bleibt separat.
- Interne Extension-Grenze mit Default-Deny, Einwilligung und Widerruf bauen;
  Host-Erweiterungen nicht als sichere Sandbox voraussetzen.
- Tatsächliche Erweiterung installieren → Rechte bestätigen → Inhaltsart/Maske/
  Generator/Importer/Präsentation konsumieren → Fehler, Remove/Replace/Restore
  prüfen. Ausfall deaktiviert nur die betroffene Capability; opaque Daten und
  unabhängige Kampagnenabläufe bleiben erhalten. Quellen: Program Capabilities
  „Modular Change“, TN-27–30; [Plattform-ADR](../architecture/platform-decision.md), SMR-AC-14/15/16.
- Kompletten Current-Format-Roundtrip, beschädigte Daten, unbekannte Felder und
  plattformübergreifende Assets prüfen.

### SMR-11 – Tutorial, A11y, Performance und Abschluss

- Featurequalität mit jeder nutzbaren Lieferung umsetzen; dieser Abschluss
  bündelt die noch offenen Gesamt-/OS-/Lastbeweise.
- Ergänzende Informationen und Aktionen in World, Planung, Party und Kampf
  ohne Kontextverlust erreichen und verlassen; Tastaturfokus nachvollziehbar
  führen und Aktionen auch bei langen Inhalten erreichbar halten. HP, XP und
  Rastbudget ablesen sowie Änderungsbeträge vor der Übernahme prüfen können.
  Die konkrete Oberflächenform folgt den [Produktzielen](product.md).
- Feature-/Versions-Tutorials, Lokalisierung, Tastatur, 100 %, Kontrast und
  Nicht-Farb-Signale vollständig qualifizieren.
- Latenz-, große Daten-, Speicher-, Abbruch-, Offline- und Privacy-Gates gegen
  Program Technical Needs prüfen.
- Gesamtqualifikation samt erforderlicher unabhängiger Prüfung,
  gezielter Nachbesserung und Bereinigung zusammenführen. Keine zusätzliche
  betroffenen Fach-/Hostprüfungen; fehlende Abnahmen bleiben offen.

Die erklärbare Kampagnenhistorie verbindet SMR-01/03/05/07–09: bestätigte Zeit-,
Reise-, Encounter-, XP-, Party- und manuelle Worldfolgen im laufenden Produkt
inspizieren; Korrekturen verlinkt anhängen und frisch öffnen. Kein Vollsnapshot-
Replay, Rückdatierung löscht keine etablierten Fakten. Ownergrenzen und die enge
kausale Reise-Undo-Ausnahme bleiben erhalten. Quelle: Program Capabilities
„Explanatory Campaign History“, SRC-C04/TN-06; [LiveScene-Vertrag](../../runtime/contract/smr03-live-scene-contract.md); [Campaign-Datenvertrag](../../campaign/contract/archive.md), SMR-AC-04/06/09.

## Abhängigkeiten und Parallelität

- `SMR-00-ADR-01` ist Voraussetzung für neue hostspezifische Kopplung; reine
  Domänen-, Daten- und Vertragsarbeit darf parallel weiterlaufen.
- Schreibende Bereiche benötigen den konkret konsumierten SMR-01-Identitäts-,
  Owner- und Publish-/Recoveryvertrag, nicht den Abschluss aller SMR-01-Funktionen.
  Fehlende Autorität sperrt produktiven Publish; kompatible Implementierung im
  eigenen Scope läuft weiter. Modell-/Portbelege sind keine Speicherfreigabe.
- `SMR-02` und `SMR-04` dürfen nach dem Quellenvertrag parallel laufen.
- `SMR-03` benötigt Kampagnenidentität und World-Referenzen.
- `SMR-05` benötigt Katalog und Party/Scene. Manuelles `SMR-06` benötigt Campaign
  und seinen eigenen Schreibvertrag; Orte sind optional. Erst die
  Encounter-/Reward-Generierung benötigt zusätzlich Party, Encounter und Loot.
- Reise in `SMR-07` benötigt Scene, Kartenposition und den Zeitport; Kalenderregeln
  benötigen keinen abgeschlossenen Reiseablauf. Autoritative Scene-Zeit braucht
  ihren konkreten Scene-/Owner-/Publishvertrag. Restock, zeitabhängiges Wetter und
  Autonomie konsumieren diesen Port, nicht den Abschluss sämtlicher Reisearbeit.

- Pro Gerät läuft höchstens eine grafische Host-/Originalinstanz. Statische
  Analyse und nichtgrafische Basisprüfungen dürfen getrennt laufen.

## Nichtziele

- Kein eigenständiges Altprodukt unter der Marke SaltMarcher. Ob das
  Zielprodukt Plugin, Desktop-App oder Hybrid wird, entscheidet
  `SMR-00-ADR-01`; parallele dauerhafte Produktlinien bleiben Nichtziel.
- Kein Remote Play, Player-Control, Dice Chat, allgemeiner Dice Roller,
  Multiuser-Editing oder Mobile-/Touch-Core ohne neuen Nutzerauftrag.
- Keine automatische Migration alter Pluginformate nur wegen historischer
  Existenz. Jede Übernahme braucht aktuellen Vertrag, gezielte Migration und
  belegte Abnahme.

## Offener Produktstand

Die [Atlasübersicht](../../atlas/requirements/atlas.md#atlas-auf-einen-blick) und [Produktroadmap](../delivery/roadmap.md) zeigen den fachlichen Stand und die Abhängigkeiten. Konkrete Restbedarfe und Kandidaten bleiben in den Produktissues und PRs; dieses Portfolio erteilt keine weiteren Arbeitsaufträge.
