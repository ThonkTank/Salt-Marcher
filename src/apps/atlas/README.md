# Atlas

Die Atlas-App bündelt die Verwaltung von Gelände- und Regionsdaten in einer eigenen Obsidian-Ansicht. Dadurch bleibt die Library auf dateibasierte Nachschlagewerke fokussiert, während Atlas tabellarische Konfigurationen mit Live-Editing bereitstellt.

## Bedien- und UX-Ziele
- Öffne Atlas über das Karten-Symbol in der Ribbon-Leiste oder den Befehl „Open Atlas“.
- Zwei Tabs stehen zur Auswahl: **Terrains** und **Regions**. Jede Ansicht merkt sich den individuellen Suchbegriff.
- Änderungen an Listen werden automatisch gespeichert; fehlerhafte Eingaben verhindern den Save-Vorgang, bis sie korrigiert sind.

## Datenquellen & Persistenz
- Terrains leben als YAML-Liste in `SaltMarcher/Terrains.md` und werden inkl. Farbe sowie Bewegungsmodifikator verwaltet.
- Regions werden in `SaltMarcher/Regions.md` geführt, inklusive Referenzen auf Terrains und optionaler Encounter-Wahrscheinlichkeiten.
- Beide Renderer beobachten ihre Dateien über `core/terrain-store` bzw. `core/regions-store` und aktualisieren die UI bei externen Änderungen automatisch.

## Tab-spezifische Hinweise
### Terrains
- Inline-editierbare Zeilen für Namen, Hex-Farben und Geschwindigkeit; neue Einträge entstehen über `Create entry` oder leere Zeilen.
- Debounctes Auto-Save (500 ms) schreibt Änderungen zurück; Konflikte werden durch Neuladen aus dem Vault aufgelöst.

### Regions
- Bietet Dropdowns zur Auswahl vorhandener Terrains, nummerische Encounter-Odds sowie ein Suchfeld.
- Änderungen synchronisieren nach jedem Save mit der Terrain-Datei, sodass Referenzen aktuell bleiben.
