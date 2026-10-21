# Wald bleibt beim Wechsel zum Dorfmaßstab verfügbar

21.10.2026, normales Electron-Atlasfenster aus dem Repository. Ausgangsbasis:
`7994d76085d00df2a56b70febcf2b480cb76e0d3`; die nachstehende lokale Korrektur
war bei der nativen Prüfung noch uncommitted. [Quell- und Artefakthashes,
Ansichten, Prozessabschluss](native.json) binden den tatsächlichen Prüfstand.

## Reproduktion und Änderung

Ein großflächiger Wald wird von 80 km über 6 km und 1,2 km auf 300 m
Ausschnittsbreite gezoomt. Der normale Atlas puffert doppelte Breite und Höhe.
Bei 1,2 km Breite überspringt die Vegetation ihre Detailgrenze von 24.000
Kandidaten. `generateVegetation` warf dann einen Fehler; der Bereichsreader
verwarf die ganze Landschaftsschicht. Höhen und Bodenfarbe blieben sichtbar,
Wege und Baumgeometrie fehlten: [vorher](before-village.png).

Die natürliche Verteilung wählt jetzt vor Geländeabfragen so lange die nächste
übergeordnete Rasterstufe, bis höchstens 24.000 Kandidaten einschließlich der
Randzellen geprüft werden. Die bestehende Hierarchie behält weltfeste IDs und
Positionen. Bei zusammengefassten Stufen entfällt Unterwuchs. Geschützte Objekte
laufen weiterhin unabhängig durch ihren bisherigen Pfad. Autorenbestände und
History werden nicht verändert. Die vorhandene Bytebegrenzung und ihre
Rasterübersicht bleiben bestehen.

## Nachweise und Grenzen

- [25 gezielte Tests](tests.log): inklusive gepuffertem Kontinentwald,
  Detail-/Übersichtsidentitäten, geschütztem Baum, unverändertem Autorenstand,
  Quellenzaun und begrenzter Antwortgröße. Außerdem Auswahl und Ausblendung.
- `npm run check`, `npm run check:desktop`, `npm run build:desktop` bestanden.
- [Native Probe](../../../tools/test-desktop-forest-style.mjs): echter Hauptatlas,
  Mausrad über vier Maßstäbe, Neigen derselben Canvas, native PNG-Ausgabe,
  frisches Öffnen der Datenbank und Vergleich sämtlicher Landschaftszeilen.
  Fünf Ansichten ohne Landschaftsfehler; normaler Exit 0, PID beendet,
  keine Rendererfehler. [Dorfmaßstab danach](after-village.png),
  [geneigte Hauptkamera](tilted.png).
- Die erste Vergleichsprobe prüfte nur Canvas-/Terrainbereitschaft und übersah
  den Landschaftsfehler. Ihr früheres `result.json` ist deshalb kein Nachweis
  einer gesunden Landschaft. Die Probe prüft jetzt ausdrücklich die sichtbare
  Landschaftsfehlermeldung; die Readerregression prüft den vollständigen Layer.

**Kein gestalterischer Abschluss:** Die Rasterübersicht ist grob, die
Waldflächen sind gleichförmig und Kronen im Nahbereich noch stark facettiert.
In den Überblicksbildern erscheinen Punkte außerhalb der sichtbaren Waldfläche;
deren Zuordnung zwischen Objektbild und Terrain muss separat geklärt werden.
Diese Korrektur belegt das Ende des Landschaftsausfalls, keine natürliche
Waldgestaltung oder durchgehend verzögerungsfreie Navigation. Keine Paket- oder
Nutzerabnahme und keine der drei geforderten abschließenden Gesamtprüfungen.
