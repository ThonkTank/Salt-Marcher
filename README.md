# Dungeon-Editor und gemeinsamer GM-Atlas

Ein lokaler Arbeitsraum für Spielleitungen: Karten und Raum-Keys bearbeiten, Kampagnen vorbereiten und später zusammenhängend live spielen. Dieses Repository entwickelt den vollständigen SaltMarcher-Nachfolger. Obsidian Desktop ist der aktuelle Entwicklungs- und Testhost; der endgültige Host wird anhand der Plattformbeweise entschieden.

**Entwicklungsstand:** Dungeon-Editor und Raum-Keys sind vorhanden; Atlas-, Stadt- und Kampagnenintegration wird entwickelt. Das Gesamtprodukt ist noch nicht abgenommen. Ein grüner Testlauf bedeutet keine vollständige Host-, Paritäts- oder Produktfreigabe. Das Repository ist derzeit privat; Beiträge benötigen Repositoryzugang.

## Hier anfangen

| Ich möchte … | Einstieg |
| --- | --- |
| das Ziel und den Lieferumfang verstehen | [Produktziele](docs/PRODUCT.md) und [vollständiger Quellenabgleich](docs/SCOPE.md) |
| sehen, was der Atlas bereits kann und was noch fehlt | [Atlas auf einen Blick: Stand und Weg zum Ziel](ROADMAP-HEX-ATLAS.md#atlas-auf-einen-blick) |
| wissen, was zuerst fertig werden muss | [Produktroadmap und aktueller Engpass](docs/ROADMAP.md) |
| als Agent sofort mitarbeiten | [Agenteneinstieg mit Aufgaben und Voraussetzungen](CONTRIBUTING.md#agenteneinstieg) |
| die nächste freie Aufgabe lesen | `npm run next` (GitHub live, Voraussetzungen und Abnahme im gewählten Issue) |
| eine Aufgabe übernehmen oder reviewen | [Contributor-Leitfaden](CONTRIBUTING.md) |
| einen Fachplan oder einen Nachweis finden | [Dokumentationsindex](docs/INDEX.md) |
| die Ordnung langfristig erhalten | [Pflegevertrag und automatische Strukturprüfung](docs/REPOSITORY.md) |
| die laufende Integration verfolgen | [Gesamtprodukt / Gates #12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12) |

## Aktueller Fokus

Der erste vollständige Nutzerablauf ist **Kampagne → Atlas → Ort/Stadt/Dungeon/Raum-Key → gemeinsames Speichern → frischer Start** (E2E-01). Die [Roadmap](docs/ROADMAP.md) führt seine Lieferkette; [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12) nennt den aktuellen offenen Schritt und dessen Belege. Mit `npm run context -- --area atlas` nur den passenden Checkoutkontext lesen.

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

- `src/`: Produktcode; `src/main.ts` bindet Obsidian an, `src/features/atlas`, `city`, `catalog` enthalten Fachbereiche.
- `tests/`: automatisierte Prüfungen und eingecheckte synthetische Fixtures.
- `tools/`: Build-, Referenz-, Fixture- und Hostprüfwerkzeuge.
- `docs/`: lesbarer Produkteinstieg und Orientierung.
- `ARCHITECTURE.md`: Architekturentscheidungen; `acceptance.json`: Anforderungen und direkte Abnahmen; `checkpoint.json`: bereichseigene Ausführungsstände.
- `ROADMAP-*.md`: bestehende Fach- und Paketpläne, bei Bedarf im [Fachplanregister](docs/reference/PLAN-REGISTER.md) auffindbar. Die alte Root-[ROADMAP.md](ROADMAP.md) dokumentiert den früheren Raum-Key-Lieferweg.

Quellen- und Datenattribution: [NOTICE.md](NOTICE.md), [SRD 5.1](src/features/catalog/SRD-5.1-ATTRIBUTION.md) und [Itemquellen](src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).
