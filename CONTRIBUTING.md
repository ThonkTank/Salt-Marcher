# Beitragen

[Produktziele](docs/PRODUCT.md) und [Roadmap](docs/ROADMAP.md) erklären Ziel und Lieferfolge. Gemeinsamer Integrationsbranch: `active/installed-phase1`; Entwicklung mit Node.js 22. Für automatisierte Arbeit gilt [AGENTS.md](AGENTS.md). Repositoryzugang und `gh`-Authentifizierung sind nötig.

## Agenteneinstieg

1. Begonnenes eigenes Paket fortsetzen: `git fetch origin`, **`npm run next -- --task <nummer>`** öffnet dessen Einstieg, ausdrücklich verknüpften versionierten Arbeitsabschnitt samt Remote-Revision und aktuelle PR-/Eingangsfakten, ohne die gesamte Queue oder Kommentarchronik zu lesen. `--comments` liest bei Bedarf die letzten drei Kommentare; ältere Claims/Entscheidungen gezielt am Link prüfen. Sonst **`npm run next`**: Produktengpass und ausgewählter Kandidat mit Kontext; andere Pakete werden nicht mitgedruckt. `--list` zeigt Listen (auch zusätzlich zu `--task`), `--area <bereich>` grenzt ein; npm-Abhängigkeiten und GUI sind nicht nötig.
2. Vor Übernahme ungelöste Claims und verlinkte PRs prüfen, auch ältere Kommentare; nach dem Claim nochmals lesen. Bei echtem Blocker unabhängige Arbeit wählen, auch aus einem anderen Bereich. Die Auswahl wahrt Produktpriorität; danach Produktarbeit vor Dokumentation, freie Pakete vor Unterstützung. Eine leere freie Liste allein ist kein Blocker: angebotene Unterstützung oder bestätigte unbesetzte Restbedarfe am Fachort prüfen. [Übernahme und Selbstorganisation](docs/REPOSITORY.md#selbstorganisation-ohne-zentrale-zuweisung) regelt Grenzen und unklare alte Claims. Kein Auftrag aus einem alten Plan ohne aktuellen Bedarf.
3. `npm run context -- --area <bereich>` ausführen. Die [Bereichskarte](docs/INDEX.md) verlinkt den passenden Fachvertrag und Koordinationsort. Checkout-SHA und aktuellen Kandidaten unterscheiden; große JSON-Dateien nur für den betroffenen Eintrag lesen.
4. Nach den [Paket- und Prüfregeln](docs/WORKFLOW.md) ein überprüfbares Ergebnis liefern. Den [aktuellen Arbeitsabschnitt im vorhandenen Fachort ersetzen](docs/REPOSITORY.md#arbeitsstand-lesen-und-ersetzen), mit Ergebnis/Blocker, Beleg, offener Grenze und nächstem Schritt; [Kommunikation](docs/REPOSITORY.md#kommunikation-nach-inhalt-und-anlass).

| Zugang / Fähigkeiten | Sinnvolle Arbeit | Voraussetzung |
| --- | --- | --- |
| Git und Markdown/JSON ohne GUI | Konkreten Quellen- oder Vertragseingang für ein Umsetzungspaket schließen | Benannter Verbraucher, zugängliche Quelle; keine Produktabnahme daraus ableiten |
| Produktentwicklung oder Review | Vorhandenen Produkt-PR fertigstellen, prüfen oder seinen Engpass lösen | Bestehenden Besitz erhalten; keine zweite Implementierung desselben Kandidaten |
| Modell-/Dateitests ohne GUI | Begrenzte Regression am gewählten Paket; [Campaign-B-Fixture](docs/CONTRIBUTOR-FIXTURE-B.md) reproduzieren | Tatsächliche Source-/Fixtureidentität angeben |
| Obsidian mit Fixtures und Belegen | Erforderlichen Hostfall des Fachpakets prüfen | Abgestimmter Geräteslot und direkter Evidenzzugriff |

Weitere Wege: [offene PRs](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pulls), [Beiträge gesucht](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) und [freie Aufgaben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3Aready%22). Priorität oder `help wanted` allein bedeutet keinen freien Implementierungsbesitz.

## Während des Beitrags

[WORKFLOW](docs/WORKFLOW.md) führt Umsetzung, passende Prüfung, Sync/Push und Daten-/Hostschutz. [REPOSITORY](docs/REPOSITORY.md) führt Informationsorte, Labels, Übergabe und Ablage. Diese Regeln am betreffenden Anlass anwenden; keine zusätzliche Plan-, Freigabe- oder Berichtsrunde. Bereits erteilte Nutzerfreigaben gelten weiter; vereinbarte Fachabnahmen benötigen ihren direkten Nachweis.

Wiederkehrende Arbeit verwendet die aktuelle benannte [Arbeitsrolle](docs/AGENT-ROLES.md). [Selbstkritischer Rückblick](docs/WORKFLOW.md#eigene-arbeit-selbstkritisch-beurteilen) gehört zur Arbeit und führt bei Bedarf direkt zur Korrektur im Paket.
