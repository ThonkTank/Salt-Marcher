# Den passenden Arbeitskontext finden

[Produktziele](PRODUCT.md) → [Lieferfolge](ROADMAP.md) → [Aufgabe übernehmen](../CONTRIBUTING.md#agenteneinstieg). Aktuelle Übernahmen und Gateentscheidungen stehen in [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12) und dem gewählten Aufgabenissue, einschließlich der neuesten relevanten Kommentare.

## Nur den eigenen Bereich lesen

`npm run context` zeigt die Bereiche. `npm run context -- --area atlas` liefert einen begrenzten Checkpointauszug mit Checkout-SHA, Fachplan und Abnahmewurzeln. Er beschreibt diesen Checkout; ein Kandidat oder neuer Ownerbeleg kann weiter sein. `npm run context -- --case HEX01-001` sucht eine exakte Fallkennung; bei einer unbekannten Kennung werden keine ähnlich benannten Fälle als Treffer ausgegeben.

| Bereich / Kontextschlüssel | Fachvertrag | Koordination |
| --- | --- | --- |
| `atlas` | [Hex-Atlas](../ROADMAP-HEX-ATLAS.md) | [#7](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/7) |
| `city` | [Stadt](../ROADMAP-CITIES.md), [Umsetzung](../ROADMAP-CITIES-IMPLEMENTATION-PLAN.md) | [#7](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/7) |
| `dungeon` | [Parität](../ROADMAP-PARITY.md), [Werkzeugfolge](../ROADMAP-PARITY-TOOLS.md) | [#8](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/8) |
| `gm` | [GM-Produkttest](../ROADMAP-GM-PRODUCT-TESTING-PLAN.md) | [#8](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/8) |
| `catalog` | [Katalog und Encounter](../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md) | [#9](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/9) |
| `campaign` | [SaltMarcher-Portfolio / SMR-01 bis SMR-09](../ROADMAP-SALTMARCHER-REPLACEMENT.md) | [#10](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/10) |
| `runtime` | [Party / LiveSession im Portfolio](../ROADMAP-SALTMARCHER-REPLACEMENT.md) | [#6](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/6) |
| `platform` | [Plattform-ADR](../ROADMAP-SALTMARCHER-PLATFORM-ADR.md) | [#11](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11) |
| `repository` | [Pflegevertrag](REPOSITORY.md) | [#1](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1) |

## Vertiefung bei konkretem Bedarf

- Vollständiger Zielumfang: [SCOPE](SCOPE.md), [gepinnte Quellen](scope-sources.json), [Gatekatalog](../ROADMAP-E2E-GATES-CANDIDATE.md).
- Erweiterter räumlicher Dungeon: [3D-/Room-/Path-/Passage-Coverage](plans/dungeon/smr04-spatial-coverage.md) für die Abgrenzung heutiger 2D-Grundlagen und fehlender SMR-04-Folgepakete.
- Architektur: [ARCHITECTURE](../ARCHITECTURE.md); anhand der betroffenen Entscheidung lesen.
- Ausführung und Abnahme: [checkpoint.json](../checkpoint.json) und [acceptance.json](../acceptance.json). Mit `context` gezielt auswählen; alte Top-Level-Felder sind kein Gesamtproduktstatus. `--full` gibt den gewählten Eintrag vollständig aus.
- Veröffentlichung, Fachphasen und Hostschutz: [Arbeitsregeln](WORKFLOW.md).
- Wiederkehrende Contributor-/Pflege-/Berichtsaufträge: [Arbeitsrollen](AGENT-ROLES.md); gemeinsame Regeln bleiben im Einstieg und Pflege-/Arbeitsvertrag.
- Synthetische Fixtures ohne GUI: [Campaign B reproduzieren](CONTRIBUTOR-FIXTURE-B.md).
- Atlas-Save-/Hostkontext: [Arbeitsort und Verwendung der historischen Laufbelege](../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md). Gepinnte Belege nur für den betroffenen Fall lesen: [H02-Rohbelege und Buildprovenienz](reference/atlas-host-h02/H02-PROVENANCE.md); [ursprüngliche Save/Fresh/Recovery-Belege](reference/atlas-host-save-i02-h01/SAVE-PROVENANCE.md); [Orts-Save H01](reference/atlas-shared-location-h01/README.md), [D01-Ursache](reference/atlas-shared-location-d01/README.md), [R01-Reparatur](reference/atlas-shared-location-r01/README.md), [damalige Komposition mit Shared315f09b](reference/atlas-shared-location-r01/composition.json), [N02-No-op-Save](reference/atlas-shared-location-r01/noop-repair.json), [Shared-Ort/Key H02: echter Save und frischer Prozess](reference/atlas-shared-location-h02/README.md). Ihre damaligen nächsten Schritte sind keine aktuellen Aufträge.
- Bestehende Detailpläne und historische Pakete: [Fachplanregister](reference/PLAN-REGISTER.md). Keine Pflichtlektüre beim Einstieg; stabile Pfade bleiben erhalten.
- Attribution: [NOTICE](../NOTICE.md), [SRD](../src/features/catalog/SRD-5.1-ATTRIBUTION.md), [Items](../src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md).
- Neue Paketpläne: [Vorlage](templates/PACKAGE-PLAN.md), unter `docs/plans/<bereich>/` ablegen und von hier oder dem Fachplanregister erreichbar machen. `npm run check:repo` prüft die Verweise.

Große native Rohbelege liegen häufig auf dem Rechner des Prüfers. Ein historischer absoluter Pfad bestätigt keinen eigenen Zugriff; fehlenden Zugriff und offene Abnahme ausdrücklich nennen.

- Manuelle GM-Sessionplanung: [Implementierung und Campaign-Speicheranschluss](plans/campaign/manual-session-planner.md) zu #69.
