# Maßstabsabhängige Atlasdarstellung

Auftrag vom 19.10.2026: Google Maps liefert das Vorbild für Zoom, Informationsdichte und lesbare Namen. Fantasy-Farben und Autorenwerte bleiben erhalten. Auswahl und laufende Bearbeitung haben Vorrang vor automatischer Ausblendung.

## Darstellung

`atlas-cartography.ts` enthält die gemeinsamen, rein abgeleiteten Regeln. Kleine Gebäude blenden zwischen drei und fünf CSS-Pixeln Ausdehnung ein. Straßen und Flüsse erhalten nach Breite abgestufte Sichtweiten und Mindeststrichbreiten; unterhalb der Detailauflösung wird nur die Darstellung vereinfacht. Gespeicherte Geometrie und physische Linienberechnung bleiben unabhängig von Kamera und Ausgabegröße.

`atlas-map-labels.ts` platziert Namen nach Bedeutung und stabiler Kennung. Gemessene Textflächen mit Kontur und Abstand kollidieren nicht. Liniennamen folgen geraden Abschnitten und bleiben aufrecht; Wiederholungen halten mindestens 400 Pixel Abstand. Flächenplatzierung berücksichtigt konkave Umrisse und Löcher. Orts- und Gebäudenamen haben mehrere mögliche Positionen. Sichtbarkeit besitzt Hysterese; frühere gültige Positionen bleiben bevorzugt. Übergeordnete Stadt-/Viertelnamen treten im Nahbereich zurück. Namen werden unverändert dargestellt oder ausgelassen, niemals gekürzt.

Schriftgrößen sind CSS-Pixel: Straßen, Gebäude und Räume 13, Orte und Gewässer 15, Viertel 16, Regionen 18. Jede Canvaskamera behält einen begrenzten Messcache und Platzierungszustand. Geometrie und Namen verwenden dieselbe bestätigte Quellenrevision; reine Zoom-/Panwechsel schreiben keine Autorenwerte.

## Anschlüsse

Bereichsantworten liefern höchstens 512 Beschriftungskandidaten je Geometrie-/Landschaftsschicht innerhalb des bestehenden Antwortbudgets. Rasterübersichten enthalten weiterhin separate Namen. `selectedIds` in Bereichsabfragen erhält ausgewählte Stadtobjekte auch beim Wechsel zur Übersicht. Trefferprüfung und Geometrieausblendung verwenden dieselben Regeln.

`AtlasPaint.mapLabels` ist eine interne Zeichenprojektion, kein Autorendokument. Canvas zeichnet die Namen nach allen Geometrien in Bildschirmkoordinaten. GM-Bildexporte sammeln begrenzte Kandidaten aus den Kacheln und platzieren sie einmal auf dem fertigen Bild. Öffentliche Exporte verwenden ausschließlich freigegebene Namen aus der vorhandenen Spielerprojektion.

Der Regionseingang `RegionLabelSource`/`regionMapLabel` entspricht dem Prominenz- und Konturvertrag der getrennten Gebietsarbeit (PR #1075). Er führt weder Gebietsspeicherung noch eine Datenmigration ein. Beim Zusammenführen der Gebietswerkzeuge ersetzt dieser Eingang deren lokale Textzeichnung. Ebenso bleibt der Straßentypkatalog aus PR #1060 sein eigener Besitzer; dieser Stand arbeitet auf den bereits integrierten Breiten und Stilen. Die offenen Erweiterungsbranches werden nicht als Teil dieses Pakets übernommen.

## Nachweise

- `tests/desktop-atlas-cartography.test.mjs`: Kollisionsfreiheit, Reihenfolge, Auswahl, Schwellen, konkave Flächen/Löcher, lange Linien, vollständige Namen, Panstabilität, Budgets und unveränderte Autorenwerte.
- `tests/desktop-atlas-cartography-region.test.mjs`: 1.600 Gebäude als Raster mit separaten Namen, Auswahl/Hits bei weitem Zoom, dichte Landschaft, Löschung und Schutz privater Prosa.
- `tests/desktop-atlas-canvas.test.mjs`: vorhandener Canvas-/Exportprüfweg; Raumkandidaten behalten den vollständigen Namen und die unbeschnittene Kontur über Exportkacheln hinweg.
- `tools/test-desktop-atlas-cartography.mjs`: isolierte native Electron-Instanz, Zoomfolge, schmales Fenster, 200 %, echte Canvas-Textmessung, Exportname über einer Kachelgrenze, Neuöffnung und unveränderte gespeicherte Stadtobjekte. Ausgabe außerhalb des Repositories unter `~/.local/share/saltmarcher-qa/atlas-cartography-20261019/`.

Automatisierte und skriptgesteuerte native Prüfungen ersetzen keine Nutzerabnahme. Installation und CI-Status werden im Lieferbericht getrennt angegeben.
