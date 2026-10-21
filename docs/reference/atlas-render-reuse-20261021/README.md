# Cursor und unveränderte Trassen wiederverwenden

21.10.2026, Änderungen auf `b91fd0f9e`, Desktopversion 0.180.0.
Lokaler Host: i5-8365U / Intel UHD 620. Der Pentium Gold 7505 des Nutzers
wurde nicht getestet. Funktionsprüfung und einzelne Laufzeitmessungen sind
keine Erfüllung der Leistungsziele für eine vollständig gefüllte Welt.

## Ursache und Änderung

Der Pinselcursor erzeugte bei jedem Zeigerpunkt neue Geometrie und ein neues
Material und gab die vorherigen Ressourcen sofort frei. Dadurch konnte Three
auch das zuletzt verwendete Shaderprogramm freigeben und beim nächsten Bild
wieder erzeugen. Das vorherige Sculpt-Profil zeigte 143 ms Shader-Abfragen
unter dem Cursor-Zeichenpfad.

`TerrainRing` hält Geometrie und Material bis zum Ende der Ansicht. Änderungen
verschieben die vorhandenen 65 Eckpunkte; identische Werte benötigen keinen
Upload. Ausblenden behält die Ressourcen. Cursor und Auswahl folgen auch
neuen Geländehöhen und dem Ursprung des geladenen Ausschnitts.

Trassen enthalten bereits vollständige Koordinaten relativ zum Kameraursprung.
Ihre unveränderten Objektmatrizen werden nicht mehr pro Bild zusammengesetzt.
`TerrainRouteVisibility` wiederholt die Sichtbarkeitsprüfung erst bei einer
anderen Kamera, Bildschirmhöhe oder Trassenliste. Zoom, Neigung, neue Trassen
und Bildausgabe behalten die bisherige Sichtbarkeitsregel. Der Shader steuert
weiterhin die kontinuierliche Überblendung.

## Gefundene Regression und Bildprüfung

Die erste native Weltprobe erreichte ihre vollständigen Detailkacheln, scheiterte
aber am anschließenden neuen Cursor-Bildtest. Der Cursor war unsichtbar:
Sein jetzt früh erzeugtes Material wurde vor dem Gelände gezeichnet. Der kleine
Höhenversatz kann im Tiefenpuffer denselben Wert wie der Boden erhalten. Die
bisherige Sichtbarkeit hing damit auch von der Material-Erzeugungsreihenfolge ab.

Der Cursor zeichnet jetzt ausdrücklich nach den undurchsichtigen Bodenobjekten,
weiterhin mit Tiefenprüfung. Der erste Fehler bleibt in
[Fehlerprotokoll](first-failure.json) und [Diagnose](first-cursor-probe.json)
erhalten. Der neue GPU-Test verwendet zwei getrennte Renderer und vergleicht
jeden RGBA-Wert mit dem bisherigen Verfahren. Er prüft Bewegung, Radius,
Aus-/Einblenden, neue Höhen, Neigung, weit entfernte Koordinaten, ausgetauschte
Bodenmaterialien und Gelände mit einem Hang. Programmanzahlen werden direkt
über WebGL `createProgram`/`deleteProgram` gemessen.

## Prüfwege

- [Ressourcen und Sichtbarkeit](../../../tests/terrain-render-reuse.test.mjs):
  unveränderte Buffer, Freigabe, Höhenänderungen und Kamera-/Trassenwechsel.
- [GPU-Vergleich](../../../tools/terrain-render-reuse-probe.mjs), eingebunden
  in die [native Weltprobe](../../../tools/test-desktop-world-navigation.mjs).
- [Normale Pinselbedienung](../../../tools/test-desktop-atlas-brush-ux.mjs):
  Navigation, Radius, Undo/Redo, Neigung, Ausgabe und frische Wiederaufnahme.
- [Straßen und Flüsse](../../../tools/test-desktop-atlas-line-scales.mjs):
  regionaler bis örtlicher Zoom, Auswahl und Neigung auf derselben Atlasfläche.

60 unterschiedliche betroffene Node-Tests bestanden; beide TypeScript-Prüfungen
und Desktop-Build bestanden. Nach der Korrektur der Zeichenreihenfolge wurden
die betroffenen neuen Tests, TypeScript-Prüfung und Desktop-Build erneut geprüft.

## Große native Welt und verbleibende Kosten

[Messung](world.json), [Bild nach dem Pinsel](world.png). Gleicher Prüfweg wie
bei den [Metadatenindizes](../atlas-terrain-kind-index-20261021/README.md):
`WORLD_POPULATED=1 WORLD_LARGE=1 WORLD_DRAFT=1 WORLD_PROGRESSIVE=1
SALTMARCHER_TERRAIN_TRACE=1`, begrenzt durch `tools/ui-session.py` auf 300 s.
Kein paralleler eigener Build oder anderer nativer Lauf während der Messung.

| Messgröße | Vorheriger Lauf | Korrigierter Lauf |
| --- | ---: | ---: |
| Navigation RAF p95 / Maximum | 35,8 / 266,6 ms | 30,8 / 333,3 ms |
| Sculpt RAF p95 / Maximum | 39,9 / 161,7 ms | 38,4 / 263,6 ms |
| Erste GPU-Pixeländerung im Messbereich | 201,3 ms | 218,0 ms |
| Alle 48 Kacheln nach Loslassen fertig | 38.185,1 ms | 37.290,2 ms |

Einzelne Läufe, keine statistisch gesicherte Beschleunigung und keine
Latenzperzentile für den Pinsel. Die erste Pixeländerung stammt aus dem
32×32-Messbereich ab Ereigniszeitstempel, einschließlich Referenz-GPU-Lesung.
Gespeicherte Revision 8, Qualität `detail`, 48/48 Kacheln. Alle bisherigen
GPU-Prüfungen für Küsten/Höhenlinien, Hexraster, Details und direkte Arbeitsfassung
bestanden. Prozess 3050187 schloss normal mit Code 0, PID verschwunden,
keine Rendererfehler.

Der Cursorvergleich meldet 202 sichtbare Pixel und **31 identische RGBA-Bilder**.
Bei 24 Bewegungen und Aus-/Einblenden: **ein neues Programm, keines freigegeben**;
das bisherige Verfahren erzeugt 25 Programme und gibt 24 frei. Höhenwechsel,
neue Bodenmaterialien und Hangverdeckung werden anschließend getrennt verglichen.

Die [CPU-Stichproben](cpu-comparison.json) bestätigen den vermiedenen Aufwand:
inklusive Matrixaktualisierung bei Navigation 228,6 → 102,2 ms, während Sculpt
272,4 → 89,6 ms; Trassensichtbarkeit während Sculpt 184,1 → 0 abgetastete ms.
Der Cursor-Zeichenpfad sinkt von 187,6 auf 23,6 abgetastete ms. Das sind Summen
innerhalb der jeweiligen Profilfenster, keine Kosten eines einzelnen Frames.
Die größeren maximalen Bildintervalle und die weiterhin zu späte Pixelreaktion
bleiben ausdrücklich offen. Das Lastbild ist eine künstliche Testwelt und
keine visuelle Fantasykartenabnahme.

## Weitere native Prüfungen

Die [native Pinselbedienung](brush-ux.json) bestand einschließlich Undo/Redo,
Shift-Mausrad, Neigung, PNG und frischem Öffnen bei 125 % Browserzoom.
Prozesse 3051281 und 3051942 endeten normal mit Code 0, PIDs verschwunden,
keine Rendererfehler. Das [gekippte Testgelände](tilted-brush.png) ist wegen
des großen Höhenauftrags auf einem sehr kleinen Ausschnitt extrem steil;
diese Funktionsprobe ist keine Beurteilung natürlicher Geländeformen.

Die [Straßenprobe](lines.json) bestand mit tatsächlicher Auswahl am sichtbaren
Linienrand, regionalem bis örtlichem Zoom und Neigung auf demselben Canvas.
Kanonische Straßen-/Flussgeometrie blieb unverändert. Der ergänzende GPU-Test
prüfte Breite, Ausblendung, Treffer und gekachelte Bildausgabe.

## Grenzen

Weniger Rendererarbeit ist keine garantierte Verbesserung des Bildtakts. Die
Weltprobe enthält 108.076 Landschaftsobjekte und den 2.500-Meilen-Pinsel; sie
qualifiziert weder den gesamten kombinierten Gebäude-/Raum-/Volumenbestand noch
eine 30-minütige Sitzung. Fantasyästhetik, 60 FPS, Pinselreaktion innerhalb
100 ms und die physische Zielhardware bleiben eigenständige offene Prüfungen.
