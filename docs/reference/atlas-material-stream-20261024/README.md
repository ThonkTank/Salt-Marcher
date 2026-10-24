# Materialkacheln während der Nachladung behalten

M2-Zwischenschritt auf `ae46b6b0b`, 24.10.2026. Die einzige Roadmap bleibt
[der Atlasplan](../../plans/maps/unified-spatial-atlas.md). Kein M2-Abschluss,
keine Main-Integration und keine Produktabnahme.

## Umsetzung

Terrain und Material verwenden denselben begrenzten Rasterkachelstrom. Die
Terrain-Schnittstelle bleibt erhalten; Material validiert zusätzlich alle fünf
Kanäle, deren Größe, Quellenkennung, Revision und Weltadresse. Übersichtskacheln
bleiben sichtbar, bis alle benötigten Kinder eines Elternbereichs bereit sind.
Beim Kamerwechsel bleibt eine gültige überlappende Ansicht bis zur vollständigen
neuen Übersicht erhalten. Verspätete Antworten überholter Aufträge werden verworfen.

Das Standardbudget beträgt 32 MiB inklusive sichtbarer und gestaffelter Kacheln;
Material plant höchstens 32 Detailkacheln, damit neben den jeweils 512 KiB Rohdaten
auch Eltern und Übergänge Platz haben. Das ist ein begrenzter Kachelspeicher,
kein Nachweis des gesamten Renderer-/Worker-Speichers oder der GPU-Komposition.

Die unabhängige Nachprüfung startete 20 Kameraaufträge mit angehaltenen Antworten:
20 Fetch-Aufrufe blieben gleichzeitig offen. Nach Freigabe wurde nur die aktuelle
Generation weiter veröffentlicht. Der Terrain-Vorgänger besitzt dasselbe Verhalten;
die Extraktion führt es nicht neu ein, Material übernimmt es aber ebenfalls.
Quellen-/Generationsprüfung ersetzt keine Abbruch- oder Parallelitätssteuerung.
Das gehört zur offenen Auftragssteuerung in M3 und verhindert eine Aussage über
ein vollständig begrenztes Budget aktiver Arbeit. [Reproduzierbare Gegenprobe](supersession-probe.mjs)
aus dem Repository mit `node docs/reference/atlas-material-stream-20261024/supersession-probe.mjs` ausführen.

## Prüfungen

[36 gezielte Regressionen](regressions-36.log.gz) prüfen Material-/Terrainprodukte,
Materialservice, Kachelplanung sowie beide Rasterströme. Darin enthalten sind
acht neue Materialstromtests: vollständige Kanäle, atomarer Wechsel, ungültige
Antworten, Pan-Retention, dichter Ausschnitt, tatsächliche Backing-Buffer-Bytes,
überholte Aufträge und Dispose. [Abschließender Achterlauf](material-stream-8.log.gz)
bestätigt die endgültige Standardplanung; keine zusätzlichen acht verschiedenen
Tests. Die Produkt-/Serviceprüfungen decken lokale Invalidierung einschließlich
Eltern und Undo/Redo ab; die native Probe führt keine Autorenänderung aus.

[Native Prüfung](native.json.gz), Reproduktion nach Desktopbuild:
`node tools/test-desktop-atlas-material-stream.mjs`.
Die eingefrorene vollständige M0-Quelle enthält 5.000 Raumgruppen und 15.701 Räume;
SHA-256 der entpackten SQLite-Datei:
`19d4edc88b50d8074578a5c40c870a50331fec1c78a7a8b4f4feee5d463fdb12`.
Gemessen wird ein 512-m-Ausschnitt dieser Quelle über die echte Preload-/Main-/Worker-Brücke.

- Die erste Feinantwort wird absichtlich angehalten; die undurchsichtige
  LOD2-Elternkachel bleibt sichtbar. Vier LOD0-Kinder ersetzen sie ohne überlappende
  veröffentlichte Eltern-/Kindbilder innerhalb derselben Kamerageneration.
- Beim gröberen Wiederbesuch wird die bereits bekannte LOD2-Kachel wiederverwendet;
  nur die neue LOD4-Übersicht wird angefordert.
- Ein frischer Prozess fragt Eltern und vier Details erneut an: alle fünf Kanäle
  sind Cachetreffer, sämtliche Detailkanal-Hashes identisch.
- Kanonische Autoreninhalte und Quell-/Buildhashes bleiben gleich. Keine erfassten
  Fehler; beide Prozesse enden regulär mit Exit 0 und verschwundenen PIDs.

Die Quellenkennung wird vorab über eine Elternabfrage ermittelt: Dies ist keine
Kaltstart-Zeitmessung. Die technische Prüffläche zeigt nur Grundfarbe, keinen
fertigen Atlas mit Höhen-/Materialkomposition. [Elternbild](parent-before-detail.png)
und [Detailbild](detail-complete.png) wurden angesehen. Frühere fehlgeschlagene
Prüfläufe hatten eine durch CSP verworfene Inline-Layoutdefinition; korrigiert
wurde das Prüfwerkzeug über DOM-Style-Zuweisung, ohne CSP oder Captureprüfung
abzuschwächen. Diese Fehlversuche zählen nicht als reguläre Prozessabnahme.

## Entscheidende Qualitätsgegenprobe

`node tools/measure-atlas-material-coverage.mjs` verwendet den tatsächlichen
Materialrasterizer auf konstant trockenem Gelände. Ein 0,25 m breiter und 600 m
langer Waldstreifen besitzt exakt 150 m² Fläche. [Maschinenbeleg](coverage-counterexample.json.gz):

| Integrierter Flächenanteil | LOD2, eine 1024-m-Kachel | LOD0, alle 16 Kinder |
| --- | ---: | ---: |
| Waldkanal | 0 m² | 301,18 m² |
| Waldanteil entlang des Grundfarbenvektors | 0 m² | 300 m² |

Die vollständig deckende Alpha-Fläche ist in beiden Bildern gleich und wäre
hier ein ungeeigneter Qualitätsnachweis. Der semantische Waldkanal belegt dagegen
echten Verlust und Überzeichnung, nicht bloß andere Pixelpositionen. Diese
isolierte Gegenprobe ist keine native Gesamtqualifikation der Materialdarstellung.

| Ansatz | Kartenqualität | Reaktion | Bearbeitbarkeit | Wartbarkeit | Umstellungsrisiko |
| --- | --- | --- | --- | --- | --- |
| Flächenintegration aus Quellen, als nächste Gegenprobe gewählt | Kann schmale Flächen je Stufe erhalten | Kein Pflichtaufbau aller Kinder; Clippingkosten messen | Autorenreihenfolge, Löcher und Masken müssen erhalten bleiben | Gemeinsame Abdeckungsberechnung möglich; weiche Kanten komplex | Mittel bis hoch, zuerst begrenzter Prototyp |
| Eltern aus Kindkacheln mitteln | Stufen konsistent; falsche Feinfläche bleibt zunächst falsch | Übersicht wartet auf 16 Kinder | Zusätzliche Abhängigkeiten und lokale Neubildung | Eigene Reduktion je Kanal | Mittel; kalte Übersicht gefährdet |
| Fest mehr Abtastpunkte | Weniger Ausfälle, keine Flächengarantie | Quadratisch mehr Rasterarbeit | Bestehende Komposition bleibt | Einfach, aber weitere Qualitätsparameter | Geringer Umbau, hohes Kosten-/Qualitätsrisiko |

Der stärkere nächste Ansatz ist eine gemessene Flächenintegration für
Materialabdeckung, während physische Höhenfelder unverändert bleiben. Vor einer
Produktentscheidung sind Löcher, überlappende Autorenflächen, Wasser-/Pigmentfolge,
weiche Vegetation und begrenzte Laufzeit zu prüfen. Der Kachelstrom löst die
Veröffentlichung; er behebt diesen Rasterfehler noch nicht.

TypeScript, Desktop-Typprüfung und Desktopbuild sind in [check.log.gz](check.log.gz),
[check-desktop.log.gz](check-desktop.log.gz) und [build-desktop.log.gz](build-desktop.log.gz)
belegt. M2 bleibt offen: Flächentreue, vollständige Welt-/Ressourcenlast,
weitere Objektklassen und kalte nutzbare Übersicht unter zwei Sekunden.
Die [Repositoryprüfung](check-repo.log.gz) ist bestanden; tatsächliche Testdateien
sind im bestehenden Terrainablauf des Capability-Katalogs mit `--geprueft` vermerkt.
