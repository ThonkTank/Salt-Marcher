# Kamera während des Pinselabschlusses bedienen

21.10.2026, Änderung auf `3847bd230` / 0.181.0. Prüfung im normalen Desktop-Atlas.

Nach dem Loslassen blieb `LandscapeWorkbench.hasDraft()` bis zum Abschluss
aller Schreibantworten, Terrain-Verfeinerungen und der Atlasaktualisierung wahr.
Die Kamera verwendete dieselbe Sperre wie die Autorenparameter. Dadurch wartete
auch reine Navigation auf diese Arbeit. Außerdem sperrte `AtlasCanvas` primäres
Verschieben bei einem ausstehenden Bild, auch bei ausdrücklich gewählter Hand
oder gedrückter Leertaste.

`blocksNavigation()` unterscheidet jetzt den gehaltenen direkten Pinsel von
seinem asynchronen Abschluss. Schreiben, Werkzeugparameter, History und neue
Autorenaktionen bleiben bis zum bestehenden Abschluss geschützt. Kamera und
Pose dürfen nach dem Loslassen weiterlaufen. Hand aktiviert in diesem Zustand
nur die Navigation und deaktiviert die Landschaftseingabe; sie wechselt weder
den Schreibbesitzer noch die Autorenfamilie. Die nächste Werkzeugwahl durchläuft
weiter die normale Entwurfsprüfung. Die eingefrorene Autoren-Trefferfläche bleibt
bis zum Abschluss erhalten; Navigationsstrahlen verwenden die aktuelle Kamera.

Der Pan-Vertrag unterscheidet ausdrückliche Navigation von der impliziten
Auswahl eines vermeintlich leeren Kartenpunkts. Hand, Leertaste, Alt und mittlere
Maustaste benötigen keine aktuellen Objekttreffer. Ein noch nicht gezeichnetes
Bild gibt weiterhin keine Autorentreffer frei. Terrain-Überhöhung, Routenplanung,
Recovery und neue Geländeabfragen behalten ihre vollständigen Entwurfssperren.

## Reproduzierbare Gegenproben

- `tools/test-desktop-atlas-navigation-pending.mjs` hält die Antwort eines
  tatsächlich erfolgreichen Main-Commits zurück. [Vorher](baseline.json) blieben
  Radzoom, Leertaste und Hand ohne Kamerabewegung. [Nachher](pending.json) bewegen
  alle drei die Ansicht trotz ausstehender Antwort; Neigung 35° und Drehung 25°
  funktionieren ebenfalls. Ein zweiter Pinselzug erzeugt keinen zusätzlichen
  Schreibaufruf, Radius und History bleiben gesperrt. Eine anschließend separat
  zurückgehaltene echte Terrain-Verfeinerung blockiert Radzoom ebenfalls nicht.
  Nach Freigabe enden Speicherung und Darstellung; Undo/Redo liefern erfolgreiche
  Main-Bestätigungen. [Native Ansicht während der Sperre](pending.png).
- Die diagnostischen `viewChangedMs` erfassen die erste beobachtete Änderung
  des Ansichtsdatensatzes in RAF; `authorReadyMs` erfasst die erneute
  Canvas-Trefferfreigabe. Beide sind **keine Pixel- oder Compositor-Zeitmessung**
  und keine Abnahme des Reaktionszeitziels.
- `tools/test-desktop-world-navigation.mjs`, ergänzt um
  `WORLD_PENDING_NAVIGATION=1`: [108.076 Landschaftsobjekte](world.json), Pinselradius
  2.500 Meilen. Nach Loslassen und während weiterhin gesperrtem Autorenwerkzeug
  verändert Radzoom die Ansicht. Danach erscheinen die bestätigte Revision und
  sämtliche Detailkacheln. In diesem Lauf liefen TypeScript-Prüfungen parallel;
  seine Zeitwerte sind kein isolierter Vergleich zur bisherigen Leistung.
- Unitregressionen: ausdrückliches Verschieben während eines ausstehenden Bilds,
  weiterhin gesperrte Autorentreffer, gehaltene Pinsel, andere offene Entwürfe,
  getrennte Posen-/Schreibsperre und Hand ohne Familienwechsel. 117 betroffene
  Tests bestanden; beide TypeScript-Prüfungen, Desktop-Build und Repositoryprüfung
  bestanden.

Die vorhandene [Pinselbedienprobe](brush-ux.json) bestand ebenfalls: neun Gruppen
mit Fenster-/Zoomskalierung, Vorlagen, Pinsel- und Kamerasperren, weiteren
Pinselfamilien, Shift-Rad, gekipptem Atlas, PNG und frischem Prozess bei 125 %.
Die Prozesse 3142676 und 3143295 endeten normal und verschwanden. Das ist
Bedien-/Wiederaufnahmeprüfung, keine gestalterische Abnahme des Testreliefs.

Baseline-PID 3136793, neue gezielte Probe 3142258 und Weltprobe 3141117 endeten
normal mit Code 0, ihre Prozesse verschwanden, keine Rendererfehler.

Die vollständige gemischte Welt, das 60-FPS-Ziel, die erste tatsächliche
Pinseländerung binnen 100 ms, das Speicherplateau und die Zielhardware
Pentium Gold 7505 / Intel UHD bleiben offen. Die synthetische Weltprobe und
der rechteckige Referenzraum der Eingabeprobe ersetzen weder Fantasygestaltung
noch den vollständigen Autorenablauf.
