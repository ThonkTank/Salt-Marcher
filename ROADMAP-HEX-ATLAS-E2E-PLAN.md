# Hex-Beitrag zum gemeinsamen Fertigstellungsplan

Verbindliche eigene Entscheidung: [Issue #12, Hex](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6089474384). Die [Atlas-Roadmap](ROADMAP-HEX-ATLAS.md) bleibt vollständiger Fachumfang; dieser Plan bindet die nächsten Schritte an das Gesamtprodukt. Er ratifiziert keine fremde Payload und gibt keine Produktphase frei.

## Integration und tatsächliche Verantwortung

`active/installed-phase1` ist der einzige gemeinsame Integrationsbranch. Neue Hexarbeit erfolgt auf dem bestehenden Kandidaten `hex/hex03-p01-20261009`; geprüftes Exact-SHA und unabhängiger Review gehen der Integration voraus. Der Steward rotiert je E2E-Gate und koordiniert Kandidat, Fixture und Gatebelege. Hex bietet die erste E2E-01-Rotation an; Teamentscheidung und unabhängiger Gate-Reviewer sind noch offen. Keine Selbstfreigabe und keine fremde Ownerstimme.

Hex besitzt World/Landschaft/Locations, gemeinsame Kamera/History, den Atlas-Renderer und räumliche City-/Dungeonadapter in HEX-03 bis HEX-05. Stadt besitzt City-Fachpayload/Erzeugung; Dungeon besitzt seine Geometrie und Raum-Keys. Campaign/Preparation/LiveSession, Party/Clock/Travel, Encounter/Chase, P02/P03/P04/OS und Display bleiben eigene bestätigte Implementierungsbesitze. Atlas-Compare/Write ist kein vollständiger Durability- oder Desktopbeweis.

## Gemeinsame vertikale Lieferung

| Beitrag | Liefernde und benötigte Grenzen | Gemeinsamer sichtbarer Beweis |
| --- | --- | --- |
| E2E-01: nächster Orts-/Dungeonablauf | Campaign/Data: Campaign/Preparation und Referenzbesitz; SMR-03: Party/Initialize; P02: wirklicher Speicheradapter; P04: Complete-Import; Hex: Marker/Key, Worldplacement, Transform/Zoom/History; Dungeon: Raum/Key und Sourceadapter | Neuinstallation **und Complete-Import** → Campaign/Party/Preparation → ausdrückliches Initialize → Hex → Ort/Key → verorteter Dungeon/Raum/Key → herauszoomen → Undo/Redo → Save → neuer Prozess; gleiche IDs, Texte und Positionen |
| E2E-01/02: Stadt im selben Raum | Stadt: City-01–04, erzeugbarer Plan/Häuser; Hex: Placement/Renderer/Hit/History/Speicherung; Dungeon: Haus-Dungeon | Ort → Stadtplan → Haus → Dungeonraum allein durch Zoom, unmittelbar bearbeiten; gleiche Kamera/History |
| E2E-02: Live-Spiel | SMR-03/Encounter/Clock/Verbraucher benötigen stabile Location-/Roomreferenzen; Hex liefert diese ohne kopierte Session-/Zeitwahrheit | Derselbe Fixture-/Receipt-Trace über Navigation, Party/Focus, Encounter, Reise und Verbraucher |
| E2E-03/04: Fehler, Portabilität und Anzeige | P02/P04: tatsächlicher Host-/Storagebesitz; P03/Display: sichere Projektion; Hex: eigene Text-/ID-/Koordinaten-/Recoveryorakel | Mehrbesitzer-Fault/Restart/Reimport; GM-Tastatur/200 Prozent; private Orts-/Raum-Keys fehlen vollständig in Playerdaten |

Nach dem aktuellen endlichen #12-Entscheidungsgate folgen unabhängiger technischer Planreview und passende Umsetzung. Der nächste Marker/Key/Drag/Fit-Schritt bleibt konkret in [HEX-03](ROADMAP-HEX-03-PLAN.md), bekommt aber benannte E2E-01-Eingänge und Abnehmer. Die erste native Ortsprobe kommt vor weiteren Links. Kein LiveSession-Autostart durch Atlasbearbeitung. Vollständige Stadt-/Dungeon-/Campaignintegration wird durch diese frühe Ortsprobe nicht vorweggenommen.

## Fester eigener Fixture-Anteil

[Manifest](tests/fixtures/atlas-e2e-v1/manifest.json), Version1: fünf eigene Eingangsdateien und fünf exakte Erwartungsdateien mit SHA-256. World `00000000-0000-4000-8000-000000000010`; Locations `...0011`/`...0012`, Placements `...0013`/`...0014`, Abschnitte `...0015` bis `...0018`. Vollständige UUIDs stehen in den Dateien. Negative Terrainchunkgrenze, Ursprung `(0,0)`, pointy, drei Meilen Mittelpunktabstand, zwei feste Orte und genaue Markdownbytes. Änderungen: Town-Key/Abschnittsfolge, POI `(-4828.032,0)` → `(4828.032,0)`, Waldhex `(1,0)`.

Nur `input` wird in einen isolierten Testvault übernommen. `expected` ist das Dateiorakel und darf nicht als zweite live Dokumentmenge mit denselben IDs eingebunden werden. Ein Gate regeneriert diese Dateien/Hashes nicht; fachliche Änderungen verlangen eine explizite neue Version. Die tatsächliche Ortanlage wird zusätzlich in HEX-03 nativ geprüft; der gemeinsame feste Seed beginnt mit zwei bekannten gespeicherten Locations.

Stadt bestätigt City `...0100` (Haus A `...0105`) und die Fremdreferenzen World `...0010` / Location `...0011` / Placement `...0013` in [6089511317](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6089511317). Die Citypayload bleibt beim Stadtowner. Dungeon `...0030`, Raum `...0031`, Geschoss `...0032`, Eingang `...0033` sind weiter Vorschläge zur Bestätigung durch den Dungeonowner; alle City-/Dungeonpayloads fehlen ausdrücklich. Campaign/Data-/Party-/Scene-/Receipt-/Displayfakten stammen von deren Owners. Der Atlas-Anteil ist somit kein vollständiges gemeinsames Fixture und keine Complete-Import-Behauptung.

## Noch zu entscheidende konkrete Grenzen

- Erste Steward-Rotation annehmen oder einen anderen tatsächlichen Kollegen benennen; unabhängigen Gate-Reviewer zusagen.
- Stadt/Dungeon bestätigen IDs, Source-/Historyadapter, Eingänge, Geschosse und unveränderliche native Fachpayloads. Weltposition ist keine automatische Geschosshöhe.
- Campaign/Data bestätigt Referenz-/Import-Remapping und die Campaign-Anbindung an denselben Atlas; keine verlustbehaftete zweite Ortswahrheit.
- P02/P03/P04, Travel/Clock und Encounter/Chase benötigen reale Implementierungsowners; ein Reviewangebot ersetzt diesen Besitz nicht.
- Keine Obsidian-Belege zu Zielhost-, Großwelt-, physischen oder Gesamtparitätsbelegen umetikettieren. Alle Hex-/City-/Wonderdraft-Fachgates bleiben verpflichtend.

Die korrigierte Wellenreihenfolge bringt die minimalen **ausführbaren** Campaign-/Party-/Preparation-/Initialize-Anschlüsse, Campaign→Atlas, P02 und den verbindlichen Complete-Import/P04 vor vollständigem E2E-01. Ein vorheriger räumlicher Hex/Ort/Dungeon-Hostlauf ist ausdrücklich nur Zwischenbeleg. Atlas-QA unterstützt Hex als Steward-Kandidaten und übernimmt den unabhängigen integrierten Hostlauf auf Laptop1 ([6089483573](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6089483573)); unabhängiger Gate-Code-Review und übrige Ownerzustimmungen fehlen weiter. Linux-Hostbeleg ist kein Windows-/macOS- oder Zielhostbeleg.
