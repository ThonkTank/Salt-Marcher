# E2E-01: Quellenfixture v1

[`manifest.json`](manifest.json) bindet die historischen Hex-, Stadt-, Dungeon- und Campaign/Data-Quellen aus [PR #13](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13), ihre Dateien und Identitäten. Die drei Bereichsmanifeste bleiben eigenständige Komponentenbelege.

Sieben native Inputdateien und sieben Expecteddateien liegen im referenzierten `atlas-e2e-v1`-Verzeichnis. Eine isolierte Testinstanz verwendet ausschließlich die Inputseite als Livebestand; Expected ist das Byteorakel. Die unveränderte Stadt-Expecteddatei ist eine Kontrolle dieses Fixtures, keine Vorgabe für die weitere Stadtentwicklung.

[Die Kompositionsprüfungen](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/shared/core/atlas-e2e-composition.test.ts) decken ab:

- Drei Bereichsmanifest-Hashes, alle 14 Datei-Hashes und Bytezahlen, kanonische Codecs, 21 lokale Identitäten und acht gespeicherte Referenzen. Der reservierte Campaignverweis zählt nicht zu den nativen Identitäten.
- `AtlasRepository`, `CitySource` und `DungeonAtlasSource` mit derselben `terrain.history`: Ein zusammengesetzter Befehl ändert Gelände, POI-Platzierung, Ortsname und Orts-Key einschließlich Reihenfolge sowie den Dungeon-Raum-Key. Die Stadtquelle beteiligt sich mit unverändertem Dokument.
- Ein Undo stellt alle sieben Input-Snapshots bytegenau her, ein Redo alle Expected-Snapshots. Ein veralteter Dungeon-Beforewert im letzten Eintrag verhindert sämtliche Änderungen, bevor eine Quelle mutiert.

Vorschau und Tests schreiben keine Fixturedateien. Dieses Fixture prüft Quellen-, Snapshot- und Historykomposition. Tatsächliche räumliche Verknüpfung, gemeinsame Campaignspeicherung, vollständiger Import und Hostbedienung haben eigene Anforderungen und Nachweise im [E2E-Katalog](../../../docs/project/verification/end-to-end.md) und [aktuellen Integrationsplan](../../../docs/atlas/contract/spatial-runtime.md). Eine Gesamtfreigabe folgt daraus nicht.

Der verlinkte Core-Test ist seit der Suitebereinigung vom 27.10.2026 ein historischer Beleg.
