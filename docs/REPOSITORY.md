# Das Repository übersichtlich halten

Die Ordnung wird mit jedem Arbeitspaket gepflegt. Es entsteht kein zusätzlicher Freigabeprozess und keine neue Statusrunde. Der Paketowner hält seine Aufgabe aktuell; der Integrationsowner gleicht beim Übernehmen die gemeinsame Orientierung ab. Paketowner ist die im Aufgabenissue benannte Agent-/Ownerrolle; Integrationsowner ist der in #12 benannte Steward des aktuellen gemeinsamen Kandidaten. Für einen aktuellen Nutzerauftrag gelten dessen Freigaben.

## Ein verbindlicher Ort je Information

| Information | Verbindlicher Ort | Pflegeanlass und Zuständigkeit |
| --- | --- | --- |
| Produktziele und Umfang | [PRODUCT](PRODUCT.md), Details in [SCOPE](SCOPE.md) | Wer eine bestätigte Zieländerung übernimmt, aktualisiert Ziel und Quellenzuordnung gemeinsam |
| Lieferfolge | [ROADMAP](ROADMAP.md), gemeinsame Entscheidungen in Issue #12 | Integrationsowner aktualisiert bei geändertem kritischem Pfad oder integriertem Gate; datierte Belege bleiben als solche erkennbar |
| Aufgabe, Übernahme, Abhängigkeit | Konkretes GitHub-Issue und zugehöriger PR | Paketowner pflegt Haupttext, Labels und GitHub-Abhängigkeiten bei Übernahme, Blockerwechsel und Abschluss |
| Aktueller Ausführungsstand | Eigene Wurzel in `checkpoint.json` | Paketowner ersetzt veralteten eigenen Laufstand nach dem Arbeitspaket; fremde Wurzeln erhalten |
| Fachliche Abnahme | `acceptance.json` | Zuständiger Fachowner bindet direkten Nachweis; fehlende oder unzugängliche Evidenz bleibt offen |
| Architekturentscheidung | `ARCHITECTURE.md` | Owner der angenommenen Entscheidung; Alternativen und alte Begründungen nachvollziehbar erhalten |
| Fachvertrag und Paketplan | Bestehender Fachort, neue Paketpläne unter `docs/plans/<bereich>/` | Paketowner verlinkt im [Index](INDEX.md), benennt Owner/Issue und markiert die Ablösung |

README und CONTRIBUTING führen zu diesen Orten. Der Index ist eine Bereichskarte; das [Fachplanregister](reference/PLAN-REGISTER.md) ist optionale Vertiefung. Einstiege verlinken den aktuellen Aufgabenort statt Reparaturverläufe, alte Testergebnisse oder frei gewordene Arbeit zu duplizieren. `npm run context` hält große JSON-Dateien aus dem Standardlesepfad und nennt die Checkout-SHA. Bereichssnapshots dürfen nicht als neuester Kandidatenstand ausgegeben werden. Sie enthalten keine zweite Live-Aufgabenliste. Kurze datierte Beispiele und gepinnte Reproduktionsbefehle dürfen bleiben; eine konkrete Aufgabe wird dadurch nicht dauerhaft als frei beworben. Issue #1 enthält den Paketindex, #12 bereichsübergreifende Entscheidungen. Fachprotokolle verbleiben im Bereich. Git-Verlauf, PR und gezielte Belege dokumentieren vergangene Läufe; Checkpoint und Übersichten wachsen nicht als tägliches Journal.

## Wo neue Dateien hingehören

- `src/`: Produktcode; `tests/`: gezielte Tests und kleine synthetische Fixtures; `tools/`: wiederverwendbare Werkzeuge mit dokumentiertem Aufruf.
- `docs/`: nutzbare Anleitungen und begründete Quellzuordnungen. Jede Markdown-Datei muss über den Index erreichbar sein, direkt oder über eine dort verlinkte Anleitung.
- `docs/plans/<bereich>/`: ein neuer begrenzter Paketplan nach der [Vorlage](templates/PACKAGE-PLAN.md). Einen vorhandenen passenden Plan zuerst fortführen. Plan, Umsetzung, Review und Reparatur können darin klar getrennte Abschnitte führen; Fachverträge bleiben bindend.
- Große QA-Dateien und Rohprotokolle bleiben außerhalb des Nutzervaults am bestehenden QA-Ort. Im Repository stehen prüfbare Identität, Hash und Zugriffsvoraussetzung.

Die bestehenden Root-Dokumente und bereits veröffentlichten Kandidatenpfade bleiben kompatibel. [repository-policy.json](repository-policy.json) hält diesen festen Bestand fest; sie ist keine Aufgaben- oder Statusliste. Neue Root-Markdown-Dateien sind nicht vorgesehen. Den Bestand nicht zur Umgehung der Prüfung erweitern. Eine später notwendige Strukturänderung muss ihre betroffenen Verweise und Übergänge ausdrücklich mitführen.

## Aufgabe übernehmen, übergeben und abschließen

1. **Vor Beginn:** neuesten Claim und vorhandenen PR prüfen. Bei Übernahme `status:ready` entfernen, `status:active` setzen und Agent/Rolle, Scope, Basis und nächsten Empfänger im Issue nennen. Überschneidungen im vorhandenen Paket klären.
2. **Bei einem Blocker:** konkreten fehlenden Eingang und verantwortlichen Empfänger nennen; `status:blocked` setzen. Eine aktive Aufgabe darf blockiert sein. Wenn ein anderes Issue der Eingang ist, die GitHub-Abhängigkeit pflegen. Bei Lieferung Blocker und Label neu bewerten.
3. **Bei Übergabe:** Commit, tatsächliche Prüfungen, offene Grenzen und nächsten Empfänger melden. Der Issue-Haupttext enthält den aktuellen nächsten Schritt; Leser müssen keine lange Kommentarhistorie rekonstruieren.
4. **Bei Abschluss:** erst das vereinbarte Ergebnis belegen, dann Issue schließen und aktive/blocked/ready-Labels entfernen. Bei einem Teilergebnis nur das Teilpaket schließen; das Produktgate bleibt offen. Abhängige Aufgaben neu bewerten, freigewordene Arbeit gegebenenfalls als `status:ready` kennzeichnen.
5. **Bei gemeinsamer Integration:** Paketowner liefert Checkpoint-/Abnahmeänderung und Dokumentationsdelta; Integrationsowner übernimmt sie und zieht einen geänderten Lieferfokus in ROADMAP/README/#12 nach. Keine erneute Meldung ohne Ergebnis, geänderten Blocker oder Übergabe.

`npm run next` liest die freie Aufgabenliste live. Bei einem abgeschlossenen Einstiegs-/Teilpaket den Verweis im Parentissue aktualisieren; ein geschlossener Vorgänger ist keine freie Aufgabe. Ist die Liste leer, klar angeben, ob alle konkreten Pakete besessen/blockiert sind oder ein bereits beschlossener Restbedarf noch in ein ausführbares Teilpaket zerlegt werden muss. Keine bloße Beschäftigungsaufgabe erzeugen und keinen Owner durch Umkennzeichnung verdrängen.

Ein Claim verfällt nicht stillschweigend nach Zeitablauf. Bei ausbleibendem Fortschritt den bisherigen Owner im bestehenden Thread erreichen und Ergebnis, Blocker oder ausdrückliche Rückgabe klären. Keinen konkurrierenden Kandidaten allein aufgrund eines alten Zeitstempels eröffnen. Es werden keine zusätzlichen Heartbeats oder automatischen Schließungen eingerichtet.

## Pläne ablösen und alte Verweise erhalten

Neue Pläne führen im Kopf Bereich, konkrete Ownerrolle, Issue, Dokumentstatus und eigene Checkpointwurzel. `complete` bezeichnet das abgeschlossene Paketdokument, keine Produktabnahme. `superseded` nennt den Nachfolger. Bei Ablösung den alten Plan und dessen Indexeintrag kenntlich machen; die aktuelle Aufgabe/Checkpointwurzel zeigt auf den Nachfolger. Historische IDs und Belege bleiben erhalten. Bereits extern referenzierte Dateien nicht blind verschieben. Ein Archiv wird nur dann angelegt, wenn Verweise und betroffene Nutzer der Pfade mitgeführt werden.

## Was automatisch geprüft wird

```bash
npm run check:repo
npm run test:repo
npm run audit:backlog
```

`check:repo` läuft offline ohne Obsidian und prüft lokale Markdown-Verweise/Anker in den Einstiegen und unter `docs/`, Erreichbarkeit im Index, den Root-Kompatibilitätsbestand, Metadaten neuer Paketpläne sowie die Struktur und Referenzen des Quellenregisters. Bestehende Fachtexte mit historischen lokalen QA-Pfaden werden nicht nachträglich als vollständig linkgeprüft ausgegeben. Historische Quellenhashes bleiben an ihren Snapshot gebunden; normale Produktänderungen werden nicht gegen alte Hashes blockiert.

`test:repo` prüft insbesondere, dass kaputte Links, fehlende Indexeinträge, neue Root-Pläne und ungültige Statuskombinationen auffallen. Beide Prüfungen laufen für PRs; außerdem läuft die Strukturprüfung bei Push auf den gemeinsamen Branch. `audit:backlog` braucht GitHub-Zugriff und meldet widersprüchliche Aufgabenlabels oder offene Arbeitslabels an geschlossenen Aufgaben. Es liest ausschließlich; es ersetzt weder Claims noch Fachentscheidungen und ändert keine Issues.

Die Prüfungen beweisen keine sachlich aktuelle Roadmap, passende Priorität oder Produktabnahme. Dafür bleiben die oben benannten Owner zuständig. CI meldet Verstöße; eine Sperre vor jedem direkten Push setzt zusätzlich GitHub-Branchschutz voraus. Dieser konnte mit dem aktuellen Zugriff nicht eingerichtet oder verifiziert werden.
