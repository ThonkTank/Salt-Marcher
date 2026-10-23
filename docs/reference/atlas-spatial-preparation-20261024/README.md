# Kalte Atlasvorbereitung: Bedarf statt Kamerarand

Untersuchung auf `2d17dbc92`, unveränderte Produktionsimplementierung. Die
[reproduzierbare Gegenprobe](../../../tools/measure-atlas-spatial-preparation.mjs)
verwendet die eingefrorene M0-Welt, neue readonly Verbindungen und ausschließlich
temporäre Projektionsindizes. Sie vergleicht die vollständige Vorbereitung mit
zwei experimentellen Filtern der Landschaftsmetadaten. Die Geometrievorbereitung
bleibt in allen Varianten vollständig. Keine Veröffentlichung von Teilindizes.

## Befund

Die [erneute Attribution](cold-attribution.json.gz) ergibt 1.736 ms für die
Synchronisation, davon 1.140 ms Landschaftsvorbereitung, und 2.809 ms für die
Übersicht. Verschachtelte Zeiten dürfen nicht addiert werden. Das ist eine
instrumentierte Bibliotheksmessung, keine native Startzeit.

Die [Gegenprobe](counterprobe.json.gz) vergleicht drei wechselnde Durchläufe je
Variante mit echten groben und feinen `AtlasGeometryTiles`-Abrufen. Verglichen
wird das vollständige Modell einschließlich Warnungen, Objektidentitäten,
Ursprüngen und Puffern. Die Feinkachel enthält 272 Objekte; ein zunächst leer
gewählter Detailausschnitt wurde vor der finalen Prüfung ersetzt.

- Vollständig: 108.076 Landschafts-Metadatenzeilen.
- Nur physische Felder: 1.028 Zeilen mit Höhe, Route oder Süßwasser.
- Kamerakachel plus 0,75 m Rand: zwölf Zeilen.

Der finale Lauf ohne parallele Testlast misst folgende Mediane aus drei
Durchläufen (Millisekunden, keine p95-Abnahme):

| Vorbereitung | Synchronisation | Übersicht danach | Erste Feinkachel danach |
| --- | ---: | ---: | ---: |
| Vollständig | 1.571 | 1.977 | 67 |
| Physische Felder | 768 | 1.989 | 68 |
| Kamerakachel | 441 | 1.522 | 70 |

Die gemessene Summe bis zum groben Modell sinkt im Median von 3.541 auf
2.754 ms für physische Felder. Die eigentliche Übersichtsableitung bleibt etwa
gleich teuer. Die scheinbar schnellere Kameravariante ist fachlich widerlegt.
Eine Vorserie überlappte mit dem Regressionstest und wird nicht als finaler
Zeitbeleg verwendet. Die [Provenienz](provenance.json) bindet Ergebnis, Tool und
das tatsächlich ausgeführte Produktionsbundle.

Auf der festen M0-Welt stimmen Modelle und Warnungen in allen Varianten überein.
Ein gezieltes Gegenbeispiel widerlegt jedoch die allgemeine Gleichwertigkeit des
Kamerafilters: Ein sichtbarer Raum kann weit von seinem Workplane-Anker entfernt
liegen. Die Höhe an diesem Anker bleibt für seine sichtbare Geometrie maßgeblich.
Der Kamerafilter verwirft diese Quelle und liefert ein anderes Modell; der
Filter nach physischen Feldern erhält das vollständige Ergebnis.

## Entscheidung und Übergangsvertrag

Der nächste Implementierungsschritt ist eine bedarfsabhängige Vorbereitung der
physischen Felder für Geometrieaufträge. Der pauschale Kamerafilter wird verworfen.
Die Auswahl der Abhängigkeiten folgt dem angeforderten Produkt; erst danach
dürfen deren Quellen räumlich eingegrenzt werden. Eine vollständige Umstellung
aller Geometriequellen ist durch diesen Landschaftsversuch nicht belegt.

Die Produktionsumsetzung muss getrennte Vollständigkeitsmarkierungen für
physische Felder und vollständige Landschaft besitzen. Ein Teilindex darf weder
als vollständiger persistenter Index veröffentlicht noch von Terrain-, Material-
oder Regionsabfragen dafür gehalten werden. Der erste vollständige Auftrag muss
die ausgelassenen Quellen aus seinem aktuellen kanonischen Snapshot ergänzen,
auch nach Änderungen, Rücknahme oder Neustart. Bestehende vollständige Indizes
bleiben wiederverwendbar. Globale Fehlererkennung, Höhenreihenfolge, alle neun
Höhensamples, Quellenstempel und Cachebudgets bleiben erhalten.

## Prüfungen und Grenzen

Der neue Fall in [Geometriekacheln](../../../tests/atlas-geometry-tiles.test.mjs)
prüft die sichtbare Feingeometrie mit einem eine Million Meter entfernten
Workplane-Anker, grobe Darstellung, Cachetreffer nach Neustart, entfernte
Höhenänderung sowie Undo/Redo. Die [20 gezielten Tests](tests.log.gz) einschließlich
der vorhandenen Höhen- und Ankerregressionen bestehen. Der erste Testlauf fand
eine falsche erwartete Autorenrevision im neuen Test; sie wird jetzt aus dem
kanonischen Datensatz gelesen. Der [Capability-Eintrag](capability.log.gz) führt
die tatsächlichen Prüfdateien und die Gegenprobe.

Kein geänderter Produktpfad, kein neuer nativer Leistungsnachweis, keine
Main-Integration und keine Veröffentlichung. Der Versuch belegt weder die
Vollständigkeit späterer Übergänge noch das Zwei-Sekunden-Ziel oder ein p95.
Nach der Umsetzung sind genau diese Übergänge und der reale erste Abruf samt
anschließender vollständiger Landschaftsabfrage zu prüfen.
