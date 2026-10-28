# Vollständige SaltMarcher-Ablösung im gemeinsamen Zielprodukt

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: project
Last Reviewed: 2026-10-28 (Quellenrolle und entschiedener Host; keine neue Fachabnahme)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Historische Umfangsableitung vom 10. Oktober 2026, gebunden an SaltMarcher
`9de85c1a26f526acbc1af332ac5962e185c0aab2`. Direkter Nutzerauftrag: SaltMarcher ist als
eigenständiges Produkt vollständig abgelöst. Das in diesem Repository
fortgeführte Zielprodukt übernimmt nicht nur bereits implementierte Funktionen,
sondern auch den bestätigten und geplanten Gesamtumfang. Das Endergebnis ist
ausdrücklich nicht an Obsidian als Laufzeit oder Pluginformat gebunden. Die
UX- und Funktionsvorgaben sind verbindlich; die technische Richtung ist im
[Plattformentscheid](../architecture/platform-decision.md) festgelegt. Heutige
Codeanschlüsse und Lieferungen stehen in der [Roadmap](../delivery/roadmap.md),
Produktcutover und Datenlinie im [Übernahmevertrag](../delivery/workbench-migration.md).
SaltMarcher bleibt Produktwahrheits-, Daten- und Verhaltensquelle; seine
Electron-, Java-, JavaFX-, JDBC- und frühere Obsidian-Architektur sind keine
Zielarchitektur und kein Merge-Vertrag.

## Technische Richtung vom 11.10.2026

[ARCHITECTURE](../architecture/overview.md) trägt den gesamten beauftragten Umfang;
[Plattform-ADR](../architecture/platform-decision.md) entscheidet kleinen
TypeScript-Neukern/Electron/SQLite statt Bestandsschutz. Fachliche Anforderungen
und datierte Belege dieser Roadmap bleiben erhalten. Frühere technische
Ports/Dateijournale/Hostvorgaben sind kein Zwang für die Implementation.
Die bestehende Lieferfolge und [Atlas-Workpakete](../../atlas/requirements/atlas.md#umsetzungsplan)
führen den Übergang, keine zusätzliche unabhängige Produktlinie.

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
4. Der implementierte Electron-/TypeScript-/SQLitepfad folgt dem
   [Plattformentscheid](../architecture/platform-decision.md). Historische
   JavaFX-/JDBC-/Obsidian- und frühere SaltMarcher-Hostvorschriften bleiben
   Quellenkontext, keine zweite aktuelle Architektur.

Jeder Lauf hält die verwendete SaltMarcher-Revision, konkrete Quelldokumente,
übernommene Daten/Fixtures, bewusst nicht übernommene Hostarchitektur und
verbleibende Abweichungen in `acceptance.json` fest.

## Gesamtumfang

Die Standspalte beschreibt ausschließlich die oben gebundene Ausgangsrevision.
Sie ist kein heutiger Implementierungs- oder Prüfstatus. Aktuellen Nutzerumfang
und offene Fachentscheidungen besitzt [SCOPE](scope.md); vorhandene Fähigkeiten
und Restqualifikation die [Roadmap](../delivery/roadmap.md). Historische
Quellpfade in der Tabelle beziehen sich auf die Ausgangsrevision.

| Bereich | Historischer SaltMarcher-Stand | Ziel im gemeinsamen Produkt | Hauptquellen |
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
| Tutorials, Lokalisierung und A11y | teilweise/querliegend | Tutorial je Feature/Version, Skip/Dismiss, Tastatur, 100 %, Kontrast, Nicht-Farb-Signale und vollständige UI-Texte | Program Technical Needs |
| Performance, Offline, Privacy und Provenienz | teilweise/querliegend | lokale Offline-Nutzung ohne versteckten Egress, reproduzierbare Regeln, messbare Latenz-/Skalierungsgrenzen, portable Assets und nachvollziehbare Entscheidungen | Vision; Program Technical Needs |

## Lieferphasen

SMR-00–11 sind Fachfolgen mit eigenen Abnahmen, keine globale serielle
Implementierungsfolge. Die [gemeinsame Lieferroadmap](../delivery/roadmap.md#parallele-umsetzung-und-zusammenführung)
führt die Nutzerergebnisse und ihre fachlichen Abhängigkeiten. Die dort
verlinkten Fachquellen beschreiben Anforderungen und technische Anschlüsse.

### SMR-00 – Portfolivertrag und Quelleninventar

- Quellenumfang und betroffene Acceptance-Zuordnung am konkreten Produktpaket
  prüfen; den bestehenden Quellenabgleich verwenden.
- `SMR-00-ADR-01` entscheidet anhand der UX-/Funktionsvorgaben über Zielhost,
  Verteilung, Datenbesitz, Erweiterbarkeit und den Migrationspfad. Mindestens
  Obsidian-Plugin, eigenständige Desktop-App und ein schrittweise entkoppeltes
  Hybridmodell werden mit prototypischen Risikobelegen verglichen.
- Der getroffene Entscheid samt Beweis- und Qualifikationskriterien steht in
  [`docs/project/architecture/platform-decision.md`](../architecture/platform-decision.md).
- Neue Domänenlogik und Produktverträge bleiben gemäß dem Entscheid
  von privilegierten Hostfähigkeiten getrennt; historische Plugin-Arbeit bleibt
  als Referenz erhalten.
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
  Capabilities „Local Data Lifecycle“, [Campaign-Datenvertrag](../../campaign/contract/archive.md); #41, SMR-AC-02/15.
- Der Fachtext verlangt Campaignauswahl bei jedem Start, der Gesamtvertrag möglichst
  vollständigen Runtime-Resume. Einstieg/Continue und wiederhergestellten Zustand
  in #44; [Campaign-Datenvertrag](../../campaign/contract/archive.md); [Plattform-ADR](../architecture/platform-decision.md) ausdrücklich zusammenführen; keine automatische UI-Weiterleitung
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
  Quellen: Catalog und Reference Graph requirements; [Katalog-/Encountervertrag](../../catalog/requirements/catalog-encounters.md); [Campaign-Datenvertrag](../../campaign/contract/archive.md), SMR-AC-03.

#### Arbeitsstand #68

Im untersuchten Bestand sind vier Kampagnenwissen-Arten mit Anlegen, Suche,
Bearbeitung, Beziehungen, Tombstones und nativer Speicherung vorhanden
([PR83](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/83)).
Beziehungs- und Zielnamensuche, eingehende Verweise und geschützte Quellnavigation
ergänzen dies; ein Ziel öffnet nur bei unverändertem Entwurf. NPC-Kreaturverweise
bleiben auch über manuell bearbeitbare IDs auffindbar (PR99/104/107/108); die
letzte manuelle-ID-Korrektur war nur DOM-geprüft.

Getrennte A/B-Entwürfe bleiben bei Kampagnenwechsel und View-Close/Reopen
innerhalb derselben Pluginlaufzeit erhalten (PR112/114). Alte Ansichten und
späte Eingaben dürfen sie nicht überschreiben. Die Rücknahme eines durch eine
zweite Ansicht verdrängten Entwurfs erfordert einen frischen Campaignsnapshot
und ausdrücklich „Erneut versuchen“;
ein bloßes Providerereignis übernimmt ihn nicht. Die begrenzte Zwei-View-Probe
bestand auf `489bc13d`; unabhängige Prüfung steht aus.

Begrenzte Obsidianproben belegen Tastatur/100 % sowie kontrollierten
Manifestfehler mit Rollback/Retry und ein aus echten Bytes gebildetes
Committed-Restjournal. Die [24 portablen Rohbelege](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/smr02-world-notes-recovery/README.md)
erhalten ihre Hash-/Quellbindung. Die ursprünglichen Recoverycheckouts waren
dirty; physischer Crash und visueller Reviewer-PASS sind daraus nicht belegt.
Weitere datierte Einzelresultate bleiben im
[historischen Arbeitsstand](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/68eab342b656b56b2d03e5e7228ecf56d37373b5/ROADMAP-SALTMARCHER-REPLACEMENT.md) verfügbar.

Offen: ungespeicherte Entwürfe über Prozessneustart, breite Crash-/Recovery-
und physische Eingabeprüfung, Encounter-Constraints, NPC-Combat, vollständiger
World Planner und Gesamt-SMR-02/SMR-AC-03. Ortstags gegenüber Name-only-Anlage
warten auf die Zielregel in #44. Teilbelege sind keine Gesamtfreigabe.

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
  „Confirmed Cross-Workflow Behavior“; [LiveScene-Vertrag](../../runtime/contract/smr03-live-scene-contract.md); #60, SMR-AC-04. DTOs beenden den Weg nicht.

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
   Room-Lifecycle → Paths/Passages](../../dungeon/requirements/smr04-spatial-coverage.md),
   [konkrete Graph-, Key-, Feature-, Vorlagen- und Verwaltungsaktionen](../../atlas/requirements/atlas-2.md#aktionen-am-ausgewählten-objekt),
   Attributvererbung/Beschreibungen, Trap-Trigger/Charges/Reset und
   Dokument-/Paketausgabe. Reise, Playeranzeige
   und Autonomy konsumieren bestätigte Raum-/Passage-/Runtimefakten; fehlende
   Schema-/Transferentscheidungen aus #44 bleiben offen.

Fachquellen: [HEX-Meilenstein B](../../atlas/requirements/atlas-2.md#meilenstein-b--hex--ort--dungeon--raum-key--zurück),
[CITY-01–09](../../city/contract/city.md#technische-arbeitspakete),
[Atlasstand](../../atlas/requirements/atlas.md); [Dungeonanforderungen](../../dungeon/requirements/smr04-spatial-coverage.md); #44. Direkte Endabnahme SMR-AC-05; E2E-01 prüft den gemeinsamen
Integrationsweg, nicht automatisch die gesamte Karten-/Stadtfunktion.

### SMR-05 – Encounter, Combat, Loot und Rewards

- Laufende `CE-03` bis `CE-06` Arbeit gegen D&D 2014 fertigstellen.
- [CE-03/04](../../catalog/requirements/catalog-encounters.md#ce-03--encounter-builder-und-planpersistenz)
  liefert bearbeitbare installationseigene Generatorpresets mit ausdrücklicher
  Campaignzuweisung bis gleicher Scene-/Sessionkomposition und gespeicherter
  Combat-Mobpartition. Einstellungs- und Consumerpfad zusammen verfolgen; Preset ist
  Kompositionspolitik, keine Regel-/Katalogversionsauswahl. [Katalog-/Encountervertrag](../../catalog/requirements/catalog-encounters.md); [Campaign-Datenvertrag](../../campaign/contract/archive.md); [LiveScene-Vertrag](../../runtime/contract/smr03-live-scene-contract.md), AC-06/07.
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
  [Katalog-/Encountervertrag](../../catalog/requirements/catalog-encounters.md); [LiveScene-Vertrag](../../runtime/contract/smr03-live-scene-contract.md), SMR-AC-06/07. Treasure-Editierkollision aus #44 bleibt offen.

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
  SRC-P01–03; [Campaign-Datenvertrag](../../campaign/contract/archive.md); [LiveScene-Vertrag](../../runtime/contract/smr03-live-scene-contract.md); [Katalog-/Encountervertrag](../../catalog/requirements/catalog-encounters.md), SMR-AC-07. Keine zweite öffentliche Generatorpipeline.

#### Manuelle Planung (#69)

Die Desktopvorbereitung und der gemeinsame Store tragen manuelle Pläne,
Besuchsinhalte, Ersetzung und Wiederverwendung.
[Aktueller Anschluss und offene Fachabnahmen](../../campaign/contract/manual-session-planner.md).


Weitere Fachabschnitte: [Teil 2](product-scope-2.md)
