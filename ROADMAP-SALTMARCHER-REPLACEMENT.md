# Vollständige SaltMarcher-Ablösung im gemeinsamen Zielprodukt

Stand: 10. Oktober 2026. Direkter Nutzerauftrag: SaltMarcher ist als
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
- Den gesamten Weg über die Campaignoberfläche liefern: anlegen → A/B/A wechseln →
  umbenennen → aktive Campaign in Trash → dieselbe Identität restaurieren → separat
  dauerhaft löschen. Duplikatnamen bleiben erlaubt; Trash/Restore aktiviert keine
  andere Campaign implizit. Unsaved-Drafts und unbekannte Commandausgänge vor dem
  Wechsel beim zuständigen Owner klären, Aktivierungsretry erzeugt keine zweite Wirkung.
- Complete-Transfer auf einer anderen Installation bis zum tatsächlich geöffneten
  Arbeitszustand verfolgen. Fehlende gemeinsame Definitionen übernehmen; Konflikte
  mit sichtbaren Folgen ausdrücklich wählen, einschließlich unabhängiger Varianten.
  Beschädigte Daten öffnen den neuesten eindeutig sicheren Recoverystand und zeigen
  Verluste; nur bei Mehrdeutigkeit fragt der GM. Keine manuelle Backupbedienung als
  Voraussetzung normaler Erhaltung. Quelle: Campaign Management und Program
  Capabilities „Local Data Lifecycle“, #10/#41, SMR-AC-02/15.
- Der Fachtext verlangt Campaignauswahl bei jedem Start, der Gesamtvertrag möglichst
  vollständigen Runtime-Resume. Einstieg/Continue und wiederhergestellten Zustand
  in #44/#10/#11 ausdrücklich zusammenführen; keine automatische UI-Weiterleitung
  oder bewusst verworfene Runtime daraus als bereits entschiedene Zielregel ableiten.

### SMR-02 – Katalog, Referenzgraph und World Planner

- Laufende `CE-01` bis `CE-02` Katalogarbeit abschließen.
- Items, PCs/NPCs, Orte, Fraktionen, Quests, Gerüchte, Besitz, Notizen und
  Referenzgraph als getrennte, stabile Dokumente ergänzen.
- Manuelle World-Inhalte parallel zur Katalogfolge liefern; der vollständige
  Itemkorpus ist nur für seine tatsächlichen Itemverbraucher Voraussetzung.
- Aktuelle Definition und eingefrorene historische Verwendung trennen.
- Katalogsuche → Inspector → ausdrückliche Übergabe an Scene/Encounter liefern;
  Bereichswechsel erhält Filter/Selektion, beendet aber unsichtbare Providerarbeit.
  Referenzgraph im laufenden Spiel konsumieren: Begriff/Alias → verschachtelte
  Vorschau → vollständiger Eintrag mit Scene-Details-History. Mehrdeutigkeit
  auswählbar, editierbare Prosa unverändert; Umbenennen/Löschen aktualisiert den
  Kampagnenindex ohne statischen Neubau. Offline-/Unavailablefälle bleiben lesbar.
  Quellen: Catalog und Reference Graph requirements; #9/#10, SMR-AC-03.

#### Arbeitsstand #68

[PR #83](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/83)
integrierte das Anlegen, Suchen, Bearbeiten und native Speichern der vier
Kampagnenwissen-Arten mit Beziehungen, Tombstones und Campaignmanifest. Der
unabhängige [Host-R02](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/68#issuecomment-6103180580)
schloss den Atlas-first-Restjournalfehler; eine
[freie GM-Probe](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/68#issuecomment-6103954556)
bestätigte Anlegen, Suche, Bearbeiten und erneutes Öffnen.

Kontrollierte echte Obsidianproben auf synthetischer Fixture:
- Auf Shared `ca290326`: 200 % Electron-Zoom, Tastaturzugang, Save und frischer
  Prozess; `--world-notes-zoom200` unter eigenem `DUNGEON_QA_ROOT`, Rohbelege
  `/home/aaron/.cache/dungeon-native-qa/atlasqa-smr02-zoom200-flag-ca290/evidence/`.
- Manifest-CAS-Fehler nach nativer Notizschreibung: exakter Before-Rollback,
  derselbe Entwurf speicherbar, frischer Prozess; `--world-notes-rollback`,
  Rohbelege `/home/aaron/.cache/dungeon-native-qa/atlasqa-smr02-rollback-fault-02/evidence/`.
- Aus tatsächlichen Before-/After-Bytes abgeleitetes Committed-Restjournal:
  zweiter Prozess prüft und entfernt es vor dem Mount; Prosa, Beziehung und
  Tombstone erhalten. `--world-notes-recovery`, Rohbelege
  `/home/aaron/.cache/dungeon-native-qa/atlasqa-smr02-committed-recovery-01/evidence/`.
  Die 24 portablen JSON-Kopien samt Hash-/Bytebindung stehen im
  [Belegpaket](docs/reference/smr02-world-notes-recovery/README.md); der
  unabhängige [R02-Rohbelegreview](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/95#pullrequestreview-5481505362)
  bestätigte kontrollierte Rollback-/Recoveryfälle. Die ursprünglichen
  Prüfcheckouts waren dirty; weder physischer Crash noch visueller Reviewer-PASS.

Die folgenden Beiträge sind ebenfalls in Shared:
- [PR #99](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/99):
  Suche nach aktiven Beziehungsnamen und Zielnamen, Öffnen des Ziels nur bei
  unverändertem Entwurf. Enge Such-/Navigationsreviews und isolierter echter
  Edit-/Frischprozess auf `a7cc6991` bestanden; Rohbelege
  `/home/aaron/.cache/dungeon-native-qa/atlasqa-relation-search-h02/evidence/`.
- [PR #104](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/104):
  aktive eingehende Verweise und geschützte Quellnavigation aus bestätigtem
  Snapshot; enger Stadt-R01 und native Edit-/Frischprozessprobe bestanden.
- [PR #107](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/107):
  NPC-Kreatursuche übernimmt nur stabile Katalog-ID, manuelle IDs bleiben
  editierbar. Enge Reviews, native Save-/Frischprozess- und 200-%-Proben;
  letzte manuelle-ID-Korrektur nur DOM-geprüft.
- [PR #108](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/108):
  aktive NPC-Notizen über gespeicherte Kreatur-ID auffindbar, auch bei manuellen
  IDs. Enger R01/CI und isolierter echter Edit-/Frischprozess auf `8621d202`;
  Rohbelege `/home/aaron/.cache/dungeon-native-qa/atlasqa-creature-ref-search-20261011/evidence/`.
- [PR #112](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/112):
  getrennte ungespeicherte A/B-Entwürfe beim Kampagnenwechsel im offenen View;
  alte Sessions/Eingaben widerrufen, Anzeige erst nach bestätigtem Snapshot.
  Enger R01/CI und echter Obsidianlauf A→B→A→B bestanden; 16 native Dateien
  bytegleich, normaler Exit. Rohbeleg
  `/home/aaron/.cache/dungeon-native-qa/atlasqa-world-notes-drafts-host-03/evidence/1791690123926-atlas-spatial-edit/`.
- [PR #114](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/114):
  Entwürfe über View-Close/Reopen innerhalb derselben Pluginlaufzeit erhalten.
  Exklusiver Besitzer je Campaign/Namespace verhindert Überschreiben durch
  alte Views oder Wiederbelebung nach Save/Discard. Unabhängiger enger R02
  mit 25/25 Panel-/Viewfällen, Exact-SHA-CI und Autorenprobe im echten
  Obsidian A→B→A→B auf `c631eb5f` bestanden; 16 native Dateien bytegleich,
  normaler Exit. Rohbeleg
  `/home/aaron/.cache/dungeon-native-qa/atlasqa-world-notes-close-r02-exact-01/evidence/1791692061930-atlas-spatial-edit/`.

Ein Folgebeitrag macht eine durch die zweite Ansicht verdrängte erste Ansicht
wieder bedienbar: Der vorhandene Button „Erneut versuchen“ holt nach frischem
Campaignsnapshot den neuesten Entwurf ausdrücklich zurück. Die andere Ansicht
und ihre späten Eingaben werden widerrufen; ein bloßes Providerereignis nimmt
den Besitz nicht ungefragt zurück. Eine Zwei-View-DOM-Gegenprobe reproduzierte
vor der Korrektur den alten Text und besteht danach. Unabhängige Prüfung und
nativer Mehrview-Nachweis stehen aus.

Offen: ungespeicherte Entwürfe über Prozessneustart, breite Crash-/Recovery-
und physische Eingabeprüfung, Encounter-Constraints, NPC-Combat, vollständiger
World Planner und Gesamt-SMR-02/SMR-AC-03. Ortstags gegenüber Name-only-Anlage
warten auf die Zielregel in #44. Die genannten Teilbelege sind keine
Gesamtfreigabe.

### SMR-03 – Party, Scene und Live Session

- Roster/Charakterprofile und Adventuring Day integrieren.
- Primary Scene, Split/Rejoin, PC-Zuordnung, Fokus und generische Maskenbasis
  etablieren. Scene bleibt über Encounter, Chase, Reise und Pausen bestehen.
- Preparation ausdrücklich übernehmen → Primary/Split/Rejoin und mehrere Masken
  im laufenden Spiel bedienen → frischen Prozess mit gleichem Fokus/Runtime öffnen.
  Partyänderungen sind sofort autoritativ; nur betroffene Scene-/Encounterkontexte
  reconciliieren und bleiben bei Fehler sichtbar pending. Eine gültige Scene-
  Speicherung wartet nicht auf Encounter-Synchronisierung; Retry konsumiert den
  gespeicherten Stand, ohne die Party-/Sceneänderung zu wiederholen.
  Quellen: Party Window, Scene, Live Session und Program Capabilities
  „Confirmed Cross-Workflow Behavior“; #6/#60, SMR-AC-04. DTOs beenden den Weg nicht.

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
- [CE-03/04](ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md#ce-03--encounter-builder-und-planpersistenz)
  liefert bearbeitbare installationseigene Generatorpresets mit ausdrücklicher
  Campaignzuweisung bis gleicher Scene-/Sessionkomposition und gespeicherter
  Combat-Mobpartition. Einstellungs- und Consumerpfad zusammen verfolgen; Preset ist
  Kompositionspolitik, keine Regel-/Katalogversionsauswahl. #9/#10/#6, AC-06/07.
- Encounter Tables, Combat-Maske, Rewards, Gruppenloot und Charakterledger
  über stabile Referenzen und atomare Kommandos verbinden.
- Vom Gruppeneditor bis zur Nachbereitung liefern: manuelle Monster-/Lootauswahl,
  vollständigen Encounterabschluss mit ausgewählter XP-Verteilung atomar anwenden,
  Treasure an Ort/Gruppe/unplaced führen, an aktuelle Party verteilen und im
  persönlichen Ledger wiederfinden. Geschützte Allokationen und immutable
  Itemreferenzen erhalten; Korrektur ersetzt durch verlinkten Eintrag statt
  Geschichtsumschreibung. Kumulativer Lootausgleich ist eine lesende Guidance;
  Gruppenreward und Sessionreward konsumieren dieselbe bestätigte Ledgerbasis.
  Quellen: Loot und Program Capabilities „Follow-Up“/„Cross-Workflow Behavior“;
  #9/#6, SMR-AC-06/07. Treasure-Editierkollision aus #44 bleibt offen.

### SMR-06 – Session Planner und reproduzierbare Generierung

- Zuerst einen eigenständig nutzbaren manuellen Plan mit geordneter Timeline,
  Notizen und optionalem Ort bearbeiten, speichern und frisch öffnen;
  ohne erforderliche Party, Encounter, Loot oder Generator (#69).
- Danach erwartete Party (ohne Änderung der aktuellen Party), Adventure Day,
  Encounterbudget/Restempfehlungen und bindende World-Auswahl verbinden. Unmögliche
  Vorgaben vor Generierung erklären. Encounterpläne gezielt an einem Timelineeintrag
  suchen/anhängen; keine Vollkatalogladung. Manuelle Lootnotizen und strukturierte
  Generated Rewards bleiben sichtbar getrennt; fremde Rosters/Definitionen werden
  nicht im Planner editiert.
- Vom bestätigten Input über asynchronen Run und konkrete Encounterauflösung bis
  zur gespeicherten bearbeitbaren Timeline liefern: Itemzeilen/Quantitäten/Packing,
  Rewardkanäle, Warnings/Audits und konkrete Creature-Identitäten konsumieren.
  Seed, Profil/Config-/Katalogprovenienz und Ledgerbasis erhalten; Goldenpflicht
  `[680, 1000, 1800]` aus Session Generation belegen, keine zufälligen Item-/Roster-
  Kandidaten als Goldenparität verlangen. Fehler liefern kein sichtbares Teilergebnis.
- Einzelnes Ergebnis ändern/regenerieren/ablehnen/annehmen/platzieren, andere
  manuelle Änderungen und angenommene Worldplatzierungen erhalten; Planersatz
  löscht diese nicht. Am vorbereiteten Ort erscheinen Gruppen/Treasures in der
  Running Scene, ohne automatischen Kampfstart oder Award. Übernahme ins Live-Spiel
  konsumiert SMR-03; keine Planner-Rückwirkung auf laufende Scenes.
- Revisiongebundene Aufträge, verständliche Fortschritts-/Fehlerzustände, Cancel,
  Retry ohne Duplikate und Reopen im selben Lieferweg prüfen; späte Resultate dürfen
  neuere Autorenschaft nicht überschreiben. Quellenkollision bleibt in #44 offen:
  Program Capabilities fordert einen unbenannten aktuellen Plan und einzeln
  annehmbare Vorschläge; Session Planner fordert mehrere benannte Sessions und
  sofortige Gesamtersetzung ohne Apply. Auch Cancel-/Commitgrenze und gemeinsame
  Receiptautorität vor abhängiger Implementierung ausdrücklich auf die Zielregel
  beziehen. Quellen: Session Planner, Session Generation, Encounter Generation und
  SRC-P01–03; #10/#6/#9, SMR-AC-07. Keine zweite öffentliche Generatorpipeline.

#### Arbeitsstand #69

Kandidat: https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/71
Eingang: https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/68

Der [compound-add-Review](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69#issuecomment-6102411326)
qualifiziert den In-Memory-Kern, nicht Host/Save/Recovery; kein unangefragter Zweitreview.
Campaign/Data benötigt den [konkreten nativen Plannerconsumer](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69#issuecomment-6102471289)
mit Plan-/Sceneclosure, kanonischem Dateibesitz und kausaler Publish-/Receipt-/Recoverybindung.
Der in #68 besessene Producer ist Anknüpfung, keine gelieferte Plannerautorität.

Ein startbarer synthetischer Browser-GUI-Weg ist im Kandidaten vorbereitet:
`node tools/manual-planner-preview/build.mjs`, danach `.build/manual-planner-preview/index.html` öffnen.
Er nutzt das reale Panel mit ortsloser Blankplanung, Szenen/Notizen/Reihenfolge und Planwechsel.
[Startanleitung und Grenzen](docs/plans/campaign/manual-session-planner.md#startbarer-flüchtiger-gui-frühtest).
Memory-only: Neuladen/Schließen verwirft sämtliche Arbeit; keine alternative Speicherung.
Der [Cloud-GM-Lauf](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69#issuecomment-6102831310)
bestätigt den manuellen Bedienweg, fand Fokusverlust bei Szenenauswahl.
Fokusreparatur auf59f04fe durch unabhängigen Review5481049475 und
[sichtbaren GM-Retest](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69#issuecomment-6102960484)
bestätigt: Klick/Enter führt zu Szenentitel, nächster Tab zu Notizen; Plan-/Text-/Order-Erhalt.
Neuer eigener Fehlerfall: Rename/Move nach Dirty-Draft-Übernahme konnte bei zweitem
Revisionsfehler teilwirken. Gemeinsamer atomarer Modellpfad geliefert, 24 fokussierte
Core-/Panel-Fälle PASS; neuer enger unabhängiger Deltareview vor Integration.
Stadt konsumiert anschließend den bestätigten nativen Speicherport; #68 liefert
World-Notes-Acknowledgment, weiterhin keine Plannerdatei-/Ownerautorität.
Native Save/Fresh-/Recoveryabnahme, wirksamer 200%-Zoom und physische Tastatur bleiben offen.

### SMR-07 – Reise, Kalender und autoritative Zeit

- Kalender-/Zeitkern und providerneutrale Reise parallel entwickeln. Kalenderregeln
  warten nicht auf die fertige Reise; autoritative Scene-Zeit konsumiert den
  bestätigten Scene-/Owner-/Publishvertrag. Bestehenden Fachbesitz in #10 erhalten.
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
  #10/#6/#7/#8, SMR-AC-08/09. UI, erforderliche Persistenz und Consumeranschluss
  gehören zum selben Ergebnis, nicht nur ein Clock-/Providerport.

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
  #10, SMR-AC-13. Domäne/Jobangebote parallel entwickeln; produktive Steps benötigen
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
  keine Discoverywahrheit. Quellkonflikt in #44/#11/#10: Dungeon Travel nennt
  komplette Partyunion/Explorationkamera, SRC-L05/T04 fokussierte Sceneunion.
  Nicht beide Filter zugleich als Sicherheitsvertrag freigeben; P03 liefert nur
  den Beweiskanal, nicht diese Fachentscheidung. SMR-AC-14/TN-24 bleibt separat.
- Interne Extension-Grenze mit Default-Deny, Einwilligung und Widerruf bauen;
  Host-Erweiterungen nicht als sichere Sandbox voraussetzen.
- Tatsächliche Erweiterung installieren → Rechte bestätigen → Inhaltsart/Maske/
  Generator/Importer/Präsentation konsumieren → Fehler, Remove/Replace/Restore
  prüfen. Ausfall deaktiviert nur die betroffene Capability; opaque Daten und
  unabhängige Kampagnenabläufe bleiben erhalten. Quellen: Program Capabilities
  „Modular Change“, TN-27–30; #11, SMR-AC-14/15/16.
- Kompletten Current-Format-Roundtrip, beschädigte Daten, unbekannte Felder und
  plattformübergreifende Assets prüfen.

### SMR-11 – Tutorial, A11y, Performance und Abschluss

- Featurequalität mit jeder nutzbaren Lieferung umsetzen; dieser Abschluss
  bündelt die noch offenen Gesamt-/OS-/Lastbeweise.
- Gemeinsame Popup-/Dropdown-/Dialogmechanik und passive Fortschrittsanzeige mit
  ihren tatsächlichen World-/Planner-/Party-/Combatverbrauchern liefern, keine
  eigene Shell-Miniphase. Escape/Auto-hide/Fokusrückgabe, feste Aktionen bei
  scrollendem Inhalt und zugängliche Amount-Eingaben vereinheitlichen;
  Geschäftsberechnung/Kommandos bleiben beim Featureowner. Die vier
  `docs/project/requirements/requirements-{anchored-popup,dropdown-popup,dialog-surface,progress-meter}.md`
  sind Produktverhalten, keine Pflicht zur Übernahme alter Hostklassen.
- Feature-/Versions-Tutorials, Lokalisierung, Tastatur, 200 %, Kontrast und
  Nicht-Farb-Signale vollständig qualifizieren.
- Latenz-, große Daten-, Speicher-, Abbruch-, Offline- und Privacy-Gates gegen
  Program Technical Needs prüfen.
- Gesamtqualifikation samt erforderlicher unabhängiger Prüfung,
  gezielter Nachbesserung und Bereinigung zusammenführen. Keine zusätzliche
  allgemeine Aufräumreviewrunde; fehlende Fachabnahme bleibt offen.

Die erklärbare Kampagnenhistorie verbindet SMR-01/03/05/07–09: bestätigte Zeit-,
Reise-, Encounter-, XP-, Party- und manuelle Worldfolgen im laufenden Produkt
inspizieren; Korrekturen verlinkt anhängen und frisch öffnen. Kein Vollsnapshot-
Replay, Rückdatierung löscht keine etablierten Fakten. Ownergrenzen und die enge
kausale Reise-Undo-Ausnahme bleiben erhalten. Quelle: Program Capabilities
„Explanatory Campaign History“, SRC-C04/TN-06; #6/#10, SMR-AC-04/06/09.

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
