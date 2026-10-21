# Freie Raumkonturen ohne automatische Volumenrasterung

Lokaler P6-Teilstand vom 21.10.2026, Runtime `24c4c16a0`. Der bestehende
Atlas und seine kanonischen Raumdaten bleiben die Grundlage.

## Ursache und Änderung

`storage/drawing.ts` führte nach jedem `create-room` sofort
`volume-initialize` aus. Damit wurden auch freie Polygone bei abgeschaltetem
Rasterfang in 1,524-Meter-Zellen umgewandelt. Schräge Wände bekamen Treppen,
kleine Räume scheiterten an fehlenden vollständigen Zellen und getrennte
Teilflächen konnten neue Raumidentitäten erhalten.

Die gemeinsame Zeichnungsaktion legt jetzt genau die validierte Kontur im
gewählten Geschoss an. Eine Volumenaktion ist eine eigene, ausdrücklich
gewählte Bearbeitung. Bestehende Volumenrecords behalten ihre bisherigen
Bearbeitungs- und Historyregeln. Es gibt keine Datenmigration oder nachträgliche
Rekonstruktion schon gerasterter Räume.

Die bisherige Gebäudesonderbehandlung `atlasDrawingScope` und der zweite
Schreibweg im Zeichenwerkzeug entfallen. Gebäude- und freie Raumgruppen
verwenden denselben Befehl. Abgeleitete Gebäudehüllen und Schutzmarkierungen
werden weiterhin durch den Atlascommit aktualisiert. Fehlende Geschosse
werden vor der Neuanlage atomar abgewiesen.

## Automatisierte Prüfung

Die [Gegenprobe](before.log) auf `7dec039b5` scheitert in allen fünf ursprünglichen
Fällen. Kleine Konturen melden insbesondere „Kontur enthält keine 5-Fuß-Zelle“.
[144 betroffene Regressionen](regressions.log) und die spätere
[Ergänzung großer freier Konturen](scale-tests.log) bestehen: insgesamt 145
verschiedene Fälle. Sie decken die gemeinsame Zeichnungsoberfläche, exakte
Punkte und Löcher, kleine und große Formen, getrennte Teilflächen unter einer
Raumkennung, Änderungen, Undo/Redo, Prozessneustart, Gebäudekonturen,
Volumenbearbeitung, Raum-Keys und Bereichsleser ab.

Die ausdrückliche Volumeninitialisierung bleibt geprüft. Ihr Undo stellt die
vorherige freie Kontur exakt wieder her; Redo und Neustart erhalten das
gewählte Volumen. Die Gebäuderegression fügt einen schrägen Anbau über denselben
Zeichenbefehl hinzu und prüft Hülle, Schutz, History und Wiederöffnung.

## Native Prüfung

[Die native Probe](native.json) öffnet den normalen Atlas, zeichnet unter
45 Grad Neigung und 25 Grad Drehung einen Raum auf dem 24-Meter-Geschoss,
prüft seine drei gespeicherten Eckpunkte und das fehlende implizite Volumen.
Die Erwartungswerte werden aus den tatsächlichen nativen Klickkoordinaten
abgeleitet: Browser-Mausklicks runden hier auf Bildschirm-Pixel. Alle drei
Weltpunkte bleiben auf 0,00001 m genau erhalten. Die Raumneuanlage hat einen
Undo-/Redo-Schritt und übersteht eine weitere frische Prozessöffnung.

Die bestehende Folge mit Raum-/Objektauswahl, verworfenem Entwurf,
Eckpunktverschieben auf dem 12-Meter-Geschoss, Undo/Redo und Wiederöffnung
besteht ebenfalls. Drei Prozesse beenden sich normal mit Exit 0; alle PIDs
sind anschließend weg. Keine aufgezeichneten Fehler. [Glatte Kontur](free-contour.png)
und [Wiederöffnung](reopened.png) wurden visuell geprüft; der
[vorherige Treppeneffekt](../atlas-workplanes-20261021/upper-saved.png) entfällt.
App-/Desktop-Typprüfung und Desktop-Build bestehen. Ein erster Typprüfprozess
endete durch SIGTERM ohne Diagnostik; nach seinem bestätigten Ende wurde die
Prüfung getrennt von den laufenden Regressionen erfolgreich wiederholt.

## Grenzen

Die Änderung betrifft die Neuanlage freier Räume. Schon gespeicherte
Volumengeometrie bleibt rastergebunden. Der separate Volumenwerkzeugdialog,
leere räumliche Arbeitsebenen, unterirdische Freilegung und die übrigen
P0–P8-Arbeiten sind damit nicht abgeschlossen. Die Gesamtqualifikation und
die drei vollständigen kritischen Abschlussuntersuchungen bleiben offen.
