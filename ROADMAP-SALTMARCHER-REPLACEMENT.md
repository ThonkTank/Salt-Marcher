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

### SMR-00 – Portfolivertrag und Quelleninventar

- Diese Roadmap und die Acceptance-Matrix vollständig reviewen.
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
- Aktuelle Definition und eingefrorene historische Verwendung trennen.

### SMR-03 – Party, Scene und Live Session

- Roster/Charakterprofile und Adventuring Day integrieren.
- Primary Scene, Split/Rejoin, PC-Zuordnung, Fokus und generische Maskenbasis
  etablieren. Scene bleibt über Encounter, Chase, Reise und Pausen bestehen.

### SMR-04 – Gemeinsamer Atlas und Karten

- Bestehende Dungeon-Paritäts-, Hex-Atlas- und Stadtroadmaps planmäßig
  abschließen; ihre geprüften Kennungen und Belege nicht neu beginnen.
- Gemeinsame Weltkoordinaten, direkte Zoom-Bearbeitung, Dungeon-/Stadtbindung,
  Karten-History, Fehlerwiederholung und große/negative Räume qualifizieren.

### SMR-05 – Encounter, Combat, Loot und Rewards

- Laufende `CE-03` bis `CE-06` Arbeit gegen D&D 2014 fertigstellen.
- Encounter Tables, Combat-Maske, Rewards, Gruppenloot und Charakterledger
  über stabile Referenzen und atomare Kommandos verbinden.

### SMR-06 – Session Planner und reproduzierbare Generierung

- World-, Party-, Encounter- und Lootbedingungen in gestufte Runs binden.
- Vorschläge einzeln regenerieren, akzeptieren und in Scene/Atlas platzieren;
  Inputs, Profile, Rundung und Outputs prüfbar speichern.

### SMR-07 – Reise, Kalender und autoritative Zeit

- Hex-, Dungeon- und Atlasprovider hinter einem hostneutralen Vertrag
  vereinen; Preview/Confirm, Unterbrechung, Ereignisse, Tracks und kausales
  Undo/Redo umsetzen.
- Kampagnenkalender und unabhängige Scene-Zeiten einführen. Gemeinsame Folgen
  werden exakt einmal angewandt; narrative Entscheidungen bleiben beim GM.

### SMR-08 – Shops, Wetter und Musik

- Shops an NPC/Ort, Scene-Verfügbarkeit, Ledger und Kalender-Restock binden.
- Wetter/Klima als begrenzte autonome regionale Entwicklung implementieren.
- Lokale Musikbibliothek/Player mit Tags, Scene-Queue, Fade, Autoplay und
  vorrangiger manueller Steuerung bereitstellen.

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

- Feature-/Versions-Tutorials, Lokalisierung, Tastatur, 200 %, Kontrast und
  Nicht-Farb-Signale vollständig qualifizieren.
- Latenz-, große Daten-, Speicher-, Abbruch-, Offline- und Privacy-Gates gegen
  Program Technical Needs prüfen.
- Eigener Gesamtreview, Nachbesserung, erneuter Review und getrennte
  Aufräumphase. Erst danach Gesamtfreigabe.

## Abhängigkeiten und Parallelität

- `SMR-00-ADR-01` ist Voraussetzung für neue hostspezifische Kopplung; reine
  Domänen-, Daten- und Vertragsarbeit darf parallel weiterlaufen.
- `SMR-01` ist Voraussetzung für alle schreibenden Bereiche.
- `SMR-02` und `SMR-04` dürfen nach dem Quellenvertrag parallel laufen.
- `SMR-03` benötigt Kampagnenidentität und World-Referenzen.
- `SMR-05` benötigt Katalog und Party/Scene; `SMR-06` zusätzlich Encounter und
  Loot.
- `SMR-07` benötigt Scene und Karten. Kalender/Zeit sind Voraussetzung für
  Restock, Wetter und Autonomie in `SMR-08/09`.
- Der konkret abgelöste Cloud-GM-Strang arbeitet nur noch an unabhängigen
  Architektur-/Technikreviews. Andere Cloud-Kollegen behalten ihre bereits
  belegten Review-/Testrollen; sie werden nicht pauschal ersetzt.
- Neben den drei neuen lokalen Integrationssträngen bleiben die drei
  Gerätekollegen für Hex/Atlas, Stadt und Dungeon vollwertige Teammitglieder.
  Ihre geprüften Pfade, Belege und Dateibesitze werden in den Plattformentscheid
  einbezogen und nicht neu begonnen. Kein zweiter Besitzer ändert gleichzeitig
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

`SMR-00-ADR-01`: gemeinsamer Architekturentscheid über Zielplattform und
Migrationspfad, mit unabhängigem Cloud-Architektur-/Technikreview. Parallel
bleibt `CE-01-I03` geteilt möglich: Query-/State-/Render-Controller und dessen
DOM-Tests bleiben hostneutral und nutzen injizierte Ports; der bestehende
Obsidian-`ItemView` bleibt ein dünner, ausdrücklich befristeter Adapter mit
eigenen Übergangstests.
Dungeon-, Hex- und Stadtpfade laufen in ihren bestehenden Roadmaps weiter.
