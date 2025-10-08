# Salt Marcher Plugin-Bundle

Dieser Ordner entspricht genau dem Inhalt, den Obsidian unter `<Vault>/.obsidian/plugins/salt-marcher` erwartet.

## Installation oder Update
1. Beende Obsidian oder deaktiviere das Plugin im Community-Plugin-Dialog.
2. Lösche ältere Versionen des Ordners `salt-marcher` aus dem Plugin-Verzeichnis.
3. Kopiere `manifest.json`, `main.js` und die restlichen Dateien aus diesem Bundle an dieselbe Stelle.
4. Starte Obsidian und aktiviere „Salt Marcher“ erneut.

## Arbeitsbereiche öffnen
- **Cartographer**: Kompass-Ribbon oder Befehl „Open Cartographer“. Der zuletzt aktive Hex-Map-File wird automatisch geladen.
- **Library**: Buch-Ribbon oder Befehl „Open Library“. Tabs wechseln zwischen Kreaturen, Zaubern, Gelände und Regionen.
- **Encounter**: Wird vom Travel-Modus automatisch geöffnet, kann aber dauerhaft als zweites Paneel fixiert werden.
- **Almanac**: Kalender-Ribbon oder Befehl „Open Almanac (MVP)“. Bündelt Dashboard, Manager und Events für Kalender & Phänomene und synchronisiert den Travel-Fortschritt.

## Datenablage
- Karten und zugehörige Hex-Notizen: `SaltMarcher/Maps/` sowie die automatisch angelegten Hex-Dateien.
- Bibliotheksdaten: `SaltMarcher/Creatures/`, `SaltMarcher/Spells/`, `SaltMarcher/Terrains.md` und `SaltMarcher/Regions.md`.
Bewahre diese Ordner bei Updates, um bestehende Inhalte weiterzuverwenden.
