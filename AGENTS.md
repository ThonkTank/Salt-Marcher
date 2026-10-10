# Agenteneinstieg

1. Aktiven Nutzerauftrag und erteilte Freigaben beachten. [Produktziele](docs/PRODUCT.md) und [Lieferfolge](docs/ROADMAP.md) erklären das Ziel; `git fetch origin` und `npm run next` zeigen Produktengpässe, freie Aufgaben und Unterstützung. Eigene Arbeit mit `npm run next -- --task <nummer>` fortsetzen; bei echtem Blocker kompatible unabhängige Arbeit suchen. Vor Beginn Claims/PRs prüfen, nach dem Claim nochmals lesen. Leere `ready`-Liste allein ist kein Blocker. [CONTRIBUTING](CONTRIBUTING.md#agenteneinstieg) beschreibt den Einstieg.
2. `npm run context -- --area <bereich>` und die [Bereichskarte](docs/INDEX.md) verwenden. Nur betroffene Fachverträge, Checkpoint-/Acceptanceeinträge und Architekturentscheidungen lesen. Checkout und Kandidatenhead unterscheiden; historische Top-Level-Felder sind kein Gesamtproduktstatus.
3. Ein zusammenhängendes Nutzerergebnis oder einen konkreten Umsetzungseingang liefern. [WORKFLOW](docs/WORKFLOW.md) bestimmt Paketgrenzen, risikogerechte Prüfung, Veröffentlichung und Hostschutz; diese Regeln ersetzen allgemeine getrennte Plan-/Review-/Aufräumzyklen älterer Pläne. [REPOSITORY](docs/REPOSITORY.md#selbstorganisation-ohne-zentrale-zuweisung) bestimmt Besitz, Übergabe und Informationsorte. Keine doppelte Statuspflege oder zentrale Zuweisung abwarten.

Wiederkehrende Aufträge laden zusätzlich ihre benannte [Arbeitsrolle](docs/AGENT-ROLES.md) vom aktuellen Remote. Gemeinsame Regeln stehen hier und in den verlinkten Verträgen; gespeicherte Startprompts enthalten keine zweite Ablaufkopie. Bei Abschluss/Übergabe und regelmäßigem Wiedereinstieg [eigene Entscheidungen rückblickend prüfen](docs/WORKFLOW.md#eigene-arbeit-selbstkritisch-beurteilen) und nötige Korrekturen im bestehenden Paket ausführen.

## Verbindliche Grenzen

- Kein Legacy-Support. Übernommene Funktionen am entsprechenden Original Dungeondraft/Dungeon Scrawl prüfen; Version, Ablauf, Beleg und Abweichung bei der Abnahme festhalten. Der alte Editor ist nur Inventarhilfe.
- Vor jedem Edit aktuelle Datei lesen. Fremde Änderungen, Kennungen, Belege, Karten und Raumtexte erhalten; nur eigene Checkpoint-/Abnahmewurzeln ändern. Orientierungspflege führt `checkpoint.repositoryOrientation`.
- Aktueller Lauf in `checkpoint.json`, Anforderungen/Nachweise in `acceptance.json`, Architekturentscheidungen in `ARCHITECTURE.md`. Fehlende Abnahme bleibt offen; Testzahlen sind keine Gesamtprozente.
- Neue Dateien nach dem [Pflegevertrag](docs/REPOSITORY.md#wo-neue-dateien-hingehören) ablegen und `npm run check:repo` anwenden. Referenzierte Root-Pfade erhalten.
