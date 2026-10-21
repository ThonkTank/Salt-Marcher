# Bestätigte Pinselfarbe im Hauptatlas

Fortsetzung der [Weltprobe](../atlas-world-response-20261021/README.md).
`terrainDetailBox` rasterte für einen Radius von 4.023.360 m zuvor eine
33.554.432 m breite Fläche. Jetzt deckt die stabile Arbeitsfläche den Pinsel
einschließlich Filterrand ab, bleibt aber höchstens drei Radien breit.

Das bestätigte 256×256-Pinselbild wird direkt auf der GPU zwischen Übersicht
und unveränderten feinen Kacheln zusammengesetzt. Die CPU vergrößert es nicht
mehr in das gehaltene Weltbild. Ungültige feine Kacheln bleiben als solche
markiert; dieses Zwischenbild füllt keinen Cacheeintrag vorgetäuscht auf.
Die zusätzliche kleine Textur wird nach Gebrauch freigegeben.

Außerdem initialisierte die echte Hauptkamera `TerrainDetailMaterial` ohne
Renderer. Damit wurde der vorhandene schnelle Rechteck-Upload nie verwendet;
die Tests mit ausdrücklich übergebenem Renderer übersahen den Anschlussfehler.
Der Besitzer entsteht jetzt erst mit dem Kamerarenderer. Eine GPU-Prüfung baut
den echten `TerrainSpatialView` auf und beobachtet für eine 256×256-Änderung
genau einen 256×256-Upload.

## Ergebnis und Grenzen

Gleiche gefüllte native Lastprobe: 3.076 Gelände-/Wald-/Straßenrecords,
1440×900, i5-8365U/Intel UHD 620, CPU-Profiler und Traces aktiv. Kein Nachweis
auf dem Pentium Gold 7505 des Eigentümers.

- Navigation: RAF p95 38,3 ms, Maximum 283,4 ms.
- Pinsel: RAF p95 18,1 ms, Maximum 216,8 ms.
- Bestätigte Live-Bildberechnung: 1.541–1.772 ms, zuvor erster Frame 4.747 ms.
- **Erster bestätigter Stand nach Zeiger-Down: 2.173 ms.** Zwei bestätigte
  Revisionen wurden während des rund 4,2 Sekunden gehaltenen Strichs publiziert.
- GPU-Farben: bestätigtes Rot im ungültigen Zentrum, unverändertes Grün im
  gültigen Außenbereich, ursprüngliche Übersicht nach Entfernen der Pinseltextur.
  Texturzahl 3 → 4 → 3; Quellbild des Orakels nur 256 Bytes.
- Prozess normal beendet, Exit 0 und PID anschließend abwesend.

[Messdaten einschließlich GPU-Ergebnis](world.json), [sichtbarer Stand](world-sculpt.png).
Ein erster Lauf dieser Änderung scheiterte ausschließlich am GPU-Testpunkt:
Er lag im weichen Verfügbarkeitsrand und war daher nicht vollständig grün.
Die Wiederholung prüft einen vollständig belegten Außenbereich. Das Testprogramm
zeichnet Zeigerereignisse vor den Werkzeug-Handlern auf, um deren Ereignissperre
nicht mit fehlendem Eingang zu verwechseln.

**Unmittelbare Bearbeitung ist damit noch nicht erreicht.** Farbberechnung im
gemeinsamen Worker verzögert weitere Autorenaufträge; der nächste Schritt muss
den schnellen Höhenstand von der aufwendigen Bildverfeinerung lösen. Die
kontrollierte Lastprobe ersetzt weder die vollständige Abnahmewelt noch die
Autorenreise Kontinente → Königreich → Stadtgeometrie → einzelnes Gebäude.
Die grobe Weltfarbe im Bild bleibt ebenfalls eine offene Darstellungsgrenze.

Regressionen: `tests/terrain-color-retention.test.mjs` prüft Quellenwechsel,
Invalidierung und Pinselabdeckung; `tests/terrain-spatial-source.test.mjs`
prüft unveränderte entfernte Details und kleine GPU-Pinselbilder.
`tools/terrain-detail-probe.mjs` prüft tatsächliche Komposition, Freigabe und
den Anschluss des schnellen Uploads im Produktkonstruktor.

28 Farb-/Quellen-/Projektionsregressionen und 32 Kamera-/Treffer-/Vegetationsfälle
bestanden, ebenso beide TypeScript-Prüfungen und der Desktopbuild. Die zusätzliche
native [Küstenprobe](coast.json) bestand schrittweise Farbverfeinerung, Neigen
auf derselben Hauptkamera, perspektivischen PNG-Export ohne Autorenänderung,
[Absenken über den Meeresspiegel](lowered-coast.png) und vollständiges
[Undo des Strichs](coast-undo.png). Prozess Exit 0, PID abwesend.
