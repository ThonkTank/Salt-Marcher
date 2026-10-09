# E2E-01: gemeinsame Quellenbasis v1

Diese Zusammenstellung gehört zum einzigen Integrationskandidaten **PR #13** und
zur Zeile „Nutzerablauf“ im ratifizierten Katalog
[`ROADMAP-E2E-GATES-CANDIDATE.md:13`](../../../ROADMAP-E2E-GATES-CANDIDATE.md).
[`manifest.json`](manifest.json) enthält die maßgebliche Liste der exakt
aufgenommenen Hex-, Stadt-, Dungeon- und Campaign/Data-Quellen sowie die
unveränderten Datei- und Identitätsbelege. Die bestehenden Bereichsmanifeste sind
historische Komponentenbelege; ihre Texte werden durch diese Zusammenstellung
nicht nachträglich zu einer Gesamtfreigabe umgeschrieben.

Die sieben nativen Inputdateien und sieben Expecteddateien bleiben im bisherigen
Fixtureverzeichnis. Hier entstehen keine zweiten Karten mit denselben IDs. Eine
Testinstanz darf ausschließlich die Inputseite als Livebestand verwenden.
Expected ist ein Byteorakel. Die Stadt-Expecteddatei ist bewusst die unveränderte
gelieferte Ausgangsbasis.

## Geprüfter Zusammenhang

Der Test `atlas-e2e-composition.test.ts` prüft die drei Bereichsmanifest-Hashes,
alle 14 Datei-Hashes und Bytezahlen, kanonische Codecs, 21 eindeutige lokale IDs
und acht tatsächlich gespeicherte lokale Referenzen. Der reservierte
Campaignverweis gehört nicht zu den 21 nativen Identitäten.

Ein echter `AtlasRepository` lädt Gelände und beide Orte. `CitySource` und
`DungeonAtlasSource` erhalten dieselbe `terrain.history`. Ein einziger
zusammengesetzter Befehl bearbeitet Gelände, POI-Platzierung, Stadtortsname und
Orts-Key einschließlich Reihenfolge sowie den Dungeon-Raum-Key. Der Cityowner
beteiligt sich mit seiner ausdrücklich unveränderten Ausgangsbasis. Ein Undo
stellt die sieben Input-Snapshots bytegenau her, ein Redo die sieben
Expected-Snapshots. Ein veralteter Dungeon-Beforewert als letzter Eintrag lehnt
alle vorherigen Änderungen ab, bevor einer der Owner mutiert. Vorschau und
Tests schreiben keine Fixturedateien.

## Konkrete Anschlussfläche für Stadt

| Vorhandener Eingang                                              | Verwendung durch die gemeinsame Atlasanbindung                                                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CitySource(document, terrain.history)`                          | Eine Cityquelle pro Dokument und gemeinsamer History-Lebensdauer; kein zweiter Stadt-Undo-Stack.                                                                         |
| `cityDocumentChange(before, after)`                              | Native, geprüfte Cityänderung für einen zusammengesetzten Atlasbefehl.                                                                                                   |
| `CityGesture.before`, `.preview`, `.update`, `.apply`, `.cancel` | Beginbasierte lokale Metergesten. `apply` schreibt bereits einmal in die gelieferte History; anschließend darf kein zweiter Session-/Atlascommit folgen.                 |
| `CityRenderer.container` und `.draw(scene, project, options)`    | Vorhandene Stadtzeichnung mit externer affiner Abbildung von lokalen Metern auf Atlas-Bildschirmpunkte.                                                                  |
| `AtlasRenderer.detailLayer`                                      | Vorhandener Einhängepunkt. Hex verbindet Lebensdauer, Projektion, Hit-Routing und Zeichnen vor `Application.render()`; der heutige `changed`-Callback läuft erst danach. |

Der nächste erforderliche Hex-Eingang ist die echte persistierte räumliche
Verknüpfung **World/Location → City → Haus → Dungeon** samt Vorwärts-/Rückabbildung
und Aufnahme dieser Owner in Snapshot, Entwurf, Save, Copy, Discard und Recovery.
Die bestehenden City-v1-Dateien bekommen dafür kein erfundenes `dungeonId`-Feld.
`Session.revision` liefert keine dauerhafte Dungeonrevision. Bis diese
Atlasanbindung ausführbar vorliegt, bleibt der gelieferte Cityseed eingefroren;
diese Quellenaufnahme startet kein weiteres Stadtpaket.

## Weiter offene Nachweise

Haus-/Dungeonbindung, tatsächliches City-/Dungeon-Mounting und Bearbeitung allein
durch Zoom sind noch offen. Die Campaignquelle liefert geprüfte hostneutrale
Lifecycle-/Context-/Remapkerne, noch keine persistierte gemeinsame Campaign,
vertrauenswürdige Domainregistry oder Vaultanbindung. Katalog-/Encounterreferenzen,
Campaignwechsel, die gemeinsame Speichergrenze aller Owner, P02 Save/Reopen und
der echte P04 Complete-Import bleiben Pflicht. Diese Tests sind ein
Source-/Snapshot-/History-Zwischenbeleg. Native Gesamtbedienung mit frischem
Prozess, unabhängiger Gesamtcodereview, physische Eingabe, Großkarten,
Originalparität und Installation benötigen eigene Belege. **E2E-01 bleibt offen.**
