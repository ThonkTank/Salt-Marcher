# Dungeon-Editor und gemeinsame Kampagnenwerkstatt

Ein lokaler Arbeitsraum für Spielleitungen: Karten und Raum-Keys bearbeiten, Kampagnen vorbereiten und zusammenhängend live spielen. Das Repository enthält die bestehende Obsidian-Integration und einen eigenständigen Desktopkandidaten. Die endgültige Plattformentscheidung bleibt offen.

**Entwicklungsstand:** Dungeon-, Atlas-, Stadt- und Kampagnenfunktionen sind in unterschiedlicher Tiefe umgesetzt. Der dokumentierte Gesamtumfang und die plattformübergreifende Produktabnahme sind noch offen.

## Hier anfangen

- [Produktziele](docs/PRODUCT.md) und [Lieferfolge](docs/ROADMAP.md): vollständiger Funktionsumfang.
- [Atlas auf einen Blick](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick): integrierter Atlasstand und offene Lücken.
- [Dokumentationsindex](docs/INDEX.md): Fachanforderungen und Nachweise.
- [Architektur](ARCHITECTURE.md): aktuelle Grenzen und offene Plattformentscheidung.
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
npm run check:desktop
npm test
npm run build
npm run build:desktop
```

`npm run build` erzeugt das Obsidian-Plugin in `main.js`; `npm run build:desktop` erzeugt den Desktopbuild unter `.build/desktop`.

### Obsidian-Testlauf

Nur einen separaten Testvault verwenden. `main.js`, `manifest.json` und `styles.css` nach `.obsidian/plugins/dungeon-editor/` kopieren, das Plugin aktivieren und in der Befehlspalette „Dungeon“ oder „Atlas“ öffnen. Obsidian Desktop benötigt mindestens Version 1.8.7 und WebGL. Build und Push installieren nichts in einem Vault.

### Desktop-Testlauf

```bash
npm run start:desktop -- --data-dir /tmp/campaign-workbench-smoke
```

Der Desktopkandidat speichert ohne `--data-dir` im lokalen Appdatenordner `CampaignWorkbench`. Er verbindet Kampagnenverwaltung, Vorbereitung, Live-Spiel, Katalog, Gegenstände, Welt/Atlas, Städte, Musik, Dungeonzeichnung und eine getrennte Spieleranzeige. Die Desktopfunktion ist ein Entwicklungsstand; offene Produktlücken und Abnahmen stehen in den Fachplänen.

Quests und Gerüchte können Mitwirkende, Ort, Status, XP und mehrere Gegenstandsbelohnungen tragen. Ihr manueller Abschluss verwendet denselben Verteilungsablauf wie Encounter. Das persönliche Beutebuch kann Mengenstapel teilen, zusammenführen und ausdrücklich an andere Figuren weitergeben.

Ein lokales Linux-x64-Paket entsteht mit:

```bash
npm run package:desktop -- /tmp/campaign-workbench-linux-x64
```

## Repositorykarte

- `src/`: gemeinsamer Produktcode, Obsidian-Anschluss und Desktopoberfläche unter `src/app/`.
- `desktop/`: privilegierter Desktopprozess und schmale Preload-Brücken.
- `tests/`: automatisierte Prüfungen und synthetische Fixtures.
- `tools/`: Build-, Paket-, Referenz-, Fixture- und Hostwerkzeuge.
- `docs/` und `ROADMAP-*.md`: Produktziele, Fachanforderungen und direkte Nachweise.
- `ARCHITECTURE.md`: Architekturentscheidungen; `acceptance.json`: Anforderungen und Abnahmen.

Historische Laufstände bleiben im Git-Verlauf zugänglich. Quellen- und Datenattribution: [NOTICE.md](NOTICE.md), [SRD 5.1](src/features/catalog/SRD-5.1-ATTRIBUTION.md) und [Itemquellen](src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).
