# Beitragen

Beginne mit den [Produktzielen](docs/PRODUCT.md) und der [Roadmap](docs/ROADMAP.md). Der gemeinsame Integrationsbranch ist `active/installed-phase1`. [AGENTS.md](AGENTS.md) gilt für automatisierte Arbeit; Schutz vorhandener Daten, Quellenbindung und unabhängiger Review gelten auch für die hier beschriebenen Beiträge.

## Eine Aufgabe finden

- [Einstiegsaufgaben](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22): kleine, abgegrenzte Beiträge mit eigener Abnahme.
- [Beiträge gesucht](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22): dort zunächst den gewünschten Scope und bestehende Owner prüfen.
- [Aktueller kritischer Pfad](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues?q=is%3Aissue+is%3Aopen+label%3A%22kind%3Atask%22+label%3A%22priority%3Anow%22).
- [Offene PRs](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pulls): Review vorhandener Arbeit kann den nächsten Nutzerablauf schneller entsperren als ein neuer Branch.

`kind:coordination` kennzeichnet Bereichsindizes; sie sind keine kleinen Übernahmeaufgaben. `kind:process` betrifft Arbeitsabläufe. Aufgaben mit `status:blocked` brauchen zuerst den im Text benannten Eingang. `priority:next` wird nach seinen Abhängigkeiten bearbeitet. Keine automatisierte Zuweisung fremder Personen: vor Implementierung im Aufgabenissue kurz Scope, bestehenden/gewünschten Branch und nächsten Reviewpartner abstimmen.

## Änderung vorbereiten und liefern

1. Aktuellen Branch, offene PRs, Remote-Branches und die Paketkoordination in [#1](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1) prüfen. Einen bereits besessenen Lauf gezielt unterstützen; keinen Doppel-Kandidaten eröffnen.
2. `git fetch origin`; einen neuen eigenen Branch von `origin/active/installed-phase1` erstellen. Aktuelle Dateien, relevante `checkpoint.json`-/`acceptance.json`-Einträge und `ARCHITECTURE.md` lesen.
3. Ein zusammenhängendes, begrenztes Ergebnis umsetzen. Quellen nach `src/`, Tests nach `tests/`, wiederverwendbare Hilfen nach `tools/`. Nur eigene Checkpoint-/Abnahmewurzeln aktualisieren; fremde Kennungen und Nachweise erhalten.
4. Prüfen: Dokumentation durch JSON-, Verweis- und Diffprüfung; Produktcode durch `npm run check`, `npm test`, `npm run build` und passende Regressionen. Tatsächlich ausgeführte Checks mit Ergebnis berichten. Host- und Originalabnahmen nur nach entsprechendem Lauf behaupten.
5. Unmittelbar vor Veröffentlichung erneut fetchen und eingegangene Änderungen integrieren. Nur eigene zusammengehörige Änderungen committen/pushen, veröffentlichten Verlauf erhalten. Remote-Commit mit dem lokalen Commit vergleichen.
6. PR gegen `active/installed-phase1` öffnen: Nutzerproblem und Ergebnis, Aufgabe, Abhängigkeiten, relevante Checks und verbleibende Abnahmegrenzen. Unabhängiger Review vor Integration; keine Selbstfreigabe. Der PR-CI-Workflow prüft den exakten Headcommit.

Bei einer komplexen Fachphase gelten die getrennten Plan-/Umsetzungs-/Review-/Nachbesserungs-/Aufräumläufe aus AGENTS.md und dem jeweiligen Fachplan. Eine kleine Korrektur braucht keine neue konkurrierende Produktroadmap.

## Hosttests und Belege

Für einen manuellen Einstieg die [README](README.md) verwenden. Nur isolierte Testvaults und synthetische/eigens freigegebene Testdaten benutzen. Vor echtem Hostlauf den einzelnen GUI-Slot im zuständigen Bereich koordinieren. Große QA-Dateien und Rohprotokolle gehören außerhalb des Nutzervaults nach `/home/aaron/.cache/dungeon-native-qa/`; diese lokalen Pfade sind auf einem anderen Rechner nicht automatisch zugänglich.

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
