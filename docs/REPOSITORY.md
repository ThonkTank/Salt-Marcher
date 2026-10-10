# Das Repository übersichtlich halten

Die Ordnung wird im Arbeitspaket gepflegt. Paketowner ist die im Aufgabenissue benannte Agent-/Ownerrolle; Integrationsowner ist der in #12 benannte Steward des gemeinsamen Kandidaten. Nutzerauftrag und erteilte Freigaben haben Vorrang.

## Ein verbindlicher Ort je Information

| Information | Verbindlicher Ort | Pflegeanlass / Zuständigkeit |
| --- | --- | --- |
| Produktziele und Umfang | [PRODUCT](PRODUCT.md), Details in [SCOPE](SCOPE.md) | Bestätigte Zieländerung samt Quellenzuordnung übernehmen |
| Lieferfolge und gemeinsame Entscheidung | [ROADMAP](ROADMAP.md), Issue #12 | Integrationsowner bei geändertem kritischem Pfad oder Gate |
| Aufgabe, Besitz, Abhängigkeit | Konkretes GitHub-Issue und PR | Paketowner bei Übernahme, Blockerwechsel und Abschluss |
| Aktueller Ausführungsstand | Eigene Wurzel in `checkpoint.json` | Paketowner ersetzt seinen Laufstand nach dem Paket; fremde Wurzeln erhalten |
| Fachliche Abnahme | `acceptance.json` | Fachowner bindet direkten Nachweis; fehlende Evidenz bleibt offen |
| Architekturentscheidung | `ARCHITECTURE.md` | Owner der angenommenen Entscheidung; frühere Begründung erhalten |
| Fachvertrag / Paketplan | Bestehender Fachort, neue Pläne unter `docs/plans/<bereich>/` | Paketowner pflegt Verweis und Ablösung |

README und CONTRIBUTING sind Einstiege, [INDEX](INDEX.md) ist die Bereichskarte, das [Fachplanregister](reference/PLAN-REGISTER.md) optionale Vertiefung. Sie verlinken Aufgaben statt deren Laufberichte zu kopieren. `npm run context` liefert begrenzten Checkoutkontext; aktuelle Kandidaten und datierte Belege bleiben unterscheidbar. Issue #1 ist der Paketindex, #6–#11 sind Bereichskoordination, #12 führt bereichsübergreifende Entscheidungen. Keine zweite Live-Aufgabenliste oder tägliche Statuschronik anlegen.

## Selbstorganisation ohne zentrale Zuweisung

Zuerst vorhandene Produktarbeit fertigstellen oder ihren konkreten Engpass lösen; `npm run next` zeigt Engpässe und freie Aufgaben. [WORKFLOW](WORKFLOW.md) bestimmt sinnvolle Paketgrenzen. Zugriff und Fähigkeiten müssen zur Aufgabe passen.

| Anlass | Handlung im bestehenden Aufgabenissue / PR |
| --- | --- |
| Übernahme | Neueste Claims und PRs prüfen; Agent/Rolle, Scope und Branch/Basis nennen, soweit noch nicht eindeutig. `status:ready` durch `status:active` ersetzen. Der erste eindeutige, nicht zurückgegebene Claim gilt; spätere Contributors unterstützen oder vereinbaren getrennte Scopes. Assignees desselben Accounts reichen nicht. |
| Blocker | Fehlenden Eingang und zuständigen Empfänger nennen; `status:blocked` und gegebenenfalls GitHub-Abhängigkeit pflegen. Nach Lieferung neu bewerten. Eine aktive Aufgabe kann blockiert sein. |
| Reviewbedarf | Offene Reviewerrolle und Prüfgrenze im vorhandenen PR anbieten, bei Bedarf `help wanted`. Contributor übernimmt dort selbst; exakten Commit binden. Vereinbarter unabhängiger Reviewer ist ein anderer als der Autor. Besessene Prüfung und Hostslot erhalten. Der Implementierungsbesitz bleibt aktiv. |
| Übergabe | Ergebnis, tatsächlichen Beleg, offene Grenze und nächsten Eingang/Empfänger nennen. Haupttext auf den aktuellen nächsten Schritt bringen; benötigte Details verlinken. |
| Abschluss | Vereinbartes Ergebnis belegen, Issue schließen und Arbeitsstatuslabels entfernen. Parentverweise und abhängige Aufgaben nachziehen; nur tatsächlich ausführbare freie Nachfolger als `status:ready` anbieten. Ein Teilabschluss schließt kein Produktgate. |
| Integration | Eigene Checkpoint-/Abnahmeänderung und Dokumentationsdelta mitliefern. Integrationsowner zieht nur den geänderten Lieferfokus in ROADMAP/#12 und gegebenenfalls README nach. |

`kind:task` bezeichnet ein Ergebnispaket, `kind:coordination` einen Bereichsindex, `kind:process` Arbeitsabläufe. `priority:now` bezeichnet den aktuellen Produktengpass, `priority:next` die Folgearbeit; beide vergeben keinen Besitz. `status:ready` ist frei und ausführbar und darf weder aktiv noch blockiert sein.

Bestätigte unbesetzte Restbedarfe kann jeder Contributor im Parentissue zu ausführbaren Ergebnispaketen machen: konkreter Nutzen/Verbraucher, Quellen, Voraussetzungen und Abnahme. Eine leere freie Liste rechtfertigt keine Beschäftigungsaufgabe. Ein Claim verfällt nicht durch Zeitablauf; mit dem Owner Ergebnis, Blocker oder Rückgabe klären, keinen konkurrierenden Kandidaten eröffnen. Zusätzliche Heartbeats oder automatische Schließungen sind nicht vorgesehen.

Bereichsfragen im Fachissue klären; bereichsübergreifende Konflikte in #12 mit Optionen und Entscheidungsbedarf. Den Nutzer bei offenen Produktzielen/Nutzerentscheidungen einbeziehen; Routineverteilung organisiert das Team selbst. Fachabnahmen behalten ihre direkten Nachweise.

## Kommunikation nach Inhalt und Anlass

**Melden, wenn sich Ergebnis, Blocker, Besitz oder Entscheidungsbedarf ändert.** Die Länge folgt dem Inhalt: eine Routineübergabe braucht meist wenige Sätze; ein komplexer Fehler- oder Abnahmenachweis darf ausführlich sein.

- **Übernahme:** Rolle übernimmt Scope auf Branch/Basis. Nur Abweichungen von den bereits beschriebenen Voraussetzungen/Prüfungen ergänzen.
- **Übergabe:** Beobachtbares Ergebnis oder konkreter Blocker → Commit/Beleglink und offene Grenze → nächster Empfänger/Schritt.
- **Entscheidung:** Konkrete Frage, relevante Optionen und Belege, Entscheidung mit Geltungsbereich. Ungeklärte Punkte ausdrücklich offen lassen.

Die vollständige Übergabe steht einmal am Aufgabenissue/PR. Im Bereichsindex genügt der geänderte Eingang mit Link; #12 braucht nur Änderungen am gemeinsamen Produktpfad oder Gate. Keine identischen Vollberichte, wiederholten Regeltexte oder Meldungen ohne Änderung. Lange Logs, Hashlisten und Prüftabellen gehören an den bestehenden Fach-/Evidenzort und werden verlinkt. Ein Haupttext zeigt Scope und nächsten Schritt mit datiertem Beleg; Kommentare dokumentieren Verlauf. Veraltete Anweisungen im Haupttext ersetzen, frühere Belege erhalten.

## Wo neue Dateien hingehören

- `src/`: Produktcode; `tests/`: gezielte Tests und kleine synthetische Fixtures; `tools/`: wiederverwendbare Werkzeuge mit dokumentiertem Aufruf.
- `docs/`: Anleitungen und begründete Quellzuordnungen; jede Markdown-Datei ist über INDEX erreichbar, direkt oder über eine verlinkte Anleitung.
- `docs/plans/<bereich>/`: vorhandenen passenden Plan fortführen; eigene neue Plandatei nach [Vorlage](templates/PACKAGE-PLAN.md) nur bei hilfreichem Vertrags-/Quellenumfang. Für Routinearbeit genügt Issue/PR.
- Große QA-Dateien und Rohprotokolle bleiben am bestehenden QA-Ort außerhalb des Nutzervaults; prüfbare Identität, Hash und Zugriffsvoraussetzung im Repository angeben.

Extern referenzierte Root- und Kandidatenpfade bleiben kompatibel; [repository-policy.json](repository-policy.json) hält diesen festen Bestand. Keine neuen Root-Markdown-Dateien oder Bestandserweiterung zur Umgehung der Prüfung. Notwendige Strukturänderungen führen betroffene Verweise und Übergänge mit.

## Pläne ablösen und alte Verweise erhalten

Neue Pläne nennen Bereich, Ownerrolle, Issue, Dokumentstatus und eigene Checkpointwurzel. `complete` meint das Paketdokument, keine Produktabnahme; `superseded` nennt den Nachfolger. Alten Plan und Indexverweis kennzeichnen, aktuelle Aufgabe auf den Nachfolger richten. Historische IDs und Belege erhalten; extern referenzierte Dateien nur mit ihren Verweisen und Übergängen verschieben.

## Was automatisch geprüft wird

- `npm run check:repo`: offline Verweise/Anker der Einstiege und `docs/`, Indexerreichbarkeit, Rootbestand, neue Planmetadaten und Quellenregister. Historische Quellenhashes gelten für ihren Snapshot; alte Fachtexte mit privaten QA-Pfaden sind nicht vollständig linkgeprüft.
- `npm run test:repo`: gezielte Tests dieser Regeln. Strukturprüfung läuft in PR-CI und bei Push auf Shared.
- `npm run audit:backlog`: mit GitHub-Zugriff ausschließlich lesend widersprüchliche Statuslabels erkennen; keine Zuweisung oder Fachentscheidung.

Diese Prüfungen beweisen keine sachliche Aktualität, sinnvolle Priorität oder Produktabnahme; dafür bleiben die Owner zuständig. CI meldet Verstöße. Branchschutz konnte mit dem aktuellen Zugriff nicht eingerichtet oder verifiziert werden.
