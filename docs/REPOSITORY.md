# Das Repository übersichtlich halten

Paketowner ist die im Aufgabenissue benannte Agent-/Ownerrolle: Sie verfolgt das vereinbarte Gesamtergebnis einschließlich benötigter fremder Eingänge und ihrer Verwendung. Das überträgt keinen Fach-, Datei- oder Abnahmebesitz. Integrationsowner ist der Steward des gemeinsamen Kandidaten in #12. Ordnung und Kommunikation werden im Arbeitspaket gepflegt.

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
| Wiederkehrende Arbeitsrollen | [AGENT-ROLES](AGENT-ROLES.md); Repositorypflege bei belegtem Änderungsbedarf |

README/CONTRIBUTING führen hinein, [INDEX](INDEX.md) ist die einzige Bereichskarte, das [Fachplanregister](reference/PLAN-REGISTER.md) optionale Vertiefung. #1 verweist auf diese Karte; #6–#11 führen Bereichsfragen. Einstiege verlinken statt Laufberichte zu kopieren. Keine zweite Live-Aufgabenliste oder tägliche Statuschronik; `npm run context` ist ausdrücklich Checkoutkontext.

## Selbstorganisation ohne zentrale Zuweisung

**Offene Aufgabenissues und ihre verlinkten PRs sind der einzige ausführbare Arbeitsbestand.** `npm run next` zeigt Produktengpässe, freie Pakete und ausdrücklich angebotene Unterstützung; `--task <nummer>` öffnet ein bekanntes eigenes Paket, `--area <bereich>` begrenzt die Auswahl. Eine Kommentar-`READY_FRONTIER` ist keine zweite Queue. #12 führt die gemeinsame Gateentscheidung, nicht eine Kopie aller Aufgaben. Zugriff/Fähigkeiten müssen passen; [WORKFLOW](WORKFLOW.md) bestimmt Paketgrenzen und Prüfung.

Beim Aufwachen eigene begonnene Arbeit fortsetzen. Bei einem echten Blocker den fehlenden Eingang einmal am Paket nennen, dann passende Unterstützung oder freie unabhängige Produktarbeit wählen, auch außerhalb des bisherigen Bereichs. Ist keine passende Einladung vorhanden, bestätigte unbesetzte Restbedarfe am Fachort prüfen und bei erfüllten Voraussetzungen selbst ein Ergebnispaket anbieten. Eine leere `ready`-Liste allein beendet diese Auswahl nicht. Wenn nach dieser Prüfung nur besessene, unerreichbare oder tatsächlich blockierte Arbeit bleibt, ruhig warten; keine Pflicht zur Auslastung oder erneuter Meldung desselben Zustands.

| Anlass | Änderung am bestehenden Aufgabenissue / PR |
| --- | --- |
| Übernahme | Claims/PRs prüfen, Rolle und Scope mit Branch/Basis nennen, soweit nicht eindeutig. Nach dem Claim erneut lesen: Erster eindeutiger, nicht zurückgegebener Claim gilt; bei Kollision vor Änderungen stoppen und getrennten Beitrag wählen. `ready` durch `active` ersetzen und aktuellen Owner im Haupttext pflegen. GitHub-Labels sind keine atomare Reservierung; Assignees desselben Accounts reichen nicht. |
| Blocker | Fehlenden Eingang/Empfänger nennen; `blocked` und gegebenenfalls GitHub-Abhängigkeit pflegen. Nach Lieferung neu bewerten; aktive Arbeit darf blockiert sein. |
| Unterstützung / Review | Freien Beitrag mit Eingang, Grenze, Umgebung und Empfänger im bestehenden Issue/PR anbieten und `help wanted` setzen; bei Besetzung/Erledigung entfernen oder verbleibendes Angebot nachführen. Reviewer übernimmt dort selbst und bindet exakten Commit. Vereinbarter unabhängiger Reviewer ist ein anderer als der Autor; besessene Prüfung/Hostslot erhalten. Unterstützungsclaim übernimmt nicht das Parentpaket. Kein eigenes Issue je Review-/Testschritt. |
| Übergabe | Ergebnis/Beleg und nächsten Schritt in Haupttext/Kommentar nachführen, wie unten beschrieben. |
| Abschluss | Ergebnis belegen, Issue schließen, Arbeitsstatuslabels entfernen; Parent und Abhängigkeiten nachziehen. Nur ausführbare freie Nachfolger als `ready` anbieten. Teilabschluss schließt kein Produktgate. |
| Integration | Eigene Checkpoint-/Abnahmeänderung und Dokumentationsdelta mitliefern; Integrationsowner aktualisiert nur den betroffenen gemeinsamen Lieferpfad. |

Labelnamen tragen `status:`: `ready` ist frei/ausführbar und weder aktiv noch blockiert. `kind:task` meint ein Ergebnispaket, `kind:coordination` einen Bereichsindex, `kind:process` Arbeitsabläufe. `priority:now` meint den Produktengpass, `priority:next` die Folgearbeit; Priorität vergibt keinen Besitz.

Ein Paket umfasst Umsetzung und erforderliche Prüfung bis zur nutzbaren Übergabe. Getrennte Pakete nur bei unabhängigen Ergebnissen, Besitz-/Schnittstellengrenzen oder realen Voraussetzungen; weder Zielzahl freier Karten noch einzelne Quellrecords als Arbeitspakete. Bei Übergabe benennt der Owner den nächsten Verbraucher und bietet bestätigte freie Folgearbeit an. Jeder Contributor kann bestätigte unbesetzte Restbedarfe im Parent zu ausführbaren Ergebnispaketen machen: Nutzen/Verbraucher, Quellen, Voraussetzungen, Abnahme.

Claims sollen innerhalb zweier erwartbarer Aufwachzyklen einen erreichbaren Branch/Commit/PR oder konkreten Blocker zeigen. Fehlt beides, verlangt die Prozesspflege einmal am Paket Bestätigung, erreichbaren Stand oder Rückgabe bis zu den nächsten zwei erwartbaren Zyklen. Das ist kein Heartbeat für belegte längere Implementierung. Fehlende Branchsichtbarkeit allein beweist keine aufgegebene Arbeit. Bei ausbleibender Antwort entscheidet der Integrationsowner in #12 ausdrücklich über Rückgabe oder weitere Klärung; unveröffentlichte Arbeit und fremde Branches erhalten, keine automatische Übernahme/Schließung. Ein Claim wird erst durch ausdrückliche Rückgabe oder begründete Stewardentscheidung frei.

Die [Arbeitsrollen](AGENT-ROLES.md) trennen Pflegezuständigkeiten: `task-maintenance` korrigiert den GitHub-Arbeitsbestand, `product-value` prüft Ergebnisse und Portfolioentscheidungen, `repository-maintenance` besitzt gemeinsame Dokumentations-/Rollenregeln und allein `checkpoint.repositoryOrientation`. Contributors pflegen ihre Pakete selbst. Gespeicherte Startaufträge verweisen auf diese veränderlichen Verträge; aktuelle Piloten und Aufgaben bleiben am Aufgabenort. Keine zweite Queue, parallele Schreibzuständigkeit oder neue Reflexionsautomation.

Ausführungshindernisse unterscheiden: fehlender Produktinput, besessener Scope, unpassende Fähigkeiten/Zugriffe oder nicht wiederhergestellte Laufumgebung. Nur den tatsächlich beobachteten Grund nennen. Routing kann einen kaputten Host oder fehlende Runtime-Wiederherstellung nicht reparieren.

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
