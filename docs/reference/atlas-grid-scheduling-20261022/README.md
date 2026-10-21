# Unterbrechbarer Aufbau des Höhengitters

Lokaler Fortschritt nach `9c4f752f9` auf
`codex/atlas-bounded-terrain-history`. Keine Main-/Release- oder
Pentium-Abnahme.

## Ursache und Umsetzung

Die Farbrasterarbeit besaß bereits Unterbrechungspunkte. Das vollständige
Höhengitter entstand davor synchron in einem einzigen Workerabschnitt.
Die Profilierung nach dem abdeckenden Quellenindex maß rund 279 ms für das
Kontextgitter; die kalte erste Weltübersicht benötigte im direkten Vergleich
sogar 294–429 ms bis zum ersten Unterbrechungspunkt.

`readTerrainGridSteps` und `TerrainProjectionCache.gridDataSteps` verwenden den
bestehenden Rasterkern mit höchstens 4.096 Samples pro kaltem Zeilenband bzw.
örtlichem Reparaturblock. Abgeschlossene Quelllesungen geben den Worker frei;
kein SQLite-Iterator wird über eine Pause gehalten. Die unveränderten synchronen
Autoren-/Sichtprüfungen konsumieren denselben Kern mit ihrer bisherigen größeren
Blockgröße. Es entstehen keine zweiten Höhenwerte oder Trefferregeln.

Kalte Cachegitter werden erst vollständig veröffentlicht. Bei örtlichen
Reparaturen bleiben bisherige Werte und Dirty-Markierungen bis zum erfolgreichen
Abschluss erhalten. Ein Invalidierungszähler verhindert, dass eine während der
Pause überholte Berechnung den Cache anschließend als aktuell markiert. Der
Worker prüft zusätzlich weiterhin vor jeder Fortsetzung den Quellenstand.
Bereits gültige Teilgitter und dekodierte Quellen bleiben im bestehenden Cache;
die vollständig sichtbare Projektion wird erst als fertige Antwort veröffentlicht.

## Vergleich

[ABBA-Messung](projection-parity.json) derselben ersten Übersicht der gemischten
40-Millionen-Meter-Prüfwelt, nach abgeschlossener Metadatensynchronisierung:

| Messung | Vorher, zwei Läufe | Nachher, zwei Läufe |
| --- | ---: | ---: |
| erster Unterbrechungspunkt | 429 / 294 ms | 8,6 / 9,4 ms |
| längster Abschnitt der ganzen Übersicht | 429 / 294 ms | 122 / 95 ms |
| vollständige CPU-Projektion | 1.485 / 1.144 ms | 1.436 / 1.148 ms |

Das ist ein Gewinn bei der Unterbrechbarkeit, keine belegte Verkürzung der
gesamten Ladezeit. Metadatenaufbau, Workerstart, IPC und Anzeige sind nicht Teil
dieser Zeiten. Alle Gitter und vollständigen Projektionsantworten sind in allen
vier Läufen bytegleich. Die verbleibenden 95–122-ms-Abschnitte zeigen ausdrücklich,
dass weder 8 ms für jeden Workerabschnitt noch 100 ms Ende-zu-Ende-Reaktion
erreicht sind. Eine feste Samplezahl ist kein garantiertes Zeitbudget.

```sh
TERRAIN_GRID_SOURCE=.build/region-cache-full-world-final/world.sqlite \
TERRAIN_GRID_BASELINE=9c4f752f9 \
QA_EVIDENCE_DIR=.build/grid-cooperative-parity \
node tools/measure-terrain-grid-scheduling.mjs
```

Der Vergleich baut alle drei geänderten Modulbesitzer für die Vorherseite aus
dem angegebenen Commit. Die restlichen gemeinsamen Module und der Quellenstand
sind identisch. `next()`-Zeiten entsprechen den zusammenhängenden CPU-Abschnitten.

## Regressionen

[49 lokale Tests](tests.json) bestanden. Neue Prüfungen belegen:

- Quelliteratoren sind vor jeder Pause geschlossen; abgebrochene kalte Gitter
  hinterlassen keinen fertigen Oberflächeneintrag.
- Eine abgebrochene örtliche Reparatur verändert weder bisherige Werte noch
  Dirty-Markierungen. Wiederholung entspricht einer unabhängigen kalten Lesung.
- Quellenfehler, Invalidierung und Reset während einer Pause veröffentlichen
  kein veraltetes Gitter. Zurückgegebene Puffer bleiben unabhängig vom Cache.
- Ein echter `AtlasRegionService`-Worker beantwortet eine Auswahl während des
  noch unvollständigen Höhengitteraufbaus. Die Traceantwort enthält zu diesem
  Zeitpunkt noch keinen Abschluss von `projection.grid`. Anschließend entspricht
  die fortgesetzte Projektion einem unabhängigen kalten Worker, ohne Neustart.

Bestehende Regressionen prüfen Quellenwechsel zwischen Abschnitten, neue Kamera,
Sculpt, Undo/Redo, Höhen-/Farbgleichheit, lokale Invalidierung und Pinselverdeckung.

Die abschließend räumlich auf das bearbeitete Gelände konzentrierte Workerprobe
wurde mit allen sieben Servicefällen erneut geprüft. App-/Desktop-Typprüfung
und Desktop-Build bestanden ebenfalls.

## Native Gegenprobe und Grenzen

Die vorhandene gemischte Belastungskarte wurde über den normalen Kampagneneinstieg
geöffnet und in einem frischen Prozess wieder geöffnet. Beide Läufe und der
anschließende große Pinsel liefen über `tools/ui-session.py` mit jeweils 240 s
Höchstdauer und ohne eigene parallele Build-/Testlast. Alle drei Electron-Prozesse
endeten normal, waren danach verschwunden und meldeten keine Rendererfehler.
Die elf Build-Artefakte waren in beiden Prüfabläufen identisch.

[Öffnen und Wiederöffnen](native-opening.json):

| Beobachtung | Kalt | Frischer Prozess |
| --- | ---: | ---: |
| erste Geländeübersicht | 5,143 s | 4,727 s |
| vollständige Objektgeometrie | 11,325 s | 8,278 s |
| alle 48 Detailkacheln | 24,266 s | 21,059 s |

Die unmittelbar vorherige Prüfung lag bei 4,959 / 4,916 s bis zur Übersicht
und 23,735 / 21,355 s bis zu allen Detailkacheln. Daraus folgt kein allgemeiner
Ladegewinn. Die Objektcachedatei blieb bei Wiederöffnung unverändert bei
9.897.192 Byte. `firstDetailMs` ist weiterhin eine Beobachtung nach dem
Objektwartepunkt und kein gemessener Zeitpunkt des ersten GPU-Detailpixels.

[2.500-Meilen-Sculpt-Pinsel](native-brush.json): 5,906 s vom Loslassen bis zur
Werkzeugfreigabe, gegenüber vorher 5,587 s. Der einzelne Lauf zeigt einen
längeren Abschluss; daraus wird weder ein Pinselgewinn noch eine stabile
Regressionsrate abgeleitet. Die Kamera änderte ihren Ausschnitt während der
noch ausstehenden Werkzeugfreigabe. Die beobachteten 338 ms vom Mausradereignis
bis zur Zustandsabfrage enthalten eine feste 250-ms-Wartezeit und sind keine
Eingabe- oder Bildlatenz.

Die [gesichtete Wiederöffnung](reopened.png) ist eine synthetische Belastungskarte,
keine gestalterisch abgenommene Fantasywelt. Die Zielgeräteprüfung auf
Pentium/Intel UHD, 100-ms-Pinselreaktion, zwei Sekunden bis zur Übersicht,
30-Minuten-Speicherplateau und der vollständige Autorenablauf bleiben offen.
Der initiale Metadatenaufbau und die verbliebenen langen Farb-/Quellabschnitte
werden durch diese Unterbrechungspunkte noch nicht beseitigt.
