# Aktueller Stand

Atlas V7, Dateiformat 20, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Arbeit: Boden in allen Außenmaßstäben

Die feste Zoomsperre des Bodenwerkzeugs ist entfernt. Farbstriche wählen beim
Beginn eine zur Bildschirmgröße passende Autorenauflösung. Große Striche legen
keine flächendeckenden Ein-Fuß-Raster an. Vorhandene feinere Autoren erhalten
denselben späteren Farbauftrag; lokale Verfeinerungen, Radieren, Vorschau und
History verwenden die gemeinsame Kachelhierarchie. Fehlende Autoren erben Farbe;
explizit transparente Autoren verdecken sie. Die gespeicherte Auflösungsstufe
führt zum Entwicklungsformat 20 ohne Migration älterer Testdateien.

Nachprüfung: Der Aufbau von Bodenübersichten liest das anschließend vollständig
überschriebene Elternraster nicht mehr vorab. Das gilt für interaktive Änderungen
und den Wiederaufbau beim Öffnen. Der benötigte Vergleich mit geerbter Farbe bleibt
erhalten; Autorenwerte, Rundung und Darstellung ändern sich nicht. Neun relevante
Rustfälle bestehen nach dieser Korrektur erneut (`ground-parent-reads.log`).
Die unten beschriebene native Abnahme gehört zum vorhergehenden Bodenbuild;
das bereits geöffnete Testprogramm wurde für diese reine Read-Korrektur nicht ersetzt.

Die Rustprüfung bestand 321 Bibliotheksfälle und 16 Dokumentfälle. Die einzige
fehlgeschlagene Parzellenprüfung erwartete noch Format 19; nach Anpassung bestehen
alle 11 Parzellenfälle. Fünf Last-/Fixturefälle bleiben ignoriert. Neun relevante
Rustfälle bestehen nochmals mit der finalen Historyserialisierung. 368 Frontendfälle
und anschließend 81 relevante Fälle einschließlich drei neuer Maßstabsfälle bestehen;
insgesamt enthält die Frontendsuite jetzt 371 Fälle. 129 Transportverträge,
Typprüfung, Clippy, Formatprüfung und Release-/RPM-Build bestehen.

18 abschließende Browserfälle bestehen: Boden einschließlich Welt per Vorgabe und
Mausrad, Datei-/Eingabegrenzen und Grundstücksmaßstab. Vorherige Lade-Timeouts
traten unter paralleler Build-/Testlast auf; die abschließende Reihe lief ohne
Releasebau. Keine neuen Zeitmessungen und noch keine CI-Freigabe dieser Änderung.

Nativ geprüft unter Linux/X11/WebKit, 1440×960: manuelles Herauszoomen bis zur
Weltgrenze, sichtbarer Auftrag während des Ziehens, weiche/harte/wolkige Spitzen,
30/40/80-Pixel-Bodenpinsel, Hineinzoomen und lokale Ergänzung/Radieren, Rückkehr
zur Welt, erneutes Übermalen mit 50 % Deckkraft und 25 % Farbfluss, Pipette,
Undo/Redo und Speichern. Undo/Redo sowie vollständiger Neustart/Wiederöffnen
stellen den geprüften 400×400-Kartenausschnitt pixelgleich her. Der abschließende
Build öffnete die Datei und nahm einen weiteren Farbstrich an. Der Testatlas bleibt
zum Ausprobieren geöffnet. Keine vollständige Prüfung sämtlicher Pinselgrößen.

## Vorheriger geprüfter Stand

Der kräuselige Höhenpinsel bietet Land/Meer mit 5–100 % Rauheit und 65 % Vorgabe.
Eine ortsgebundene Küstenstruktur erhält den Pinselweg und die bestehende
Abschnitts-/Historyarchitektur. Native Prüfungen umfassten manuelles Zoomen,
Land/Meer, mehrere Pinselgrößen, Undo/Redo und Datei-Rundlauf. Die vorhandenen
Kontrollwertlimits bleiben bestehen. PR #1448 wartet auf seine CI-Freigabe.

PR #1447 ist auf main integriert. Höhenstriche werden an der Weltkante begrenzt;
der Canvas kennzeichnet den Außenbereich. Die Statusleiste ändert beim
Verschwinden eines Fehlers nicht mehr ihre Höhe und bricht dadurch keinen
Folgestrich ab. Frühere Änderungen begrenzen Höhenpakete auf 32 Punkte, verwenden
räumliche Autorenreads und gemeinsame Oberflächensampler und entfernen ungenutzte
Höhenübersichten. Die lokale ursprüngliche Historie bleibt erhalten.

Genau eine kleine Vorher-/Nachher-Reihe mit je drei Weltstrichen ist abgeschlossen:
erste sichtbare Änderung vorher 275–304 ms, danach 119–134 ms; sichtbare Bestätigung
p95 vorher 427–516 ms, danach 339–376 ms; Nachlauf vorher 259–427 ms, danach
231–345 ms. Spätere Änderungen sind darin nicht enthalten. Das Ziel p95 ≤50 ms
ist nicht belegt; keine weitere Zeitmessreihe wurde begonnen.

## Offene Abnahme

Native Datei-/Eingabeabnahme über die jeweils geprüften Fälle hinaus,
RPM-Installation und große Stadt-/Weltlastfälle bleiben offen. Der umfangreiche
Release-Treiber mit neun Fixtures wurde nicht ausgeführt. Weitere allgemeine
Optimierungen sind nicht Teil der aktuellen Produktänderung.

Aktuelle Belege: `src-tauri/target/diagnostics/ground-*`.
Vorherige Belege: `crinkled-*`, `manual-world-*`, `river-sampling-*`,
`surface-consistency-*`, `water-footprint-*`, `water-locality-*`, `direct-state-*`,
`brush-reads-*`, `house-index-*`, `ocean-*`, `density-*` und `world-brush/` unter
`src-tauri/target/diagnostics/`. Browserbelege: `playwright-*/` dort.
