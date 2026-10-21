# Eine normale Atlasfläche statt zweiter 3D-Karte

Die Produktimplementierung entfernt `VegetationSpatialView` und den eigenständigen Landschaftsdialog. Die Trassenplanung ist eine Atlas-Seitenleiste. Ihr einziges zusätzliches Canvas ist ein Höhenprofil, keine Karte. Bäume und Felsen sind instanzierte Objekte in der Hauptszene.

## Native Belege und Grenzen

- `reopen/result.json`: gezielte Fortsetzung nach dem Zeitlimit. SQLite-Backup des erhaltenen Testprofils in ein frisches Profil, gespeicherte Passstraße öffnen, auf der Hauptkarte einpassen/neigen, Planung schließen und regulär beenden. Alle Landschaftspayloads bleiben unverändert; kein Dialog und kein zweiter Karten-Canvas. Vollständig bestanden auf dem Produktstand `6a2d8e819`.

- `vegetation/result.json`: Bewuchs im normalen Atlas malen, Lichtung freihalten, geschützten Felsen auswählen/verschieben/skalieren/drehen, Hauptkamera neigen, zentrales Undo/Redo, Fläche und Baumreihe, Abbruch und frischer Prozess. Vollständig bestanden, keine Rendererfehler, reguläre Prozessabschlüsse. Der vorgelagerte isolierte Bildtest verwendet denselben Produktrenderer und ist kein zweiter Produktzugang.

- `routes-complete/result.json`: vollständiger Ablauf im normalen Atlas mit Straßen-/Flussvorschau, Speichern, Schutz, Löschen/Undo, Geländepinsel und frischem Prozess. Beide Prozesse endeten regulär mit Code 0; keine Rendererfehler. Dieser Lauf liegt vor dem abschließenden Anschluss der zentralen History-Tasten und der unabhängigen Bewuchspublikation.
- `planning-timeout/failure.json`: zusätzlicher Ablauf nach Anschluss der zentralen History-Tasten und Bereinigung der Seitenleiste. Bearbeitung, History, Speichern, Fluss und Löschen waren durchlaufen; das 300-Sekunden-Limit beendete den zweiten Prozess beim Wiederöffnen. **Kein vollständiger Pass.** Die Bilder sind Sichtbelege für die Hauptkarte, keine Neustartqualifikation. Alle Prozesse dieses Laufs wurden beendet.

Die JSON-Dateien enthalten Ausgangscommit, Dirty-Markierung und SHA-256 der tatsächlich ausgeführten Desktop-Bundles. Der Ausgangscommit allein bezeichnet bei diesen Arbeitsständen nicht den getesteten Quellstand. Dies ist weder Paket-/Installationsnachweis noch Main-Integration oder Owner-Abnahme.
