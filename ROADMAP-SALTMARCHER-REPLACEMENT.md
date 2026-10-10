# Vollständige SaltMarcher-Ablösung im gemeinsamen Zielprodukt

Stand: 9. Oktober 2026. Direkter Nutzerauftrag: SaltMarcher ist als
eigenständiges Produkt vollständig abgelöst. Das in diesem Repository
fortgeführte Zielprodukt übernimmt nicht nur bereits implementierte Funktionen,
sondern auch den bestätigten und geplanten Gesamtumfang. Das Endergebnis ist
ausdrücklich nicht an Obsidian als Laufzeit oder Pluginformat gebunden. Die
UX- und Funktionsvorgaben sind verbindlich; die Plattform und technische
Ausprägung bestimmt das Team in einem eigenen, belegten Architekturentscheid.
SaltMarcher bleibt Produktwahrheits-, Daten- und Verhaltensquelle; seine
Electron-, Java-, JavaFX-, JDBC- und frühere Obsidian-Architektur sind keine
Zielarchitektur und kein Merge-Vertrag.

## Quellenhierarchie

1. `docs/project/vision.md`,
   `docs/project/requirements/requirements-program-capabilities.md`, alle
   aktuellen `docs/**/requirements/*.md`, bestätigte Acceptance-Fälle,
   statische Katalogdaten, Referenztabellen und Golden Master im Repository
   `ThonkTank/Salt-Marcher` sind die fachliche Wahrheit.
2. `docs/project/architecture/program-technical-needs.md` bindet die
   Qualitäts-, Sicherheits-, Skalierungs-, Barrierefreiheits- und
   Reproduzierbarkeitsanforderungen.
3. Aktueller SaltMarcher-Produktcode ist Verhaltens- und Testreferenz. Die
   letzte vollständige JavaFX-Dungeon-Linie `javafx-final-2026-07-27` und
   historische Obsidian-Stände dürfen nur gezielt als Orakel, Fixture- oder
   UX-Quelle verwendet werden.
4. Die Architektur dieses Repositories ist die gegenwärtige
   Implementierungsbasis, aber keine Vorentscheidung für den finalen Host.
   Electron Main/Preload/IPC/Installer/Handoff, JavaFX/JDBC, Obsidian-Grenzen
   und alte Plugin-Bundles werden nur nach dem Plattformentscheid gezielt
   übernommen, ersetzt oder durch Adapter isoliert.

Jeder Lauf hält die verwendete SaltMarcher-Revision, konkrete Quelldokumente,
übernommene Daten/Fixtures, bewusst nicht übernommene Hostarchitektur und
verbleibende Abweichungen in `checkpoint.json` und `acceptance.json` fest.

## Gesamtumfang

| Bereich | SaltMarcher-Stand | Ziel im gemeinsamen Produkt | Hauptquellen |
| --- | --- | --- | --- |
| Kampagnen und Datenlebenszyklus | produktiv/teilweise | Kampagnen anlegen, wechseln, umbenennen, wiederherstellbar löschen, dauerhaft löschen, kopieren, importieren/exportieren und nach Absturz exakt fortsetzen | `docs/campaign/requirements/requirements-campaign-management.md`, Program Capabilities |
| Katalog und Referenzgraph | teilweise produktiv | installationweite Creatures/Items/Rules; kampagneneigene PCs, NPCs, Orte, Fraktionen, Quests, Gerüchte und Besitz; Duplikatnamen, Notizen, Suche und historische Snapshots | `docs/catalog`, `docs/creatures`, `docs/items`, `docs/reference` |
| World Planner | teilweise produktiv | NPCs, Orte, Fraktionen, Beziehungen, Quests und Gerüchte note-first verwalten und aus Scenes ausdrücklich anlegen | `docs/worldplanner/requirements/requirements-world-planner.md` |
| Party und Adventuring Day | produktiv/teilweise | Roster, Profile, Mitgliedschaft, XP, Rest, Budget, Historie und vollständige Reconciliation | `docs/party/requirements` |
| Scenes und Live Session | teilweise produktiv | dauerhafte Primary Scene, Split/Rejoin, PC-Zuordnung, gepinnte Inhalte, mehrere Encounter-/Chase-/künftige Masken und kontinuierlicher Lauf | `docs/scene`, `docs/session` |
| Encounter und Combat | produktiv/teilweise | Tabellen, Pläne, Builder, Initiative, HP, Zustände, Konzentration, Runden, Undo, Auflösung und XP im D&D-2014-Vertrag | `docs/encounter`, `docs/encountertable` |
| Loot und Rewards | produktiv/teilweise | Generierung, Schätze, Gruppenloot, Verteilung, Ledger, Provenienz, Korrekturen und Quest-/Shop-Kopplung | `docs/loot/requirements/requirements-loot.md` |
| Hex, Dungeon, Städte und Karten | mehrere aktive Plugin-Roadmaps | ein gemeinsamer grenzenloser Atlas vom Welt-Hex bis Haus-Dungeon; direkte Bearbeitung, stabile Identitäten, Revisionen, History und geschützte Daten | `docs/hex`, `docs/dungeon`, `docs/maps`; bestehende lokale Paritäts-/Atlas-/Stadtroadmaps |
| Session Planner und Generierung | produktiv/teilweise | Timeline, erwartete Party, bindende World-Inhalte, gestufte reproduzierbare Generierung, individuelle Annahme/Neugenerierung und Platzierung | `docs/sessionplanner`, `docs/sessiongeneration`, Encounter Generation |
| Reise | produktive Grundlage, Gesamtvertrag offen | provider-neutrale Hex-/Dungeon-/Atlas-Reise, Partyposition außerhalb der Karte, Preview/Confirm, Zeitfortschritt, Ereignisse, Unterbrechungen, Tracks und kausales Undo | `docs/hex/requirements/requirements-hex-travel*.md`, `docs/dungeon/requirements/requirements-dungeon-travel*.md`, Program Capabilities |
| Kalender und Weltzeit | geplant; historische Almanac-Ideen | pro Kampagne konfigurierbarer Kalender, unabhängige Scene-Zeiten, orts-/zeitrelevante Events und exakt einmal angewandte gemeinsame Folgen | Program Capabilities: Calendar/Time |
| Shops und Handel | geplant | genau einem NPC/Ort gehörender Bestand, Preise, Scene-Verfügbarkeit, atomarer Handel/Ledger, Restock nach Zeit/Kalender und History | Program Capabilities: Shops And Trade |
| Wetter und Klima | geplant; historische Phänomen-Ideen | regionale kontinuierliche Entwicklung aus Ort, Terrain, Klima und Scene-Zeit; strukturierte Effekte, GM-Override und Fehlerisolation | Program Capabilities: Weather |
| Musikbibliothek, Player und Ambience | geplant | lokale portable Songs mit Mood/Intensity/Vibe/Genre, Scene-Queue, Fade, Autoplay sowie vorrangige manuelle Queue-/Loop-/Transportsteuerung | Program Capabilities: Music And Notes |
| Actor Autonomy | geplant | ausdrücklich aktivierte, begrenzte NPC-/Monsterbedürfnisse, Arbeit, Wahrnehmung und Konflikte; pausierbar, atomar, erklärbar und einmaliges Catch-up | `docs/autonomy/requirements/requirements-actor-autonomy.md` |
| Passives zweites Display | teilweise produktive Referenz | fokussierte Scene, sichere Karte/Art und nur freigegebene Spielerinformationen; keine privaten Notizen oder Mechanikdetails | Scene/Live-Session-Anforderungen, Program Technical Needs |
| Extensions | geplant | explizite Identität, Default-Deny-Fähigkeiten, präzise Einwilligung, Widerruf, Sink-Prüfung, Fehlerisolation und erhaltene opaque Daten | Program Capabilities: Extensions; TN-27 bis TN-31 |
| Tutorials, Lokalisierung und A11y | teilweise/querliegend | Tutorial je Feature/Version, Skip/Dismiss, Tastatur, 200 %, Kontrast, Nicht-Farb-Signale und vollständige UI-Texte | Program Technical Needs |
| Performance, Offline, Privacy und Provenienz | teilweise/querliegend | lokale Offline-Nutzung ohne versteckten Egress, reproduzierbare Regeln, messbare Latenz-/Skalierungsgrenzen, portable Assets und nachvollziehbare Entscheidungen | Vision; Program Technical Needs |

## Lieferphasen

SMR-00–11 sind Fachfolgen mit eigenen Abnahmen, keine globale serielle
Implementierungsfolge. Die [gemeinsame Lieferroadmap](docs/ROADMAP.md#parallele-umsetzung-und-zusammenführung)
führt ihre parallel umsetzbaren Nutzerergebnisse und Zusammenführungen;
aktuelle Aufgaben und Besitz stehen an den dort verlinkten Arbeitsorten.

### SMR-00 – Portfolivertrag und Quelleninventar

- Quellenumfang und betroffene Acceptance-Zuordnung am konkreten Produktpaket
  prüfen; den bestehenden Quellenabgleich verwenden.
- `SMR-00-ADR-01` entscheidet anhand der UX-/Funktionsvorgaben über Zielhost,
  Verteilung, Datenbesitz, Erweiterbarkeit und den Migrationspfad. Mindestens
  Obsidian-Plugin, eigenständige Desktop-App und ein schrittweise entkoppeltes
  Hybridmodell werden mit prototypischen Risikobelegen verglichen.
- Der vorgeschlagene Entscheid samt Beweis- und Ratifikationskriterien steht in
  [`ROADMAP-SALTMARCHER-PLATFORM-ADR.md`](ROADMAP-SALTMARCHER-PLATFORM-ADR.md).
- Bis zur Entscheidung bleiben neue Domänenlogik und Produktverträge
  hostneutral; bestehende Plugin-Arbeit wird nicht verworfen.
- Für jeden Bereich aktuelle Produktquelle, Verhaltensreferenz, Datenquelle,
  Nichtziel und zuständige lokale Roadmap festhalten.
- Historische Obsidian-Stände nur dateiweise inventarisieren; kein Whole-Branch-
  Merge oder Cherry-pick.

### SMR-01 – Kampagne, Identität und Datenlebenszyklus

- Lokale Kampagnenidentität, atomare Writes, Autosave, Restart, Trash,
  Restore, permanente Löschung, Backup und Recovery definieren.
- Geschlossene Import-/Export-Einheit einschließlich Assets, Definitionen,
  Runtime, Trash und unbekannten zukünftigen Daten entwerfen.
- Bestehende Dungeon-/Atlasdateien ohne stillen Formatwechsel erhalten.

### SMR-02 – Katalog, Referenzgraph und World Planner

- Laufende `CE-01` bis `CE-02` Katalogarbeit abschließen.
- Items, PCs/NPCs, Orte, Fraktionen, Quests, Gerüchte, Besitz, Notizen und
  Referenzgraph als getrennte, stabile Dokumente ergänzen.
- Manuelle World-Inhalte parallel zur Katalogfolge liefern; der vollständige
  Itemkorpus ist nur für seine tatsächlichen Itemverbraucher Voraussetzung.
- Aktuelle Definition und eingefrorene historische Verwendung trennen.

### SMR-03 – Party, Scene und Live Session

- Roster/Charakterprofile und Adventuring Day integrieren.
- Primary Scene, Split/Rejoin, PC-Zuordnung, Fokus und generische Maskenbasis
  etablieren. Scene bleibt über Encounter, Chase, Reise und Pausen bestehen.

### SMR-04 – Gemeinsamer Atlas und Karten

Der Produktweg ist **Hex → Ort/Stadt → Haus/Dungeon → Raum-Key → zurück**,
ausschließlich durch Zoom auf einer bearbeitbaren Fläche. Ein verorteter
Marker, ein isolierter CityRenderer oder ein Dungeoneditor allein genügt nicht.

1. HEX-04 bindet bestehende Dungeonidentität, lokalen Eingangsanker,
   Weltposition, Drehung und realen Maßstab; HEX-05 zeigt und bearbeitet
   dessen Geometrie und Keys im Atlas. CITY-01/02 liefern zeichnbare und
   reproduzierbar generierte Städte; CITY-03 komponiert Stadt-, Gebäude- und
   Dungeontransformationen. Vorhandene Sources/History konsumieren, kein
   zweiter Atlas oder Stadt-/Dungeonmodus.
2. Die gemeinsame Kamera, Auswahl und Werkzeugwahl durch alle Zoomstufen,
   gemischtes Undo/Redo und Mehrowner-Save/Fresh-Reopen/Recovery qualifizieren.
   Elternbewegung ändert keine lokalen Räume/Keys; stale Sources, externe
   Konflikte und kaputte Bindungen verlieren keine Texte. HEX-22 erweitert
   denselben Weg auf mehrere Detailkarten, große/negative Räume und Streaming.
3. CITY-04–09 liefern geschützte Regeneration, Innenräume/Dekoration,
   Bewohner/Haushalte/Berufe/Beziehungen/Fraktionen, Tagesabläufe und Ausgabe.
   CITY-Zeitfunktionen konsumieren SMR-07, keine eigene SceneClock. Die volle
   Wonderdraft-, Dungeondraft- und Dreiprodukt-Stadtinventur samt Originalbelegen
   bleibt verpflichtend, auch wenn der erste gemeinsame Weg funktioniert.
4. Zusätzlichen Dungeonumfang im selben Raum anschließen: [3D-Volumes →
   Room-Lifecycle → Paths/Passages](docs/plans/dungeon/smr04-spatial-coverage.md),
   Graph-Entwurf/geschützte Vorschau, Attributvererbung/Templates/Beschreibungen,
   Trap-Trigger/Charges/Reset und Dokument-/Paketausgabe. Reise, Playeranzeige
   und Autonomy konsumieren bestätigte Raum-/Passage-/Runtimefakten; fehlende
   Schema-/Transferentscheidungen aus #44 bleiben offen.

Arbeitsorte: [HEX-Meilenstein B](ROADMAP-HEX-ATLAS.md#meilenstein-b--hex--ort--dungeon--raum-key--zurück),
[CITY-01–09](ROADMAP-CITIES-IMPLEMENTATION-PLAN.md#technische-arbeitspakete),
#7/#8/#44. Direkte Endabnahme SMR-AC-05; E2E-01 prüft den gemeinsamen
Integrationsweg, nicht automatisch die gesamte Karten-/Stadtfunktion.

### SMR-05 – Encounter, Combat, Loot und Rewards

- Laufende `CE-03` bis `CE-06` Arbeit gegen D&D 2014 fertigstellen.
- Encounter Tables, Combat-Maske, Rewards, Gruppenloot und Charakterledger
  über stabile Referenzen und atomare Kommandos verbinden.

### SMR-06 – Session Planner und reproduzierbare Generierung

- Zuerst einen eigenständig nutzbaren manuellen Plan mit geordneter Timeline,
  Notizen und optionalem Ort bearbeiten, speichern und frisch öffnen;
  ohne erforderliche Party, Encounter, Loot oder Generator.
- World-, Party-, Encounter- und Lootbedingungen in gestufte Runs binden.
- Vorschläge einzeln regenerieren, akzeptieren und in Scene/Atlas platzieren;
  Inputs, Profile, Rundung und Outputs prüfbar speichern.

### SMR-07 – Reise, Kalender und autoritative Zeit

- Kalender-/Zeitkern und providerneutrale Reise parallel entwickeln. Kalenderregeln
  warten nicht auf die fertige Reise; autoritative Scene-Zeit konsumiert den
  bestätigten Scene-/Owner-/Publishvertrag. Bestehenden Fachbesitz in #10 erhalten.
- Hex-, Dungeon- und Atlasprovider hinter einem hostneutralen Vertrag
  vereinen; Preview/Confirm, Unterbrechung, Ereignisse, Tracks und kausales
  Undo/Redo umsetzen.
- Kampagnenkalender und unabhängige Scene-Zeiten einführen. Gemeinsame Folgen
  werden exakt einmal angewandt; narrative Entscheidungen bleiben beim GM.

### SMR-08 – Shops, Wetter und Musik

Drei eigenständige Produktlieferungen verbinden sich über bestätigte
World-/Scene-/Zeitprojektionen. Die Quellen sind [SRC-P04/L03/L04/T05/S01–03](docs/scope-sources.json)
auf SaltMarcher `9de85c1a26f526acbc1af332ac5962e185c0aab2`, TN-14/25/26.
Aktueller Besitz und konkrete Fachentscheidungen in #10, Hostgrenzen in #11.

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

- Opt-in-Akteure, Bedürfnisse, Arbeit, Wahrnehmung und begrenzte Konflikte auf
  den stabilen World-/Zeit-/Scene-/Encounter-Verträgen aufbauen.
- Pausieren, Abbrechen, atomare Wirkung, erklärbares Log und einmaliges
  Catch-up qualifizieren.

### SMR-10 – Zweites Display, Extensions und vollständige Portabilität

- Sichere passive Spielerprojektion für den gewählten Host beweisen.
- Interne Extension-Grenze mit Default-Deny, Einwilligung und Widerruf bauen;
  Host-Erweiterungen nicht als sichere Sandbox voraussetzen.
- Kompletten Current-Format-Roundtrip, beschädigte Daten, unbekannte Felder und
  plattformübergreifende Assets prüfen.

### SMR-11 – Tutorial, A11y, Performance und Abschluss

- Featurequalität mit jeder nutzbaren Lieferung umsetzen; dieser Abschluss
  bündelt die noch offenen Gesamt-/OS-/Lastbeweise.
- Feature-/Versions-Tutorials, Lokalisierung, Tastatur, 200 %, Kontrast und
  Nicht-Farb-Signale vollständig qualifizieren.
- Latenz-, große Daten-, Speicher-, Abbruch-, Offline- und Privacy-Gates gegen
  Program Technical Needs prüfen.
- Gesamtqualifikation samt erforderlicher unabhängiger Prüfung,
  gezielter Nachbesserung und Bereinigung zusammenführen. Keine zusätzliche
  allgemeine Aufräumreviewrunde; fehlende Fachabnahme bleibt offen.

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
- Aktuellen Rollenvertrag und Claim verwenden; historische Teamaufteilungen
  sind keine Beschränkung neuer Beiträge. Geprüfte Pfade, Belege und
  Dateibesitze bleiben erhalten. Kein zweiter Besitzer ändert gleichzeitig
  dieselbe Datei oder Aggregategrenze.
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

## Aktueller nächster Schritt

Der gemeinsame nächste Schritt steht ausschließlich in
[#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12),
ausführbare eigene oder freie Arbeit in `npm run next`. Die
[Lieferroadmap](docs/ROADMAP.md#parallele-umsetzung-und-zusammenführung)
verbindet parallel umsetzbare Produktpakete mit dem vollständigen Umfang.
`SMR-00-ADR-01` bleibt die offene Plattformentscheidung in #11; sie hält
hostneutrale Produktarbeit und den bestehenden befristeten Obsidianadapter
nicht pauschal an. Neue dauerhafte Hostkopplung braucht ihre bestätigte Grundlage.
