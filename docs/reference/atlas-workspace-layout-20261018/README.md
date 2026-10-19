# Atlasarbeitsplatz: native Layout- und Bedienprüfung

Die Anwendungshülle und der Atlas wurden gemeinsam umgebaut. Verglichen wurden eigene synthetische Kampagnen im nativen Electron-Fenster. Die Baseline stammt aus `3dae9db238ec1d1a6456ad520d10e7165d8915e1`; der neue Stand ist eine darauf aufbauende Arbeitskopie. `after.json` hält die tatsächlich geprüften Renderer-/CSS-Prüfsummen fest. Das ist kein Installations- oder Owner-Abnahmebeleg.

| Zustand bei 1280 × 800 | Tatsächliche Canvasfläche | Anteil am Fenster |
| --- | --- | --- |
| Vorher | 670 × 522 | 34,15 % |
| Eine Werkzeugleiste | 1000 × 730 | 71,29 % |
| Werkzeugleiste eingeklappt | 1280 × 730 | 91,25 % |
| Karte maximiert | 1280 × 800 | 100 % |

[Vorher](before.png), [neuer Arbeitsplatz](after.png), [Bebauungsvorschau](city-preview.png), [neu gezeichneter Raum](new-room.png).

Geprüft wurden Suche/Auswahl, Raumtextänderung, rechte Zusatzleiste, Einklappen/Maximieren, Flusszeichnung mit Enter, Space-Ziehen, Straßen-/Viertelzeichnung, Übernahme einer Bebauungsvorschau, Raumrechteck per Ziehen, Bildausgabe und Rückkehr aus einem anderen Produktbereich. Musik-, Status-, Bereichs- und weitere Menüs verändern die Kartenabmessungen nicht. Nach normalem Beenden wurde die Kampagne in einem neuen Prozess geöffnet und der neue Raum über die Suche wiedergefunden. Die gespeicherten Raumtexte und die Stadt wurden anschließend auch im kanonischen Store geprüft.

Weitere tatsächliche Fenstermaße: 1366 × 768 und 1920 × 980; die angefragte Höhe 1080 wurde vom nativen Fenstersystem auf 980 begrenzt. 200 % UI-Skalierung bei 1280 × 800 entspricht 640 × 400 CSS-Pixeln. Alle geprüften Zustände hatten keine horizontale Seitenscrollleiste. Auf schmalen Fenstern wird kein zweites dauerhaftes Seitenpanel erzwungen.

Die bestehende Autorenprüfung mit 1600 Räumen bestand bei Zoomfaktor 1 und 2: mehrdeutige Trefferwahl, echte Raumgriffe über Rasterdarstellung, fortgesetzter Polygonentwurf, Canvas-Wiederherstellung, Abbrechen, Eckpunktänderung, Undo/Redo und Wiederöffnung. Sämtliche dort erfassten Prozesse endeten normal. Zusammenfassung: [authoring.json](authoring.json). Layoutläufe: [before.json](before.json), [after.json](after.json).

Wiederholen mit Node.js 22 nach `npm ci`, `npm run desktop:runtime` und `npm run build:desktop`:

```sh
python3 tools/ui-session.py node tools/test-desktop-atlas-layout.mjs
python3 tools/ui-session.py node tools/test-desktop-atlas-author-overlay.mjs
```

95 gezielte Tests nach der Zusammenführung mit den aktuellen Tür- und Wiederaufnahmeänderungen für Atlas, Frame-/Reisekontext, Autorenüberlagerung, Dungeonentwürfe, Raumtexte und gemeinsame Livefläche bestanden lokal. Die verpflichtende vollständige Candidate-CI bleibt ein eigener Nachweis. Der direkte vollständige Bedienvergleich mit allen vier Originalprodukten, physische Touchpadgesten und die visuelle Owner-Abnahme sind damit nicht abgeschlossen. Benutzerbestände wurden für diese Prüfungen nicht geöffnet; eine installierte Produktversion wurde nicht ersetzt.


## Grundriss bis zur PNG-Ausgabe, 19.10.2026

Neue direkte Prüfung der Aufgabe: leere Kampagne öffnen, Dungeon platzieren,
Torhalle/Wachstube/Archiv zeichnen und benennen, zwei Türen setzen, Torhalle
am Wandgriff vergrößern, aktualisierte PNG ausgeben. Native Wiederöffnung,
Undo/Redo, Raum-/Türidentitäten und unveränderte Raumtexte wurden zusätzlich
geprüft. Normale und doppelte Geräteskalierung, vier normale Prozessexits.
Der vorhandene automatische Fokus nach Dungeonplatzierung funktioniert;
die Probe wartet jetzt seinen Abschluss ab.

Die vorherige Ansichtsausgabe hatte viel leeren Rand. **Dungeon-Grundriss**
verwendet stattdessen die vollständigen indizierten Geschossgrenzen, auch bei
Offscreen-Räumen oder Rasterdarstellung. Der Rahmen wird nach einer späteren
Vergrößerung neu abgeleitet, fehlt bei unpassenden Geschossdaten ausdrücklich
und schreibt keine Geometrie. Eine überlagernde rechte Leiste verdeckt die
Vorschau nicht mehr. Der Maßstab erhält eigenen Platz unter dem Grundriss.
Freie Ansicht und manuell gezogener Ausgabebereich bleiben verfügbar.

[Vorherige Ansichtsausgabe](groundplan-viewport-before.png),
[ausgegebener Grundriss](groundplan-framed.png),
[native Vorschau bei doppelter Skalierung](groundplan-preview-200.png),
[Prozesse und Quellhashes](groundplan-20261019.json).

Dieselbe Aufgabe wurde in der echten Weboberfläche von Dungeon Scrawl
(`https://app.dungeonscrawl.com/`, 19.10.2026; keine Buildnummer sichtbar)
ausgeführt: Rechtecke/Korridore, zwei Türsymbole, separate Raumtexte mit
Schriftkorrektur, überlappende Erweiterung der Torhalle, tatsächlicher
PNG-Download (1400 × 910) und visuelles Öffnen der Datei. Eine versehentlich
nicht überlappende Erweiterung wurde rückgängig gemacht. Das finale Ergebnis
ist zusammenhängend. Der vorgeschlagene Inhaltsrahmen ersparte dort manuelles
Einrahmen. [Weboberfläche](groundplan-scrawl-ui.jpg),
[tatsächliche PNG](groundplan-scrawl.png). Keine Anmeldung, öffentliche
Veröffentlichung oder Neustartqualifikation des Vergleichsprodukts.

Wiederholen: `python3 tools/ui-session.py node tools/test-desktop-dungeon-groundplan.mjs --moved-wall --dungeon-frame`.
95 gezielte Canvas-, Export-, Autorenüberlagerungs- und Entwurffälle bestanden
lokal. Vier neue Fälle sichern Offscreen-/gedrehte Geschossgrenzen,
Neuberechnung nach Vergrößerung, Maßstabsabstand und unverdeckte Vorschau.
Diese begrenzte Aufgabe belegt weder vollständige Dungeon-Scrawl-Parität noch
menschliche GM-Vorlieben, installierte Pakete oder Owner-Abnahme.


## Zugangsweg und bearbeitbare Sicherung, 19.10.2026

Eine eigene native Prüfung auf Mainbasis `96a9fe72d2338457b437447fd10765e1174a3627`
mit den Exportänderungen dieser Branch erhält das Zollhaus, zieht einen
kreuzenden Weg am mittleren Griff nach außen und prüft Undo/Redo sowie die
wirkliche PNG. Raumgeometrie, Raumtext und Wegmetadaten bleiben erhalten.
Der [Lauf mit Build-Prüfsummen](access-path-20261019.json) erfasst normale und
doppelte Geräteskalierung, reduzierte Bewegung und vier normale Prozessexits.
Die Probe wartet nach der Ortsuche auf den tatsächlich fokussierten Ausschnitt;
ein bereits gefülltes Namensfeld bestätigt noch keine abgeschlossene Navigation.

Unter **Export → Ausgabe: Bearbeitbare Kampagne → Kampagne sichern…** ist
jetzt das bestehende vollständige Kampagnenpaket erreichbar. Nur dessen
Optionen sind dann sichtbar; die Bildausgabe bleibt eine eigene Auswahl.
Abbrechen ändert die geprüften Autoreninhalte nicht. Öffentliche Bild- oder
Archivoptionen redigieren die Sicherung nicht; die Oberfläche nennt ausdrücklich
GM-Inhalte. Das tatsächlich erzeugte Paket wurde über **Pakete und Kopien**
als unabhängige Kampagne importiert. Dort ließ sich der Weg erneut ziehen,
während der ursprüngliche Weg unverändert blieb. Der historische JSON-Datenauszug
ist keine qualifizierte wiederherstellbare Sicherung.

[Export bei einfacher Skalierung](access-path-export-100.png),
[Export bei doppelter Skalierung](access-path-export-200.png),
[tatsächliche PNG](access-path-corrected.png).

Die zuerst geprüften Gegenprodukte blieben teilweise offen. In der echten Excalidraw-Weboberfläche
wurden Rechteck, Beschriftung und unabhängige Linie gezeichnet, am mittleren
Punkt korrigiert, rückgängig gemacht und wiederholt. Nach Neuladen blieb die
Zeichnung bearbeitbar. Der lokale Dateidialog war über die verfügbare
Browsersteuerung nicht bedienbar; eine fertige PNG wurde dort nicht belegt.
In Dungeon Scrawl wurden Haus und Weg auf getrennten Ebenen gezeichnet, der
alte Pfad radiert und der neue um das Haus geführt. Zweimal Undo/Redo stellte
die jeweiligen Verläufe wieder her. Der [wirkliche PNG-Download](access-path-scrawl.png)
zeigt den erhaltenen Grundriss. Seine bearbeitbare Speicherdatei und deren
Wiederöffnung blieben ebenfalls am Dateidialog offen. Beide Webprodukte wurden
am 19.10.2026 ohne sichtbare Buildnummer benutzt. Diese beiden Versuche gelten nicht als vollständige Gegenvergleiche.

Ein nachfolgender vollständiger Vergleich gelang in **diagrams.net/draw.io Web**
(`https://app.diagrams.net/`, 19.10.2026, keine sichtbare Buildnummer).
Ein Rechteck mit Beschriftung Zollhaus und eine unabhängige kreuzende Linie
bildeten denselben Kartenfall. Rechtsklick auf die Linie → Wegpunkt einfügen,
mittleren Punkt nach außen ziehen, Linienbreite ändern, zweimal Undo/Redo.
**Speichern unter → Browser** erhielt die bearbeitbare Zeichnung. Nach Schließen
des Tabs und Öffnen der gespeicherten Datei war der Weg wieder am Griff änderbar;
diese zusätzliche Änderung wurde rückgängig gemacht. **Speichern unter →
Editierbares Bitmap-Bild (.png) → Herunterladen** erzeugte eine echte PNG.
Das erste transparente Bild war auf dunklem Viewergrund schlecht lesbar;
ein ausdrücklich weißer Diagrammhintergrund lieferte die brauchbare Ausgabe.
Auch die bearbeitbare XML-Datei wurde über Herunterladen gesichert. Ihr Inhalt
enthält weiterhin das eigene 190 × 190 große Zollhaus und eine getrennte Linie
mit drei Wegpunkten. Keine Anmeldung, Cloudablage oder externen Bedingungen.

[Wiedergeöffnete Oberfläche](access-path-drawio-ui.jpg),
[ausgegebene PNG](access-path-drawio.png),
[heruntergeladene bearbeitbare Datei](access-path-drawio.drawio).
Dieser vollständige Kartenvergleich ist im Capability-Katalog eingetragen;
er qualifiziert keine allgemeine Gleichwertigkeit der Kampagnendatenmodelle.
Die native Probe zoomt für Pixel-Gegenproben drei Stufen heraus; daraus folgt
keine Notwendigkeit genau dieser drei Schritte im GM-Ablauf.

Auch `tools/test-desktop-region-export.mjs` bestand mit vier normalen
Prozessexits bei einfacher und doppelter Skalierung: Wege korrigieren,
Undo/Redo, Messen, PNG-Schrift über Kachelgrenzen und Wiederöffnung. Die Probe
schließt vor dem Ziehen die verdeckende rechte Leiste; zuvor hatte die Mausgeste
Seitentext statt eines Weggriffes ausgewählt. [Regionslauf](access-path-region-20261019.json).
Installation, andere Plattformen und Owner-Abnahme wurden nicht geprüft.

Wiederholen: `python3 tools/ui-session.py node tools/test-desktop-access-path.mjs`.
