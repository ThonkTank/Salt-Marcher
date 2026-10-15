# GM-UX-QA: Verhalten statt Formulierungen vergleichen

Diese Fälle dienen ausschließlich der gezielten Überarbeitung des Skills. Sie sind keine Pflicht für normale QA-Arbeit und aktivieren keine zusätzlichen Agenten. Vergleichsläufe nur im ausdrücklich genehmigten Umfang starten. Der einmalige Pilot vom 15. Oktober 2026 durfte kurzlebige Testagenten verwenden; daraus folgt keine dauerhafte Ausnahme von den Projektregeln.

## Maßstab und Herleitung

Der Skill soll vollständige GM-Aufgaben zu brauchbaren Ergebnissen führen, entscheidende Bedienbelastungen zusammenhängend beheben und die Wirkung ehrlich nachprüfen. Die ältere Fassung verlangt bereits grundlegende UX-Verbesserungen; eine schärfere Wortwahl allein wäre kein belegter Fortschritt.

- Aufgaben vom gewünschten Ergebnis aus formulieren, ohne den Bedienweg vorzugeben: [NN/g: Task Scenarios](https://www.nngroup.com/articles/task-scenarios-usability-testing/).
- Erkennen, Auffinden, Verstehen und Rückmeldung an den entscheidenden Interaktionen untersuchen: [NN/g: Cognitive Walkthroughs](https://www.nngroup.com/articles/cognitive-walkthroughs/). Wiederholte Spielleitungsarbeit zusätzlich betrachten; ein Walkthrough ersetzt keine Nutzerstudie.
- Belastung nach Auswirkung, Wiederholung und Reichweite beurteilen: [NN/g: Severity Ratings](https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/).
- Agentenbeobachtungen nicht als menschliche Nutzerpräferenzen ausgeben: [NN/g: Synthetic Users](https://www.nngroup.com/articles/synthetic-users/).
- Kurze entscheidungsrelevante Anweisungen durch repräsentative Vergleichsfälle überprüfen: [OpenAI: Skills und Prompts](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra), [Anthropic: Skill Authoring](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).

## Vergleich vorbereiten

Die vier kleinen ausführbaren GM-Oberflächen sind kontrollierte Modellfälle. Sie bilden keinen vollständigen Dungeon Editor ab. Alte und neue Fassung auf denselben Aufgaben mit gleichem Modell, denselben Werkzeugen und voneinander getrennten Eingaben und Ergebnissen erproben. Nur der Skill unterscheidet sich. Den Ausgangsstand des alten Skills vor der Bearbeitung sichern; keine Änderung laufender Quellen oder Testfälle während eines Paars.

Die Helfer benötigen Python 3, Node.js, Playwright und einen verfügbaren Chromium-Browser. Vorhandene lokale Laufzeiten verwenden; keine Browserinstallation oder Sicherheitsabschaltung gehört zu diesen Helfern. Pfade lokal auflösen und beiden Varianten gleich bereitstellen.

```sh
PLAYWRIGHT_MODULE="$LOCAL_PLAYWRIGHT_MODULE" CHROME_EXECUTABLE="$LOCAL_BROWSER" \
  python3 tools/agent-setup/evals/gm-ux-qa/prepare.py "$TRIAL_DIR" \
  --baseline "$PREVIOUS_SKILL_FILE" \
  --candidate tools/agent-setup/skills/gm-ux-qa/SKILL.md

PLAYWRIGHT_MODULE="$LOCAL_PLAYWRIGHT_MODULE" CHROME_EXECUTABLE="$LOCAL_BROWSER" \
  node tools/agent-setup/evals/gm-ux-qa/preflight.cjs "$TRIAL_DIR"
```

TRIAL_DIR muss ein neuer Wegwerfpfad außerhalb des Produktcheckouts sein. Der Generator überschreibt keine Versuche. Er erzeugt Fallkopien unter runs/alpha und runs/beta, je einen eingefrorenen zugewiesenen Skill und die Hashes der App-Eingänge. Alpha verwendet die ältere Fassung. Der Vorlauf prüft die Ausgangsprobleme über die UI und hinterlegt die Ausgangsbilder für den Fall mit begrenzten Belegen. Er ist nur vor Agentenläufen auf frischen Kopien auszuführen.

Je Lauf nur den zugewiesenen Skill, TASK.md, TOOLS.md, app.html und gegebenenfalls source-evidence bereitstellen. Pfade und lokale Browserangaben nennen, aber weder dieses Dokument noch fremde Fälle, erwartete Befunde oder Lösungsvorschläge. Keine fremden Hauptchats oder Teständerungen in das Produkt einbeziehen. Erfolgreich ausgeführte Skripte, tatsächliche Ergebnisdateien und passende Screenshots erhalten; RESULT.md genügt als kurzer Bericht.

## Fälle und Bewertung — nicht an Testagenten aushändigen

| Fall | Ausgangslage | Gesuchtes Verhalten |
|---|---|---|
| 01-session | Orte, Personen und Präsentation liegen auf getrennten Wegen; Entwürfe können beim Wechsel verloren gehen. | Die wesentliche Such-/Verwaltungsbelastung zusammenhängend verbessern und Ort, Person, Ortswechsel, aktuelle Präsentation, Fortsetzung und erhaltene Daten prüfen. |
| 02-player-view | Ein ergänzter Präsentationsknopf zeigt gespeicherten statt aktuellen Text, veröffentlicht das GM-Geheimnis und verliert den Rückkehrkontext. | Aktuelle sichere Präsentation und anschließende Fortsetzung mit erhaltenen Eingaben ermöglichen; die Korrektur über den sichtbaren Einzeldefekt hinaus prüfen. |
| 03-limited-evidence | Derselbe Quellstand, aber ausschließlich Code und historische Ausgangsbilder sind freigegeben. | Begründet innerhalb der vorhandenen Belege arbeiten; keine App starten und keine Prüfung der geänderten UI behaupten. |
| 04-working-session | Kontextinformationen am Ort, gespeicherte Änderungen, aktuelle öffentliche Präsentation und passende Rückkehr funktionieren bereits. | Einen brauchbaren Ablauf anerkennen; Änderungen brauchen einen konkreten wesentlichen Befund. |

Die Aufgaben stammen aus den Fixtures, nicht aus dieser Tabelle. Gleichwertige andere Lösungen zulassen und berechtigte zusätzliche Befunde beurteilen. Die Tabelle ist kein vorgeschriebener Umbaukatalog.

Pro Fall **wesentliches Problem**, **zusammenhängendes Ergebnis**, **Wirkungsbelege** und **kalibriertes Urteil** als erfüllt, teilweise erfüllt, nicht erfüllt oder offen bewerten. Belege aus ausgeführten Aktionen, tatsächlichen Änderungen und Ergebnisdateien angeben. Nur Textbehauptungen, Zeilenzahl, Anzahl der Tests oder Wortwahl beweisen keine Verbesserung. Eingesparte Klicks dürfen nicht auf Kosten von Ergebnisqualität, benötigten Fähigkeiten oder Daten gehen.

Resultierende Oberflächen selbst nachprüfen; beim eingeschränkten Fall 03 innerhalb des erlaubten Quellenumfangs bleiben. Alle Paarergebnisse einschließlich Gleichstand und Rückschritt festhalten. Bei Widersprüchen den tatsächlichen Ablauf untersuchen und nur den betroffenen Vergleich wiederholen. Nur beobachtete Schwächen rechtfertigen eine Nachschärfung; danach betroffene Kriterien erneut prüfen. Ergebnisse aus einem Paar je Modellfall sind qualitative Hinweise, kein statistischer Nachweis allgemeiner Überlegenheit oder menschlicher Gebrauchstauglichkeit.
