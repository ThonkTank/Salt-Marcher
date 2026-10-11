# Dungeon-Editor und gemeinsamer GM-Atlas

Ein lokaler Arbeitsraum für Spielleitungen: Karten und Raum-Keys bearbeiten, Kampagnen vorbereiten und zusammenhängend live spielen. Dieses Repository entwickelt den SaltMarcher-Nachfolger. Obsidian Desktop ist der aktuelle Entwicklungs- und Testhost; die endgültige Plattformentscheidung bleibt offen.

**Entwicklungsstand:** Dungeon-Editor und Raum-Keys sind vorhanden; Atlas-, Stadt- und Kampagnenintegration ist teilweise umgesetzt. Das Gesamtprodukt ist noch nicht abgenommen.

## Hier anfangen

- [Atlas auf einen Blick](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick): umgesetzt, fehlend und Weg zum Ziel.
- [Atlas umsetzen](ROADMAP-HEX-ATLAS.md#umsetzungsplan): Oberfläche, Codepakete und Goal-Prompt bis zur vollständigen Atlasabnahme.
- [Produktziele](docs/PRODUCT.md) und [Lieferfolge](docs/ROADMAP.md): vollständiger Funktionsumfang.
- [Dokumentationsindex](docs/INDEX.md): Fachanforderungen und Nachweise.
- [Beitragen](CONTRIBUTING.md) und [AGENTS.md](AGENTS.md): Entwicklung und Arbeitsgrenzen.

## Lokal entwickeln

Node.js 22 und npm verwenden; diese Version entspricht der PR-CI.

```bash
git clone https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1.git
cd Obsidian-Dungeon-Editor-Phase1
git switch active/installed-phase1
npm ci
npm run check:repo
npm run check
npm test
npm run build
```

Der Build erzeugt `main.js` und `main.js.map`. Für einen manuellen Smoke ausschließlich einen separaten Obsidian-Testvault verwenden: `main.js`, `manifest.json` und `styles.css` nach `.obsidian/plugins/dungeon-editor/` kopieren und das Plugin dort aktivieren. Obsidian Desktop mindestens 1.8.7; WebGL-Verfügbarkeit für Grafikprüfungen kontrollieren. Zum Einstieg die Befehle „Dungeon“ bzw. „Atlas“ in der Befehlspalette suchen. Produktive Karten und bestehende Nutzertexte bleiben geschützt. Build oder Push installieren kein Plugin im Nutzervault.

## Repositorykarte

- `src/`: Produktcode und Obsidian-Anschluss.
- `tests/`: automatisierte Prüfungen und synthetische Fixtures.
- `tools/`: Build-, Referenz-, Fixture- und Hostprüfwerkzeuge.
- `docs/` und `ROADMAP-*.md`: Produktziele, Fachanforderungen und direkte Nachweise.
- `ARCHITECTURE.md`: Architekturentscheidungen; `acceptance.json`: Anforderungen und Abnahmen.

Historische Laufstände und Einzelpläne bleiben im Git-Verlauf zugänglich. Quellen- und Datenattribution: [NOTICE.md](NOTICE.md), [SRD 5.1](src/features/catalog/SRD-5.1-ATTRIBUTION.md) und [Itemquellen](src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).
