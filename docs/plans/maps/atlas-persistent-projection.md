# Persistenter räumlicher Lesebestand im bestehenden Atlas

Arbeitsentscheidung vom 22.10.2026; Runtimeanschluss implementiert, vollständige Leistungsabnahme offen.

Der normale Atlas bleibt Oberfläche und Renderer. Main/SQLite bleiben Besitzer
der Autorendaten. Der nächste Schritt ersetzt den wiederholten Aufbau abgeleiteter
räumlicher Indizes; darauf können dauerhaft gespeicherte Detailstufen aufbauen.

## Drei Optionen und Entscheidung

| Option | Wirkung | Grenze |
| --- | --- | --- |
| Einzelne Abfragen/Kopien optimieren | Weniger Arbeit je Lesung | Der volle Weltbestand wird beim Öffnen weiterhin aufbereitet. |
| Indexaufbau in unterbrechbare Schritte zerlegen | Neue Anzeigeaufträge können dazwischen arbeiten | Gesamtkosten und erneute Aufbereitung bleiben bestehen. |
| Fertige räumliche Indizes und später Detailstufen dauerhaft halten | Öffnen greift auf vorhandene Suchstrukturen zu; Änderungen aktualisieren betroffene Einträge | Benötigt klare Quellenversionen, Snapshotgrenzen und Cache-Lebenszyklen. |

**Gewählt ist die dritte Option.** Die zweite bleibt eine Ergänzung für den ersten
Aufbau oder einen verworfenen Cache. Optimierungen werden anhand der vollständigen
Öffnungs-/Bearbeitungsfolge bewertet, nicht nur anhand kleinerer Funktionszeiten.

Die bestehende Mischwelt zeigte rund 4,3 Sekunden Warteschlange hinter dem
Geometrieindexaufbau. Ein separater Diagnoseablauf mit absichtlich zurückgehaltenem
Objektbereich zeigte das Gelände nach 4,91 Sekunden und erlaubte Kameraänderungen.
Das ist keine normale Öffnungsmessung und belegt das Zwei-Sekunden-Ziel nicht.
Der bisherige JSONL-Cache verhindert erneutes Materialisieren vieler Konturen,
lädt aber alle Metadaten erneut und baut den räumlichen Index wieder auf.

Ein kleiner Wegwerfprototyp auf derselben Mischwelt bestätigt die Richtung:
vollständige Indexbereitstellung 5.461 ms, Anhängen des fertigen SQLite-Index und
Wiederherstellen der kleinen Leser-Metadaten 6,4 ms. Welt- und Nachbarschaftsantwort
mit 11.200 Geometrieobjekten bleiben einschließlich Raster bytegleich. Der Index
belegt 28.966.912 Bytes; sein SQLite-Backup benötigt 139 ms. Kanonische
Schreibversuche sind weiterhin gesperrt. Rohbeleg:
`.build/persistent-index-prototype/result.json`.

Die 6,4 ms enthalten weder Dateihashprüfung noch Arbeitskopie, inkrementelle
Änderungen oder eine native App-Öffnung. Das Experiment umgeht Konstruktor-DDL
und übernimmt einige skalare Leserzustände ausdrücklich nur zur Machbarkeitsprüfung;
dieser Hilfspfad wird nicht in das Produkt übernommen. Die eigentliche
Nachbarschaftslesung kostet weiterhin rund 2,5 Sekunden und benötigt eigene
Detailstufen. Der Versuch ist eine Architekturentscheidung, keine Leistungsabnahme.

## Anschluss und Grenzen

- Eine schreibgeschützte Verbindung liest weiterhin den kanonischen, gepinnten
  SQLite-Snapshot. Eine getrennte Verbindung darf ausschließlich den abgeleiteten
  Index schreiben. Das wurde mit der tatsächlich verwendeten SQLite-Bindung geprüft:
  kanonische Schreibversuche bleiben mit `SQLITE_READONLY` gesperrt.
- Ein erster oder vollständig veralteter Bestand entsteht weiter in den TEMP-
  Tabellen der schreibgeschützten Quellverbindung. SQLite kopiert Metadaten dabei
  direkt; es gibt keinen zusätzlichen vollständigen Aufbau über JavaScript.
  Dieser fertige TEMP-Bestand wird über dieselbe Backup-Veröffentlichung gespeichert.
- Bei gültigem persistiertem Bestand erhält der Worker eine eigene Arbeitskopie.
  Die schreibgeschützte Quellverbindung hängt sie zum Lesen an; eine separate
  Verbindung schreibt ausschließlich in diese Kopie. Kein zweiter Worker verändert sie.
- Synchronisation liest kanonische Werte aus dem gepinnten Quellsnapshot und
  aktualisiert Metadaten und Quellenmarkierung in einer Indextransaktion. Erst
  anschließend liest der Rendererauftrag den dazugehörigen Indexsnapshot.
- Persistierte Geometrie- und Landschaftsindizes müssen ihre tatsächlichen
  Eingangsquellen abdecken. Die bestehende dauerhafte Quellenmarkierung wird
  entsprechend erweitert. Eine zusätzliche Geometriekennung bleibt bei reinen
  Terrainänderungen stabil, auch wenn deren Änderungsverlauf überläuft. Externe
  Schreibverbindungen, Undo und wiederhergestellte
  Backupzweige dürfen keine ältere Projektion als aktuell ausgeben.
- SQLite-Snapshots werden über die vorhandene Backup-API erstellt. Ein atomar
  ersetzter Verweis benennt Inhaltshash, Format und Quelle. Veraltete, unvollständige
  oder beschädigte Caches werden verworfen; der kanonische Bestand bleibt maßgeblich.
- Arbeitsspeicher, Dateigrößen und Anzahl der Arbeitskopien bleiben begrenzt.
  Der Hauptprozess entfernt die eigene Arbeitskopie erst nach Ende des Workers.
  Kampagnenlöschung entfernt ausschließlich zugehörige Projektionen.
- Der ersetzte JSONL-Leser ist entfernt. Alte Cachedateien werden nach erfolgreicher
  SQLite-Veröffentlichung gelöscht. Reale
  Rückfallwege bei nicht beschreibbarem Cache und Graphvorschauen verwenden dieselbe
  Projektionslogik, nicht eine zweite fachliche Implementierung.

SQLite dokumentiert Snapshot-Backups und die Regeln angehängter Datenbanken;
`better-sqlite3` bietet inkrementelle Backups bei laufendem Betrieb. URI-Dateinamen
sind in der hier verwendeten Bindung nicht aktiviert. Die Architektur setzt deshalb
nicht auf einen vermeintlich schreibgeschützten URI an einer schreibbaren
Autorverbindung. Quellen: [SQLite ATTACH](https://www.sqlite.org/lang_attach.html),
[SQLite Backup](https://www.sqlite.org/backup.html),
[better-sqlite3 Backup-API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#backupdestination-options---promise).

## Prüfung vor Übernahme

Vollständige Antworten und Raster werden gegen den bisherigen Leser verglichen.
Kalter Erstaufbau, frischer Prozess mit gültigem Index, lokale Änderungen,
Rollback, externe Änderungen, Backupzweige, beschädigter Cache und Workerabbruch
gehören in getrennte Prüfungen. Im normalen Atlas wird die Zeit bis zur ersten
sichtbaren Geländeübersicht und bis zur nächsten möglichen Bearbeitung gemessen.
Weniger Cache-Ladezeit allein erfüllt die Produktanforderung nicht.

Persistente Farb-/Höhen-Detailstufen folgen auf diesem Anschluss. Sie benötigen
zusätzlich räumliche Invalidierung und Zoomübergänge. Dieser Indexschritt darf
nicht als bereits implementiertes weltweites Detailstufensystem bezeichnet werden.

## Codebesitzer

`atlas-projection-index.ts` besitzt Arbeitskopien, TEMP-/Dateianschluss, Transaktionen
und veröffentlichte SQLite-Snapshots. `atlas-region.ts` und
`atlas-landscape-region.ts` behalten Geometrie-/Landschaftsprojektion und lokale
Invalidierung. `atlas-shape-source.ts` bindet beide Teile an ihre tatsächlichen
Eingangstabellen. `desktop/atlas-region-worker.ts` nutzt diesen Anschluss für den
normalen Atlas; der Service entfernt seine Arbeitsdateien erst nach Workerende.

Snapshotdateien verwenden ein eigenständiges SQLite-Journalformat ohne WAL-
Begleitdateien. Kandidaten bleiben im eigenen Workerordner. Nach einem Abbruch
entfernt der Start unter der App-Einzelsperre unveröffentlichte Arbeitskopien und
nicht referenzierte Snapshotdateien. Fehlende Quellenmarkierung, Graphvorschau und
ein nicht beschreibbarer Cache verwenden ausschließlich den TEMP-Anschluss.

[Prüfstand und offene Leistungsziele](../../reference/atlas-persistent-index-20261022/README.md):
103 betroffene Tests, große Lesemessung und native Wiederöffnung.
