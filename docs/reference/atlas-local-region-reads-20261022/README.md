# Örtlichen Bewuchs ohne Scan der Weltlandschaft lesen

Ausgangsbasis: Main `1628f998fe6b71bc17eafeeb4e5115a4a6ac24f1`
(Releasequelle 0.184.0). Dieser Folgeschritt ist darin noch nicht enthalten.
Die bestehende Atlasfläche und alle Autorenbefehle bleiben die Grundlage.

## Ursache und Änderung

Ein lokaler Bewuchsausschnitt vereinigte globale Geländeeinstellungen und
örtliche Grenzen mit einem SQL-`OR`. SQLite nutzte dabei nur den Kampagnenanteil
des Indexes und prüfte JSON aus dem ganzen Landschaftsbestand. In der gemischten
Prüfwelt lieferte die Abfrage zwölf lokale Datensätze nach rund 547 ms.
`readVegetationEnvironment` liest Einstellungen und Ausschnitt jetzt mit `UNION`
über die vorhandenen Indizes. Dieselbe direkte Diagnose brauchte rund 11 ms.
Zeilennummer und abschließende Reihenfolge erhalten die ursprüngliche Malfolge;
eine Einstellung innerhalb des Ausschnitts erscheint weiterhin genau einmal.
Es entsteht kein zusätzlicher Index, Cache oder gespeicherter Weltbestand.

## Verworfene Variante

Ein zusätzlich erprobter freier Join zwischen Besitzerindex und Rtree wurde
verworfen. Er verkürzte Lesungen zwischen vielen kleinen Gebäuden, verursachte
aber bei einem einzigen Besitzer mit 100.000 Konturen rund 125–151 ms statt
unter 1 ms für 25 räumliche Treffer. SQLite durchlief dort zunächst sämtliche
Besitzerkonturen. Die bisherige räumliche Joinreihenfolge bleibt bestehen.
[Die Messung der kombinierten Variante](rejected-owner-first.json) ist ausdrücklich
kein Nachweis für den endgültigen Code. Der neue Regressionstest schützt den
räumlichen Zugriff auf einen großen Bestand und den Scan-Fallback.

## Prüfweg und Grenzen

`tools/measure-atlas-region-opening.mjs` vergleicht die ausdrücklich genannten
Dateien mit Git; weitere Abhängigkeiten bleiben aktuell. Dazu
`ATLAS_REGION_BASELINE_FILES=src/app/storage/atlas-region.ts,src/app/storage/vegetation.ts`
und `ATLAS_REGION_BASELINE=1628f998fe6b71bc17eafeeb4e5115a4a6ac24f1` setzen.
`ATLAS_MIXED_SOURCE` verweist auf die erhaltene synthetische Welt, niemals auf
Benutzerdaten. `QA_EVIDENCE_DIR` wählt den Belegordner. Die Region-Datei ist
wieder unverändert; ausschließlich die Bewuchslesung unterscheidet sich.

Die Probe enthält 100.000 Geländezuordnungen, 5.000 eingerichtete Gebäude und
einen Dungeon mit mehr als 4.000 Räumen. Es sind einzelne lokale Messungen,
keine p95-Werte und keine Messungen auf dem Pentium Gold 7505.
Die Weltübersicht, Pinselabschluss, erstes Terrain, Bildrate und RAM-Plateau
bleiben offen. Ebenso fehlen die ästhetische Gesamtqualifikation und die drei
sauberen Abschlussuntersuchungen. Lokale Funktionsbelege ersetzen weder
Candidate/Main-CI noch Veröffentlichung oder Zielgeräteabnahme.

Der erste native Waldlauf endete mit Timeout im Zoomhelfer. Der Helfer verlangte
mindestens 5 % Änderung, während seine Zielkorrektur kleiner sein konnte; auch
ein Zwischenbild durfte als Ausgangspunkt der nächsten Geste gelten.
`tools/test-desktop-forest-style.mjs` wartet jetzt auf das tatsächlich angeforderte,
begrenzte Zoomziel und prüft den erreichten Maßstab ausdrücklich. Produktnavigation
und Grenzwerte wurden dafür nicht geändert. Der [Fehllauf](initial-native-failure.json)
ist kein Funktionsnachweis. PID 3389588 war vor dem korrigierten Lauf beendet.
Der erste korrigierte Lauf mit der später verworfenen Joinvariante endete normal
(PID 3390673, null Rendererfehler); der endgültige Code wird separat nachgeprüft.

## Endgültiger Vergleich

[Messung des endgültigen Codes](parity.json), jeweils vollständige Antworten
einschließlich Rasterpixeln hashgleich:

| Ausschnitt | Vorher | Nachher |
| --- | ---: | ---: |
| Welt | 1138 ms | 1066 ms |
| Region | 484 ms | 401 ms |
| Gebäude | 833 ms | 313 ms |
| Dungeon | 922 ms | 386 ms |

Der gezielte Gewinn betrifft lokale Bewuchsumgebungen. Die Schwankung in der
Weltübersicht und beim kalten Aufbau (5,9/5,4 Sekunden) wird nicht als
Verbesserung dieses Pfades gewertet. Der TEMP-Bestand bleibt 28.958.720 Bytes
und der Formcache 126.850 Bytes; das ist keine Gesamt-RAM-Messung.
Die [Gegenprobe am großen Einzelbestand](rejected-dense-owner.json) begründet
die Rücknahme der zusätzlichen Joinänderung.

## Endgültige Regression und Hauptatlas

Die [Testübersicht](tests.json) enthält 86 fortgeltende Fälle: 85 unveränderte
Fälle des breiteren Laufs und den separat bestandenen endgültigen Regressionstest
für den großen Einzelbestand. Der verworfene Besitzerindex-Test wird nicht
mitgezählt. App-/Desktop-Typechecks, endgültiger Desktop-Build und Repositorycheck
sind bestanden. Der Region-Runtimecode ist wieder bytegleich mit der grünen
Releasequelle; nur `storage/vegetation.ts` enthält eine Produktänderung.

Der [endgültige native Lauf](native.json) erreichte mit normalen Mausradgesten
80.000, 6.000, 1.200 und 300 m Ausschnittsbreite und neigte dieselbe Hauptkamera.
PNG-Ausgabe, geschützter Baum und sämtliche Autorenzeilen blieben erhalten.
PID 3393278 endete regulär mit Code 0 und ist beendet; keine Rendererfehler.
Alle elf Laufartefakte stimmen mit dem endgültigen Build überein.

Alle fünf Bildschirmbilder und der Export wurden angesehen. Die
[Übersicht](01-world.png) bleibt eine flache, polygonale Waldfläche mit
dominantem Hexraster. In mittleren Maßstäben stehen verstreute kleine Kronen,
in der [geneigten Nahansicht](05-tilted.png) und im [Export](export.png) sind
Bäume, Felsen und Straße sichtbar. Diese Funktionsregression verbessert das
Kartenbild selbst nicht; natürliche Waldstruktur, kartografische Waldzeichen
auf Kontinentmaßstab und ansprechende Straßentexturen bleiben offen.
