# Das Repository übersichtlich halten

Paketowner ist die im Aufgabenissue benannte Agent-/Ownerrolle, Integrationsowner der Steward des gemeinsamen Kandidaten in #12. Ordnung und Kommunikation werden im Arbeitspaket gepflegt.

## Ein verbindlicher Ort je Information

| Information | Ort und Pflege |
| --- | --- |
| Ziele / vollständiger Umfang | [PRODUCT](PRODUCT.md) / [SCOPE](SCOPE.md); bestätigte Zieländerung samt Quellenzuordnung |
| Dauerhafte Lieferfolge | [ROADMAP](ROADMAP.md); Integrationsowner bei geändertem Lieferpfad |
| Aktueller gemeinsamer Schritt / Gateentscheidung | Issue #12; Integrationsowner mit direktem Beleg |
| Aufgabe, Besitz, Abhängigkeit | Konkretes Issue/PR; Paketowner bei Übernahme, Blockerwechsel und Abschluss |
| Ausführungsstand | Eigene Wurzel in `checkpoint.json`; aktuellen Lauf ersetzen, fremde Wurzeln erhalten |
| Abnahme | `acceptance.json`; Fachowner bindet direkte Evidenz, fehlender Nachweis bleibt offen |
| Architektur | `ARCHITECTURE.md`; angenommene Entscheidung mit früheren Begründungen |
| Fachvertrag / Paketplan | Bestehender Fachort; neue Pläne unter `docs/plans/<bereich>/` |

README/CONTRIBUTING führen hinein, [INDEX](INDEX.md) ist die einzige Bereichskarte, das [Fachplanregister](reference/PLAN-REGISTER.md) optionale Vertiefung. #1 verweist auf diese Karte; #6–#11 führen Bereichsfragen. Einstiege verlinken statt Laufberichte zu kopieren. Keine zweite Live-Aufgabenliste oder tägliche Statuschronik; `npm run context` ist ausdrücklich Checkoutkontext.

## Selbstorganisation ohne zentrale Zuweisung

`npm run next` zeigt Produktengpässe und freie Arbeit. Zugriff/Fähigkeiten müssen passen; [WORKFLOW](WORKFLOW.md) bestimmt Paketgrenzen und Prüfung.

| Anlass | Änderung am bestehenden Aufgabenissue / PR |
| --- | --- |
| Übernahme | Claims/PRs prüfen, Rolle und Scope mit Branch/Basis nennen, soweit nicht eindeutig. `ready` durch `active` ersetzen. Erster eindeutiger, nicht zurückgegebener Claim gilt; spätere Contributors unterstützen oder vereinbaren getrennte Scopes. Assignees desselben Accounts reichen nicht. |
| Blocker | Fehlenden Eingang/Empfänger nennen; `blocked` und gegebenenfalls GitHub-Abhängigkeit pflegen. Nach Lieferung neu bewerten; aktive Arbeit darf blockiert sein. |
| Reviewbedarf | Offene Rolle/Prüfgrenze im vorhandenen PR anbieten, gegebenenfalls `help wanted`. Reviewer übernimmt dort selbst und bindet exakten Commit. Vereinbarter unabhängiger Reviewer ist ein anderer als der Autor; besessene Prüfung/Hostslot erhalten. Implementierungsbesitz bleibt aktiv. |
| Übergabe | Ergebnis/Beleg und nächsten Schritt in Haupttext/Kommentar nachführen, wie unten beschrieben. |
| Abschluss | Ergebnis belegen, Issue schließen, Arbeitsstatuslabels entfernen; Parent und Abhängigkeiten nachziehen. Nur ausführbare freie Nachfolger als `ready` anbieten. Teilabschluss schließt kein Produktgate. |
| Integration | Eigene Checkpoint-/Abnahmeänderung und Dokumentationsdelta mitliefern; Integrationsowner aktualisiert nur den betroffenen gemeinsamen Lieferpfad. |

Labelnamen tragen `status:`: `ready` ist frei/ausführbar und weder aktiv noch blockiert. `kind:task` meint ein Ergebnispaket, `kind:coordination` einen Bereichsindex, `kind:process` Arbeitsabläufe. `priority:now` meint den Produktengpass, `priority:next` die Folgearbeit; Priorität vergibt keinen Besitz.

Jeder Contributor kann bestätigte unbesetzte Restbedarfe im Parent zu ausführbaren Ergebnispaketen machen: Nutzen/Verbraucher, Quellen, Voraussetzungen, Abnahme. Leere Liste ist kein Grund für Beschäftigungsarbeit. Claims verfallen nicht durch Zeitablauf: Ergebnis, Blocker oder Rückgabe mit dem Owner klären. Keine konkurrierenden Kandidaten, Heartbeats oder automatischen Schließungen.

Bereichsfragen im Fachissue, gemeinsame Konflikte/Entscheidungen in #12. Den Nutzer bei offenen Produktzielen/Nutzerentscheidungen einbeziehen; Routineverteilung organisiert das Team selbst.

## Kommunikation nach Inhalt und Anlass

**Ein vollständiger Bericht am Aufgabenort, sonst nur das relevante Delta mit Link.** Melden bei geändertem Ergebnis, Blocker, Besitz oder Entscheidungsbedarf. Routine meist in wenigen Sätzen; komplexe Fehler-/Abnahmenachweise entsprechend ausführlich.

| Meldung | Nötiger Inhalt |
| --- | --- |
| Claim | Rolle, Scope, Branch/Basis; nur Abweichungen von bereits beschriebenen Voraussetzungen/Prüfungen |
| Übergabe | Beobachtbares Ergebnis oder Blocker → Commit/Beleglink und offene Grenze → nächster Empfänger/Schritt |
| Entscheidung | Frage, relevante Optionen/Belege, Entscheidung mit Geltungsbereich; ungeklärte Punkte offen |

Der aktuelle Haupttext zeigt Scope und nächsten Schritt mit datiertem Beleg; Kommentare bewahren den Verlauf. Regeln und bekannte Voraussetzungen nicht je Lauf wiederholen. Lange Logs, Hashlisten und Prüftabellen an den bestehenden Fach-/Evidenzort verlinken. Bereichsindex nur bei geändertem Eingang, #12 nur bei geändertem gemeinsamen Produktpfad/Gate aktualisieren. Veraltete Anweisungen ersetzen, frühere Belege erhalten; kein Bericht je Commit und keine identischen Vollberichte in mehreren Threads.

## Wo neue Dateien hingehören

- `src/`: Produktcode; `tests/`: gezielte Tests/kleine synthetische Fixtures; `tools/`: wiederverwendbare Werkzeuge mit dokumentiertem Aufruf.
- `docs/`: Anleitungen/Quellzuordnungen, über INDEX erreichbar. Vorhandenen passenden Plan fortführen; neue Plandatei unter `docs/plans/<bereich>/` nur bei hilfreichem Vertrags-/Quellenumfang, nach [Vorlage](templates/PACKAGE-PLAN.md). Routineplan im Issue/PR genügt.
- Große QA-Dateien/Logs: bestehender QA-Ort außerhalb des Nutzervaults; Identität, Hash und Zugriff im Repository dokumentieren.

Referenzierte Root-/Kandidatenpfade bleiben kompatibel; [repository-policy.json](repository-policy.json) führt den festen Bestand. Keine neuen Root-Markdown-Dateien oder Erweiterung zur Prüfumgehung. Strukturänderungen führen Verweise/Übergänge mit.

## Pläne ablösen und alte Verweise erhalten

Neue Pläne: Bereich, Ownerrolle, Issue, Dokumentstatus, eigene Checkpointwurzel. `complete` meint das Paketdokument, keine Produktabnahme; `superseded` nennt den Nachfolger. Alten Plan/Index kennzeichnen, aktuelle Aufgabe auf Nachfolger richten. Historische IDs/Belege erhalten; externe Pfade nur mit ihren Verweisen/Übergängen verschieben.

## Was automatisch geprüft wird

- `npm run check:repo`: offline Links/Anker der Einstiege und `docs/`, Indexerreichbarkeit, Rootbestand, neue Planmetadaten, Quellenregister. Alte Fachtexte/private QA-Pfade sind nicht vollständig linkgeprüft; historische Hashes gelten für ihren Snapshot.
- `npm run test:repo`: gezielte Regeltests; Strukturprüfung läuft in PR-CI und bei Shared-Push.
- `npm run audit:backlog`: GitHub-Statuslabels ausschließlich lesend prüfen.

Sachliche Aktualität, Priorität und Produktabnahme bleiben Owneraufgaben. CI meldet Verstöße; Branchschutz konnte mit dem bisherigen Zugriff nicht eingerichtet/verifiziert werden.
