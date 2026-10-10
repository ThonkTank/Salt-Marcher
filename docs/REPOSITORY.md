# Das Repository übersichtlich halten

Paketowner ist die im Aufgabenissue benannte Agent-/Ownerrolle: Sie verfolgt das vereinbarte Gesamtergebnis einschließlich benötigter fremder Eingänge und ihrer Verwendung. Das überträgt keinen Fach-, Datei- oder Abnahmebesitz. Integrationsowner ist der Steward des gemeinsamen Kandidaten in #12. Ordnung und Kommunikation werden im Arbeitspaket gepflegt.

## Ein verbindlicher Ort je Information

| Information | Ort und Pflege |
| --- | --- |
| Ziele / vollständiger Umfang | [PRODUCT](PRODUCT.md) / [SCOPE](SCOPE.md); bestätigte Zieländerung samt Quellenzuordnung |
| Dauerhafte Lieferfolge | [ROADMAP](ROADMAP.md); Integrationsowner bei geändertem Lieferpfad |
| Aktueller gemeinsamer Schritt / Gateentscheidung | Issue #12; Integrationsowner mit direktem Beleg |
| Aufgabe, Besitz, Unterstützung | Konkretes Issue/PR; Paketowner bei Übernahme und geänderter Zuständigkeit |
| Aktueller Lieferstand / nächste Beiträge | Explizit verlinkter Abschnitt im bestehenden Fachplan, sofern vorhanden; Paketowner mit Lieferung oder tatsächlichem Blockerwechsel, ohne Kopie im Issue |
| Ausführungsstand | Eigene Wurzel in `checkpoint.json`; aktuellen Lauf ersetzen, fremde Wurzeln erhalten |
| Abnahme | `acceptance.json`; Fachowner bindet direkte Evidenz, fehlender Nachweis bleibt offen |
| Architektur | `ARCHITECTURE.md`; angenommene Entscheidung mit früheren Begründungen |
| Fachvertrag / Paketplan | Bestehender Fachort; neue Pläne unter `docs/plans/<bereich>/` |
| Wiederkehrende Arbeitsrollen | [AGENT-ROLES](AGENT-ROLES.md); Repositorypflege bei belegtem Änderungsbedarf |

README/CONTRIBUTING führen hinein, [INDEX](INDEX.md) ist die einzige Bereichskarte, das [Fachplanregister](reference/PLAN-REGISTER.md) optionale Vertiefung. #1 verweist auf diese Karte; #6–#11 führen Bereichsfragen. Einstiege verlinken statt Laufberichte zu kopieren. Keine zweite Live-Aufgabenliste oder tägliche Statuschronik; `npm run context` ist ausdrücklich Checkoutkontext.

## Selbstorganisation ohne zentrale Zuweisung

**Offene Aufgabenissues und ihre verlinkten PRs sind der einzige ausführbare Arbeitsbestand.** `npm run next` zeigt Produktengpässe, freie Pakete und ausdrücklich angebotene Unterstützung; `--task <nummer>` öffnet ein bekanntes eigenes Paket, `--area <bereich>` begrenzt die Auswahl. Eine Kommentar-`READY_FRONTIER` ist keine zweite Queue. #12 führt die gemeinsame Gateentscheidung, nicht eine Kopie aller Aufgaben. Zugriff/Fähigkeiten müssen passen; [WORKFLOW](WORKFLOW.md) bestimmt Paketgrenzen und Prüfung.

Eigene Arbeit fortsetzen. Bei echtem Blocker fehlenden Eingang einmal am Paket nennen, dann passende Unterstützung oder unabhängige Produktarbeit wählen, auch außerhalb des bisherigen Bereichs. Ohne Einladung bestätigte unbesetzte Restbedarfe am Fachort prüfen. Eine leere `ready`-Liste allein beendet die Auswahl nicht; bleibt nur besessene, unerreichbare oder blockierte Arbeit, ruhig warten.

| Anlass | Änderung am bestehenden Aufgabenissue / PR |
| --- | --- |
| Übernahme | Claims/PRs prüfen, Rolle und Scope mit Branch/Basis nennen, soweit nicht eindeutig. Nach dem Claim erneut lesen: Erster eindeutiger, nicht zurückgegebener Claim gilt; bei Kollision vor Änderungen stoppen und getrennten Beitrag wählen. `ready` durch `active` ersetzen und aktuellen Owner im Haupttext pflegen. GitHub-Labels sind keine atomare Reservierung; Assignees desselben Accounts reichen nicht. |
| Blocker | Fehlenden Eingang/Empfänger nennen; `blocked` und gegebenenfalls GitHub-Abhängigkeit pflegen. Nach Lieferung neu bewerten; aktive Arbeit darf blockiert sein. |
| Unterstützung / Review | Freien Beitrag mit Eingang, Grenze, Umgebung und Empfänger im bestehenden Issue/PR anbieten und `help wanted` setzen; bei Besetzung/Erledigung entfernen oder verbleibendes Angebot nachführen. Reviewer übernimmt dort selbst und bindet exakten Commit. Vereinbarter unabhängiger Reviewer ist ein anderer als der Autor; besessene Prüfung/Hostslot erhalten. Unterstützungsclaim übernimmt nicht das Parentpaket. Kein eigenes Issue je Review-/Testschritt. |
| Übergabe | Paketowner ersetzt den verlinkten Lieferstand mit der Lieferung; Unterstützer nennt einmal Ergebnis/Beleg und die Konsequenz für den Empfänger. Keine laufende Issuekopie, siehe unten. |
| Abschluss | Ergebnis belegen, Issue schließen, Arbeitsstatuslabels entfernen; Parent und Abhängigkeiten nachziehen. Nur ausführbare freie Nachfolger als `ready` anbieten. Teilabschluss schließt kein Produktgate. |
| Integration | Eigene Checkpoint-/Abnahmeänderung und Dokumentationsdelta mitliefern; Integrationsowner aktualisiert nur den betroffenen gemeinsamen Lieferpfad. |

Labelnamen tragen `status:`: `ready` ist frei/ausführbar und weder aktiv noch blockiert. `kind:task` meint ein Ergebnispaket, `kind:coordination` einen Bereichsindex, `kind:process` Arbeitsabläufe. `priority:now` meint den Produktengpass, `priority:next` die Folgearbeit; Priorität vergibt keinen Besitz.

[WORKFLOW](WORKFLOW.md#sinnvolle-arbeit-wählen-und-begrenzen) bestimmt Liefergrenzen und Prüfung. Contributors können bestätigte unbesetzte Restbedarfe im Parent als Ergebnispaket anbieten: Nutzen/Verbraucher, Quellen, Voraussetzungen, Abnahme. Keine Zielzahl freier Karten oder Pakete je Quellrecord.

Claims sollen innerhalb zweier erwartbarer Aufwachzyklen einen erreichbaren Branch/Commit/PR oder konkreten Blocker zeigen. Fehlt beides, verlangt die Prozesspflege einmal am Paket Bestätigung, erreichbaren Stand oder Rückgabe bis zu den nächsten zwei erwartbaren Zyklen. Das ist kein Heartbeat für belegte längere Implementierung. Fehlende Branchsichtbarkeit allein beweist keine aufgegebene Arbeit. Bei ausbleibender Antwort entscheidet der Integrationsowner in #12 ausdrücklich über Rückgabe oder weitere Klärung; unveröffentlichte Arbeit und fremde Branches erhalten, keine automatische Übernahme/Schließung. Ein Claim wird erst durch ausdrückliche Rückgabe oder begründete Stewardentscheidung frei.

Die [Arbeitsrollen](AGENT-ROLES.md) bestimmen Pflegezuständigkeiten; `repository-maintenance` besitzt allein `checkpoint.repositoryOrientation`. Contributors pflegen ihre Pakete selbst. Startaufträge verweisen auf die Verträge; keine zweite Queue, parallele Schreibzuständigkeit oder Reflexionsautomation.

Ausführungshindernisse unterscheiden: fehlender Produktinput, besessener Scope, unpassende Fähigkeiten/Zugriffe oder nicht wiederhergestellte Laufumgebung. Nur den tatsächlich beobachteten Grund nennen. Routing kann einen kaputten Host oder fehlende Runtime-Wiederherstellung nicht reparieren.

Bereichsfragen im Fachissue, gemeinsame Konflikte/Entscheidungen in #12. Den Nutzer bei offenen Produktzielen/Nutzerentscheidungen einbeziehen; Routineverteilung organisiert das Team selbst.

## Kommunikation nach Inhalt und Anlass

**Der Aufgabenhaupttext ist der Einstieg:** Nutzerergebnis, Besitz und Unterstützung sowie der direkte Verweis auf den aktuellen Lieferstand im vorhandenen Fachplan. Bei angeschlossenem Fachort dort Eingang, verbleibenden Blocker und nächsten Beitrag ersetzen; keine zweite Kopie im Issue. Ohne passenden vorhandenen Fachort bleibt der bisherige manuell gepflegte Haupttext der Arbeitsstand. Erledigte Warteanweisungen und Zwischenstände entfernen. Kommentare bewahren Claims und relevante Entscheidungen, werden aber nicht zur zweiten laufenden Aufgabenbeschreibung. Ein neuer Contributor muss den aktuellen Stand ohne Rekonstruktion der Kommentarchronik verstehen können; ältere Claims/Belege nur bei Unklarheit gezielt prüfen.

| Meldung | Nötiger Inhalt |
| --- | --- |
| Claim | Rolle, Scope, Branch/Basis; nur Abweichungen von bereits beschriebenen Voraussetzungen/Prüfungen |
| Übergabe | Beobachtbares Ergebnis oder Blocker → Commit/Beleglink und offene Grenze → nächster Empfänger/Schritt |
| Entscheidung | Frage, relevante Optionen/Belege, Entscheidung mit Geltungsbereich; ungeklärte Punkte offen |

Ein Ergebnis einmal am zuständigen Ort veröffentlichen; andernorts nur eine geänderte Konsequenz mit Link. Logs, Hashlisten, Prüftabellen und technische Detailchronik an vorhandene Evidenz-/QA-Orte verlinken. Fachpläne führen Vertrag und Lieferweg, keine fortlaufenden Build-/Test-/Wiederholungsläufe; vorhandene historische Abschnitte bleiben gezielte Belege, neue Läufe erweitern nicht den Standardlesepfad. Kommentare nur für neue Ergebnisse, echte Blocker, Besitz oder Entscheidungen; kein Hoststart-, Sync-, CI- oder Wiederholungsbericht ohne neue Konsequenz. Bereichsindex nur bei geändertem Eingang, #12 nur bei geändertem gemeinsamen Schritt/Gate.

Projektgedächtnis bleibt ein aktueller Snapshot in der eigenen Checkpointwurzel: Fortsetzung, noch offene Fragen und benötigte Belege. Erledigte Zwischenstände ersetzen statt anhängen; Ziele, Regeln und fremde Dispatchzustände verlinken statt kopieren. Acceptance bewahrt Anforderungen und direkte Abnahmeidentitäten, Git/Beleglinks den Verlauf. Keine Löschung fremder Wurzeln oder gepinnter Nachweise; kein zusätzliches Tages-/Laufarchiv.

## Arbeitsstand lesen und ersetzen

`npm run next -- --task N` liest den Einstieg ohne Kommentarchronik. Ein expliziter
Verweis im Issue verbindet den vorhandenen Fachplan:

```text
Arbeitsstand: https://github.com/OWNER/REPO/blob/DEFAULTBRANCH/PFAD.md#arbeitsstand-N
```

Im Plan heißt der Abschnitt `#### Arbeitsstand #N`; er enthält aktuellen Eingang,
Blocker, Beleg, offene Grenze und nächste ausführbare Beiträge. Keine neue Datei
oder zusätzliche Aufgabenliste dafür anlegen. `next` löst den aktuellen Defaultbranch
auf eine konkrete Commitrevision auf und liest nur diesen Abschnitt. Fehlender
Zugriff, doppelte/fehlende Abschnitte oder mehr als 6000 Zeichen werden ausdrücklich
als unbrauchbarer Einstieg gemeldet; historische Kommentare ersetzen ihn nicht.
Ziel und Besitz bleiben im Issue, persönliche Fortsetzung in der eigenen
Checkpointwurzel, Abnahme in Acceptance. Beides nicht in den Arbeitsabschnitt kopieren.

Explizite Zeilen `Kandidat: https://github.com/OWNER/REPO/pull/N` und
`Eingang: https://github.com/OWNER/REPO/issues/N` werden live abgefragt. Head, CI
und Reviewzustand nicht kopieren; Merge ist keine Fach-/GUI-Abnahme. `--json`
liefert Quellenrevision und vollständigen Issue-Snapshot, `--comments` nur die
letzten drei Kommentare. Ältere Claims/Entscheidungen bei Bedarf direkt prüfen.

Arbeitsabschnitt mit der zusammengehörigen Lieferung oder tatsächlichem
Blockerwechsel ändern. Der Paketowner ersetzt dabei erledigte Warteanweisungen,
benennt jetzt konsumierbare Eingänge und den nächsten ausführbaren Beitrag samt
Empfänger; weiter offene Grenzen bleiben sichtbar. Kein angehängter Laufbericht.
Neue Hinweise beim Wiedereinstieg auf diese Konsequenz prüfen und dann umsetzen,
begründet verwerfen oder den tatsächlichen fehlenden Eingang benennen.

Unterstützer veröffentlichen Ergebnis/Beleg und geänderte Konsequenz einmal am
zuständigen PR/Issue. Der Paketowner übernimmt nur deren Konsequenz in den Fachort;
keine kopierten Vollberichte und kein zweiter Kommentar über die Gedächtnispflege.
Ohne Plan-/Repositorybefugnis die Änderung dem Owner übergeben, statt im Issue
einen konkurrierenden Stand anzulegen. Unterstützung überträgt keinen Parentbesitz.
Unveränderte Eingänge erzeugen keine Aktualisierung oder erneute Blockermeldung.

Besitzt das eigene aktive Paket einen passenden vorhandenen Fachplan, bei dessen
nächster sachlicher Bearbeitung den bestehenden Issueeinstieg einmal daran
anschließen und die alte veränderliche Kopie entfernen. Keine zusätzliche
Migrationsaufgabe, neue Statusdatei oder flächendeckende Aufräumrunde. Verweise,
fremde Inhalte und Besitz erhalten; feste Issueänderungen wie unten kontrollieren.

Vor Bearbeitung Remote lesen; vor Veröffentlichung erneut fetch und eingehende
Arbeit integrieren. Hat sich derselbe Arbeitsabschnitt gegenüber der eigenen
Basis geändert, stoppen und inhaltlich abgleichen, auch wenn Git automatisch
mergen könnte. Andere Abschnitte erhalten. Regulärer Push ohne Force: Eine
zwischenzeitliche Remoteänderung wird zurückgewiesen, nicht überschrieben.
Git schützt die Historie, bestätigt aber keine sachliche Richtigkeit eines Merge.
Keine pauschalen JSON-Merge- oder Wiederholungsaktionen bei Konflikt/unklarem Ausgang.

`npm run update-task -- --task N --file INPUT.json` bleibt ausschließlich eine
Vorschau für bestehende manuelle Issuepflege. Eingabe: `expectedBodySha256`,
`expectedUpdatedAt`, `content`; Snapshot über `npm run --silent next -- --task N --json`.
`--apply` und automatische Issue-Body-Patches sind deaktiviert: GitHub bietet hierfür
keine belastbare Compare-and-swap-Garantie. Keine Befugnis aus dem Werkzeug ableiten.
Einmalige Änderungen fester Issueverweise müssen mit aktueller Lektüre, Erhalt fremder
Inhalte und nachträglicher Kontrolle erfolgen; sie sind nicht atomar konfliktgeschützt.
Pakete ohne passenden Fachort bleiben beim bisherigen manuellen Verfahren und
werden erst bei sachlicher Bearbeitung angeschlossen. Keine Commit-/Meldepflicht je Lauf.

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
