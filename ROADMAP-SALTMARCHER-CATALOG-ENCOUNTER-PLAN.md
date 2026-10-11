# SaltMarcher-Katalog- und Encounter-Migration

Abschnitte: [Monsterkatalog](#monsterkatalog) · [Monster-Hostprüfung](#monster-hostprüfung) · [Gemeinsame Providerverträge](#gemeinsame-providerverträge) · [Itemquellen und Provider](#itemquellen-und-provider)

Stand: 10. Oktober 2026. Dieser Plan überführt die Katalog- und Encounter-
Funktionen aus `ThonkTank/Salt-Marcher` in das Obsidian-Plugin. SaltMarcher ist
die Implementierungs- und Verhaltensquelle; die vergleichbaren aktuellen
D&D-Beyond-Abläufe bilden die Mindestabnahme. Der bestehende Dungeon-, Hex- und
Stadtstand bleibt erhalten.

## Ziel und Grenzen

- Eine gemeinsame GM-Arbeitsfläche zeigt Monsterkatalog, Encounter-Aufbau und
  den laufenden Kampf ohne Seitenwechsel beim Hinzufügen oder Nachschlagen.
- Monster- und Encounterdaten liegen als versionierte Vaultdaten vor. Karten
  referenzieren stabile Encounter- und Kreaturenkennungen; Statblocks werden
  nicht in jede `.dungeon`-Datei kopiert.
- SRD-5.1-Daten aus SaltMarcher dürfen mit ihrer CC-BY-4.0-Provenienz übernommen
  werden. Nutzerinhalte bleiben eine getrennte Quelle.
- Das Plugin unterstützt ausschließlich die D&D-2014-Regeln. Encounter verwenden
  immer die DMG-2014-Schwellen und Monsterzahlmultiplikatoren; es gibt keinen
  Regelmodus, keinen 2024-Rechner und keine Regelversionsauswahl.
- Katalog, Plan und Laufzeitkampf sind getrennte Wahrheiten. Ein gespeicherter
  Plan enthält Zusammenstellung und Notizen; Initiative, HP, Runde, Zustände,
  Würfelprotokoll und Undo gehören zum fortsetzbaren Laufzeitstand.
- Diese Migration ersetzt weder die vorhandenen Raum-Keys noch deren aktuelle
  einfache Encounter-Auswertung. Sie verbindet diese schrittweise über stabile
  IDs und behält vorhandenen Text bytegenau bei.

## Referenzen

SaltMarcher-Quellen:

- `docs/catalog/requirements/requirements-catalog.md`
- `docs/creatures/requirements/requirements-creatures-catalog.md`
- `docs/creatures/requirements/requirements-creatures-details.md`
- `docs/encounter/requirements/requirements-encounter.md`
- `docs/encounter/requirements/requirements-encounter-generation.md`
- `docs/campaign/requirements/requirements-campaign-management.md`
- `docs/encounter/requirements/requirements-encounter-state-tab.md`
- `src/core/creatures/catalog.ts`
- `src/core/creatures/srd-5.1.generated.json`
- `src/core/encounter/`
- `src/renderer/features/catalog/`
- `src/renderer/features/encounter/`

Offizielle Produktreferenzen für die Mindestabnahme:

- D&D Beyond Encounters (DMG 2014):
  <https://dndbeyond-support.wizards.com/hc/en-us/articles/46363685344148-What-is-happening-to-the-Encounters-tool>
- D&D Beyond Monsterkatalog: <https://www.dndbeyond.com/monsters>
- D&D Beyond Encounter-Ablauf:
  <https://www.dndbeyond.com/posts/1135-tutorial-how-to-build-encounters-and-run-them-on-d>

## Offene Punkte vor Fachfreigabe

1. SaltMarcher bringt einen vollständigen SRD-5.1-Katalog und die benötigte
   2014-Mathematik, aber nicht alle vergleichbaren D&D-Beyond-2014-Filter. Die
   zusätzlichen Filter sind eine echte Erweiterung.
2. Das aktuelle Plugin besitzt einfache Kreaturdefinitionen in Karteninhalten,
   aber noch keinen vaultweiten Monster- oder Encounter-Speicher. Migration und
   ID-Verknüpfung müssen vorhandene Definitionen unverändert lesbar lassen.
3. Homebrew-Schema, Importformat und Konfliktauflösung brauchen vor dem ersten
   Schreib-Import einen eigenen Vertrag. Read-only SRD und manuell angelegte
   Datensätze dürfen nicht dieselbe Quellenkennung behaupten.
4. Würfelausdrücke aus Statblock-Prosa benötigen einen begrenzten Parser mit
   sichtbarer Rohformel; Freitext darf nicht als Code ausgeführt werden.
5. Vollständige Maus-/Tastatur-, Obsidian-Neustart- und beschädigte-Daten-
   Abnahme bleibt auf echten Hosts erforderlich.

## Phasen

### CE-00 – Vertrag, Provenienz und Golden Master

- Architektur, Datenbesitz, IDs, Versionen und Migrationsgrenzen festlegen.
- SaltMarcher-Dateien und D&D-Beyond-Funktionsmatrix den Abnahmefällen zuordnen.
- SRD-Lizenz/Attribution und die DMG-2014-Tabellen pinnen.
- Ergebnis: geprüfter Plan und offene Abnahmefälle; keine Funktionsfreigabe.

### CE-01 – Read-only Monsterkatalog

- Versionierten SRD-5.1-Katalog mit Manifest und Attribution übernehmen.
- Validierung toleriert keine beschädigten Einträge und meldet Quelle/Version.
- Volltextsuche; kombinierbare Filter für CR, Typ, Subtyp, Größe, Habitat,
  Alignment, AC, HP, Bewegung, Sinne, Verwundbarkeit, Resistenz, Immunität,
  Zustandsimmunität und Quelle. Eine Regelversionsauswahl entfällt vollständig.
- Sortierung, Paging, Reset, aktive Filter und vollständiger Statblock behalten
  Suche, Auswahl und Scrollposition.

### CE-02 – Vollständiger SaltMarcher-Katalog

- Gemeinsamer, zustandserhaltender Bereichswähler für Monster, Items,
  gespeicherte Encounter, NPCs, Fraktionen, Orte und Encounter-Tabellen.
- Alle Bereiche teilen 200-ms-Suche, Enter-Sofortsuche, Chips, Reset,
  Tabellenkopf-Sortierung, Paging/Footer, Lade-/Leer-/Fehlerzustände,
  tastaturbedienbare Auswahl und read-only Inspector.
- Items erhalten einen echten Referenzkatalog; SaltMarchers Loot-Index ist kein
  Ersatz für Itemdetails, Quelle, Einstimmung, Gewicht und Beschreibung.
- NPCs, Fraktionen, Orte und Encounter-Tabellen verwenden vault-native,
  revisionierte Dokumente. Zeilenauswahl bleibt nebenwirkungsfrei; nur
  ausdrückliche Aktionen übergeben Daten an Encounter, Szene oder Atlas.

### CE-03 – Encounter Builder und Planpersistenz

- Partyzeilen mit Level, Anzahl, Aktivzustand und frei benannten NPCs.
- Monster aus derselben Katalogansicht hinzufügen; gruppierte Menge und einzelne
  Exemplare bleiben semantisch verschieden.
- Live-Berechnung von Basis-XP, angepasstem XP und Schwierigkeit ausschließlich
  nach DMG 2014. Es gibt keinen auswählbaren Regelmodus.
- Plan anlegen, automatisch speichern, laden, duplizieren, neu starten, suchen,
  sortieren und löschen; Name, Kurzfassung, Beschreibung und Notizen erhalten.
- Generatorvorgaben bis zum Nutzerweg liefern: Einstellungen öffnen → geschütztes
  Systempreset kopieren → Rollen-/CR-Matrix, gültige Kombinationen, Mengenbereiche,
  Difficultygewichte und Mobschwelle bearbeiten → speichern → ausdrücklich einer
  Campaign zuweisen → Scene-/Sessiongenerierung konsumieren → frisch öffnen.
  Kopieren/Speichern weist nichts zu; Löschen eines Custompresets führt seine
  Campaigns auf den Systemfallback. Kein Regelversionswähler. Tastatur/Painting,
  Dirty-Wechsel, 200 %, stale Save mit erhaltenem Draft/Load-or-Copy und unbekannter
  Commandausgang über Receipt im selben Ergebnis prüfen. Installation besitzt
  Registry, Campaign nur Zuweisung; produktive Schreib-/Recoveryautorität mit
  Campaign/Data ([Campaign-Datenvertrag](ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md)) bestätigen, keine zweite Campaignregistry.
- Scene und Session konsumieren einen gemeinsamen Compositionselector und dieselbe
  kanonische Presetrevision/Confighash-Provenienz. Kandidaten vor Ranking gegen
  Rollen/Mengen/Kombinationen/Stock/Statblockkapazität prüfen; Domainranking geht vor
  seeded Entropie. Scene-„Auffüllen“ erhält vorhandene Mitglieder als additive Basis;
  fehlgeschlagene konkrete Materialisierung schwächt keinen gewählten CR-Block ab.
  Gleiche verfügbare Inputs ergeben gleiche abstrakte Blocks; erst der Encounterowner
  löst konkrete Creatures auf. Sourceartefakt/Gültigkeit, Scene-/Sessionparität und
  getrenntes <100-ms-p95-Selectorprofil nach Encounter Generation qualifizieren.
  Keine Übernahme der alten Electronmodal-/Schemaarchitektur durch diesen Lieferweg.

### CE-04 – Initiative und fortsetzbarer Kampf

- Automatische/manuelle Initiative, Vorteil/Nachteil, stabile Sortierung und
  A/B/C-Kennungen für einzelne gleiche Monster.
- Runde, aktueller Zug, Weiter, Rückgängig und freie Initiativeeinträge.
- Aktuelle/maximale/temporäre HP, Max-HP-Override, Schaden, Heilung, AC,
  Zustände, Zustandsimmunitäts-Hinweis und Bloodied/Dead-Ableitung.
- Jede Mutation wird atomar gespeichert; Neustart setzt denselben Stand fort.
- Effektives Preset/Revision/Hash und Mobschwelle beim Prepare festhalten. Null
  liefert individuelle Sources, die bestätigte Schwelle bündelt lebende Mengen.
  Explizite Sourceidentität/Partition speichern; Mobverstärkung bleibt Mob,
  vorhandene Individuals bleiben individuell. Erst ohne überlebende Source neu
  partitionieren. Schwellenwechsel, Verstärkung, Entfernen und Neustart erhalten
  Initiative-/HP-/Partitionwahrheit; keine Ableitung aus Namen oder Row-ID-Parsing.
  Quelle: Encounter Generation „Combat Consumption“, [Katalog-/Encountervertrag](ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md); [LiveScene-Vertrag](docs/plans/runtime/smr03-live-scene-contract.md), SMR-AC-06.

### CE-05 – Statblock-Aktionen und Live-Anpassung

- Angriff, Schaden, Check und Rettungswurf aus begrenzt erkannten Formeln.
- Würfelprotokoll mit Akteur, Aktion, Formel, Einzelwürfeln, Modifikator,
  Ergebnis und Zeit.
- Teilnehmer hinzufügen/entfernen, ohne übrigen Laufzeitstand zurückzusetzen.
- Reduzierte Spielersicht mit expliziter Sichtbarkeit verborgener Gegner.

### CE-06 – Dungeon-, Raum-Key- und Atlas-Verbindung

- Vorhandene Encounter-Namen/Links optional auf stabile Plan-IDs migrieren.
- Raum-Key-Kreaturen können ausdrücklich in einen Plan übernommen werden; bloßes
  Öffnen oder Auswählen verändert keinen Encounter.
- Encounter- und Kreaturenlinks fokussieren den zugehörigen Raum/Ort im
  gemeinsamen Atlas, ohne zweiten Editor- oder Kartenmodus.

### CE-07 – Fachreview, Nachbesserung und Aufräumen

- Alle Abnahmefälle auf frischem Obsidian-Prozess, Reload und beschädigten
  Fixtures prüfen; 900×650 und 1150×700 ohne horizontales Hauptscrollen.
- Die jeweils betroffenen Fach-/Hostfälle mit dem nutzbaren CE-Ergebnis prüfen. Fehlende Fach-/Hostabnahmen bleiben explizit offen.

## Mindestabnahme gegenüber D&D Beyond

1. `dragon` plus CR-, Größen-, Typ- und Quellenfilter liefert nur die
   Schnittmenge; Reset stellt den Katalog wieder her.
2. Jede Zeile zeigt Name, Quelle, Typ, Größe, CR, AC, HP und XP;
   der Statblock öffnet ohne Verlust des Katalogzustands.
3. Ein Golden-Master-Encounter wird reproduzierbar nach den gepinnten
   DMG-2014-Schwellen und Monsterzahlmultiplikatoren bewertet.
4. Party-, Aktiv- und Mengenänderungen aktualisieren die Bewertung unmittelbar.
5. Drei einzeln hinzugefügte Goblins besitzen drei Initiativen; eine Gruppe mit
   Menge drei besitzt eine gemeinsame Initiative und individuelle HP.
6. Initiativeänderung sortiert sofort und bleibt nach Neuöffnung erhalten.
7. Weiter rollt nach dem letzten Eintrag die Runde; Undo stellt Zug und Runde
   wieder her.
8. Schaden verbraucht temporäre HP zuerst; Heilung überschreitet maximale HP
   nicht und verändert temporäre HP nicht.
9. Runde, Zug, Initiative, HP, temporäre HP und Zustände überleben Neustart.
10. Live-Hinzufügen/-Entfernen erhält alle übrigen Teilnehmerzustände.
11. Würfelprotokolle enthalten sämtliche Eingaben und Einzelwürfel.
12. Zustände und Immunitätshinweise sind in Liste und Detail sichtbar.
13. Speichern, Duplizieren, Neustarten und Löschen haben getrennte Wirkung.
14. Maus und Tastatur erreichen alle Pflichtfunktionen; leerer Katalog,
    optionale Felder und beschädigte Einträge erzeugen keine ungefangenen Fehler.

## Bestehende Implementierung und Abnahmegrenzen

Die technischen CE-01-Anforderungen stehen im Abschnitt
[Monsterkatalog](#monsterkatalog).
`CE-01-I01` (komprimiertes Buildasset, Lazy Loader und Inventar) ist geprüft
und nach Reparaturreview bestanden. `CE-01-I02` stellt den eigenen
Katalog-`ItemView`, eindeutigen Command-Fokus und den Kernfluss aus Suche,
Filtern, Sortierung, Paging, Auswahl und Statblock als geprüften
Umsetzungskandidaten bereit. `CE-01-I03` ergänzt die übrigen 2014-Filter,
Mehrfachwerte, Chips/Reset, Debounce/Stale-Schutz, responsive Barrierefreiheit,
einen fokussierten DOM-Harness und atomare Draft-Übernahme beim Host-Lifecycle.
`CE-01-R01` fand einen Unique-View-Concurrency-Race und selectorunsicheren
Tastaturfokus. `CE-01-N01` reparierte beide Pfade; `CE-01-R02` bestand nach
expliziten Regressionen. `CE-01-H01` bestand seinen automatisierten echten
Obsidian-Umfang. `CE-01-C01` zentralisierte Restore-, Default- und Draftregeln;
sein erster Review fand eine verbleibende Content-Duplizierung, die
`CE-01-C01-N01` beseitigte. Der unabhängige Re-Review schloss das Aufräumtor.
Historischer Nachfolger war `CE-02-P01`, der eigene technische Fachplan für den
vollständigen SaltMarcher-Katalog. Physische CE-01-Eingabe, Screenreader und
weitere Plattformen bleiben offen; noch keine vollständige CE-01- oder
Encounter-Fachfreigabe behaupten.

## Monsterkatalog

## Monsterkatalog — Ausgangslage

- CE-00 stellt einen geprüften, reinen Katalogkern mit 334 SRD-5.1-Kreaturen,
  Manifestbindung, unabhängigem Artefakthash, kombinierten Filtern, Sortierung,
  Paging, Detailzugriff und tiefer Immutabilität bereit.
- Der Katalogkern ist noch nicht vom Produktionseinstieg erreichbar. Das ist
  absichtlich so, weil sein statischer JSON-Import beim Pluginstart vermeidbare
  Kosten verursachen würde.
- Der bestehende Build erzeugt ein einzelnes CJS-`main.js`; die Hostinstallationen
  kopieren zuverlässig nur `main.js`, `manifest.json` und `styles.css`.
- Die reproduzierbare Produktbaseline auf Commit
  `86ce73179ede452ee6a9f5d3197ee325544a58b8` unter Node `v24.19.0` ist
  1.189.370 Bytes unkomprimiert und 344.194 Bytes gzip. Messbefehl:
  `npm run build && wc -c main.js && gzip -9 -c main.js | wc -c`.
- Nicht eingecheckte Einmalproben ergaben für ein isoliertes Katalogbundle
  606.237 Bytes beziehungsweise 96.282 Bytes gzip, für das rohe JSON 106.150
  Bytes gzip beziehungsweise 141.536 Base64-Zeichen und für eine einzelne
  Node-Materialisierung rund 28,84 ms sowie 3.154.264 Bytes Heap-Zuwachs.
  Diese Werte sind **unverifizierte Planungsbeobachtungen**: Ohne
  eingechecktes Messskript, Warmup-/Sampledefinition und Receipt sind sie
  weder Abnahmebeleg noch Leistungsbaseline. CE-01-I01 ersetzt sie durch ein
  reproduzierbares Buildinventar; echte Start-/Ladezeit bleibt Hostabnahme.

## Monsterkatalog — Verbindliche Entscheidungen

1. Der Katalog wird ein eigener `ItemView` mit dem View-Type
   `dungeon-creature-catalog`. Ein Befehl `Monsterkatalog öffnen` öffnet oder
   fokussiert genau eine Ansicht. Ein Modal ist ungeeignet, weil Query,
   Auswahl, Paging, Scrollposition und später die parallele Encounter-Spalte
   über Fokuswechsel erhalten bleiben müssen.
2. Das SRD-Artefakt wird beim Build gegen `SRD_5_1_ARTIFACT_SHA256` geprüft,
   gzip-komprimiert und durch ein virtuelles Modul als Base64-String in
   `main.js` eingebettet. Es entsteht kein viertes zwingendes Pluginasset.
   Die Identität liegt in einem kleinen, von Produkt und Build lesbaren
   Manifestmodul beziehungsweise JSON; ein zweites manuell gepflegtes
   SHA-Literal im Build ist unzulässig.
3. `creature-catalog.ts` enthält nur Typen, Parser, Query und Katalogklasse. Es
   importiert kein JSON. Ein kleiner Loader dekodiert und dekomprimiert das
   virtuelle Modul erst beim ersten Öffnen, parst es und cached genau eine
   unveränderliche Kataloginstanz. Fehler leeren den Cache für einen bewussten
   Wiederholversuch.
   Der Runtimepfad ist verbindlich `atob` → `Uint8Array` →
   `DecompressionStream("gzip")` → `TextDecoder` → `JSON.parse`. Vor dem
   Dekodieren prüft der Loader `atob`, `DecompressionStream`, `TextDecoder`
   und `Response`; fehlt eine Fähigkeit, zeigt die Ansicht einen expliziten
   nicht-verfügbar-/Fehlerzustand. Es gibt keinen stillen eager Fallback und
   keinen Node-`zlib`-Import im Browserbundle.
4. Der Produktstart materialisiert nur den komprimierten String. Der 334
   Statblocks umfassende Objektgraph entsteht erst bei tatsächlicher
   Katalognutzung. Das vermeidet zusätzliche Installationsdateien und den
   bisherigen eager JSON-Objektliteral-Import.
5. Der vollständige Notice ist in der Ansicht über `Quelle & Lizenz` direkt
   erreichbar. Er nennt WotC/SRD 5.1, CC-BY-4.0 mit Link, 5e-bits, SaltMarcher,
   Normalisierung/Anreicherung und Kopie. Der sichtbare, in `main.js`
   eingebettete Notice ist die distributionsfeste Produktquelle;
   `NOTICE.md` bleibt derzeit nur zusätzlicher Repositoryhinweis. Erst ein
   künftig belegter erweiterter Paketweg darf ihn als Releaseasset behandeln.
6. CE-01 besitzt nur D&D-2014-Daten. Es gibt keine Regelversionsauswahl und
   keinen 2024-/Legacy-Filter.

## Monsterkatalog — Oberfläche und Zustandsbesitz

`CreatureCatalogView` besitzt pro geöffneter Ansicht:

- akzeptierte Query und noch nicht veröffentlichte Texteingabe,
- ausgewählte Kreaturen-ID,
- Seite, Sortierspalte und Richtung,
- Ergebnis- und Detailprojektion,
- Scrollposition von Ergebnisliste und Detailbereich,
- 200-ms-Debounce-Timer, Query-Generation und einen `AbortController`.

Die erste schmale Umsetzung verwendet drei Bereiche:

1. Eine kompakte Filterleiste mit Namenssuche, CR min/max, Typ, Größe,
   Habitat, Alignment, AC min/max, HP min/max sowie Freitextfeldern für
   Bewegung, Sinne, Verwundbarkeit, Resistenz, Immunität und
   Zustandsimmunität. Quelle ist sichtbar `SRD 5.1`; sie ist kein sinnloser
   Einzelauswahlfilter.
2. Eine semantische Ergebnistabelle mit sortierbaren Spalten Name, HG, RK, TP
   und XP. Typ, Größe und Quelle bleiben sichtbar. Tabellenfuß enthält Anzahl,
   Seite, Zurück/Weiter und eindeutigen Lade-/Leer-/Fehlerstatus.
3. Ein read-only Statblock-Inspector mit Name, Metazeile, RK/TP/Bewegung,
   Attributen, Rettungswürfen, Fertigkeiten, Sinnen, Sprachen,
   Verwundbarkeiten/Resistenzen/Immunitäten, Eigenschaften, Aktionen und
   legendären Aktionen. Er verändert weder Karte noch Encounter.

Alle aktiven Filter erscheinen als einzeln entfernbare Chips; `Zurücksetzen`
leert nur Filter und springt auf Seite eins. Sortierung bleibt erhalten. Ein
Nameklick, Doppelklick oder Enter auf einer ausgewählten Zeile öffnet Details.

## Monsterkatalog — Tastatur und Barrierefreiheit

- Suchfeld und Filter besitzen sichtbare Bezeichnung oder `aria-label`.
- Tabellenkopf-Buttons veröffentlichen `aria-sort`.
- Ergebniszeilen sind per Tab erreichbar; Pfeil hoch/runter verschiebt die
  Auswahl, Enter öffnet Details.
- Status verwendet `role=status`, Fehler `role=alert`; Detailüberschriften
  behalten eine nachvollziehbare Hierarchie.
- Escape leert eine geöffnete Detailauswahl, aber nicht die Filter.
- Fokus wird bei einer Aktualisierung nicht versetzt. Eine weiterhin vorhandene
  Auswahl bleibt nach Query-/Sortieränderung über ihre stabile ID erhalten.

## Monsterkatalog — Umsetzungspakete

### Monsterkatalog — CE-01-I01 – Komprimiertes Buildasset und Lazy Loader

Status: umgesetzt, Basisprüfungen und 222 Tests grün, nach Reparaturreview
bestanden. Das Buildinventar misst 102.021 Gzip-Bytes, 136.028
Base64-Zeichen und 144.954 Bytes `main.js`-Zuwachs; alle festgelegten Grenzen
sind eingehalten. Katalog-UI und Hostabnahme bleiben offen.

- JSON-Import aus `creature-catalog.ts` entfernen.
- Hashprüfenden, einmalig cachenden Loader ergänzen.
- Build um das hashgeprüfte virtuelle Gzip-/Base64-Modul und eine
  objektive Payload-Grenze erweitern: höchstens 122.880 Gzip-Bytes, höchstens
  164.000 Base64-Zeichen und höchstens 180.000 tatsächlich in `main.js`
  emittierte Bytes des virtuellen Katalogpayloads. Das gesamte Wachstum von
  `main.js` gegenüber der gebundenen 1.189.370-Byte-Baseline bleibt als
  Inventarwert sichtbar, ist aber kein Kataloggate für spätere Atlas-, City-
  oder andere Produktfunktionen. Das Buildinventar dokumentiert Quelle,
  Commit, Node-Version, Befehl, Payloadanteil und Gesamtwachstum.
- Lazy-, Fehler-/Retry-, Hash-, Notice- und Buildinventartests ergänzen.

### Monsterkatalog — CE-01-I02 – View-Grundgerüst und Kernfluss

Status: umgesetzt; Typprüfung, 225 Tests und Build bestanden. Unabhängiger
Review, DOM-/Obsidian-Host und Fachabnahme bleiben offen.

- View-Type, Registrierung und Command-Fokus ergänzen.
- Suche, CR/Typ/Größe, Sortierung, Paging, Auswahl und vollständigen Statblock
  mit stabiler View-Session implementieren.
- Kein Encounter-Button in diesem Paket.

### Monsterkatalog — CE-01-I03 – Erweiterte Filter, Chips und Responsive/A11y

Status: umgesetzt; Typprüfung, 235 Tests einschließlich hostneutralem DOM-
Harness und Build bestanden. Ein Reparaturreview bestätigt Filterprojektion,
Mehrfachwerte, Chips/Reset, 200-ms-Drafts, Timer-Cleanup, atomare Übernahme
ausstehender Drafts beim Host-Lifecycle und Fokusfallbacks.
Der CSS-Container und seine Breakpoints sind statisch belegt; echte
Obsidian- und 900×650-/1150×700-Abnahme bleiben offen.

- Query, State, Render-Controller und DOM-Host-Prüfungen bleiben hostneutral
  und erhalten alle Hostfähigkeiten über injizierte Ports. Der bestehende
  Obsidian-`ItemView` ist nur ein dünner Übergangsadapter; Command-/View-Tests
  prüfen diesen Adapter getrennt und begründen keine dauerhafte Hostbindung.
- Verbleibende D&D-Beyond-2014-vergleichbare Filter, einzelne Chips und Reset.
- Den lokalen statischen I02-Befund reproduzieren und beheben: `change()` darf
  beabsichtigte Scroll-Resets nicht durch ein nachfolgendes `captureScroll()`
  aus dem alten DOM überschreiben.
- Responsive Containerregeln am tatsächlichen Katalogcontainer aktivieren und
  im DOM-Host belegen; derzeit ist `container-type` nur für den Editorhost
  nachgewiesen.
- Tastaturablauf, 200-ms-Debounce, Statuszustände und Layout bei 900×650 und
  1150×700 fertigstellen.

## Monsterkatalog — Fokussierte Prüfungen

- `npm run check`, `npm test`, `npm run build` auf jedem Produktpaket.
- Reiner Loader-Test: keine Dekompression vor `load()`, gültige und beschädigte
  Payload, Retry nach behobenem Fehler und genau eine Instanz bei parallelem
  Öffnen.
- Buildtest: `main.js` enthält weder den Aboleth-Statblocktext noch den
  unkomprimierten Katalog-JSON-Korpus, aber Notice/CC-URL und das begrenzte
  virtuelle Payloadmodul; Build bricht bei abweichendem Quellhash oder einem
  der drei numerischen Payloadlimits ab.
- Viewtest mit DOM-Host: Debounce, stale Query, Schnittmengenfilter, Paging,
  Auswahlbeibehalt, Enter/Escape, `aria-sort`, Status und Notice.
- Echte Obsidian-Abnahme auf einem Gerät: Öffnen aus der Command Palette,
  Suche/Filter/Detail, Fokuswechsel, View schließen/neu öffnen und frischer
  Prozess. Andere Geräte dürfen parallel ihre eigene einzelne Hostinstanz
  prüfen.

## Monsterkatalog — Offene Abnahme

- CE-AC-01 bleibt bis zu I03 und echtem Host offen.
- CE-AC-02 bleibt bis zum vollständigen Inspector und nachgewiesenem
  Zustands-/Scroll-Erhalt offen.
- CE-AC-14 bleibt bis zur Tastatur-, Fehler- und beschädigten-Asset-Abnahme
  offen.
- Sämtliche Encounter-Fälle CE-AC-03 bis CE-AC-13 bleiben vollständig offen.

## Monster-Hostprüfung

## Monster-Hostprüfung — Zweck und Grenze

Dieser Lauf prüft den auf `active/installed-phase1` integrierten CE-01-Kandidaten
in einer echten, isolierten Obsidian-Desktopinstanz. Er ändert keine
Produktdatei und erteilt allein keine CE-01-Fachfreigabe. Automatisierte
Playwright-Eingaben belegen den echten Hostpfad, ersetzen aber keine spätere
physische Tastatur-/Mausprüfung; diese Grenze bleibt im Receipt ausdrücklich
offen.

Die Abnahme verwendet ausschließlich das QA-Vault unter
`/home/aaron/.cache/dungeon-native-qa/`. Produktive Vaults, Karten und
Benutzerdaten werden nicht verändert. Auf diesem Gerät läuft gleichzeitig nur
eine grafische Obsidian-, Original- oder Prototypinstanz.

## Monster-Hostprüfung — Läufe und Belege

### Monster-Hostprüfung — H01-A – Kernablauf und frischer Prozess

1. `npm run check`, `npm test` und `npm run build` müssen auf sauberem SHA
   bestehen. SHA-256 und Größe von `main.js`, `manifest.json` und `styles.css`
   werden vor dem Start erfasst.
2. Obsidian startet mit eigenem Config-/Cache-/Data-Root und genau dem
   `dungeon-editor`-Plugin. Der Katalog wird über die sichtbare Command Palette
   mit `Monsterkatalog öffnen` geöffnet, nicht durch einen direkten View-Aufruf.
3. Zwei überlappende Command-Ausführungen ergeben genau einen
   `dungeon-creature-catalog`-Leaf; der kanonische Leaf ist aktiv und sichtbar.
4. Suche, mindestens zwei kombinierte Filter, Chipentfernung, Sortierung,
   Paging, Zeilenauswahl, Enter, Pfeiltaste, Escape und `Quelle & Lizenz` werden
   über echte Host-DOM-Eingaben geprüft. Filter, Auswahl, Paging, Ergebnis- und
   Detailscroll bleiben bei Fokuswechsel und Rückkehr erhalten.
5. Bei 900×650 und 1150×700 bleiben Filter, Ergebnistabelle, Status, Inspector
   und Lizenzzugang erreichbar; der Hauptcontainer besitzt keinen horizontalen
   Überlauf. Bounding-Boxen, Scrollmaße und Screenshots werden gespeichert.
6. Der Edit-Lauf beendet Obsidian normal. Ein eigener `--restart`-Lauf öffnet
   denselben QA-Workspace in einem frischen Prozess und verifiziert exakt den
   serialisierten Viewzustand. Danach wird der Leaf geschlossen und über die
   Command Palette sauber als genau ein neuer Default-Leaf geöffnet.

### Monster-Hostprüfung — H01-B – Beschädigte Payload und Retry

Ein separater frischer Hostlauf injiziert vor dem ersten Katalogzugriff genau
einmal beschädigte, von `atob` gelieferte Gzip-Bytes. Der unveränderte
Produktdecoder muss einen sichtbaren `role=alert`-Fehler mit
`Erneut versuchen` zeigen; es darf weder ungefangenen Pagefehler noch einen
zweiten Katalogleaf geben. Nach Rücknahme der Fault-Injection lädt derselbe
Retry-Button den vollständigen Katalog. Das Receipt bezeichnet dies als
kontrollierte Host-Fault-Injection und nicht als Nachweis eines manipulierten
Releasebundles.

Jeder Lauf schreibt unter einem neuen unveränderlichen Verzeichnis in
`/home/aaron/.cache/dungeon-native-qa/` mindestens `build.json`,
`plugin-state.json`, `result.json`, `catalog-state.json`, Layoutmessungen,
Screenshots, Console-/Pagefehler und Speichertelemetrie. Vorhandene Receipts
werden nicht überschrieben.

## Monster-Hostprüfung — Gates

- Exakter sauberer Git-SHA und Pluginhash stimmen in Edit-, Restart- und
  Faultlauf überein.
- 0 ungefangene Pagefehler und 0 unerwartete Consolefehler.
- Genau ein sichtbarer Katalogleaf nach jeder Einzel- oder Doppelöffnung.
- Kombinierte Filter, Detailauswahl, Fokus, Scroll und Lizenz erfüllen den
  dokumentierten CE-01-Vertrag.
- Restart stellt den gespeicherten Zustand im frischen Prozess wieder her;
  manuelles Schließen und Neuöffnen erzeugt einen sauberen einzelnen
  Default-Leaf.
- Beide Größenprofile sind ohne horizontalen Hauptüberlauf bedienbar.
- Faultlauf zeigt den expliziten Fehler und besteht nach Retry.
- Ein erzwungener Prozessabbruch, fremde QA-Prozesse, geänderte Produktdateien
  oder fehlende Belege sind `failed`, nicht `passed with warning`.

## Monster-Hostprüfung — Review und verbleibende Grenzen

Nach den Läufen prüft ein unabhängiger Read-only-Review den exakten SHA,
Szenariocode und sämtliche Receipts. Pflichtbefunde werden in einem getrennten
Nachbesserungslauf repariert und erneut geprüft. Physische Eingabe und jede
nicht ausgeführte Plattform-/Screenreaderprüfung bleiben offen. Erst nach
bestandenem H01-Review darf `CE-01-C01` mit eigenem Plan, Umsetzung und Review
beginnen.

## Monster-Hostprüfung — Ergebnis vom 9. Oktober 2026

Der automatisierte H01-Scope ist auf dem sauberen Commit
`aa6d92d6cb1d8c8e06a0a61233ad837d25e40c05` unabhängig geprüft und
freigegeben. `npm run check`, 242/242 Tests und `npm run build` bestanden;
`main.js` ist 1.339.676 Byte groß, liegt mit 150.306 Byte Wachstum unter dem
180.000-Byte-Limit und besitzt in allen drei Läufen denselben SHA-256
`3a383cbc8853133e4d55af388c86ec70e93230cee8dffc32ba35cf0676f3cdad`.

Maßgebliche Receipts:

- `/home/aaron/.cache/dungeon-native-qa/evidence/1791557643230-ce01-catalog-edit`
- `/home/aaron/.cache/dungeon-native-qa/evidence/1791557649842-ce01-catalog-reopen`
- `/home/aaron/.cache/dungeon-native-qa/evidence/1791557655176-ce01-catalog-damaged-edit`

Jeder Lauf bindet eine eigene systemd-Unit und Invocation-ID sowie MainPID,
Obsidian-PIDs, Startticks und Cgroup. Alle drei Receipts belegen normalen
`app.quit()`-Ausstieg, `Result=success`, `ExecMainStatus=0` und keine erzwungene
Terminierung. Der reale Hostlauf fand zwei Produktfehler: browsernative Timer
wurden mit einem unzulässigen Empfänger aufgerufen, und normalisierte
`undefined`-Werte überschrieben nach leerem Restore die expliziten
Sortier-/Richtungs-/Seitendefaults. Beide Fehler und die Hostharness-Belege
wurden repariert und regressionsgetestet.

Dieses Ergebnis schließt ausschließlich den automatisierten Real-Host-Scope.
Physische Tastatur/Maus, Screenreader und nicht ausgeführte Plattformen bleiben
offen und werden durch Playwright nicht ersetzt. CE-01 erhält deshalb noch
keine vollständige Fachfreigabe.

## Gemeinsame Providerverträge

## Gemeinsame Providerverträge — Ziel und Wahrheitsgrenze

CE-02 erweitert den bestehenden, qualifizierten Monsterkatalog zu genau einem
zustandserhaltenden Katalog mit sieben Bereichen:

1. Monster;
2. Items;
3. gespeicherte Encounter;
4. NPCs;
5. Fraktionen;
6. Orte;
7. Encounter-Tabellen.

Bindend sind die CE-02-Anforderungen in
`ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md`, die dokumentierten
SaltMarcher-Anforderungen und -Verträge sowie die bestehenden CE-01-Belege.
SaltMarcher-Code ist nur Verhaltensreferenz. Die aktuelle Zielarchitektur
entscheidet Datenbesitz und Adapter.

CE-02 ist erst vollständig, wenn alle sieben Bereiche ihre echten, geprüften
Datenquellen besitzen. Ein sichtbarer Bereichswähler oder ein typisierter
Nichtverfügbar-Zustand ist allein keine Fachfreigabe. CE-01 bleibt trotz dieser
Planung mit physischer Eingabe, Screenreader und weiteren Plattformen offen.

## Gemeinsame Providerverträge — Nichtziele

Dieser Plan autorisiert noch keine Umsetzung von:

- Item-Import, Loot-Erzeugung, Inventar- oder Shopmutation;
- Encounter-Builder, DMG-2014-Berechnung, Initiative oder Combat-State;
- CRUD-Oberflächen für NPCs, Fraktionen, Orte oder Encounter-Tabellen;
- automatische Übergaben an Encounter, Scene oder Atlas;
- SQLite, eine allgemeine Repository-/ORM-Schicht oder eine zweite
  Katalogwahrheit;
- eine Vorentscheidung der noch vorgeschlagenen Zielplattform-ADR.

## Gemeinsame Providerverträge — Ein gemeinsamer Katalog, sieben Eigentümer

### Gemeinsame Providerverträge — Kanonische Bereichsquelle

Eine einzige geordnete, unveränderliche `CATALOG_SECTIONS`-Definition ist die
Quelle für Schlüssel, Label, Reihenfolge und Capability-Status. Die Schlüssel
sind stabil und hostneutral:

`creatures`, `items`, `savedEncounters`, `npcs`, `factions`, `places`,
`encounterTables`.

Rail, Persistenznormalisierung, Fokusfolge, Tests und Providerregistrierung
leiten sich aus dieser Quelle ab. Kein zweites Array, Switch mit denselben
sieben Paaren oder manuell synchronisierte Tab-/State-Liste ist zulässig.

### Gemeinsame Providerverträge — Zustand

Der neue hostneutrale `CatalogWorkspaceState` besitzt eine explizite
Schemaversion, `activeSection` und genau einen getrennten Zustand je Bereich.
Jeder Bereich behält mindestens:

- angewandte Suche und noch nicht angewandten Draft;
- bereichseigene Filter und Chips;
- Sortierspalte und Richtung;
- Seite;
- ausgewählte stabile ID;
- Ergebnis- und Inspector-Scrollposition;
- den letzten sichtbaren Lade-/Leer-/Fehlerstatus nur soweit er keine
  veralteten Daten als Wahrheit persistiert.

Der Monsterzustand bleibt der bestehende `CreatureCatalogViewState` und wird
nicht in einen kleinsten gemeinsamen Datentyp gepresst. Die anderen Bereiche
erhalten eigene typisierte States. Eine State-Map kapselt diese Typen, ohne
ihre fachlichen Filter anzugleichen.

Die Normalisierung erkennt ausschließlich den aktuellen unversionierten
CE-01-Zustand als Ausgang des fortgeführten Produkts und legt ihn verlustfrei
unter `sections.creatures` ab. Unbekannte Bereichsschlüssel, ungültige Werte
und beschädigte Payloads werden verworfen oder auf dokumentierte Defaults
gesetzt; sie dürfen keinen anderen Bereich beschädigen. Es gibt keine
Migration historischer Alt-Editorformate.

### Gemeinsame Providerverträge — Gemeinsame Interaktion

Alle Bereiche verwenden:

- 200-ms-Draftsuche mit sofortigem Enter-Flush;
- entfernbare aktive Chips und bereichseigenen Reset;
- sortierbare Tabellenköpfe;
- begrenztes Paging und Ergebnisfooter;
- explizite Lade-, Leer-, Nichtverfügbar-, ungültige-Filter- und Fehlerzustände;
- tastaturbedienbare Zeilenauswahl;
- einen read-only Inspector.

Der Bereichswähler ist ein zugängliches Tab-/Panel-Muster mit sichtbarer
Auswahl, roving Tabindex, Pfeil/Home/End sowie Enter/Space. Umschalten speichert
den alten Bereichszustand vor dem Rendern des neuen. Escape schließt nur die
aktuelle Auswahl, nicht den Bereich. Auswahl bleibt nebenwirkungsfrei; eine
spätere Übergabe benötigt einen ausdrücklich benannten Button und ein eigenes
Anwendungskommando.

## Gemeinsame Providerverträge — Hostneutrale Providergrenze

Die View erhält eine registrierte read-only Provider-Map. Jeder Provider
besitzt seinen Query-, Row-, Detail- und Fehlervertrag und bietet nur:

- eine begrenzte, deterministisch sortierte Ergebnisseite;
- Detail für eine stabile ID;
- Capability-/Quellenmetadaten;
- `AbortSignal` beziehungsweise eine gleichwertige Abbruchgrenze.

Rows und Details sind immutable DTOs. Provider veröffentlichen keine
Speicherrecords, Vaultpfade, SQLitezeilen, mutable Domainmodelle oder
allgemeinen Querybuilder. Die View importiert keinen Vault-, Datei- oder
Datenbankadapter.

Jede Anfrage bindet Bereichsschlüssel und monotone Generation. Nach einem
Bereichswechsel, neuer Suche oder Close dürfen verspätete Resultate weder den
aktuellen Bereich noch dessen Auswahl, Footer oder Inspector überschreiben.
Fehler und Retry sind auf genau den betroffenen Bereich begrenzt.

Die gemeinsame Shell besitzt Rail, Header, Status, Ergebnisfläche, Footer und
Inspector. Bereichseigene Filter, Spalten, Row- und Detailprojektionen werden
über enge Deskriptoren eingesetzt. Es entstehen weder sieben Viewkopien noch
ein generischer Renderer, der unvalidiertes HTML oder beliebige Funktionen aus
Datenquellen ausführt.

## Gemeinsame Providerverträge — Datenbesitz je Bereich

### Gemeinsame Providerverträge — Monster

Die vorhandene CE-01-Wahrheit bleibt unverändert: gepinnte SRD-5.1-Daten,
Manifest, SHA-256, Attribution, lazy Loader und `CreatureCatalog`-API. Filter,
Draftzuordnung und Statblockprojektion werden nicht dupliziert. Der neue Shell-
Adapter muss die bestehenden CE-01-Tests und Hostbelege erhalten.

### Gemeinsame Providerverträge — Items

Items erhalten einen eigenen lokalen, read-only Referenzkatalog mit stabilen
Quellenschlüsseln. Vor dem ersten Datenimport benötigt das Umsetzungspaket:

- eine ausdrücklich freigegebene öffentliche Quelle samt Version, Lizenz und
  Attribution;
- Manifest, Dateihash und reproduzierbaren Generator;
- ein Schema für Name, Kategorie, Unterkategorie, Rarität, Magiestatus,
  Einstimmung, Kosten, Gewicht, Eigenschaften, Beschreibung, Schadens- oder
  Rüstungsdaten und Quellenverweis;
- fail-closed Unterscheidung von fehlendem Import, inkompatiblem Schema und
  beschädigten Daten.

SaltMarchers Loot-Index ist ausdrücklich keine Item-Detailquelle. Browsing
führt keinen Netzwerkzugriff und keine Mutation aus.

### Gemeinsame Providerverträge — Gespeicherte Encounter

Encounter bleibt alleiniger Eigentümer. Die Katalogsuche liest nur stabile
Plan-ID, Name und Encounter-eigene Kurzfassung. Roster und XP werden erst für
die ausgewählte ID über einen getrennten begrenzten Detailread hydratisiert.
Statblocks, Initiative, HP, Runde, Zug und Combat-State werden weder kopiert
noch hier gespeichert.

Der Zieladapter verwendet revisionierte, vault-native Encounter-Dokumente und
einen Encounter-eigenen Index. Dokumentformat, Revision, atomarer Write,
Rebuild des Index und Konfliktverhalten benötigen vor der ersten Persistenz ein
eigenes reviewtes Schema-/Owner-Paket; CE-02 implementiert nur read-only Ports.

### Gemeinsame Providerverträge — NPCs, Fraktionen und Orte

World Planner besitzt die revisionierten vault-nativen Dokumente und ihre
Indizes:

- NPC: stabile Identität, Name, Creature-ID-Referenz, Lebenszyklus, Notizen und
  optionale Fraktions-/Ortsreferenzen; keine kopierten Statblockfelder;
- Fraktion: stabile Identität, Name, Notizen, Mitgliedschaften, Disposition,
  primäre Encounter-Table-ID und Inventargrenzen;
- Ort: stabile Identität, Name, geordnete Tags, Read-aloud, GM-Notizen sowie
  Referenzen auf Fraktionen und Encounter-Tabellen.

Die Katalogprovider veröffentlichen read-only Projektionen. Fremde Creature-
oder Encounter-Table-Wahrheit wird über deren Besitzer nachgelesen. Auswahl
mutiert keine Beziehung und keine globale Scene.

### Gemeinsame Providerverträge — Encounter-Tabellen

Encounter Tables besitzt stabile Tabellen-IDs, revisionierte vault-native
Dokumente und einen eigenen read-only Provider. Auswahl kopiert weder
Tabellenmitgliedschaften noch Creature-Wahrheit. Spätere Pool-/Encounter-
Aktionen referenzieren IDs über eigene Commands.

Auch für World Planner und Encounter Tables müssen Format, Revision,
atomarer Write, Indexrebuild und Konfliktverhalten in eigenen Owner-Paketen
reviewt werden, bevor ihre Persistenz als geliefert gilt. Die Viewer-Shell
erfindet diese Verträge nicht.

## Gemeinsame Providerverträge — Umsetzungspakete

### Gemeinsame Providerverträge — CE-02-I01 – Shell und Zustand

- kanonische sieben Bereichsdefinitionen;
- versionierter Workspace-State mit verlustfreier CE-01-Einordnung;
- gemeinsamer Rail-/Shell-/Status-/Paging-/Inspector-Rahmen;
- read-only Providerverträge und Stale-/Abort-Schutz;
- echter Monsterprovider über die vorhandene API;
- für die sechs noch nicht gelieferten Provider ausschließlich ehrliche
  `unavailable`-Capabilities mit erklärendem Status.

I01 schließt keinen neuen Datenbereich und CE-02 nicht ab. Es darf keine
Beispiel- oder erfundene Produktwahrheit als Inhalt anzeigen.

### Gemeinsame Providerverträge — CE-02-I02 – Items

Nach eigenem Provenienz-/Schema-Review: gepinnter Itemkatalog, Generator,
Manifest/Attribution, Provider, Filter, Sortierung, Paging und vollständiger
read-only Inspector. Item-Acceptance wird getrennt reviewed; die übrigen fünf
Provider bleiben dadurch nicht bestanden.

### Gemeinsame Providerverträge — CE-02-I03 – Encounter-Readmodel

Nach reviewtem Encounter-Dokument-/Indexvertrag: gespeicherte Encounter suchen,
auswählen und begrenzt hydratisieren. Keine Builder- oder Combatmutation.

### Gemeinsame Providerverträge — CE-02-I04 – World-Planner-Readmodels

Nach reviewten Owner-Schemata: NPCs, Fraktionen und Orte als getrennte
Providerprojektionen. Beziehungen werden nur gelesen und als stabile Links
gezeigt.

### Gemeinsame Providerverträge — CE-02-I05 – Encounter-Table-Readmodel

Nach reviewtem Tabellenvertrag: suchen, auswählen, inspizieren; keine
Generierung oder globale Poolmutation.

### Gemeinsame Providerverträge — CE-02-H01 und CE-02-C01

Der gemeinsame echte Hostlauf muss alle sieben realen Provider prüfen. Die Providerbelege allein ersetzen keine Encounter-Builder- oder Combatabnahme. Offene Providerbefunde bleiben sichtbar und werden nicht durch spätere Funktionsbelege geschlossen.

## Gemeinsame Providerverträge — Besitzdateien

CE-02-I01 darf ausschließlich besitzen:

- neue enge Section-/Workspace-State-/Providerdateien unter
  `src/features/catalog/`;
- gezielte Anpassungen an
  `src/features/catalog/creature-catalog-view-content.ts`,
  `src/features/catalog/creature-catalog-view.ts`, die eng begrenzten
  Katalog-Selektoren in `styles.css` für sichtbare Tabwahl/Fokus und nur bei tatsächlichem
  Hostbedarf `src/ui/view-types.ts`/`src/main.ts`;
- passende Core-, DOM- und Adaptertests;
- `tools/host/ce02-catalog.cjs` erst für den späteren Hostlauf;
- CE-02-Plan-, Checkpoint- und Acceptance-Metadaten.

I01 besitzt keine Itemdaten, Encounter-/World-Planner-Persistenz, SQLite,
Combat-, Scene- oder Atlasdateien. I02 bis I05 erhalten vor Umsetzung jeweils
einen engeren, separat reviewten Besitzsatz. Fremde Hex-, Stadt-, Dungeon- und
ADR-Dateien bleiben unberührt.

## Gemeinsame Providerverträge — Automatisierte Gates

Für jedes Produktpaket bestehen `npm run check`, `npm test` und
`npm run build`. I01 benötigt zusätzlich mindestens:

- exakt sieben Schlüssel, Label und Reihenfolge aus der einen kanonischen
  Quelle;
- Migration des aktuellen CE-01-Zustands sowie Normalisierung beschädigter,
  unbekannter und partieller Workspace-Payloads;
- Bereichswechsel erhält je Bereich Draft/Applied Query, Filter, Sortierung,
  Seite, Auswahl und beide Scrollpositionen;
- 200-ms-Debounce, Enter-Flush, Reset, Chips, Tabellenkopf, Paging und
  Zeilennavigation laufen über gemeinsame Interaktionspfade;
- roving Bereichsfokus und Tastaturfolge einschließlich Home/End;
- verspätete, abgebrochene und fehlerhafte Providerantworten bleiben im
  verursachenden Bereich;
- Missing-/Unavailable-/Empty-/Invalid-/Error-Zustände sind unterscheidbar und
  retrybar, ohne Monster zu beschädigen;
- Auswahl ist nebenwirkungsfrei und es existiert kein implizites
  Encounter-/Scene-/Atlas-Kommando;
- vorhandene CE-01-State-, DOM-, Adapter-, Buildasset- und Boundarytests bleiben
  grün;
- kein direkter Vault-, Datei-, SQLite- oder Obsidianzugriff in State, Shell
  oder Providervertrag.

I02 bis I05 ergänzen je Eigentümer Contract-, Schema-, Provenienz-, beschädigte
Daten-, Revision-, Indexrebuild-, Query-/Detail- und Cross-reference-Tests.
Testzahlen allein schließen keine Fachabnahme.

## Gemeinsame Providerverträge — Echter Host und physische Gates

CE-02-H01 verwendet neue isolierte Profile unter
`/home/aaron/.cache/dungeon-native-qa/` und bindet exakten sauberen SHA,
Produktbytes und normalen Prozesslebenszyklus. Mindestens:

- überlappende Open-Kommandos ergeben genau einen Katalogleaf;
- alle sieben Bereiche werden mit Maus und automatisierter Tastaturfolge
  geöffnet; ihre getrennten Zustände bleiben nach Wechsel erhalten;
- frischer Obsidian-Prozess stellt aktiven Bereich und sämtliche sieben
  Zustände exakt wieder her;
- pro Provider werden Loading, Empty, Invalid, Unavailable, Error und Retry
  dort geprüft, wo sie fachlich möglich sind;
- 900×650 und 1150×700 besitzen keinen horizontalen Hauptscroll und halten
  Rail, Ergebnisse, Footer und Inspector bedienbar;
- beschädigter Workspace- oder Providerzustand bleibt auf seinen Bereich
  begrenzt und erlaubt same-leaf Retry;
- Auswahl verändert keine Encounter-, Scene-, Atlas- oder Ownerdatei;
- Close/Restart endet normal ohne erzwungene Terminierung.

Physische Tastatur/Maus, Screenreader und weitere Plattformen bleiben eigene
Pflichtzeilen. Automatisierte DOM- oder Playwrightfolgen ersetzen sie nicht.

## Itemquellen und Provider

### Itemquellen und Provider — Aktuelle Quellenlieferung

Der vollständige S01-Quellenkorpus mit unabhängigem Review liegt als Kandidat in [PR85](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/85); seine Integration und Itemproduktabnahme sind getrennte offene Schritte. Die folgenden Quellenregeln erhalten die beobachteten Tabellen-, Whitespace- und Provenienzgrenzen. Der direkte Nutzerauftrag vom 10. Oktober verlangt sinnvolle
Produktbeiträge ohne künstliche Einzeleintrags-/Kleinstpaketbeschränkung.
W23 liefert die zusammenhängende Armor-/Arrow-Gruppe (A–Z 10–13,
physische/gedruckte Seiten 208–209) einschließlich Resistenz-d10-Tabelle,
Fluchtext und Slaying-Regeln. Ein kompletter Heading-zu-Heading-XML-Abgleich
prüft Prosa und physische Tabellenreihenfolge statt nur vorhandener Substrings.
W23-N01 ersetzt nach dem unabhängigen P1-Befund die feste Footer-Y-Grenze:
Nur der exakte SRD-Footer mit belegter Seitennummer wird entfernt, nie eine
Bodyregion nach Koordinaten. Getrennte kursive Wort-/Satzzeichenläufe erhalten
das Fehlen von Grenzleerraum aus den XML-Quellwerten; echte Leerzeichen und
Interpunktion bleiben unangetastet. Ein hashgebundener echter Poppler-25.03-
XML-Ausschnitt, verschobene/hohe Koordinaten, Footer-/Body-Adversarien und ein
expliziter PDF-Integrationstest schützen diese Grenze. Der lokale echte PDF-
Lauf ist kein behaupteter Poppler-25.07- oder fremder Host-PASS. Der unabhängige
W23-N01-P1-Re-Review auf `8dfa06ac859acf84df1e35d481893cf289e062e3`
bestätigt inzwischen den echten Poppler-25.07-PDF-Pfad als PASS
([PR #48, Review 5479968350](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/48#pullrequestreview-5479968350));
das ist keine vollständige S01-/Produktabnahme.

W24 ergänzt die gesamte Bags-Gruppe (A–Z 14–17, Seiten 209–211): Beans,
Devouring, Holding und Tricks. Alle zwölf d100-Effekte einschließlich `00`
und der seitenübergreifenden Eierregel sowie alle drei farbgebundenen
d8-Kreaturentabellen mit jeweils acht Zeilen bleiben vollständig erhalten.
Tabellenlabels und Würfelergebnisse bleiben den jeweiligen Zellen zugeordnet;
die drei Farben sind keine zusätzlichen Detailheadings oder erfundenen
Variantenrecords/Merges. Beans-Gewichtsformel und Holding-Kapazität bleiben
als vollständiger Quellwortlaut erhalten, nicht als erfundene numerische
Umrechnung. Die optionalen strukturierten Kosten-/Gewichts-/Kapazitätsfelder
werden in diesem Quellenabschnitt nicht ergänzt.

Der Verifier verwendet dieselbe inhaltliche Footer-/Quellwhitespace-Policy wie
W23-N01 und prüft jeden vollständigen Heading-Block einschließlich Tabellen,
Seitenübergängen und der nächsten Überschrift. Eine unveränderte echte
Poppler-25.03-XML-Ausgabe der drei kompletten Seiten mit Hash-/Lizenzreceipt
liegt unter `tests/fixtures/items-srd51-bags-poppler-25.03.*`; sie macht die
prüfentscheidenden Rohdaten offline zugänglich, behauptet aber keinen neuen
PDF-/GUI-Lauf. Negative Goldens erhalten auch bei unverändertem
Kreaturen-Multiset die Farb-/Würfelzuordnung. W24 wurde unabhängig auf
`42a69b63a69fbf310f1ba4eb4b7128cee2e5c700` geprüft
([Review 5480292230](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/56#pullrequestreview-5480292230))
und regulär auf Shared `843562ac256eb293f1b8c95f10077a9a7a7c1a1b`
integriert; kein Full-S01-/Produkt-/Host-PASS.

W25 liefert den vollständigen verbleibenden B-Abschnitt, A–Z 18–32, Bead of
Force bis Broom of Flying, physische/gedruckte Seiten 211–213. Alle Header,
Prosa, Aufzählungen, bedingten Regeln, Recharge-Angaben und der
seitenübergreifende Berserker-Fluch bleiben erhalten. Belt of Giant Strength
hat fünf physische Tabellenzeilen mit fünf ordinalgebundenen Raritätschoices;
die Quelle nennt sechs Varianten, fasst Stone/frost aber in einer Zeile
zusammen. Diese Zeile bleibt kombiniert; die sechs Varianten und ihr
unterschiedliches Aussehen/gleicher Effekt bleiben im vollständigen Fließtext.
Keine erfundenen zusätzlichen Occurrences, Records oder Merges. Header
`Weapon (any axe)` ergänzt das geschlossene Draft-v1-Subcategory-Enum um
`weapon`; es wird nicht unbelegt als einfache/martiale Einzelwaffe klassifiziert.
Gewicht, Kapazität und temperaturabhängige Regeln bleiben Quellenwortlaut,
keine erfundenen Kosten oder Einheitenumrechnungen.

`tools/items-srd51-b-section.mjs` vergleicht die vollständigen Blöcke bis zur
Folgeüberschrift, einschließlich Tabellenzelleneigentum und Seitenwechsel.
Originale drei vollständige Poppler-25.03-XML-Seiten samt Hash-/Lizenzreceipt
liegen unter `tests/fixtures/items-srd51-b-section-poppler-25.03.*`.
Negative Goldens schützen Variant-IDs/Rarität/Strength-Zellen, Fluchende,
Aufzählungen, echte Minuszeichen, Recharge und Bedingungsgrenzen. W25 ist
unabhängig auf `8772d950301b899c22f8bc4588e35bd2a5fe6dde` als PASS geprüft
([Chronik-Review 5480446444](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/64#pullrequestreview-5480446444))
und regulär auf Shared `ebb480eaac0c11640b843b4fa4297f541951d4ad` integriert
([Integrationsbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/64#issuecomment-6101348349)).
Das schließt weder Full-S01 noch ein Produkt-/Hostgate.

W26 ergänzt den vollständigen kohärenten C-Abschnitt A–Z 33–47, Candle of
Invocation bis Cubic Gate, physische/gedruckte Seiten 213–215: alle Header,
Prosa, Aufzählungen, bedingten Regeln und Seitenfortsetzungen. Die neun
Candle-Alignmentzeilen, vier Carpet-Zeilen (Größe/Kapazität/Geschwindigkeit),
sechs Cube-Faces mit Charges/Effekt und fünf Spell-/Item-Charge-Loss-Zeilen
behalten Reihenfolge und Zelleigentum. Der vollständige Table-Wortlaut bleibt
auch an seiner Position zwischen den Prosaabsätzen erhalten. Crystal Ball
bleibt eine Occurrence mit vier quellgeordneten Raritätschoices: typischer
Ball very-rare; Mind Reading, Telepathy und True Seeing legendary. Keine
erfundenen Unterheadings, Records oder Merges; alle variantenspezifischen
Regeln und Scrying-/Konzentrations-/Rechargegrenzen bleiben vollständige Prosa.

`tools/items-srd51-c-section.mjs` vergleicht jeden vollständigen Headingblock
einschließlich Table-Position und Seitenwechsel bis zur Folgeüberschrift.
Originale komplette drei Poppler-25.03-XML-Seiten und Hash-/Lizenzreceipt
liegen unter `tests/fixtures/items-srd51-c-section-poppler-25.03.*`.
Negative Goldens schützen Table-/Variant-IDs, Rarität, Würfelbereiche,
Kapazität, Charge-Loss, Fließtextbedingungen und Aufzählungen. Kein Schema-
oder Produktvertrag wurde erweitert; der W25-Korpuscount-Test prüft nun die
Inventarlänge statt den historischen Zwischenstand 252, ohne Quellenfakten
oder W25-Orakel abzuschwächen. W26 ist unabhängig auf
`67daede8eb4c5debafa98115f12b6e516c54e3be` geprüft
([Stadt-Review 5480616259](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/66#pullrequestreview-5480616259))
und regulär auf Shared `9e3a6c1bbd6484a356c00c268083b147cd7cc6ae` integriert
([Integrationsbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/66#issuecomment-6101632238)).

W27 ergänzt den vollständigen D-Abschnitt A–Z48–62, Dagger of Venom bis
Dwarven Thrower, physische/gedruckte Seiten215–220. Alle Header und Prosa,
einschließlich Dancing-Sword-Seitenfortsetzung, Fluch, Recharge und
bedingtem Dwarf-Attunement bleiben vollständig. Deck of Illusions behält
33 physische Tabellenzeilen (Jokers(2) ist eine Zeile), Deck of Many Things
alle22 Tabellenzeilen, die13-vs22-Fußnote und sämtliche22 Kartenwirkungen.
Der vollständige eingebettete Avatar-of-Death-Statblock bleibt in der
Quellreihenfolge unter Skull, ohne zusätzliche Item-Occurrence oder Änderung
des Monsterkorpus. Dragon Scale Mail bewahrt zehn Drachen-/Resistenzzellen
und ihre fünf physischen gepaarten Zeilen. Karten-/Drachentypen sind keine
erfundenen Raritätsvarianten oder Detailheadings; optional strukturierte
Kosten/Gewicht/Kampfwerte werden nicht aus Prosa erfunden.

`tools/items-srd51-d-section.mjs` prüft vollständige Headingblöcke bis zur
Folgeüberschrift. Originale sechs vollständige Poppler25.03-XML-Seiten samt
Hash-/Lizenzreceipt liegen unter `tests/fixtures/items-srd51-d-section-poppler-25.03.*`.
Goldens schützen Karten-/Suit-/Resistenzzuordnung trotz gleicher Wertemengen,
Fußnote, alle Kartenregeln, Statblock, Einschränkungen und Quellinterpunktion.
W27 ist unabhängig geprüft
([Review5480792943](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/70#pullrequestreview-5480792943))
und regulär auf Shared7ba2bf4 integriert
([Integrationsbeleg](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/70#issuecomment-6102297681)).
Schema, Attribution, Produktcode und alte Quellen-/Verifiergoldens bleiben unverändert.

Der aktuelle nächste Quellenumfang ist der vollständige E-Abschnitt A–Z63–70,
Efficient Quiver bis Eyes of the Eagle, Seiten220–221. Efreeti-d100-Effekte
einschließlich `91–00`, alle vier Gem→Elemental-Zuordnungen und vollständige
Sicht-/Recharge-/Windbedingungen werden headinggebunden geprüft; Eyes of
Charming bleibt einschließlich Seitenfortsetzung erhalten. Tabellenwirkungen
erzeugen keine zusätzlichen Itemidentitäten oder Raritätsvarianten. Die
originalen zwei XML-Seiten/Receipt und das Quellenorakel liegen unter
`tests/fixtures/items-srd51-e-section-poppler-25.03.*` beziehungsweise
`tools/items-srd51-e-section.mjs`. Aktueller Ausführungs-/Prüfstand ausschließlich
in den fachlichen Abnahmen und [Aufgabenissue58](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/58).
Stand: 290 Occurrences /289 Records,71/239 A–Z-Headings
(70 standalone plus Potion-of-Healing-Merge);168 A–Z-Headings plus Orb offen.
Der Gesamtquellenauftrag endet nicht an diesem Zwischenstand; nächster
kohärenter Abschnitt beginnt bei Feather Token. I01 bleibt vor unabhängigem
vollständigem S01-R01 gesperrt.
Der erwartete vollständige Occurrence-Count ist 459 (219 Ausrüstung +
239 A–Z + Orb), nicht der jeweilige Zwischenstand; bekannte Mergezahl bisher 1,
weitere Merge-/Helperprüfung bleibt offen. `complete:false` bleibt gesetzt.
Der vollständige PDF-Test wird mit
`SRD51_SOURCE_PDF=/pfad/SRD_CC_v5.1.pdf node --test tests/items-srd51-source.test.mjs`
aktiviert. Ohne diese Quelle ist er ausdrücklich skipped; Offline-XML-Fixtures
ersetzen keinen erneuten echten PDF-Lauf bei Quellenänderungen.
Der Quellenstand und die direkten Review-/Veröffentlichungsbelege bleiben in
`acceptance.saltMarcherCatalogEncounter`
und im [historischen Fachissue #9](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/9); das geschlossene Issue vergibt keine aktuellen Aufgaben.
Die nächsten Lieferungen folgen zusammenhängenden Quellabschnitten; die
vollständigen Schema-/Provenienz-/Produkt-/Hostgates unten bleiben erhalten.

## Itemquellen und Provider — Ziel und Grenze

`Items` wird der erste echte Bereich nach `Monster` in der vorhandenen
siebenfachen Katalog-Shell. Er liefert einen lokalen, nur lesbaren
2014-Referenzkatalog für Ausrüstung und magische Gegenstände. Maßgeblich sind
die [gemeinsamen Providerverträge](#gemeinsame-providerverträge) und SaltMarchers
`docs/items/requirements/requirements-items-catalog.md` sowie
`docs/items/domain/domain-items.md` am gepinnten SaltMarcher-Commit
`9de85c1a26f526acbc1af332ac5962e185c0aab2`. SaltMarchers
SQLite-/HTTP-Importvertrag beschreibt das beobachtbare Verhalten, erzwingt aber
keine SQLite- oder Laufzeit-Importarchitektur für dieses Plugin. Der Loot-Index
ist keine Item-Detailquelle.

## Itemquellen und Provider — Gepinnte Quelle und Freigabe vor Datenübernahme

Die normative Inhaltsquelle ist Wizards of the Coast, *System Reference
Document 5.1*, die 2014er Fassung unter
<https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf>. Der am
9. Oktober 2026 abgerufene PDF-Byte-Hash ist
`2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0`
(SHA-256; 3.158.713 Bytes, 403 PDF-Seiten). Seite 1 nennt CC BY 4.0 und den
verlangten Attributionstext. `CE-02-I02-S01` kopiert genau den auf PDF-Seite 1
als Attribution Statement ausgewiesenen Wortlaut unverändert in das kanonische
Asset `src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md`. S01 prüft den
Wortlaut und Asset-Hash gegen PDF-Seite 1; erst I01 prüft seine Präsenz im
Build und im sichtbaren Inspector. Hinweise zur
Itemprojektion stehen getrennt davon; keine weitere Wizards-Attribution wird
angehängt. Keine 2024-/SRD-5.2-Daten.

`CE-02-I02-S01` ist ein eigenes, vor jeder Produktumsetzung abgeschlossenes
Provenienz-/Schema-Paket. Es legt `src/features/catalog/data/items-srd51-inventory.json`
mit genau einer Zeile je Ausrüstungs-Tabellenzeile, eigenständigem Magic-Item-
Tabelleneintrag und alphabetischem Magic-Item-Detailabschnitt an. Jede Zeile
trägt Abschnitt/Feed, erste und letzte physische PDF-Seite, sichtbare SRD-Seite,
Quellenüberschrift bzw. Tabellenkennung, Zeilen-/Abschnittsordinal,
Variantenkennung und explizite Merge-Referenz oder `null`. Das Manifest enthält
Abschnittsgrenzen und erwartete Counts für Ausrüstungstabellen, Magic-Item-
Tabellen und A–Z-Details sowie eine Summe vor und nach expliziten Merges.
Ein zweiter Prüfer vergleicht alle PDF-Seiten an den Abschnittsgrenzen und die
vollständige Zeilen-/Überschriftenfolge gegen das Inventar; Stichproben allein
reichen nicht. Er dokumentiert PDF-Hash, Inventarhash, Count-Abgleich und
Ausnahmen auf einem exakten Commit als `CE-02-I02-S01-R01 PASS` oder
`CHANGES REQUIRED`. S01 erstellt vor diesem Review auch das vollständige
Quelltranskript, das versionierte Schema und den PDF→Transkript-Beleg. Ohne
PASS entstehen weder generiertes Produktartefakt noch Provider oder UI; I01
beginnt nicht.

Ein 5e-bits-Datensatz darf als Extraktionshilfe dienen,
aber nicht ungeprüft zur zweiten Wahrheit werden: jede übernommene Tatsache
muss im SRD 5.1 verortbar sein. Nicht belegte oder außerhalb der SRD liegende
Einträge werden abgewiesen. Die 5e-bits-MIT-Lizenz für Repository-Code ersetzt
keine Prüfung der Inhaltslizenz.

## Itemquellen und Provider — Quellprojektion und Schema

Das in S01 erstellte Inventar ist die Identitätsgrundlage des Quelltranskripts. Eine
Erscheinung erhält die ID `srd51:<equipment|magic-item>:<abschnitt>:<ordinal>`;
Abschnitt und Ordinal stammen ausschließlich aus der festgehaltenen physischen
PDF-Reihenfolge. Anzeigenamen, Slugs, Unicode und Interpunktion erzeugen keine
Identität. Für gleichnamige Varianten gibt es je eigener Tabellenzeile oder
Überschrift eine eigene Erscheinung und eine explizite Variantenkennung.
Eine Merge-Liste weist Tabellenerscheinungen und A–Z-Details per ID genau
einem kanonischen Eintrag zu; niemals durch automatisch gleichen Namen. Die
kanonische ID ist die erste Erscheinung in PDF-Reihenfolge. Mehrdeutigkeit,
Kollision, unbelegter Merge oder abweichende Fakten stoppen den Generator.
Ein abweichender SRD-Quellenstand erfordert neues Manifest und eigenen Review.

Das Transkript speichert je Fakt die Inventar-ID und PDF-Seite. Mechanische
Textextraktion normalisiert Unicode nach NFC, Ligaturen zu Buchstaben,
geschützte Leerzeichen zu normalen Leerzeichen und PDF-Zeilenumbrüche zu
Leerzeichen; echte Wortbindestriche und Zeichensetzung bleiben erhalten.
Weiche Trennstriche an Zeilenenden dürfen nur bei nachgewiesenem Umbruch
entfallen. Jede andere Korrektur steht als explizite Vorher-/Nachher-Zeile mit
PDF-Beleg im Transkript. `S01` legt die kontrollierten Kategorie-/Unterkategorie-
Werte und die Zuordnung jeder Quellentabelle fest. Golden-Fälle prüfen
Gleichnamigkeit, Varianten, Tabellen-/Detailmerge, Ligatur, Trennstrich,
Interpunktion und bytegleiche Projektion.

S01 legt den verbindlichen Vertrag als
`src/features/catalog/data/items-srd51-schema-v1.json` (JSON Schema Draft
2020-12, `schemaVersion: 1`) und das Transkript als
`src/features/catalog/data/items-srd51-transcript.json` ab. Der unabhängige
S01-Review bindet die SHA-256-Hashes von PDF, Inventar, Schema, Transkript und
Attribution sowie die Schema-Validierung sämtlicher Einträge. Das Schema
verbietet zusätzliche Felder und schließt Kategorie, Unterkategorie, Raritätswerte,
Einstimmung und Einheiten als Enums. Seine Mindestform ist:

- `id` und `name`: nichtleere NFC-Strings; `category`: `equipment` oder
  `magic-item`; `subcategory`: optionaler Wert aus einem in S01 durch das
  vollständige Inventar festgelegten, geschlossenen Enum samt Zuordnung jeder
  Quellentabelle; `magic`: Boolean; `rarity`: optionales diskriminiertes Objekt:
  `{kind: "fixed", value}` oder `{kind: "varies", sourceText, choices}`.
  `value` und jedes `choices[].value` gehören zum Enum `common`, `uncommon`,
  `rare`, `very-rare`, `legendary`, `artifact`. Eine Choice ist
  `{variantId, label, value, occurrenceId}` mit nichtleeren Strings und
  Inventarbeleg; `choices` ist geordnet und darf leer sein, wenn die Quelle
  zwar „rarity varies“ nennt, aber keine eindeutige Variante→Rarität-Zuordnung
  liefert. `sourceText` bewahrt dann den vollständigen Quellenwert;
- `attunement`: genau `required`, `not-required` oder `unspecified`;
- `cost`: optionales Objekt `{sourceText, copperPieces?}` mit nichtleerem
  Quelltext und nichtnegativem Safe-Integer in Kupferstücken. Umrechnung ist
  nur für eindeutige Einzelwerte zulässig: `cp=1`, `sp=10`, `ep=50`, `gp=100`,
  `pp=1000`; Bereiche, Formeln und unbezifferte Kosten behalten allein
  `sourceText`;
- `weight`: optionales Objekt `{sourceText, pounds?}`; `pounds` ist eine
  kanonische positive Dezimalzeichenfolge ohne Exponent, nur bei eindeutigem
  Quellenwert in Pfund; andere Einheiten bleiben allein `sourceText`;
- `properties`: geordnete Liste aus `{name, description?, occurrenceId}`;
  `description`: geordnete Liste aus `{text, occurrenceId}`. Alle Strings sind
  nichtleer und `occurrenceId` verweist auf genau eine Inventarerscheinung;
- `damage`: optional `{diceText, typeText, versatileDiceText?}` und `armor`:
  optional `{armorClassText, dexterityRuleText?, strengthRequirementText?,
  stealthRuleText?}`. Diese Felder sind ausdrücklich nichtleere,
  quellengetreue Textwerte, keine numerischen Kampfwerte. Fehlt ein Pflichttext,
  bleibt der strukturierte Teil weg und der Wortlaut in `description`;
- `source`: `{document: "SRD 5.1", pdfUrl, pdfPages, printedPages,
  occurrenceIds}` mit der gepinnten URL, nichtleeren geordneten
  Integer-Seitenlisten und existierenden Inventar-IDs. Der Generator prüft
  Seiten, Abschnitte und faktbezogene Erscheinungen gegen das Inventar.

Optionale fehlende Quellenfelder werden ausgelassen, nicht durch `null` oder
Nullwerte ersetzt. Insbesondere werden für magische
Gegenstände keine Preise, Gewichte oder Einstimmungen aus anderen Quellen
erfunden. `attunement` unterscheidet `required`, `not-required` und
`unspecified`: Bei einem vollständig geprüften Magic-Item-Header setzt die
`requires attunement`-Klausel `required`, ihr belegtes Fehlen `not-required`.
Bei unvollständigem/mehrdeutigem Header und nichtmagischer Ausrüstung gilt
`unspecified`; das ist kein behauptetes Nein. `S01` prüft positive, negative
und unklare Header als Golden-Fälle. Geldwerte werden ohne Rundung als
ganzzahlige kleinste Einheit
normalisiert; nicht eindeutig umrechenbare Quellwerte bleiben reine Anzeige
und nehmen am numerischen Kostenfilter nicht teil. Sortierung behandelt fehlende
Werte deterministisch am Ende, unabhängig von der Richtung. Für Rarität gilt:
ein konkreter Filterwert trifft `fixed.value` oder eine belegte
`varies.choices[].value`; ein eigener Filterwert `varies` trifft alle
variablen Einträge. Die Sortierung ordnet feste Raritäten nach der genannten
Enum-Reihenfolge, dann `varies`, dann fehlende Werte; Richtung kehrt nur die
festen Raritätswerte um, fehlende bleiben am Ende. Der Inspector zeigt bei
`varies` den `sourceText` und jede belegte Choice; er macht keine einzelne
Rarität für den gesamten Eintrag geltend. Ein Variantenschlüssel ist
`<occurrenceId>#variant:<ordinal>` mit dem Ordinal der Variantenfolge im
gepinnten PDF, unabhängig von Label oder Slug. S01-Golden-Fälle decken
mindestens `rarity varies` und einen kombinierten `+1/+2/+3`-Header vollständig
von Inventar über Transkript und Schema bis zur Filter-/Inspector-Projektion
ab. Der Inspector
kennzeichnet fehlende Fakten, statt sie mit Nullwerten zu verwechseln.

## Itemquellen und Provider — Reproduzierbarer Build und Fail-closed-Lader

Ein enger Generator unter `tools/` liest ausschließlich das reviewte Inventar,
Quelltranskript und Manifest mit PDF-URL/-SHA-256, Inventarhash,
Schema-Version, Lizenz und Attribution. Er benötigt keinen Netzwerkzugriff.
Ein separater Quellen-Verify-Lauf lädt die PDF in den QA-Cache, prüft ihren
Hash und vergleicht die vollständige Seiten-/Zeilen-/Überschriftenfolge mit
dem Inventar und den Transkriptbelegen. Er liefert den unabhängigen
PDF→Transkript-Vollständigkeitsbeleg. Der Offline-Generator validiert jede
Inventar-ID, jede Faktquelle, eindeutige Schlüssel, alle Merge-Regeln und
Counts, serialisiert in fester Ordnung und schreibt ein Artefakt samt SHA-256.
Wiederholung muss bytegleich sein. `npm run build` prüft das eingecheckte
Artefakt gegen Manifest und generierte Bytes, ohne die PDF erneut aus dem Netz
zu holen; der getrennte Quellen-Verify-Lauf ist Pflichtgate von S01 und jeder
Quelländerung. Quell-PDF und große Protokolle liegen im QA-Cache.

Der Runtime-Lader prüft Schema-Version, Manifest/Artefakt-Hash und Struktur vor
der ersten Veröffentlichung des gesamten Korpus. Die Daten werden erst nach
vollständiger Prüfung als ein unveränderlicher Snapshot sichtbar. Fehler geben
keine Teilmenge oder veraltete Detailantwort als aktuelle Wahrheit aus:

- fehlendes Asset bzw. noch kein vollständiger Import: `unavailable`;
- neuere/andere Schema-Version: `incompatible`;
- Hashabweichung, ungültiger Datensatz, Duplikat oder indizierter Datensatz
  ohne versprochenes Detail:
  `corrupt`;
- ungültige Filter-/Pagingwerte: `invalid`;
- Laufzeit-/Ladefehler: `error` mit isoliertem Retry.

Diese Fehler betreffen nur `items`. `creatures` und die fünf weiterhin
`unavailable`-Provider behalten ihren Zustand. Kein Katalogklick startet
Netzwerk, Import, Vaultwrite, Loot-, Inventory- oder Encounter-Mutation.

## Itemquellen und Provider — Provider und sichtbares Verhalten

`I01` erweitert den vorhandenen Providervertrag ausdrücklich: Capability
behält `available|missing|unavailable`; Query erhält neben `ready|empty|
invalid|missing|unavailable|error` die Status `incompatible|corrupt`; Detail
erhält neben `ready|missing|unavailable|error` ebenfalls `incompatible|corrupt`.
Loader-Schemafehler gehen auf beide `incompatible`, Integritätsfehler auf
`corrupt`; ungültige Query auf `invalid`. Eine unbekannte oder inzwischen
entfernte Detail-ID ist `missing`, ein im geprüften Index gelisteter Eintrag
ohne Detail ist `corrupt`. Nur `error` und nach erneuter lokaler Validierung
`corrupt` bieten Retry; `incompatible` verlangt einen passenden Build und
`missing` eine neue Auswahl. Registry, Shellstatus, Itemansichten und Tests
erhalten diese Union gemeinsam; Monsterverhalten bleibt unverändert. Ein
fehlgeschlagener Refresh entwertet den aktuellen Item-Snapshot, sodass Retry
oder spätere Query keine alte Liste als aktuellen Erfolg ausgeben.

Der Itemprovider implementiert diesen CE-02-read-only-Vertrag mit
immutable Row-/Detail-DTOs, begrenzter Ergebnispage und `AbortSignal`.
Stabile IDs werden auch in Auswahl und Wiederherstellung genutzt. Query und
Detail verwenden denselben geprüften Snapshot. Generations-/Abortschutz der
Shell verhindert, dass verspätete Itemantworten nach Suche oder Bereichswechsel
einen anderen Bereich überschreiben.

Die Items-Oberfläche nutzt den gemeinsamen 200-ms-Draft-/Enter-Flush-,
Chip-/Reset-, Sortier-, Paging-, Tastatur- und Inspector-Pfad. Filter sind Name,
Kategorie, Unterkategorie, Rarität, Magiestatus, Einstimmung und Kostenbereich;
Sortierung ist Name, Kategorie, Rarität und Kosten, jeweils mit stabiler
ID-Nachordnung. Rarität und Kosten zeigen fehlende Werte offen an; der
Kostenbereich matcht nur tatsächlich bezifferte Kosten. Auswahl zeigt
Beschreibung, Eigenschaften, Kosten, Gewicht, Rarität, Einstimmung,
Schadens-/Rüstungsfakten soweit vorhanden, Quellenstellen und Attribution.
Es gibt explizite Loading-, Empty-, Invalid-, Unavailable-, Incompatible-,
Corrupt- und Error-/Retry-Ansichten, ohne verdeckte Produkt-Placeholder.

Die Workspace-Schemaversion steigt von `1` auf `2`. Die v1→v2-Migration
übernimmt `activeSection` und Monster sowie die fünf anderen Section-States
werttreu durch ihre bisherigen Restorer. Beim bisherigen Item-Placeholder
übernimmt sie `search`, `searchDraft`, `direction`, `page`, `selectedId` und
beide Scrollpositionen; `filters: []` wird zum leeren typisierten Itemfilter,
`sort: name` bleibt erhalten. Neue Item-Filter und Sortierfelder beginnen mit
Defaults. Nur beschädigte Itemwerte werden auf Itemdefaults normalisiert.
Unbekannte künftige Workspaceversionen bleiben wie bisher insgesamt
fail-closed. Der real typisierte Itemzustand hält eigenen Draft/angewandte
Suche, Filter, Sortierung, Seite, Auswahl und beide Scrollpositionen. Tests
prüfen v1→v2, beschädigtes Item bei intaktem Monster, unbekannte Zukunft,
Item→Monster→Item und frischen Prozess-Restore.

## Itemquellen und Provider — Lieferbestand und Prüfanforderungen

`CE-02-I02-S01` besitzt Inventar, Identitäts-/Merge-Ledger, vollständiges
Quelltranskript, `items-srd51-schema-v1.json`, Kategoriezuordnung, kanonische
Attribution, PDF→Transkript-Quellen-Verify und Golden-Fälle, aber noch kein
generiertes Produktartefakt, keinen Provider und keine UI. Ein unabhängiger
Prüfer muss S01 auf einem exakten Commit mit vollständigem Count-, Schema- und
Hashbeleg freigeben.

`CE-02-I02-I01` besitzt erst danach neue Itemdaten-, Generator-, Manifest-,
Attributions-,
Provider- und Item-View-Dateien unter `src/features/catalog/` und `tools/`,
gezielte Item-Deskriptor-/State-Ergänzungen in der bestehenden Katalog-Shell,
passende Tests und nur nötige Katalog-CSS. Monsterdaten, die fünf anderen
Provider, Encounter-/World-Planner-Owner, Atlas, Dungeon und Vaulttexte bleiben
außerhalb dieses Pakets. Ein verändertes Bundlebudget wird nur anhand gemessener
Buildgröße, Lazy-Load und echtem Hostverhalten entschieden.

Quellenübernahme und Produktaktivierung benötigen reproduzierbare Daten-/Provider-/DOMprüfungen, Typprüfung und Build. Pflichtfälle sind: Source-Hash und
Attribution; Korpusvollständigkeit und bytegleiche Regeneration; doppelte
Schlüssel und widersprüchliche Feldquellen; fehlende optionale Werte;
deterministische Filter/Sortierung/Paging; Auswahl und Inspector; sämtliche
Fehlerzustände und Retry; Abort-/Stale-Antwort; Bereichs-/Neustartzustand;
kein Netzwerk oder Ownerwrite beim Browsing. Der I02-Review bindet sauberen
Quell-SHA, bytegleiche installierte `main.js`/`manifest.json`/`styles.css` und
einen echten isolierten Obsidian-Hostlauf. Sichtbar geprüft werden bei
900×650 und 1150×700 Itemfilter, Chips/Reset, Sortierung, Paging, Auswahl,
Inspector, Attribution und fehlende optionale Felder. Ein Bereichswechsel
während einer ausstehenden Query darf Item/Monster nicht überschreiben;
beide Zustände müssen unabhängig durch Wechsel und frischen Prozess erhalten
bleiben. Der Prozess endet normal. Corrupt/Incompatible/Error/Retry werden
zusätzlich mit deterministischen Fixture-/Harness-Gates geprüft. Automatisierte
Hostbelege werden nicht als physische Tastatur-/Maus-, Screenreader- oder
Plattformabnahme ausgegeben. CE-02-H01 wiederholt die gemeinsame Prüfung nach
allen sieben Providern.

Eine Itemfreigabe schließt weder die fünf anderen Provider noch CE-02, CE-01-
Physikeingabe, Screenreader oder weitere Plattformen. Diese Gates bleiben
ausdrücklich offen.
