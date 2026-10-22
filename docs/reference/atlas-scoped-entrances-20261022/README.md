# Atlas: Eingänge auf den benötigten Kontext begrenzen

22.10.2026. Normaler Electron-Entwicklungsstart auf Fedora/Wayland,
Intel Core i5-8365U. Keine Abnahme auf dem Pentium Gold 7505.
Anschluss: [gemeinsamer Atlas, P0/P5/P8](../../plans/maps/unified-spatial-atlas.md),
HEX-06, HEX-08, HEX-16 und [Reise](../../plans/maps/hex-travel.md).

## Beleg und Entscheidung

Nach der [Stylekorrektur](../atlas-style-invalidation-20261022/README.md)
bleiben lange Navigationsframes. Die Bestandsaufnahme der tatsächlichen
`atlas:geometry-region`-Antwort zeigt unabhängig davon einen konkreten
Mehraufwand: jeder Ausschnitt enthält alle 5.000 Eingänge der Prüfwelt,
auch wenn keine Raumgruppe dargestellt wird. Das sind 954.361 JSON-Bytes.
Der Main-Prozess liest, decodiert und prüft sämtliche Eingänge bei jeder Antwort.
Eine kausale Zuordnung eines einzelnen langen Frames ist damit nicht belegt.

Drei Optionen:

- Vollständige Eingangsliste cachen: weniger wiederholtes Lesen, aber weiterhin
  große Kopien und ein zusätzlicher Invalidierungsbesitzer.
- Eigenen räumlichen Eingangsindex aufbauen: genaue Flächenabfrage, aber zusätzliche
  Indexpflege für Verschiebungen und verschachtelte Raumgruppen.
- Vorhandene Ausschnittsbindungen verwenden und den gewählten Eingang mitführen:
  vorhandene Transformationen und Reiseauswahl bleiben maßgeblich; die Antwort
  enthält nur den benötigten Kontext. Diese Variante ist umgesetzt.

## Vertrag und Grenzen

`atlasDisplayEntrances` liest Eingänge der gelieferten Dungeonbindungen sowie
den ausdrücklich gewählten Eingang. Ohne Bindungen und Auswahl ist keine
Eingangsabfrage nötig; die einzelne Auswahl verwendet den vorhandenen Primärschlüssel.
Bei sichtbaren Raumgruppen filtert SQLite die gespeicherten `scopeId`-Werte.
Dieser Pfad scannt weiterhin die Eingangszeilen der Kampagne; ein eigener Index
oder eine Schemaänderung wurde nicht eingeführt.

`CampaignAtlasWorkbench.regionQuery` übergibt die aktuelle Auswahl über den
vorhandenen Preload/Main-Vertrag. Die bereits bestehende Ergänzung der
Raumgruppenbindung einer innen stehenden Party bleibt vor der Eingangsprojektion
erhalten. Dadurch funktionieren sowohl der ausdrücklich ausgewählte Eingang
außerhalb des Ausschnitts als auch das Verlassen eines Innenraums.

Kanonische Reisebefehle, vollständige Fachansichten und deren Prüfsummenprüfung
verwenden weiterhin `atlasEntrances`. Eine beschädigte ausgewählte Zeile wird
auch im begrenzten Leser abgewiesen. Gelöschte Auswahlen liefern keinen Eingang.
Die Änderung ergänzt keine automatische Eingangssuche für eine außerhalb des
geladenen Ausschnitts stehende Weltparty.

## Nutzdaten der gleichen gespeicherten Welt

Die Probe kopiert dieselbe geschlossene synthetische SQLite-Datenbank in ein
frisches Profil und bedient den normalen Atlas. Die zusätzliche JSON-Messung
verändert die Laufzeit: sie ist eine Größenaufnahme, keine Latenzmessung.

| Ausschnitt | Vorher | Nachher | Eingänge vorher / nachher |
| --- | ---: | ---: | ---: |
| Anfang, 60 km gepuffert | 1.239.399 B | 285.040 B | 5.000 / 0 |
| Welt, 80.000 km gepuffert | 1.019.155 B | 64.796 B | 5.000 / 0 |
| Nach Zoom, 24.096 km gepuffert | 1.087.622 B | 133.263 B | 5.000 / 0 |

In allen drei Antworten entfallen exakt 954.359 Bytes. Die Weltantwort wird
um 93,6 % kleiner. Beide nativen Läufe endeten normal mit Code 0, verschwundenem
Prozess und ohne Rendererfehler. Rohdaten: [vorher](payload-before.json),
[nachher](payload-after.json). Ausgangscode: `0d4da5bed12f3ee206ae3ec72d0bdf7e20a22f27`;
der neue Stand ist durch die Artefakthashes in den Rohdaten gebunden.

## Volle Welt und verbleibende Latenz

Die vorhandene Weltprobe enthält 100.000 Biomzuordnungen, 5.000 eingerichtete
Gebäude, 5.000 Orte, 50 detaillierte Gebäude und einen Dungeon mit 4.001 Räumen.
Insgesamt: 15.701 Räume, 48.670 Zeichenelemente, 108.076 Landschaftsobjekte und
1.028 anfängliche Höhenkacheln. Dies sind keine 100.000 feinen Höhenbearbeitungen.
Navigation und zwei Sculpt-Züge verwenden einen Radius von 2.500 Meilen.

Vergleich mit dem [vorherigen asynchronen Lauf](../atlas-style-invalidation-20261022/async-readback/result.json.gz),
beide ohne CPU-Profiling und mit asynchronem GPU-Auslesen. Je ein Lauf, keine
statistisch abgesicherte Beschleunigung. Die Messung greift selbst in den Ablauf ein.

| Ablauf | Vorher p95 / p99 / Maximum | Nachher p95 / p99 / Maximum |
| --- | --- | --- |
| Navigation | 20,7 / 99,9 / 200 ms | 24,6 / 35,8 / 66,6 ms |
| Sculpt | 24,2 / 83,2 / 100 ms | 24,3 / 66,7 / 133,4 ms |
| Sculpt wiederholt | 24,3 / 65 / 133,4 ms | 24,3 / 66,7 / 150 ms |

Die Navigationsausreißer sind kürzer; der p95-Wert ist schlechter.
Sculpt bleibt im p95 praktisch gleich, einzelne Maxima werden schlechter.
Die erste geänderte Pinselinnenfläche ist nach 186,6 statt 188 ms auslesbar,
beim zweiten Zug nach 156,7 statt 121,3 ms. Das sind obere Schranken der
GPU-Verfügbarkeit mit Messaufwand, keine Compositor-/Displaylatenzen.
Das 100-ms-Ziel ist damit weiterhin nicht qualifiziert. Auch p95 ≤ 16,7 ms
und p99 ≤ 33,3 ms sind nicht erreicht.

Keine Rendererfehler; beide nativen Prozesse endeten normal mit Code 0 und
verschwanden. [Zusammenfassung](world-summary.json),
[vollständige Rohdaten](world-after.json.gz), [Welt nach Sculpt](world-sculpt.png).
Die Bildgestaltung und der Terrain-/GPU-Pinselpfad sind unverändert.
Nächster Leistungsfund bleibt die langsame erste Pinselreaktion; aus dieser
Änderung folgt keine vollständige Welt- oder Hardwareabnahme.

Die dauerhafte Bereinigung beschränkt den zusätzlichen Leser auf die
Darstellungsprojektion. Es gibt keinen neuen globalen Cache, zweiten Index oder
Schemawechsel. Die Auswahlausnahme ist im bestehenden Abfragevertrag dokumentiert;
kanonisches Reisen bleibt bei seinem bisherigen Besitzer.

## Prüfungen und Reproduktion

`tests/desktop-atlas-regions.test.mjs` prüft die Begrenzung bei 5.000 entfernten
Eingängen, Auswahl, Löschung, Prüfsummen sowie kanonisches Betreten/Verlassen
bei entfernter Kamera. Die bestehenden Reise- und Kampagnenfälle bleiben beteiligt.
`tools/test-desktop-atlas-entrance-context.mjs` bedient die gemeinsame Atlasfläche
im Spielabend: zur Party, Weltübersicht, ausgewählten Eingang betreten und
verlassen, danach den gespeicherten Stand mit einer frischen Store-Verbindung lesen.
Der Mitschnitt prüft die echte Übergabe der Auswahl durch Renderer, Preload und Main.
Beleg: [nativer Reiseablauf](travel-result.json),
[Weltübersicht](travel-world-selected-entrance.png),
[bestätigter Innenraumstand im Live-Panel](travel-inside-from-overview.png).
Der normale Fensterabschluss und der frische gespeicherte Außenstand sind im
Ergebnis enthalten. 84 betroffene Node-Tests, beide Typprüfungen, Desktopbuild
und Repositoryprüfung bestanden; die ergänzte Eingangsvalidierung wurde separat
über den bestehenden Worker-Lebenszyklustest ausgeführt.

```sh
node build.mjs --test
node --test tests/desktop-atlas-regions.test.mjs tests/desktop-atlas-travel-context.test.mjs tests/desktop-campaign-atlas.test.mjs
npm run check
npm run check:desktop
npm run build:desktop
QA_EVIDENCE_DIR=.build/entrance-repeat python3 tools/ui-session.py timeout --signal=TERM 180s node tools/test-desktop-atlas-entrance-context.mjs
WORLD_WARM_OPEN=1 WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_MIXED=1 WORLD_READBACK=async WORLD_PROFILE=0 WORLD_DRAFT=1 WORLD_REPEAT=1 WORLD_PROGRESSIVE=1 WORLD_OVERLAY=1 QA_EVIDENCE_DIR=.build/entrance-world-repeat python3 tools/ui-session.py timeout --signal=TERM 300s node tools/test-desktop-world-navigation.mjs
QA_SOURCE_PROFILE=/path/to/closed/synthetic/profile QA_EVIDENCE_DIR=.build/reply-repeat python3 tools/ui-session.py timeout --signal=TERM 180s node docs/reference/atlas-scoped-entrances-20261022/probe-replies.mjs
```

Das Weltprofil steht nach normalem Abschluss in `result.json`. Nur einen nativen
Prüfablauf zur Zeit starten. Für den Vergleich den Ausgangscode in einer isolierten
Arbeitskopie bauen. Keine persönlichen Profile verwenden.
