# Räumlicher Bewuchs bleibt bei größeren Ausschnitten erhalten

21.10.2026. Folgebeleg zur
[Bildkachel- und Exportkorrektur](../atlas-image-orientation-20261021/README.md).

## Ursache und Änderung

Bei fast gleichem sichtbarem Maßstab überschritt allein der größere Lesebereich
für die Ausgabe das bestehende Vektorbudget. Die Hauptansicht behielt 1.790
räumliche Instanzen; der Ausgabebereich mit 3.737 Instanzen fiel auf Rasterpunkte
zurück. Die unverpackten Bewuchsprojektionen benötigten dort rund 901 kB.

Der Readonly-Leser komprimiert generierten Bewuchs jetzt erst dann, wenn er sonst
wegen der Antwortgröße rasterisieren müsste. Der gemeinsame Projektionscodec
speichert acht Float64-Werte und einen Assetindex pro Instanz; IDs bleiben
unverändert, geschützte Korrekturen und zusätzliche Metadaten bleiben vollständig
erhalten. Die bereits vorhandene fflate-Abhängigkeit komprimiert den numerischen
Puffer. Renderer, Treffer und flache Darstellung teilen eine zwischengespeicherte
Dekodierung. Kanonische Autorenformate ändern sich nicht.

Das Budget bleibt bei höchstens 512 KiB für Vektoren. Gewöhnliche passende
Antworten bleiben unverpackt; echte Überlastfälle behalten den Rasterfallback.
Die [erneute Größenprobe](projection-sizes.json) erhält im größeren Ausschnitt
alle 3.737 Instanzen ohne Rasterkacheln bei insgesamt 414.511 JSON-Bytes.
Der kleinere Ausschnitt bleibt unverpackt bei 433.012 Bytes. Dies belegt
Detailerhaltung innerhalb des Budgets, keinen allgemeinen Latenzgewinn.

## Prüfungen

- [34 Regressionen bestanden](tests.log): verlustfreie Koordinaten auch bei
  großer Entfernung, geschützte Metadaten, stabile Reihenfolge/IDs, begrenzte
  Dekodierung, identische GPU-Matrizen/Treffer/flache Zeichnung und tatsächlicher
  Readonly-Leser mit größerem Wald. Autorenstand und Revision bleiben erhalten;
  der Writer lehnt eingeschleuste Anzeigeprojektionen weiterhin ab.
- Beide TypeScript-Prüfungen und Desktopbuild bestanden.
- [Native Hauptatlas-Probe](main-atlas.json): vier Maßstäbe von 80 km bis 300 m,
  Neigung derselben Hauptkamera und PNG aus dem normalen Ausgabedialog.
  [Aktuelle Ausgabe](export.png) zeigt räumliche Kronen und Stämme statt der
  [vorherigen Rasterpunkte](../atlas-image-orientation-20261021/export-fixed.png).
  120.458 dunkle Kronenpixel liegen in der geprüften Bildhälfte außerhalb des
  geschützten Einzelbaums. Normaler Exit, PID beendet, keine Rendererfehler,
  unveränderte Autorenzeilen beim frischen Datenbanklesen.
- [Native Bearbeitung und frischer Prozess](authoring.json): Landschaft malen,
  Lichtung, Einzelkorrektur auswählen/verschieben/skalieren/drehen, gemeinsame
  Kamera, Undo/Redo, Flächen/Baumreihen/Abbruch und Ortsverweise. Drei normale
  Prozessabschlüsse, keine Fehler; kein Prozess des Prüfprofils blieb bestehen.
  Der zusätzlich enthaltene isolierte Renderertest ist kein Produktzugang.

Quellbasis ist f9b5bcd369a6f663d6e4f74b54301aebaba8e8ad mit lokalen Änderungen;
die nativen Ergebnisse enthalten die Quellhashes. Tests:
[Codec](../../../tests/vegetation-projection.test.mjs),
[Readonly und Autorenbestand](../../../tests/vegetation.test.mjs),
[Waldzoom/Export](../../../tools/test-desktop-forest-style.mjs),
[Bearbeitung](../../../tools/test-desktop-vegetation.mjs).

## Offen

Die Kronen sind weiterhin stark facettiert, die Bodenflächen gleichförmig und
die Bestände ästhetisch noch zu regelmäßig. Zusammenhängende Waldgestaltung
auf Weltmaßstab, weiche Geländeübergänge, sämtliche Landschaftswerkzeuge und
die vollständige Leistungsqualifikation bleiben offen. Keine Paket- oder
Nutzerabnahme; keine der drei abschließenden Gesamtuntersuchungen ist erreicht.
