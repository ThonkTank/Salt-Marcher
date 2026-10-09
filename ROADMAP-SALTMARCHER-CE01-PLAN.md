# CE-01 – Read-only Monsterkatalog

Stand: 9. Oktober 2026. Dieser Fachplan setzt ausschließlich den ersten
nutzbaren Monsterkatalog um. Encounter-Aufbau, Vault-Homebrew, Items, NPCs,
Fraktionen, Orte und Encounter-Tabellen bleiben in CE-02/03. D&D 2024 ist
ausdrücklich nicht Teil des Produkts.

## Ausgangslage

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

## Verbindliche Entscheidungen

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

## Oberfläche und Zustandsbesitz

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

## Tastatur und Barrierefreiheit

- Suchfeld und Filter besitzen sichtbare Bezeichnung oder `aria-label`.
- Tabellenkopf-Buttons veröffentlichen `aria-sort`.
- Ergebniszeilen sind per Tab erreichbar; Pfeil hoch/runter verschiebt die
  Auswahl, Enter öffnet Details.
- Status verwendet `role=status`, Fehler `role=alert`; Detailüberschriften
  behalten eine nachvollziehbare Hierarchie.
- Escape leert eine geöffnete Detailauswahl, aber nicht die Filter.
- Fokus wird bei einer Aktualisierung nicht versetzt. Eine weiterhin vorhandene
  Auswahl bleibt nach Query-/Sortieränderung über ihre stabile ID erhalten.

## Umsetzungspakete

### CE-01-I01 – Komprimiertes Buildasset und Lazy Loader

- JSON-Import aus `creature-catalog.ts` entfernen.
- Hashprüfenden, einmalig cachenden Loader ergänzen.
- Build um das hashgeprüfte virtuelle Gzip-/Base64-Modul und eine
  objektive Payload-Grenze erweitern: höchstens 122.880 Gzip-Bytes, höchstens
  164.000 Base64-Zeichen und höchstens 180.000 Bytes Zuwachs von `main.js`
  gegenüber der oben gebundenen 1.189.370-Byte-Baseline. Das Buildinventar
  dokumentiert Quelle, Commit, Node-Version, Befehle und alle drei Werte.
- Lazy-, Fehler-/Retry-, Hash-, Notice- und Buildinventartests ergänzen.

### CE-01-I02 – View-Grundgerüst und Kernfluss

- View-Type, Registrierung und Command-Fokus ergänzen.
- Suche, CR/Typ/Größe, Sortierung, Paging, Auswahl und vollständigen Statblock
  mit stabiler View-Session implementieren.
- Kein Encounter-Button in diesem Paket.

### CE-01-I03 – Erweiterte Filter, Chips und Responsive/A11y

- Verbleibende D&D-Beyond-2014-vergleichbare Filter, einzelne Chips und Reset.
- Tastaturablauf, 200-ms-Debounce, Statuszustände und Layout bei 900×650 und
  1150×700 fertigstellen.

### CE-01-R01/N/R02 – Fachreview und Nachbesserung

- Getrennter Review gegen CE-AC-01/02/14 und SaltMarcher-Anforderungen.
- Nachbesserungen erneut prüfen; erst danach CE-01-Fachfreigabe erwägen.

### CE-01-C01 – Aufräumen

- Separater Aufräumplan, Umsetzung und Review. Erst danach CE-02 beginnen.

## Fokussierte Prüfungen

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

## Offene Abnahme

- CE-AC-01 bleibt bis zu I03 und echtem Host offen.
- CE-AC-02 bleibt bis zum vollständigen Inspector und nachgewiesenem
  Zustands-/Scroll-Erhalt offen.
- CE-AC-14 bleibt bis zur Tastatur-, Fehler- und beschädigten-Asset-Abnahme
  offen.
- Sämtliche Encounter-Fälle CE-AC-03 bis CE-AC-13 bleiben vollständig offen.

## Nächster Lauf

`CE-01-I01`: komprimiertes Buildasset, Lazy Loader, Buildinventar und fokussierte
Regressionen. Keine Katalog-UI- oder Fachfreigabe behaupten.
