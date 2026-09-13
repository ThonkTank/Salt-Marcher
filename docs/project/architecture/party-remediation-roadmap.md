# Party remediation roadmap

Canonical roadmap supplied in the conversation and authorized for execution on 2026-09-13. The following scope is preserved from that roadmap.

Die Roadmap basiert auf dem inzwischen aktuellen **`origin/main@bc3e32570`**. Die dort bereits eingeführte risikobasierte CI-Auswahl wird übernommen. Die noch offenen Befunde bleiben bestätigt.

Ich plane **drei Umsetzungspakete und eine getrennte Untersuchung**:

| Reihenfolge | Paket | Befunde | Aufwand | Ergebnis |
|---|---|---|---|---|
| 1 | Verlaufsfehler sichtbar machen, Party-Dokumentation bereinigen | F5, F7b | S | Verständliche Fehlerzustände und eindeutige Fachregeln |
| 2 | Übergabe-Vorprüfung und Wiederaufnahme korrigieren | F6, F7a | M | Frühe, verlässliche Diagnose einer belegten Installation |
| 3 | Desktop-Tests voneinander isolieren | F4 | M | Fehler bleiben auf ihr Szenario begrenzt |
| 4 | Verlaufserfassung gezielt vermessen | F2 | S für Untersuchung | Begründete Entscheidung über eine mögliche Optimierung |

**1. Verlaufsfehler und Party-Dokumentation**

In `desktop-party.tsx` werden Laden, erfolgreicher leerer Verlauf, verfügbarer Verlauf und Abfragefehler ausdrücklich unterschieden.

- Bei fehlgeschlagener Abfrage erscheint ein kompakter Hinweis mit „Erneut versuchen“.
- Undo/Redo bleiben deaktiviert, solange kein verlässlicher aktueller Verlauf vorliegt.
- Eine Wiederholung fragt den Verlauf erneut ab. Sie führt keinen ursprünglichen Schreibauftrag erneut aus.
- Verspätete Antworten einer verlassenen Kampagne oder eines geschlossenen Fensters verändern den aktuellen Zustand nicht.
- Die normale kompakte Ansicht erhält keine permanente Statuszeile.

Die widersprüchlichen Aussagen zu XP, Stufen und Rast werden gleichzeitig in den unmittelbar betroffenen Party-Dokumenten korrigiert. Historische Beschreibungen werden eindeutig als solche gekennzeichnet.

**Abnahme:**

- Leerer Verlauf erzeugt keinen Fehlerhinweis.
- Abfragefehler ist sichtbar und per Tastatur bedienbar.
- Erfolgreiche Wiederholung stellt die richtigen Undo-/Redo-Aktionen wieder her.
- Wiederholtes Scheitern bleibt verständlich; veraltete Antworten werden ignoriert.
- Die Anzeige funktioniert bei 360 px und der bestehenden Mindestbreite.
- Aktuelle Fachtexte widersprechen der bestätigten Party-Spezifikation nicht mehr.

**Abhängigkeiten:** Keine. Keine Datenmigration und keine neuen öffentlichen Verträge vorgesehen.

**2. Verlässliche Übergabe-Vorprüfung**

Die Vorprüfung wird innerhalb der bestehenden Installations- und Profilsperrverwaltung vereinheitlicht. Grundlage ist das tatsächlich verwendete Profil samt Prozessidentität, nicht ausschließlich ein exakter AppImage-Pfad.

- Kanonische Profilpfade, Launcher und konkrete Deployment-Pfade werden berücksichtigt.
- Die Diagnose unterscheidet „frei“, „belegt“ und „nicht verlässlich feststellbar“.
- Ein unbekannter Zustand wird nicht als freie Installation ausgegeben.
- Die Prüfung findet vor Artefaktdownload und Beginn eines neuen Übergabeversuchs statt.
- Die verbindliche Sperre unmittelbar vor Installationsänderungen bleibt erhalten.
- Die Diagnose beendet keine Prozesse und entfernt keine lebenden Sperren.
- Die dokumentierte Wiederaufnahme wird auf den funktionierenden Aufruf `pnpm handoff:app --resume` vereinheitlicht.

**Abnahme:**

- Eine über den stabilen Launcher gestartete App wird erkannt.
- Pfad-Aliase und abweichende Deployment-Pfade erzeugen keine falsche Freigabe.
- Veraltete, unlesbare und ungültige Sperrinformationen werden korrekt unterschieden.
- Startet die App erst nach der Vorprüfung, verhindert die spätere Sperre weiterhin konkurrierende Änderungen.
- Nach regulärem Schließen funktioniert die Wiederaufnahme und verwendet vorhandene gültige Nachweise weiter.
- Der dokumentierte Aufruf wird über den tatsächlichen Programmeinstieg geprüft, nicht nur unmittelbar am Argumentparser.

**Abhängigkeiten:** Keine fachliche Abhängigkeit von Paket 1. Vorhandene Sperrformate und Wiederaufnahmegarantien bleiben kompatibel.

**3. Unabhängige Desktop-Testfälle**

Die derzeitige gemeinsame Testkampagne wird als Abhängigkeit zwischen eigenständigen Szenarien entfernt.

Dafür werden die unabhängigen Szenarien aus `scene-desktop.e2e.ts` als eigene registrierte Specs ausgeführt. Der vorhandene Testläufer erzeugt bereits pro Suite ein eigenes temporäres Profil; dieser Mechanismus wird wiederverwendet.

- Jedes Szenario stellt seine eigenen benötigten Fenster, Charaktere und Spielzustände her.
- Beispielsweise öffnet der Karten-/Kampftest sein Referenzdokument selbst, statt es vom vorherigen Dokumenttest zu übernehmen.
- Zusammenhängende Abläufe über Navigation und Neustarts behalten innerhalb desselben Szenarios ihr Profil.
- Gemeinsame Fixture-Erzeugung und Bedienhilfen werden weiterverwendet.
- Suite-Registrierung, CI-Zuordnung und Vollständigkeitsprüfungen werden angepasst.
- Die ursprünglichen elf Abnahmefälle bleiben nachvollziehbar abgedeckt.

**Abnahme:**

- Jedes Szenario besteht einzeln.
- Die Szenarien bestehen auch in veränderter Reihenfolge.
- Ein gezielt provozierter Abbruch im Dokumenttest erzeugt keine Folgefehler in Party- oder Barrierefreiheitstests.
- Neustart, Fenstergeometrie, Reise, Kampf und Undo/Redo bleiben abgedeckt.
- Laufzeit und zusätzliche Startkosten werden mit dem bisherigen Durchlauf verglichen.
- Es werden weder Prüfungen abgeschaltet noch pauschal Wartezeiten erhöht.

**Abhängigkeiten:** Keine Produktänderung nötig. Paket 1 liefert bereits die neuen Fehlerfälle; deren gezielte Komponententests müssen nicht zusätzlich als vollständige Desktop-Abläufe dupliziert werden.

**4. Untersuchung der Verlaufserfassung**

Dieses Paket enthält zunächst Messungen und eine dokumentierte Entscheidung, keinen vorweggenommenen Umbau.

Untersucht werden XP-Änderung, Schnellwertänderung, Rasten und Verschieben. Die Fixtures variieren Charakterzahl, Szenenzahl sowie Umfang von Kampf- und Reisezuständen. Kleine und große Fälle erhalten jeweils vergleichbare Wiederholungen.

Erfasst werden:

- Anzahl der Datenbankabfragen und gelesenen Datensätze.
- Zeit für Zustandserfassung, Vergleich, Speicherung und gesamte Aktion.
- Größe der gespeicherten Verlaufsdaten.
- Abhängigkeit einer kleinen Aktion von unveränderten anderen Szenen.
- Konkrete Stellen, an denen fachfremde Schemaänderungen Anpassungen verlangen.

**Abnahme und Entscheidung:**

- Die Ergebnisse sind reproduzierbar und trennen erstmalige Initialisierung von wiederholten Aktionen.
- Ohne belegten relevanten Nachteil wird die bestehende Erfassung beibehalten.
- Bei belegtem Nachteil wird eine begrenzte Optimierung beschrieben: betroffene Aktionen, verantwortliche Fachbereiche, erwarteter Nutzen und erforderliche Regressionstests.
- Eine anschließende Änderung muss weiterhin Nebenwirkungen vollständig erfassen, atomar bleiben und spätere unabhängige Änderungen schützen.
- Erfordert die Lösung neue Verantwortungsgrenzen oder Vertragsänderungen, wird dafür ein gesondertes Umsetzungspaket formuliert.

**Durchführung und Auslieferung**

F3 wird als Arbeitsweise ab Paket 1 berücksichtigt: vorhandene Format-, Lint-, Typ- und passende Architekturprüfungen werden vor dem nächsten vollständigen Candidate-Durchlauf ausgewertet. Dafür entsteht keine zusätzliche Freigabestufe.

Jedes Umsetzungspaket beginnt auf einer sauberen `codex/`-Branch vom dann aktuellen `origin/main`. Deine vorhandene lokale Dokumentänderung bleibt unberührt. Die aktuellen CI-Regeln bestimmen die erforderlichen Prüfungen; übersprungene Prüfungen müssen durch deren bestehende Auswahlmechanik gedeckt sein.

App-relevante Pakete enden mit geprüftem Candidate-SHA, kanonischer lokaler Übergabe, Übernahme desselben SHA nach `main` und erfolgreicher Main-Bestätigung. Reine Test-/Dokumentationspakete benötigen bei unverändertem App-Build-Fingerprint keine erneute lokale Installation.

Die Pakete werden getrennt als **implementiert, geprüft und ausgeliefert** erfasst. So bleibt insbesondere die Untersuchung aus Paket 4 von einer bereits beschlossenen Optimierung unterscheidbar.
