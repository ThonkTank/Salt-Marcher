# Pinselbeschriftungen beim Kamerafahren wiederverwenden

Jedes Kartenbild synchronisiert die Pinselgrößen, damit ein Bildschirmradius beim
Zoomen stimmt. `BrushSizeControl.render` baute dabei jedes Mal die Beschriftung
`Radius` samt Einheit neu auf. Die nächste Größenabfrage in `regionQuery` zwang
Chromium deshalb zur erneuten Stilberechnung. Drei Pinselbedienfelder erzeugten
zusammen wiederholt 42 betroffene Elemente.

Die Beschriftung entsteht jetzt einmal. Nur ein tatsächlich veränderter
Einheitentext wird ersetzt; Modell, Größenwerte, Eingaben und Gestensperre werden
weiter synchronisiert. Einheitenwechsel zwischen Pixeln, Metern und Fuß behält
dieselben Beschriftungsknoten. Der zusätzliche Regressionstest prüft diese
Identität über Kameramaßstäbe und echte Modus-/Einheitenwechsel.

## Native Gegenprobe

[Trace-Auswertung und Prozessnachweise](navigation.json): normale Atlasfläche,
3.076 Gelände-/Wald-/Straßenrecords, i5-8365U/Intel UHD 620, 1440×900, DPR 1.
Zwölf Mausradschritte und zwölf Verschiebungen; CPU-Profil und Chromium-Timeline
aktiv, keine eigenen parallelen Builds oder Tests. Beide Prozesse endeten mit
Exit 0 und bestätigter PID-Abwesenheit, ohne Rendererfehler oder Trace-Datenverlust.

| Messung | Vorher | Danach |
| --- | ---: | ---: |
| Durch `regionQuery` erzwungene Stilberechnungen | 81 | 3 |
| Deren Gesamtzeit | 373,3 ms | 14,0 ms |
| Navigation RAF p95 | 46,5 ms | 39,8 ms |
| Längstes RAF-Intervall | 283,3 ms | 250,1 ms |

Das ist ein abgegrenzter Aufwand im Oberflächenthread, keine vollständige
Leistungsabnahme. Insbesondere die langen Bildintervalle, volle Zielwelt,
Eingabe-bis-Pixel-Latenz und Pentium Gold 7505 bleiben offen.

`tools/test-desktop-world-navigation.mjs` zeichnet mit `WORLD_LAYOUT_TRACE=1`
zusätzlich `layout-trace.json` auf. In Chrome-Traces sind `UpdateLayoutTree`-Ereignisse
mit `args.beginData.stackTrace[0].functionName === "regionQuery"` die hier
summierten erzwungenen Stilberechnungen. Die Rohtraces der Gegenprobe bleiben
unter `.build/world-navigation-layout-before/` und `...-after/` erhalten.


## Pinselbedienung

Fünf Brush-Size-Regressionen, beide Typprüfungen, Desktopbuild und
Repositoryprüfung bestanden. Die [native Bedienprobe](brush-ux.json) prüft
Richtung und Vorlagen, Bildschirm-/Weltradius, Shift-Mausrad in allen
Pinselfamilien, Gestensperre, Undo/Redo, Neigung, PNG-Ausgabe und frisches Öffnen
mit 125 % Browserzoom. Beide Prozesse endeten normal; ihre PIDs sind beendet.
[Wiedergeöffnete Karte](reopened.png).

Der erste Lauf erreichte das Wiederöffnen, scheiterte dann aber am bei 125 %
ausgeblendeten Bereichsfeld neben dem Rauminspektor. Er bleibt unter
`.build/atlas-brush-controls-stable/` als fehlgeschlagen erhalten. Der aktualisierte
Prüfablauf schließt den sichtbaren Inspektor vor der Werkzeugwahl und bestand
vollständig. Das verändert keine Produktbedienung und zählt den ersten Lauf
nicht nachträglich als bestanden.
