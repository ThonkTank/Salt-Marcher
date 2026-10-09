# Phase 1, DD-036: Dateifluss für die einzige Atlaskarte

Planreparatur `DD-036-ATLAS-P01-R01` vom 09.10.2026 zu
[Phase 1](ROADMAP-PARITY-TOOLS-PHASE1-PLAN.md). Grundlage ist der unabhängige
Review auf `6ee65dae1eb462f269d253263d5f861fe28a8ef0`. Die Nutzerentscheidung ersetzt
Dungeondrafts Mehrkartenmodell durch eine einzige grenzenlose Atlaskarte mit
Hexterrain, Städten und Dungeons. `DD-036.01–.16` bleiben unverändertes
Dungeondraft-Inventar; dieser Plan ändert keinen Acceptance-Stand und erteilt
keine Funktions-, Host- oder Paritätsfreigabe.

## Feste Grenzen

- Der heutige HEX-01-Stand kann eine leere `.overworld` konfliktgeschützt
  anlegen, validieren und **nur lesend** öffnen. Seine
  `VaultStore.compareAndWrite`-Anlage ist kein Save-, Draft-, Journal- oder
  Recovery-Nachweis.
- HEX-02-I01a liefert den hostneutralen gemeinsamen `AtlasHistory`-Kern;
  HEX-02-I01b muss dessen sichtbaren Terrain-/Undo-/Redo-Ablauf im Host belegen.
  HEX-02-I01c liefert erst den gemeinsamen Mehrdatei-Speicher- und Draftweg.
  HEX-02-I01d liefert erst Kopie, A→B→A und Verwerfen.
- Es entsteht kein DD-036-eigenes Repository, keine zweite History, keine
  zweite Kamera und kein paralleles Atlas-Speichersystem. Der Atlas muss den
  gemeinsamen `FileStore`-/`FileTransaction`-/Draft-/Recovery-Vertrag nutzen;
  Dungeon-, City- und Atlasbesitzer behalten ihre stabilen Kennungen.
- Alle Prüfungen arbeiten in einem isolierten Testvault auf Kopien. Nutzerkarte,
  Dungeontexte, Raum-Key-Bytes, Originaldateien und fremde Belege bleiben
  unverändert.

## Ausführbare Fall- und Voraussetzungsmatrix

| Fälle | Früheste Voraussetzung | Genau erlaubter Lauf | Sichtbares Orakel | Noch ausdrücklich offen |
| --- | --- | --- | --- | --- |
| `.02`, `.16` | O01a nach HEX-01; O01b hostneutral nach I01a und sichtbar erst nach angeschlossenem Terrain-Lader/I01b | O01a öffnet nur eine gültige **referenzfreie** `.overworld` und deren bytegleiche Einzeldatei-Transportkopie read-only; vor und nach Schließen hashen, null Schreibaufrufe. O01b öffnet erst später die vollständige nichtleere Weltdateimenge und prüft fehlende Terraindatei beziehungsweise Kinddatei mit fremder `world.id`. | O01a: gleiche `.overworld`-Bytes und `world.id`, keine Anlage, kein Save, Draft oder Journal. O01b: zusätzlich gleiche referenzierte Pfade, Einzeldateihashes, geschützte Dungeon-/Location-Key-Bytes und Fremdkennungen; Missing-/Foreign-Child wird hostneutral und danach sichtbar abgelehnt. | O01a belegt weder Kinddateiladen noch Dungeondraft-Open-Wirkung, veränderten Atlas, Save, Import, Recovery oder Hostabnahme. O01b wartet auf die echte Hostverdrahtung. |
| `.04`, `.05` | HEX-02-I01a hostneutral; sichtbarer Lauf erst nach I01b | Einen Terrainbefehl über die gemeinsame `AtlasHistory` zurücknehmen und wiederholen. Der hostneutrale Test darf nach I01a laufen; das sichtbare Hostpaar wartet auf I01b. | Besitzerkennung, Vorher-/Nachheränderungen und Redo-Folge exakt; Kamera, geladene Fremdbesitzer und Dateien unverändert. | Keine Dungeondraft-Parität; kein Persistenznachweis vor I01c. |
| `.03` | HEX-02-I01c | Dirty Terrain über den gemeinsamen Transaktionsweg speichern, normal neu öffnen und denselben gespeicherten Stand erneut ohne Änderung speichern. | Zustandsmatrix unten, Einzeldatei-Manifest und exakter gespeicherter Dokumentzustand; Draft wird erst nach bestätigtem Commit entfernt. | Weitere direkte Host-Abbruchgrenzen, City-/Dungeon-Kinder und alle Kopierfälle. |
| `.14` | HEX-02-I01c für Dirty/Draft; sichtbare Save/Discard/Cancel-Folge erst nach I01d | Ungespeichert verlassen oder Welt wechseln: Cancel erhält Session und Draft; Save benutzt denselben Transaktionsweg; Discard stellt die gespeicherte Basis wieder her. Der alte New-Map-Zweig entfällt. | Jeder Zweig hat getrennte Vorher-/Nachherdateien, sichtbaren Status und frische Neuöffnung; Cancel schreibt nichts, Discard ändert keine gespeicherte Basis. | Betriebssystem-Exit und Dungeondraft-Dialogparität bis zur Shellentscheidung. |
| `.07`, `.08`, `.13`, `.15` | Identitätsorakel dieses Plans unabhängig bestanden **und** HEX-02-I01d | Nur die ausdrücklich benannten Atlasaktionen Backup/Restore, Transport oder „Als Kopie“ ausführen. Keine alte Recent-/Save-As-Oberfläche automatisch nachbauen. | Operationszeile aus dem Identitätsorakel, vollständiges Einzeldatei-Manifest und A→B→A; Original und Kopie lassen sich nicht gegenseitig überschreiben. | Transport-/Restore-Ablauf und endgültige Shell-/Importoberfläche; eine Recent-Liste ist keine Zielpflicht. |
| `.01`, `.06`, `.10`, `.11`, `.12` | ratifizierte reale Ziel-Shell | Menü, About, Datenordner, reguläres Schließen und zustandsabhängige Befehle in genau dieser Shell prüfen. | Installierte Version, aktiver Atlas, leerer Zustand, normaler Prozessausgang und unveränderte Dateien je Aktion. | Vor der Plattformentscheidung keine Ersatzoberfläche und kein Host-Go. |
| `.09` | ratifizierte reale Ziel-Shell | In Phase 1 ausschließlich den sichtbaren Preferences-Einstieg öffnen und schließen. | Einstieg ist erreichbar, Cancel/X schreiben nichts. | Felder, Tabs und Kürzel `.17–.76` bleiben Phase 12. |

Kein späterer Tabellenlauf darf einen früheren Gate-Status rückwirkend behaupten.
Insbesondere macht I01a den sichtbaren Undo-/Redo-Fall nicht bestanden und ein
erfolgreiches I01c schließt weder I01d noch die Shellfälle.

## Getrennte Referenzwahrheiten

Jeder spätere Hostbeleg nennt genau eine Referenzzeile und hält Produkt,
Version, Originalablauf, belegte Wirkung und Abweichung getrennt fest:

| Referenz | Darf belegen | Darf nicht belegen |
| --- | --- | --- |
| Dungeondraft 1.2.0.1 Opulent Kirin, `acceptance.json.strictParity.cases` `DD-036.01–.16` | Fallname, vorhandene direkte Bildschirm-/Dateibelege und ausdrücklich eingetragene Originalwirkung. `.12` belegt den leeren Menüzustand, `.13` den ersten Recent-Pfad; die übrigen überwiegend nur Oberfläche oder offene Zielwirkung. | Keine ungemessene Save-, Undo-, Redo-, Warnungs-, Kopier- oder Neustartwirkung; kein Atlasorakel. |
| Wonderdraft 1.1.8.2, `acceptance.json.wonderdraftParity.cases` `WD-003.01` | Abgebrochene Zielwahl, Save/Save As, bytegleiche Originalkopie, A/B/A und frische Öffnung im direkt belegten Wonderdraft-Umfang. | Keine Dungeondraft-Parität und keine Vorgabe, dass eine Atlas-Kopie dieselbe `world.id` behalten darf. |
| Wonderdraft 1.1.8.2, `WD-003.02` | Direkt belegte Save/Discard/Cancel- und Exitfolgen sowie Öffnen einer Original-Sicherung. | Keine automatische Atlas-Draft-/Recovery-Freigabe; die dauerhafte Atlas-Draftwirkung ist eine benannte Produktanpassung. |
| Wonderdraft 1.1.8.2, `WD-003.03` | Direkt belegtes A→B→A, frischer Prozess und Trennung ausgewählter globaler beziehungsweise karteneigener Werte. | Keine allgemeine Persistenzregel für alle Werkzeuge und keine Dungeondraft-Parität. |
| Gemeinsamer Hostvertrag | Nutzerzweck des einzigen Atlas, FileTransaction-, Draft-, Konflikt- und Identitätsorakel dieses Plans. | Kein Ersatz für fehlende Originalbelege oder physische Eingabe. |

Ein Bericht führt pro Schritt `referenceId`, Originalversion, konkrete
Evidence-Pfade, `observedEffect`, `hostAdaptation` und `remainingDifference`.
Wonderdraft-Belege stehen niemals im Feld für Dungeondraft-Originalabnahme.

## Weltidentitäts- und Kopierorakel

Vor jedem Lauf wird ein Manifest aus **jeder** beteiligten Datei erzeugt:
normalisierter relativer Pfad, Dateityp, Bytezahl, SHA-256, enthaltene
`world.id`, referenzierte Terrainpfade und -hashes, stabile Atlas-/Dungeon-/
City-/Location-/Fremdkennungen sowie die Bytehashes aller geschützten
Dungeontexte und Raum-/Location-Keys. Ein Gesamthash oder bloß erfolgreiches
Öffnen genügt nicht.

| Ausdrückliche Aktion | `world.id` | Terrain-/Kinddateien | Geschützte Inhalte | Konfliktregel |
| --- | --- | --- | --- | --- |
| Normales Save derselben Welt | unverändert | dieselben kanonischen Pfade; nur tatsächlich geänderte Dateien erhalten neue Hashes | nicht betroffene IDs, Key-Bytes und Fremdkennungen byte-/wertgleich | Jeder vom gelesenen `before` abweichende Zielwert bricht vor Bestätigung ab. |
| Bytegleicher Transport oder Backup derselben logischen Welt | unverändert | vollständige referenzierte Dateimenge und relative Verweise bytegleich | sämtliche Bytes und IDs gleich | Nur in leeren isolierten Zielraum; keine gleichzeitige zweite bearbeitbare Identität registrieren. |
| Restore eines Backups derselben Welt | unverändert | vollständige gesicherte Dateimenge; kein Mischen mit Teilen eines anderen Stands | sämtliche gesicherten Bytes und IDs gleich | Bestehende abweichende Zielwerte erzeugen Konflikt statt Überschreiben; Recovery nutzt die Transaktionsmatrix. |
| „Als Kopie“/Duplizieren | **neue** `world.id` | neue eigene Pfade; sämtliche internen Welt-/Terrainbesitzer und Verweise konsistent umgeschrieben, semantische Zellinhalte gleich | Dungeon-/City-/Location-IDs, fremde Kennungen und Key-/Textbytes bleiben erhalten, soweit sie nicht die Weltbesitzerkennung selbst sind | Alle Kopierziele müssen vorher fehlen; Fehler hinterlässt weder halbe Kopie noch Verweis auf Ursprungsdateien. |
| Import als Wiederherstellung/Relokation | unverändert | wie bytegleicher Transport, nachdem die Aktion ausdrücklich „dieselbe Welt“ gewählt wurde | unverändert | Konflikt bei bereits registrierter abweichender Welt derselben ID. |
| Import als neue Kopie | neue `world.id` | exakt das Duplizierungsorakel | exakt das Duplizierungsorakel | Kein stilles Umschalten zwischen Restore und Kopie anhand des Pfads. |
| Journal-/Draft-Recovery | unverändert | je nach Journalzustand vollständig Vorher **oder** Nachher, niemals gemischt | keine neue Kennung; externe Bytes werden nie überschrieben | Divergenter externer Wert erhält Journal/Draft und meldet den konkreten Pfad. |

Die Aktionsart ist Teil des validierten Auftrags und darf nicht aus Dateiname
oder Zielpfad geraten werden. Export ohne Reimport bleibt ein Transportartefakt;
erst die ausdrücklich gewählte Importaktion entscheidet zwischen derselben Welt
und neuer Kopie.

## Gemeinsamer FileTransaction-, Draft- und Recovery-Vertrag

HEX-02-I01c extrahiert beziehungsweise verallgemeinert den bereits im
Dungeon-`MapRepository` verwendeten Vertrag: `FileStore.read` plus pro Pfad
serialisiertes `compareAndWrite`, eine validierte Liste eindeutiger
`{path,before,after}`-Schreibungen und ein Journal mit `prepared`/`committed`.
Der Atlasadapter liefert Overworld-, Terrain- und spätere Kinddateien an diesen
Baustein. Er kopiert nicht den Dungeon-Dokumenttyp und erweitert nicht dessen
Pfadregeln heimlich. Derselbe Baustein muss für spätere City-/Locationbesitzer
verwendbar bleiben. Der Obsidianadapter verspricht dabei keine bislang nur im
separaten H03-Pfad untersuchten nativen Filesystem-TOCTOU- oder
Durabilitätsgarantien.

| Ausgang/Zeitpunkt | Erwarteter frischer Recovery-Zustand |
| --- | --- |
| Vor `prepared` abgebrochen | Alle Ziele `before`, kein bestätigtes Journal, Draft erhalten. |
| `prepared`, noch kein Ziel geschrieben | Alle Ziele `before`; vorbereitetes Journal kontrolliert entfernen, Draft erhalten. |
| `prepared`, Teilmenge bereits `after` | Erst alle aktuellen Werte gegen `before|after` prüfen, dann geschriebene Ziele rückwärts auf `before`; keine Teilmischung bestätigen, Draft erhalten. |
| `prepared` plus externer dritter Wert | Nichts weiter schreiben oder zurückrollen; konkreter Konfliktpfad, Journal und Draft unverändert erhalten. |
| Alle Ziele `after`, Journal noch `prepared` | Nach demselben Vertrag auf `before` zurückrollen; erst `committed` macht den Nachherstand maßgeblich. |
| `committed`, Cleanup unterbrochen | Alle Ziele müssen `after` sein; Nachherstand behalten, Journal kontrolliert entfernen, anschließend nur den dazugehörigen übernommenen Draft entfernen. |
| Draft bei unveränderter gespeicherter Basis | Exakte Weltkennung und Änderungen wiederherstellen; Navigation/Kamera bleibt flüchtig. |
| Draft bei extern veränderter Basis oder Kinddatei | Kein Merge und kein Überschreiben; Draft erhalten und konkreten Konflikt sichtbar melden. |
| Ausdrückliches Verwerfen | Draft per Compare/Write nur gegen den gelesenen Draftwert entfernen; gespeicherte Overworld-/Terrain-/Dungeon-/Citydateien bleiben bytegleich. |

Gezielte Unterbrechungen werden mindestens nach Journalanlage, nach jeder
einzelnen Zieldatei, nach `committed` und vor Draft-Cleanup injiziert. Für jede
Zelle werden Journal, Draft und alle Einzeldateien vor/frisch danach geprüft.
Ein In-Memory-Fehler allein genügt nicht; der Recovery-Lauf verwendet eine neue
Repository-/Adapterinstanz. Ein extern geänderter Wert wird nie durch Rollback
ersetzt.

## Getrennte Ausführungspakete

1. **O01a – read-only Overworld-Open:** nach HEX-01 ausschließlich `.02/.16`
   mit einer referenzfreien `.overworld` und dem Null-Schreiborakel prüfen. Das
   ist ein enger Atlas-Öffnungsbeleg, keine Kinddatei- oder Dungeondraft-Abnahme.
   **O01b** prüft vollständigen Transport und Missing-/Foreign-Child erst nach
   hostneutralem Terrain-Lader und seiner sichtbaren Hostverdrahtung.
2. **H01 – History:** `.04/.05` nach I01a hostneutral, sichtbar erst nach I01b.
   Kein Speicher- oder Dirty-Claim.
3. **S01 – Save/Draft/Recovery:** `.03` und die technische Dirty-/Draftgrenze
   nach I01c gegen jede Transaktionszeile. Danach frischer unabhängiger Review.
4. **C01 – Copy/Discard:** `.14` sowie mögliche `.07/.08/.13/.15` erst nach
   I01d und bestandenem Identitätsorakel. Nur explizit beschlossene
   Atlasaktionen umsetzen; kein historisches Menü imitieren.
5. **SH01 – Shell:** `.01/.06/.09–.12` erst nach ratifizierter Ziel-Shell.
6. Jeder Produktkandidat erhält getrennten Fachreview, nötige Nachbesserung und
   eigenen Aufräumzyklus. Original-, Host-, physische und Gesamtfreigaben
   bleiben bis zu ihren jeweiligen Belegen offen.

## Prüfung dieses reparierten Plans

Der Planstand ist nur dann reviewfähig, wenn JSON- und Verweisprüfung bestehen,
alle 16 Fälle genau einer Matrixzeile zugeordnet sind, jede Referenzquelle
getrennt bleibt und jede Identitäts-/Recovery-Aktion ein eindeutiges Orakel hat.
Ein unabhängiger Reviewer prüft den exakten Commit gegen Issue-#1-Befund
`6084893762`, `acceptance.json`, `ROADMAP-HEX-02-PLAN.md`, den aktuellen
`FileStore`-/Dungeon-Journalvertrag und die unveränderten fremden
Checkpoint-Wurzeln. Erst ein PASS öffnet O01a; er öffnet weder O01b, HEX-02 noch eine
Produktimplementierung und ersetzt keinen späteren Implementierungsreview.

## Danach, ausdrücklich eigener Planlauf

Erst nach bestandenem unabhängigem DD-036-Planreview folgt
`GM-UX-N-005-P01` als **neuer** Dungeon-Planlauf. Er plant ausschließlich die
vom GM-Produkttest belegte Suche nach Raum-Key-Texten
([GM-Produkttestplan](ROADMAP-GM-PRODUCT-TESTING-PLAN.md)): eindeutiger Begriff,
Treffer mit Raum und Geschoss, Aktivierung öffnet Raum und Key ohne
Kartenänderung, leere Suche stellt die Übersicht wieder her und Save/Reload
erhält den Hinweis. Dieser Folgeauftrag teilt weder DD-036-Fälle noch Atlas-
Identität, FileTransaction-Umsetzung oder Reviewstatus und beginnt hier nicht.
