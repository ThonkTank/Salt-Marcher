# Scharfe Höhenlinien auf dem vorhandenen Atlasgelände

Lokaler Stand vom 20.10.2026 auf `81acd60b7` mit den Quellhashes in den Ergebnisdateien. [Roadmap und offene Produktziele](../../plans/maps/unified-spatial-atlas.md).

## Änderung

Höhenlinien im bestehenden räumlichen Atlas werden unmittelbar auf demselben Dreiecksnetz gezeichnet, das die sichtbaren Geländetreffer bestimmt. Ein Intervallwechsel ändert GPU-Uniforms statt die Geländetextur neu anzufordern. Die Linien verwenden tatsächliche Höhenmeter, konstante Bildschirmbreite, hervorgehobene Hauptlinien und eine Ausblendung bei zu dichter Darstellung. Überhöhung verändert keine Höhenwerte oder Intervalle.

## Prüfung

- [Native Kameraprobe und echte GPU-Pixel](camera-result.json): Die Hauptlinie belegt bei 1.000, 500 und 250 Weltmetern Bildbreite jeweils **2 Pixel** auf dem 512-Pixel-Prüfbild. Die 100-m-Linie bleibt an ihrer erwarteten Weltposition. Ausgeschaltete und unlesbar dichte Intervalle sowie die Meereshöhe erzeugen keine Linie. Der Intervallwechsel im tatsächlichen Atlas verändert Canvaspixel ohne neuen Geländeauftrag.
- [Native Autorenprobe mit 100-m-Konturen](author-result.json): Pass absenken, gekoppelte Küste, Undo/Redo, Escape, Glätten, Bemalen/Löschen, Zoom/Pan, Auswahl, Wissensmasken und frisches Öffnen bestehen. Beide Proben beenden sich normal mit Exitcode 0, ohne Renderer-/Shaderfehler oder zurückbleibende Prozesse.
- 24 gezielte Tests bestehen: [Kamera/GPU-Puffer](../../../tests/atlas-perspective-camera.test.mjs), [Quellenwiederverwendung](../../../tests/terrain-spatial-source.test.mjs), [Geländevorschau](../../../tests/terrain-tilted-atlas.test.mjs), [kanonische Bearbeitung/History](../../../tests/terrain-tilted-atlas-storage.test.mjs). Typprüfungen, Desktopbuild und Repositoryprüfung bestehen.
- [Kontrollbild](contours.png) und [bearbeiteter Pass](lowered.png) wurden visuell geprüft. Eine zunächst sichtbare zusätzliche gezackte Kontur auf der Meereshöhe wurde vor diesem Stand korrigiert und mit GPU-Pixeln abgesichert.

Der erste Autorenlauf erreichte Bearbeitung/History, scheiterte dann an der Test-Synchronisation beim animierten Zoom: Zwischen zwei Statusabfragen begann die nächste Detailanforderung. Die Probe wartet jetzt ausdrücklich auf die berechnete Zielbreite und den dazugehörigen Bereich, bevor sie Bereitschaft verlangt. Der neue vollständige Lauf ist oben verlinkt. Kamera- und Autorenprobe führen deshalb unterschiedliche Probe-Scripthashes, aber dieselben Produktquellen und Desktopartefakte.

## Verbleibende Grenzen

Die GPU-Pixelmessung prüft eine bekannte synthetische Fläche; sie ist keine FPS- oder vollständige Lesbarkeitsabnahme. Die native Autorenprobe misst Statuswartezeiten, keine erste tatsächliche Pixelreaktion. Küsten-/Relieftextur und Dreiecksnetz bleiben begrenzt aufgelöst. Automatische Intervallwahl, gemeinsame Konturen in Canvas2D/Export, hohe DPI, alle Wasserflächen und sämtliche Maßstäbe brauchen weitere Arbeit. Die Gesamtoptimierung einschließlich Assets, Beschriftungen und Regionen ist nicht abgeschlossen; die drei geforderten Abschlussuntersuchungen ohne Arbeitsfund haben noch nicht begonnen.

Candidate-CI, Integration, Paket und Installation sind für diesen lokalen Stand noch nicht belegt.
