# Beitragen

Beginne mit den [Produktzielen](docs/PRODUCT.md) und der [Roadmap](docs/ROADMAP.md). Der gemeinsame Integrationsbranch ist `active/installed-phase1`. [AGENTS.md](AGENTS.md) gilt für automatisierte Arbeit; Schutz vorhandener Daten und Quellenbindung gelten auch für die hier beschriebenen Beiträge. Aktuelle Nutzeraufträge und bereits erteilte Freigaben haben Vorrang; fachliche Abnahmeanforderungen bleiben am jeweiligen Paket sichtbar.

## Agenteneinstieg

**Arbeitsauftrag:** Lies [#12 und seine neuesten Kommentare](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12) und das Repository, setze den wichtigsten sinnvollen nächsten Schritt für einen nutzbaren Dungeon-Editor um und melde Ergebnis oder konkreten Blocker; beachte [AGENTS.md](AGENTS.md). Produktziele und Roadmap erklären Ziel und Reihenfolge; der aktuelle Aufgaben-/PR-Verlauf entscheidet, was noch offen und bereits besessen ist.

1. `git fetch origin`; gemeinsame Basis, offene PRs und aktuelle Übernahmen prüfen. Die folgenden Befehle geben einen Überblick, ersetzen aber nicht das Lesen des gewählten Issues und seiner letzten Kommentare.
2. Eine Aufgabe passend zu Zugriff und Fähigkeiten wählen. Ohne GUI kannst du Modell-/Regressionstests, Quellenabgleich und begrenzte Dokumentation liefern; native Bedienabnahmen brauchen den tatsächlichen Host. Ein privater QA-Pfad ist keine Voraussetzung für alle Beiträge.
3. Das konkrete freie Paket im Aufgabenissue übernehmen: **Agent/Rolle, begrenzter Scope, Basis-SHA, Branch oder vorhandener PR, geplante Prüfung und nächster Empfänger**. Bei bereits benanntem Owner dessen vorhandene Arbeit unterstützen. Für ein freies, autorisiertes Paket braucht es keine zusätzliche allgemeine Zustimmungsrunde. GitHub-Assignees allein unterscheiden die unter demselben Account arbeitenden Agenten nicht.
4. Relevante Checkpoint-/Acceptancewurzel und Fachplan lesen, ein überprüfbares Ergebnis liefern und mit Commit, Tests und offenen Grenzen übergeben. Eine noch offene Ownerentscheidung als konkreten Blocker ausweisen; außerhalb davon weiterarbeiten.

```bash
gh issue list --repo ThonkTank/Obsidian-Dungeon-Editor-Phase1 --state open --label 'status:ready'
gh pr list --repo ThonkTank/Obsidian-Dungeon-Editor-Phase1 --state open
gh issue view 12 --repo ThonkTank/Obsidian-Dungeon-Editor-Phase1 --json body,comments --jq '{body,comments:.comments[-8:]}'
```

| Deine Umgebung | Sinnvoller Einstieg | Grenze |
| --- | --- | --- |
| Git und Markdown/JSON, Repositoryzugriff; keine GUI nötig | [#46: Trap-Lifecycle auf vorhandene Fachpakete und Abnahmen abbilden](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/46); genaue Quellen, Scope und Abnahme stehen im Issue | Quellenabgleich; offene Zielentscheidungen und Produktabnahmen bleiben offen |
| Weitere Quellen-/Plananalyse ohne GUI | [#44: genau einen offenen Quellen-/Fachpaketpunkt zuordnen](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/44), zunächst den begrenzten Punkt nennen | Offene Zielentscheidungen nicht selbst als entschieden markieren |
| Produktentwicklung oder Review | Aktuellen Owner-/PR-Scope aus #12 und dem Bereichsissue wählen; z. B. vorhandenen PR #13 unterstützen | Kein zweiter Atlas-Kandidat; integrierte/native Abnahme braucht ihren tatsächlichen Lauf |
| Obsidian, passende Fixtures und zugängliche Belege | Bestehenden Hostfall im Fachbereich übernehmen | GUI-Slot auf demselben Gerät abstimmen; bei fehlendem Zugriff präzisen Eingang nennen |

Der gemeinsame Branch enthält noch nicht alle Kandidateneingänge. Campaign B aus PR #37 liegt im PR-13-Kandidaten, nicht automatisch auf Shared. #42 wurde von Chronik abgeschlossen und über PR #45 integriert. Die [fertige Fixture-Anleitung](docs/CONTRIBUTOR-FIXTURE-B.md) pinnt die tatsächliche Kandidatenbasis; sie kann jetzt ohne GUI nachvollzogen werden.

Der lokale Einstieg wurde auf einem frischen Shared-Checkout `321a41c1fa651e6c77f005566ebbafc7080eb960` mit Node 22 geprüft: `npm ci`, Typprüfung, 443 Tests und Build bestanden ohne Obsidian oder private QA-Dateien. Ein gezielter Modelltest lässt sich anschließend so ausführen:

```bash
node --test --test-concurrency=1 --test-name-pattern='^Dungeondraft packages keep image payloads lazy and expose stable assets$' .build/tests.cjs
```

Erwartet: ein bestandener Test. Die synthetische Paketquelle liegt unter `tests/core/pack-fixtures.ts`, der Test unter `tests/core/assets.test.ts`; proprietäre Assetpakete werden dafür nicht benötigt. Nach Quelländerungen zuerst `node build.mjs --test` ausführen, damit das Testbundle aktuell ist. Dieser Lauf bestätigt den Modelltest, keine Original- oder native Hostabnahme.

## Eine Aufgabe finden

- [Frei übernehmbare Aufgaben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3Aready%22): zuerst aktuellen Scope und Kommentare prüfen.
- [Einstiegsaufgaben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22): kleine, abgegrenzte Beiträge mit eigener Abnahme.
- [Beiträge gesucht](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22): dort zunächst den gewünschten Scope und bestehende Owner prüfen.
- [Aktueller kritischer Pfad](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22kind%3Atask%22+label%3A%22priority%3Anow%22).
- [Offene PRs](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pulls): Review vorhandener Arbeit kann den nächsten Nutzerablauf schneller entsperren als ein neuer Branch.

`kind:coordination` kennzeichnet Bereichsindizes; sie sind keine kleinen Übernahmeaufgaben. `kind:process` betrifft Arbeitsabläufe. `status:ready` bezeichnet ein ausführbares, noch unbeanspruchtes Paket; bei Übernahme durch `status:active` ersetzen und den Owner/Scope im Issue nennen. Aufgaben mit `status:blocked` brauchen zuerst den im Text benannten Eingang; bei Lieferung neu bewerten. Ein aktives Paket kann zugleich durch einen konkreten Eingang blockiert sein. `priority:next` wird nach seinen Abhängigkeiten bearbeitet. Keine automatisierte Zuweisung fremder Personen: vor Implementierung im Aufgabenissue Scope, bestehenden/gewünschten Branch und nächsten Empfänger festhalten; Überschneidungen mit dem bestehenden Owner klären.

## Änderung vorbereiten und liefern

1. Aktuellen Branch, offene PRs, Remote-Branches und die Paketkoordination in [#1](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1) prüfen. Einen bereits besessenen Lauf gezielt unterstützen; keinen Doppel-Kandidaten eröffnen.
2. `git fetch origin`; einen neuen eigenen Branch von `origin/active/installed-phase1` erstellen. Aktuelle Dateien, relevante `checkpoint.json`-/`acceptance.json`-Einträge und `ARCHITECTURE.md` lesen.
3. Ein zusammenhängendes, begrenztes Ergebnis umsetzen. Quellen nach `src/`, Tests nach `tests/`, wiederverwendbare Hilfen nach `tools/`. Nur eigene Checkpoint-/Abnahmewurzeln aktualisieren; fremde Kennungen und Nachweise erhalten.
4. Prüfen: Dokumentation durch JSON-, Verweis- und Diffprüfung; Produktcode durch `npm run check`, `npm test`, `npm run build` und passende Regressionen. Tatsächlich ausgeführte Checks mit Ergebnis berichten. Host- und Originalabnahmen nur nach entsprechendem Lauf behaupten.
5. Unmittelbar vor Veröffentlichung erneut fetchen und eingegangene Änderungen integrieren. Nur eigene zusammengehörige Änderungen committen/pushen, veröffentlichten Verlauf erhalten. Remote-Commit mit dem lokalen Commit vergleichen.
6. PR gegen `active/installed-phase1` öffnen: Nutzerproblem und Ergebnis, Aufgabe, Abhängigkeiten, relevante Checks und verbleibende Abnahmegrenzen. Gemäß konkretem Auftrag und geltendem Paketvertrag integrieren; bereits erteilte Nutzerfreigaben nicht erneut erfragen. Wo der Fachvertrag unabhängigen Review verlangt, bleibt dessen Ergebnis erforderlich. Der PR-CI-Workflow prüft den exakten Headcommit.

Bei einer komplexen Fachphase gelten die getrennten Plan-/Umsetzungs-/Review-/Nachbesserungs-/Aufräumläufe aus AGENTS.md und dem jeweiligen Fachplan. Eine kleine Korrektur braucht keine neue konkurrierende Produktroadmap.

## Hosttests und Belege

Für einen manuellen Einstieg die [README](README.md) verwenden. Nur isolierte Testvaults und synthetische/eigens freigegebene Testdaten benutzen. Vor echtem Hostlauf den einzelnen GUI-Slot im zuständigen Bereich koordinieren. Große QA-Dateien und Rohprotokolle gehören außerhalb des Nutzervaults nach `/home/aaron/.cache/dungeon-native-qa/`; diese lokalen Pfade sind auf einem anderen Rechner nicht automatisch zugänglich.

Wer zunächst ohne GUI-Slot einen eingecheckten Beleg nachvollziehen möchte, kann das [Campaign-B-Fixture in einem frischen Checkout reproduzieren](docs/CONTRIBUTOR-FIXTURE-B.md). Die Anleitung trennt den deterministischen Datei-/Modelltest ausdrücklich von einem echten Obsidian-Hostlauf.

Ein Handoff nennt: Branch/Commit, Build, Fixtureversion und Hashes, ausgeführten Ablauf, Datei-/Text-/ID-Orakel, Ergebnis, zugängliche Belegreferenz oder ausdrücklich fehlenden Zugriff, offene Grenzen und nächsten Empfänger. Eine fehlende lokale Evidenzdatei ist kein lokal verifizierter PASS. Synthetische Eingabe, physische Bedienung und ein tatsächlich frischer Hostprozess getrennt ausweisen.

## Wo Fragen und Entscheidungen hingehören

| Thema | Ort |
| --- | --- |
| Produktfolge, bereichsübergreifende Gateentscheidung | [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12) |
| Paketindex und gemeinsame Arbeitskoordination | [#1](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1) |
| Party / LiveSession | [#6](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/6) |
| Atlas / Stadt | [#7](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/7) |
| Dungeon / GM-Test | [#8](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/8) |
| Katalog / Encounter | [#9](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/9) |
| Campaign / Planner / Reise und Consumer | [#10](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/10) |
| Plattform / Recovery / Spielerdisplay | [#11](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/11) |

Neue Aufgaben bekommen eine eigene kleine Beschreibung mit Abnahme und verlinken ihren Bereich. Detaillierte Laufprotokolle gehören in den bestehenden Fachort; im Gesamtindex genügt die Entscheidung oder der Blocker mit Link.
