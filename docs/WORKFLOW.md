# Produktarbeit und passende Prüfung

Nutzerauftrag und erteilte Freigaben haben Vorrang. Diese Regeln ersetzen allgemeine getrennte Plan-/Umsetzungs-/Review-/Aufräumzyklen älterer Pläne. Konkrete Produktanforderungen, unabhängige Fachabnahmen und Daten-/Hostschutz bleiben bindend. Besitz und Kommunikation: [REPOSITORY](REPOSITORY.md).

## Sinnvolle Arbeit wählen und begrenzen

- Eigene Produktarbeit fortsetzen; freie Beiträge zum aktuellen Engpass in [#12](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12) haben Vorrang. Ist dessen Scope besessen oder ein benötigter Eingang offen, ein unabhängiges ausführbares Produktpaket aus der [Lieferroadmap](ROADMAP.md#parallele-umsetzung-und-zusammenführung) parallel verfolgen. Ein fremder Engpass oder ein noch offenes Integrationsgate sperrt nicht sämtliche Umsetzung.
- **Ein Paket, ein zusammenhängendes Ergebnis:** etwa Ort anlegen → Key ändern → Undo → speichern → frisch öffnen. Planung, Implementierung, Regressionen, Review, Nachbesserung und Bereinigung gehören ins vorhandene Issue/Branch/PR; mehrere Commits sind möglich. Eng gekoppelte Teil-PRs zusammenführen.
- Nur teilen bei eigenständigem Nutzen, tatsächlich unterschiedlichem Besitz/Eingang oder einer notwendigen unabhängig prüfbaren Risikogrenze. Einzelne Felder, Tests und Reviews sind normalerweise Checklistenpunkte; Parallelisierung allein begründet keine Teilung.
- Hilfsarbeit an Planung, Quellen, Infrastruktur oder Prozessen löst einen **jetzt fehlenden Eingang** eines benannten Umsetzungspakets oder einer anstehenden Entscheidung: Was kann der Verbraucher nach der Lieferung tatsächlich tun, was vorher nicht möglich war? Ein späterer Integrationswunsch allein genügt nicht. Erforderliche vollständige Quellen-/Lizenzgates zählen dazu. Ohne solchen Bedarf bleibt die Arbeit im Backlog; eine leere Liste rechtfertigt keine neue Planarbeit.

Eine technische Teillieferung beendet das Ergebnispaket nicht. Der Paketowner verfolgt die benötigten Beiträge bis zum vereinbarten Nutzerablauf beziehungsweise konsumierbaren Eingang; Fachowner behalten ihren Code-, Vertrags- und Abnahmebesitz. Zwischenstände dürfen einzeln geprüft und integriert werden, während kompatible Umsetzung im selben Paket weitergeht. Eine offene Prüfung sperrt nur die von ihr abhängige Wirkung. Bleibt der nächste Verbraucher nach der Übergabe handlungsunfähig, den fehlenden Anschluss im bestehenden Paket lösen oder als konkreten Blocker mit Empfänger benennen.

## Umsetzung, Review und Abschluss

Ein kurzer Plan im Issue/PR genügt. Eine eigene Plandatei hilft bei komplexen Verträgen/Quellenmatrizen. Review an der lauffähigen Änderung bündeln; vorgezogene Planreviews bei strittigen Daten-/Schnittstellenverträgen oder teuren irreversiblen Entscheidungen. Nachbesserungen nur am betroffenen Befund nachprüfen, ohne zusätzliche allgemeine Aufräumreviewrunde.

Dungeon-Arbeit führt `checkpoint.parityRoadmap`, Hex-Arbeit `checkpoint.hexAtlasExecution`; fremde Wurzeln erhalten. Funktionale Ergebnisse bestimmen [Dungeon-Parität](../ROADMAP-PARITY.md), [Hex-Atlas](../ROADMAP-HEX-ATLAS.md) und die jeweiligen Fachverträge. Eine Plan-/Dokumentationsprüfung erteilt keine Produktabnahme.

## Prüfaufwand nach Änderung und Risiko

| Änderung | Passende Prüfung |
| --- | --- |
| Orientierung, Verweise, Quellenabgleich | `npm run check:repo` und betroffene Quellen-/JSON-/Diffprüfung; keine lokale Vollsuite/Typprüfung/Build bei unverändertem Produkt-/Buildpfad. |
| Offline-Werkzeug | Strukturprüfung und gezielte Werkzeugtests; kein Host-/Großkartenlauf für einen Backlogbefehl. |
| Produkt, Buildpfad, Abhängigkeiten | Typprüfung, Tests und Build einmal am integrierten Stand plus passende Regression. Vorhandene Exact-SHA-CI nutzen; lokal zusätzlich für Diagnose oder fehlende Prüfung. |
| Speicherformat, geschützte Texte/IDs, Recovery, Host-/Kampagnenwechsel, Spielerzugriff | Direkte Fehler-/Erhaltungsfälle sowie unabhängiger Review und tatsächliche Host-/Reopen-/Recovery-Abnahme, soweit der Fachvertrag es verlangt. Gesamtqualifikation bleibt an ihren eigenen Gates. |

Belege gelten für ihre tatsächliche Source-/Build-/Fixtureidentität. Bei unverändertem relevantem Pfad können sie mit Diffnachweis weiter gelten; eine neue SHA allein verlangt keinen neuen GUI-Lauf. Geänderte Pfade, Fixtures, relevante Hostbedingungen, Fehlbefunde oder fehlende Evidenz begründen weitere Prüfung. Reviewer bewerten Belege und Risiken, statt automatisch dieselbe Vollsuite zu wiederholen; Herkunft stets korrekt angeben.

## Fortschritt beurteilen und Schleifen beenden

Fortschritt ist zusätzlicher GM-Nutzen oder ein gelöster Umsetzungseingang, keine Zahl von Commits, Issues, Tests oder PASS-Meldungen. Folgen zwei Übergaben ohne neue Funktion, gelösten Eingang oder notwendigen Befund, den Lauf stoppen und bündeln, umsetzen oder den echten Blocker nennen. Keine zusätzliche Mess-/Berichtsrunde.

Kostet weitere Organisation/Prüfung voraussichtlich mehr als die Änderung, das konkrete Risiko nennen und auf die kleinste ausreichende Prüfung reduzieren; echte Daten-/Sicherheits-/Abnahmegrenzen erhalten. Nach zwei erfolglosen Versuchen oder 45 Minuten an derselben technischen Hypothese anhand der Belege neu entscheiden.

## Eigene Arbeit selbstkritisch beurteilen

Vor größeren Folgeinvestitionen, bei Übergabe/Abschluss und beim ersten Wiedereinstieg eines Arbeitstags kurz auf die eigene jüngste Arbeit zurückblicken. Das gilt für Produktcode, Tests, Pläne, Regeln und Berichte gleichermaßen:

- Welches bestätigte Ziel hat die Arbeit tatsächlich nähergebracht? Wer nutzt das Ergebnis bereits oder benötigt es jetzt?
- Würde ich es mit dem heutigen Wissen wieder so machen? Welche Annahme, alte Anweisung oder lokale Bequemlichkeit hat die Entscheidung geprägt?
- Habe ich hilfreiche Arbeit geliefert oder zusätzliche Schritte, Regeln, Dateien und Prüfungen erzeugt, deren Nutzen unklar bleibt?
- Was sollte ich jetzt vereinfachen, zusammenführen, entfernen, anders umsetzen oder ausdrücklich stoppen?

Die Antwort muss Konsequenzen haben: eine belegte Fehlentscheidung im eigenen Scope korrigieren, unnötige Folgearbeit streichen oder einen konkreten fremden Bedarf dem zuständigen Owner übergeben. Frühere Belege und geschützte Nutzerarbeit erhalten; echte Abnahmegrenzen nicht wegargumentieren. Ungewissheit verlangt den kleinsten hilfreichen Lernschritt. Ein früher grüner Test oder eigener PASS schützt die Entscheidung nicht vor erneuter sachlicher Kritik.

Dieser Rückblick findet innerhalb der Produktarbeit statt. Kein separater Reflexionsauftrag, Fragenkatalogbericht, Score oder Pflichtkommentar; nur geänderte Entscheidung/Ergebnis am vorhandenen Arbeitsort belegen. Bei unverändert tragfähiger Arbeit weiterarbeiten. Die bestehende Produktwertrolle prüft auch die Wirkung ihrer früheren Entscheidungen regelmäßig; die Pflegefunktionen prüfen den Aufwand ihrer eigenen Regeln.

## Veröffentlichen und eingehende Arbeit integrieren

Die bestehende Freigabe umfasst Commit/Push und GitHub-Koordination. Vor Beginn und unmittelbar vor Veröffentlichung Remote/Upstream abrufen und eingehende Arbeit integrieren. Vor neuem Branch Claims, PRs und Remote-Branches prüfen. Geprüften zusammenhängenden Stand veröffentlichen; bei längerer Arbeit spätestens zum täglichen Abschluss einen prüfbaren Zwischenstand sichern.

Nur eigene Änderungen committen; lokale fremde Änderungen sichern und erhalten. Kein Force-Push; Konflikte gezielt integrieren und betroffene Prüfungen wiederholen. Shared: `active/installed-phase1`; tatsächlichen Upstream prüfen und Remote-Commit nach Push bestätigen. Build/Sync/Push installieren kein Plugin im Nutzervault. Übergabe nach dem [Kommunikationsvertrag](REPOSITORY.md#kommunikation-nach-inhalt-und-anlass), ohne Bericht je Commit.

## Hosttests und Schutz

Nur eine Testinstanz pro Gerät, keine parallelen Agenten-/Lasttests und keine anderen Programme schließen. Geräteslot im Bereich abstimmen. Isolierte Testvaults mit synthetischen oder ausdrücklich freigegebenen Daten nutzen; vor Installation aktuellen Produktstand sichern. Karten, Raumtexte und fremde Änderungen erhalten.

Freigabe vom 02.10.: keine festen Speicherlimits/hohe Startreserve; normale Ressourcenverwaltung. Notbremse bei akutem systemweitem Speichermangel: unter 256 MiB verfügbar oder über 50 Prozent Vollspeicherblockade während zwei Sekunden.

Große QA-Dateien/Logs liegen außerhalb des Nutzervaults unter `/home/aaron/.cache/dungeon-native-qa/`. Direkter Beleg: Commit/Build, Fixtureversion/Hashes, tatsächlicher Ablauf, Ergebnis und zugängliche Referenz oder fehlender Zugriff. Synthetische Eingabe, physische Bedienung und frischer Hostprozess unterscheiden. Schutzstopps und Kleinkartenprüfungen gelten nur für ihren Scope; unzugängliche Evidenz ist kein selbst verifizierter PASS.
