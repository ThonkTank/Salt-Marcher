# Beitragen

[Produktziele](docs/PRODUCT.md) und [Roadmap](docs/ROADMAP.md) erklären Ziel und Lieferfolge. Gemeinsamer Integrationsbranch: `active/installed-phase1`; Entwicklung mit Node.js 22. Für automatisierte Arbeit gilt [AGENTS.md](AGENTS.md). Repositoryzugang und `gh`-Authentifizierung sind nötig.

## Agenteneinstieg

1. `git fetch origin` und **`npm run next`** ausführen. Der Befehl zeigt aktuelle Produktengpässe getrennt von freien Aufgaben und den ersten freien Auftrag mit Voraussetzungen, Abnahme und letzten drei Kommentaren. `npm run next -- --list` zeigt die Listen ohne Auftragstext; npm-Abhängigkeiten und GUI sind dafür nicht nötig.
2. Im gewählten Issue die neueste Übernahme und vorhandenen PR prüfen. Freie Arbeit übernehmen oder den bestehenden Owner unterstützen; [Übernahme und Selbstorganisation](docs/REPOSITORY.md#selbstorganisation-ohne-zentrale-zuweisung). Eine leere freie Liste bedeutet keine bestätigte freie Aufgabe: den Engpass in [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12) prüfen, keinen Auftrag aus einem alten Plan ableiten.
3. `npm run context -- --area <bereich>` ausführen. Die [Bereichskarte](docs/INDEX.md) verlinkt den passenden Fachvertrag und Koordinationsort. Checkout-SHA und aktuellen Kandidaten unterscheiden; große JSON-Dateien nur für den betroffenen Eintrag lesen.
4. Nach den [Paket- und Prüfregeln](docs/WORKFLOW.md) ein überprüfbares Ergebnis liefern. Im Aufgabenissue Ergebnis, Beleg und nächsten Schritt übergeben; [Kommunikation](docs/REPOSITORY.md#kommunikation-nach-inhalt-und-anlass).

| Zugang / Fähigkeiten | Sinnvolle Arbeit | Voraussetzung |
| --- | --- | --- |
| Git und Markdown/JSON ohne GUI | Konkreten Quellen- oder Vertragseingang für ein Umsetzungspaket schließen | Benannter Verbraucher, zugängliche Quelle; keine Produktabnahme daraus ableiten |
| Produktentwicklung oder Review | Vorhandenen Produkt-PR fertigstellen, prüfen oder seinen Engpass lösen | Bestehenden Besitz erhalten; keine zweite Implementierung desselben Kandidaten |
| Modell-/Dateitests ohne GUI | Begrenzte Regression am gewählten Paket; [Campaign-B-Fixture](docs/CONTRIBUTOR-FIXTURE-B.md) reproduzieren | Tatsächliche Source-/Fixtureidentität angeben |
| Obsidian mit Fixtures und Belegen | Erforderlichen Hostfall des Fachpakets prüfen | Abgestimmter Geräteslot und direkter Evidenzzugriff |

Weitere Wege: [offene PRs](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pulls), [Beiträge gesucht](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) und [freie Aufgaben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3Aready%22). Priorität oder `help wanted` allein bedeutet keinen freien Implementierungsbesitz.

## Während des Beitrags

[WORKFLOW](docs/WORKFLOW.md) führt Umsetzung, passende Prüfung, Sync/Push und Daten-/Hostschutz. [REPOSITORY](docs/REPOSITORY.md) führt Informationsorte, Labels, Übergabe und Ablage. Diese Regeln am betreffenden Anlass anwenden; keine zusätzliche Plan-, Freigabe- oder Berichtsrunde. Bereits erteilte Nutzerfreigaben gelten weiter; vereinbarte Fachabnahmen benötigen ihren direkten Nachweis.
