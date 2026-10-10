# Beitragen

Beginne mit den [Produktzielen](docs/PRODUCT.md) und der [Roadmap](docs/ROADMAP.md). Der gemeinsame Integrationsbranch ist `active/installed-phase1`. [AGENTS.md](AGENTS.md) gilt für automatisierte Arbeit; Schutz vorhandener Daten und Quellenbindung gelten auch für die hier beschriebenen Beiträge. Aktuelle Nutzeraufträge und bereits erteilte Freigaben haben Vorrang; fachliche Abnahmeanforderungen bleiben am jeweiligen Paket sichtbar.

## Agenteneinstieg

**Arbeitsauftrag:** Lies [#12 und seine neuesten Kommentare](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12) und das Repository, setze den wichtigsten sinnvollen nächsten Schritt für einen nutzbaren Dungeon-Editor um und melde Ergebnis oder konkreten Blocker; beachte [AGENTS.md](AGENTS.md). Produktziele und Roadmap erklären Ziel und Reihenfolge; der aktuelle Aufgaben-/PR-Verlauf entscheidet, was noch offen und bereits besessen ist.

1. `git fetch origin`; gemeinsame Basis, offene PRs und aktuelle Übernahmen prüfen. Die folgenden Befehle geben einen Überblick, ersetzen aber nicht das Lesen des gewählten Issues und seiner letzten Kommentare.
2. Eine Aufgabe passend zu Zugriff und Fähigkeiten wählen. Ohne GUI kannst du Modell-/Regressionstests, Quellenabgleich und begrenzte Dokumentation liefern; native Bedienabnahmen brauchen den tatsächlichen Host. Ein privater QA-Pfad ist keine Voraussetzung für alle Beiträge.
3. Das konkrete freie Paket im Aufgabenissue übernehmen: **Agent/Rolle, begrenzter Scope, Basis-SHA, Branch oder vorhandener PR, geplante Prüfung und nächster Empfänger**. Bei bereits benanntem Owner dessen vorhandene Arbeit unterstützen. Für ein freies, autorisiertes Paket braucht es keine zusätzliche allgemeine Zustimmungsrunde. GitHub-Assignees allein unterscheiden die unter demselben Account arbeitenden Agenten nicht.
4. Den passenden Bereich über `npm run context -- --area <bereich>` auswählen, relevante Checkpoint-/Acceptanceeinträge und Fachplan lesen, ein überprüfbares Ergebnis liefern und mit Commit, Tests und offenen Grenzen übergeben. Eine noch offene Ownerentscheidung als konkreten Blocker ausweisen; außerhalb davon weiterarbeiten.

```bash
gh issue list --repo ThonkTank/Obsidian-Dungeon-Editor-Phase1 --state open --label 'status:ready'
gh pr list --repo ThonkTank/Obsidian-Dungeon-Editor-Phase1 --state open
gh issue view 12 --repo ThonkTank/Obsidian-Dungeon-Editor-Phase1 --json body,comments --jq '{body,comments:.comments[-8:]}'
```

| Deine Umgebung | Sinnvoller Einstieg | Grenze |
| --- | --- | --- |
| Git und Markdown/JSON, Repositoryzugriff; keine GUI nötig | [frei übernehmbare Aufgaben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3Aready%22); genaue Quellen, Scope und Abnahme stehen im gewählten Issue | Quellenabgleich; offene Zielentscheidungen und Produktabnahmen bleiben offen |
| Weitere Quellen-/Plananalyse ohne GUI | [#44: genau einen offenen Quellen-/Fachpaketpunkt zuordnen](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/44), zunächst den begrenzten Punkt nennen | Offene Zielentscheidungen nicht selbst als entschieden markieren |
| Produktentwicklung oder Review | Aktuellen Owner-/PR-Scope aus #12 und dem Bereichsissue wählen; z. B. vorhandenen PR #13 unterstützen | Kein zweiter Atlas-Kandidat; integrierte/native Abnahme braucht ihren tatsächlichen Lauf |
| Obsidian, passende Fixtures und zugängliche Belege | Bestehenden Hostfall im Fachbereich übernehmen | GUI-Slot auf demselben Gerät abstimmen; bei fehlendem Zugriff präzisen Eingang nennen |

Den gewählten Bereich mit `npm run context -- --area <bereich>` auswählen; [Bereichskarte](docs/INDEX.md). Checkout-SHA und aktuelle PR-Heads unterscheiden. Für einen reproduzierbaren Datei-/Modelltest ohne GUI die [gepinnte Campaign-B-Anleitung](docs/CONTRIBUTOR-FIXTURE-B.md) verwenden.

## Eine Aufgabe finden

- [Frei übernehmbare Aufgaben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3Aready%22): zuerst aktuellen Scope und Kommentare prüfen.
- [Einstiegsaufgaben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22): kleine, abgegrenzte Beiträge mit eigener Abnahme.
- [Beiträge gesucht](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22): dort zunächst den gewünschten Scope und bestehende Owner prüfen.
- [Aktueller kritischer Pfad](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22kind%3Atask%22+label%3A%22priority%3Anow%22).
- [Offene PRs](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pulls): Review vorhandener Arbeit kann den nächsten Nutzerablauf schneller entsperren als ein neuer Branch.

`kind:coordination` kennzeichnet Bereichsindizes; sie sind keine kleinen Übernahmeaufgaben. `kind:process` betrifft Arbeitsabläufe. `status:ready` bezeichnet ein ausführbares, noch unbeanspruchtes Paket; bei Übernahme durch `status:active` ersetzen und den Owner/Scope im Issue nennen. Aufgaben mit `status:blocked` brauchen zuerst den im Text benannten Eingang; bei Lieferung neu bewerten. Ein aktives Paket kann zugleich durch einen konkreten Eingang blockiert sein. `priority:next` wird nach seinen Abhängigkeiten bearbeitet. Keine automatisierte Zuweisung fremder Personen: vor Implementierung im Aufgabenissue Scope, bestehenden/gewünschten Branch und nächsten Empfänger festhalten; Überschneidungen mit dem bestehenden Owner klären.

## Änderung vorbereiten und liefern

Nach der Aufgabenwahl die passenden [Arbeitsregeln](docs/WORKFLOW.md) anwenden: eigene begrenzte Änderung, relevante Prüfungen, eingehende Arbeit integrieren, geprüft committen/pushen und mit Beleg/offenen Grenzen übergeben. Bereits erteilte Nutzerfreigaben nicht erneut erfragen; vereinbarte Fachreviews bleiben erforderlich. Build oder Push installieren kein Plugin im Nutzervault.

## Wo Fragen und Entscheidungen hingehören

[#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12): Produktfolge und Gateentscheidungen. [#1](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1): Paketkoordination. Bereichsissues und Fachverträge stehen in der [Bereichskarte](docs/INDEX.md).

Neue Aufgaben bekommen eine eigene kleine Beschreibung mit Abnahme und verlinken ihren Bereich. Detaillierte Laufprotokolle gehören in den bestehenden Fachort; im Gesamtindex genügt die Entscheidung oder der Blocker mit Link.

## Ordnung bei jedem Beitrag erhalten

Der [Repository-Pflegevertrag](docs/REPOSITORY.md) legt Ablage, kanonische Informationsorte und Zuständigkeit fest. Neue Paketpläne liegen unter `docs/plans/<bereich>/` nach der [Vorlage](docs/templates/PACKAGE-PLAN.md) und werden im Index verlinkt. Bei Übernahme, Blockerwechsel und Abschluss Haupttext, Statuslabels und Abhängigkeiten nachziehen; bei Integration einen geänderten Lieferfokus aktualisieren. Kein zusätzlicher Freigabe- oder Meldelauf. `npm run audit:backlog` prüft mit GitHub-Zugriff ausschließlich lesend auf widersprüchliche Statuslabels.
