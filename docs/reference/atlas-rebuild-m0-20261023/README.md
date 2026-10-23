# Atlasumbau M0: aktuelle Vergleichsbasis

M0 liefert die Vergleichsbasis für den [beschlossenen Umbau M0–M8](../../plans/maps/unified-spatial-atlas.md).
Der Produktcode wurde für diese Messungen nicht verändert. Ausgangsstand ist
`d3d31363fc40cff1f0f2f5d0b6699dacd54e8b30`; die Arbeitskopie enthält die neue Roadmap,
diesen Bericht und Änderungen an der Messprobe. M0 ist keine Leistungsabnahme
des bisherigen oder künftigen Atlas.

## Umfang und Messbedingungen

Die [Übernahmeliste](inventory.md) erfasst alle 48 Katalogeinträge (45 eindeutige
IDs), globale Aktionen und Verbraucher samt Anforderungen, Code-/Testanschlüssen
und bekannten Lücken. Insbesondere bleiben fehlende Terrain-Feature-Generatoren
und offene Stadt-/Dungeon-Parität sichtbar. Inventarisierung, implementiertes
Verhalten und vollständige native Qualifikation sind getrennt.

Gemessen wurde auf dem Entwicklungsrechner mit i5-8365U, Node 22.22.0,
Electron 44.7.0 und normalem Plattformstart in einer Wayland-Sitzung; Fenster
1440 × 900. [Umgebung](environment.json). Das ist **nicht** der Pentium Gold 7505
bei 1080p aus M8. Native Messungen liefen nacheinander, ohne parallele Builds
oder Testlast. Die Proben verwenden isolierte Profile und synthetische Daten.

Zwei unterschiedliche Welten erfüllen unterschiedliche Aufgaben:

- **Asterfall:** dieselbe eingefrorene Autorenwelt wie im
  [bestehenden Referenzablauf](../atlas-workflow-20261023/README.md), neu in fünf
  getrennten App-Prozessen bei vollständig geladenem Terrain aufgenommen.
- **Mischwelt:** 100.000 Geländehexe und Quellzellen, 5.000 Orte, 5.000 Gebäude,
  50 Detailkarten und ein Dungeon mit 4.001 Räumen. Insgesamt 15.701 Räume,
  48.670 Zeichnungselemente und 1.028 Höhenkacheln. Die Hexe sind Biomeigenschaften;
  das Höhenfeld ist unabhängig davon angelegt. Dies ist kein Bestand mit
  100.000 fein modellierten Reliefzügen.

Die Mischwelt wurde **vor** den gemessenen Pinselzügen eingefroren. Frames,
Pixelreaktion und Neustart verwenden dieselbe SQLite-Eingabe mit SHA-256
`19d4edc88b50d8074578a5c40c870a50331fec1c78a7a8b4f4feee5d463fdb12`.

## Ausgangsmessungen

Die Frameprobe liest während der Zeitmessung keine Pixel aus und profiliert
nicht. Sie öffnet die Welt zunächst in einem Vorlauf, beendet den Prozess
regulär und misst im neuen Prozess Navigation und zwei große Pinselzüge.
Jeder Zug verwendet 2.500 Meilen Radius, drei Sekunden Halten, Bewegung und
eine weitere Sekunde Halten. Die Frame-Perzentile beschreiben die jeweiligen
kurzen Messfenster, keine Langzeitqualifikation.

| Unprofilierter Lauf ohne Pixelauslesen | Frame p95 | Frame p99 |
| --- | ---: | ---: |
| Zoom und Pan | 22,1 ms | 33,3 ms |
| Erster großer Pinselzug | 21,8 ms | 33,4 ms |
| Wiederholter Zug nach Detailnachladung | 19,8 ms | 35,4 ms |

Damit ist schon auf diesem Rechner das gemeinsame Ziel von p95 ≤16,7 ms
nicht erfüllt. Die Werte belegen keine Ursache und keine mögliche Beschleunigung
einer noch nicht implementierten Architektur.

Ein separater Lauf mit asynchronem Pixelauslesen beobachtet die erste tatsächliche
Terrainänderung nach Pointerdown: **140,5 ms** beim ersten und **64,9 ms** beim
Folgezug. Es sind zwei Einzelbeobachtungen, kein p95-Nachweis für das 100-ms-Ziel.
Cursorbewegung allein zählt nicht als Terrainreaktion.

| Nach Pointerup, Beobachtungsobergrenzen | Erster Zug | Zweiter Zug |
| --- | ---: | ---: |
| Werkzeugsteuerung wieder aktiviert, Frameprobe | 1.141 ms | 1.152 ms |
| Neue Autorenrevision tatsächlich dargestellt, Frameprobe | 1.152 ms | 1.167 ms |
| Vollständige Detailstufe dieser Revision, Frameprobe | 8.979 ms | 4.579 ms |

Diese Zeiten enthalten die Warte- und Beobachtungsschritte der Probe, insbesondere
eine Sekunde nach dem Zug; sie sind keine exakten Übergangszeitpunkte oder reinen
Speicherdauern. Ein bloßes `terrainReady=ready` reichte im ersten Probeentwurf
nicht aus: Die maßgeblichen Läufe verlangen zusätzlich eine gegenüber dem
Zugbeginn neuere Revision und Gleichheit von Darstellung und Autorenbestätigung.

Im Pixellauf beginnt der zweite Zug bereits bei `refining`, Kachelstand `1/42`,
und bestätigter Revision 13. Er verändert sichtbare Pixel und bestätigt anschließend
Revision 23. Zwischen dem Ende des ersten und Beginn des zweiten Zugs liegen
2.152 ms einschließlich Probe-/Screenshotaufwand. Das belegt einen möglichen
Folgezug vor vollständiger Detailnachladung, **keine** verzögerungsfreie Folgeeingabe.
Der zweite Zug erreicht seine vollständigen Details nach beobachteten 9.493 ms.
Frame- und Pixellauf haben damit bewusst unterschiedliche Wartefolgen; ihre
zweiten Pinselzüge sind nicht derselbe Performancefall.

### Öffnen und frischer Prozess

Eine weitere Probe öffnet dieselbe unveränderte Eingabe zunächst ohne
anwendungseigenen Darstellungsindex und danach in einem neuen Prozess mit dem
erzeugten Index. Die Zeit beginnt beim Öffnen der Kampagnenkarte; App-Prozessstart
und Betriebssystem-Dateicache sind darin nicht enthalten.

| Beobachtung ab Kampagnenöffnung | Ohne Darstellungsindex | Neuer Prozess mit Index |
| --- | ---: | ---: |
| Erstes Terrain (`overview`) | 3.346 ms | 2.150 ms |
| Objektbereich bereit | 6.458 ms | 2.545 ms |
| Erste Detailkachel spätestens beobachtet | 6.781 ms | 2.817 ms |
| Vollständige Detailstufe (48/48) | 15.811 ms | 10.831 ms |

Die erste Detailkachel wird erst nach dem Objektbereich abgefragt: Auch dies
ist eine Beobachtungsobergrenze. Der zweite Prozess verwendet die beiden
Indexdateien ohne Neuschreiben; Dateigröße und Änderungszeit bleiben identisch.
Der Hash der geprüften kanonischen Landschafts-, Raum-, Element- und
Gebietstabellen sowie die Atlasrevision bleiben unverändert. Beide Prozesse
enden regulär mit Code 0. Eine grobe Übersicht innerhalb von zwei Sekunden ist
in diesen Einzelbeobachtungen noch nicht nachgewiesen.

## Fünf aktuelle Bildreferenzen

Alle fünf Bilder wurden neu aufgenommen und visuell betrachtet. Jede Ansicht
meldet `terrainQuality=detail`; keine Rendererfehler, alle fünf Prozesse regulär
mit Exitcode 0 beendet und anschließend nicht mehr vorhanden.

| Maßstab | Bild und sichtbare Ausgangseigenschaften |
| --- | --- |
| Welt | [Weltansicht](fixed/world.png): gerundete Landformen, dominante Konturen und großes Hexraster. |
| Kontinent | [Kontinent](fixed/continent.png): schmale lange Gebirgskette, Schnee im Zentrum, deutlich begrenzte Waldfläche. |
| Königreich | [Königreich](fixed/kingdom.png): flächiges Waldmuster und lesbarer Gebietsname. |
| Siedlung | [Siedlung](fixed/settlement.png): breite Straßen, sechs verstreute Häuser mit sichtbaren Grundrissen und einzelne Bäume. |
| Innenraum | [Innenraum](fixed/interior.png): Wände, Türen, Ausstattung und Raumnamen. Ein D&D-Raster ist in diesem Bild nicht sichtbar; daraus folgt keine Aussage über die gesamte Rasterfunktion. |

Die Bilder sind Ausgangsbelege, keine neue Gestaltungsabnahme. Konturdominanz,
Waldflächen, Straßenproportionen und maßstabsabhängige Detailwirkung bleiben
konkrete Vergleichsgegenstände für M4–M7.

## Reproduktion und Grenzen

Die ausführbaren Prüfwege sind
[World-Navigation](../../../tools/test-desktop-world-navigation.mjs),
[Cache-Reopen](../../../tools/test-desktop-atlas-cache-reopen.mjs) und
[feste Ansichten](../atlas-workflow-20261023/capture-reference.mjs).
Zuerst `npm run build:desktop`, dann die nativen Proben einzeln ausführen.
Die beiden Zeitmessmodi dürfen weder gleichzeitig noch parallel zu Builds laufen.

Die [eingefrorene Mischwelt](mixed-world.sqlite.gz) ist absichtlich einmalig als
komprimierter synthetischer Bestand erhalten (40,2 MB, entpackt 225,5 MB).
Für exakt dieselbe Eingabe ersetzt der folgende Befehl die erste Generierung:

```sh
mkdir -p .build/m0-source
gzip -dc docs/reference/atlas-rebuild-m0-20261023/mixed-world.sqlite.gz > .build/m0-source/source.sqlite
sha256sum .build/m0-source/source.sqlite
```

```sh
WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=off WORLD_PROFILE=0 WORLD_FREEZE_SOURCE=1 QA_EVIDENCE_DIR=.build/m0-source python3 tools/ui-session.py node tools/test-desktop-world-navigation.mjs

WORLD_SOURCE=.build/m0-source/source.sqlite WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=off WORLD_PROFILE=0 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1 QA_EVIDENCE_DIR=.build/m0-frames python3 tools/ui-session.py node tools/test-desktop-world-navigation.mjs

WORLD_SOURCE=.build/m0-source/source.sqlite WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=async WORLD_PROFILE=0 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_EARLY_REPEAT=1 WORLD_PROGRESSIVE=1 QA_EVIDENCE_DIR=.build/m0-pixels python3 tools/ui-session.py node tools/test-desktop-world-navigation.mjs

ATLAS_MIXED_SOURCE=.build/m0-source/source.sqlite ATLAS_WAIT_DETAIL=1 QA_EVIDENCE_DIR=.build/m0-opening python3 tools/ui-session.py node tools/test-desktop-atlas-cache-reopen.mjs

QA_EVIDENCE_DIR=.build/m0-fixed python3 tools/ui-session.py node docs/reference/atlas-workflow-20261023/capture-reference.mjs
```

Neu erzeugte Mischwelten enthalten neue UUIDs. Für einen Vergleich mit exakt
identischer Eingabe muss dieselbe eingefrorene Datei verwendet werden; eine
neu erzeugte Welt bekommt eine neue Prüfsumme. Der Test prüft beim Wiederverwenden
Kampagnenname und Lastinventar und verändert nur die isolierte Kopie.

Noch nicht nachgewiesen sind Zielgerät, 30-Minuten-Speicherplateau, statistische
Eingabe-/Öffnungsperzentile, vollständige Autorenreise, alle Fehlerfälle und
persönliche Nutzerabnahme. Diese gehören zu den späteren Etappen. M0 stellt
die Vergleichsbasis bereit und hebt keine dieser Anforderungen auf.

## Etappenprüfung

| M0-Kriterium | Aktueller Beleg | Ergebnis |
| --- | --- | --- |
| Main-, Runtime- und Gerätebasis festhalten | Ausgangs-SHA, Umgebung und identische elf Runtime-Artefakthashes der Messläufe | Erfüllt für den Entwicklungsrechner; keine Zielgerätequalifikation |
| Bestehenden Atlas als Vergleich erhalten | Unveränderter Produktcode; eingefrorene Mischwelt und fünf neue Asterfall-Bilder | Erfüllt |
| Öffnen, Navigation, Pinselbeginn/-abschluss, Folgezug und Detailnachladung trennen | Separate Frame-, Pixel-/Folgezug- und Öffnungsläufe mit regulären Prozessenden | Erfüllt als Baseline; Grenzen der Beobachtungen oben ausgewiesen |
| Vollständige Übernahmeliste mit Anforderungen und tatsächlichen Tests | [Inventar](inventory.md), 48 Katalogeinträge plus globale Funktionen/Verbraucher | Erfüllt als Bestandsaufnahme; offene Produktfunktionen bleiben offen |

Die Nachprüfung korrigierte veraltete Bereitschaftssignale und ergänzte den
Folgezug vor vollständiger Detailnachladung. Danach wurde neu gemessen; die
vorherigen ungesicherten Bereitschaftszeiten sind nicht die maßgebliche Baseline.
`node build.mjs --test` und anschließend die gezielten Tests
`terrain-pixel-readback.test.mjs` sowie `desktop-atlas-tool-hierarchy.test.mjs`
bestanden mit **19/19**. Die drei tatsächlich geprüften nativen Abläufe wurden
mit ihren Quelldateien im Capability-Katalog verknüpft und mit `--geprueft` erfasst.

**M0 ist abgeschlossen. Nächste Etappe ist M1.** Das ist ein Abschluss der
Vergleichsbasis, keine Behauptung eines bereits schnelleren Atlas. Es wurde
noch kein Paket erstellt, installiert oder veröffentlicht.

Rohdaten: [Frameprobe](frames.json.gz), [Pixel-/Folgezugprobe](pixels.json.gz),
[Öffnen/Neustart](opening.json.gz), [feste Ansichten](fixed/result.json.gz).
[Manifest](manifest.json) enthält Eingabe- und Ergebnisprüfsummen, Runtimehashes
und Prozessabschlüsse. Die erste Frameprobe enthält noch nicht die zusätzlich
für die frühe Folgezugprobe aufgenommenen `strokeStarts`; Messkern und
Revisionsprüfung sind gleich, die Wartefolge ist wie oben beschrieben verschieden.
