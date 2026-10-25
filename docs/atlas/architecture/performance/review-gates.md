# Unabhängige Reviews und Steuerung – Arbeitspakete

Status: Planned; erste Planreviewrunde mit Befunden abgeschlossen, Freigabe noch offen.
Owner: atlas
Last Reviewed: 2026-10-25
Source of Truth: Reviewpakete und Meilensteinübergänge; siehe [Projekthandbuch](handbook.md).

Jedes Review ist ein eigener Agentenlauf ohne Implementierer-Chatkontext.
Die zwei Reviews eines Gates dürfen parallel laufen. Eine Freigabe erfolgt erst,
wenn beide beendet sind und keine begründete Kritik offen ist. Neue Fixpakete
werden vor ihrer Ausführung mit IDs, Umfang, Tests und Abhängigkeiten ergänzt;
danach beide betroffenen Reviewaufträge erneut ausführen. Nicht erfolgte oder
abgebrochene Reviews gelten nicht als bestandene Reviews.

Für jedes Paket gelten Eingaben, Aufwand und Übergabe aus dem
[gemeinsamen Paketvertrag](handbook.md#gemeinsamer-paketvertrag). Die `.01`-Reviews
brauchen die Fachkompetenz der tatsächlich geänderten Code-/Prüfbesitzer, die
`.02`-Reviews zusätzlich Messmethodik und Projektsteuerung. `.03` verantwortet
der Koordinator; er darf seine eigenen Änderungen nicht selbst unabhängig
freigeben. Schnittstellen sind exakter Diff-/Buildstand, Reviewbefunde,
benannte Fixpakete und die nachvollziehbare nächste Planversion.

Für **jedes Rn.03** gehört die nötige Integration zum Übergang: alle eigenen
Meilensteinergebnisse im permanenten Checkout zusammenführen und auf demselben
Stand prüfen. Sobald die Phase eine GitHub-Integration umfasst, verlangt deren
Freigabe die reale grüne `Candidate · exact-SHA aggregate` auf dem exakten
Kandidaten und danach die verifizierte Main-SHA gemäß `AGENTS.md`. Änderungen nach
diesem Nachweis erfordern die betroffenen Prüfungen erneut. Ein lokaler Test oder
Agentenbericht ist weder ein Integrationsbeleg noch eine Freigabe zum Push/Merge
eines unqualifizierten Stands; nötige Lieferarbeit bekommt einen eigenen Auftrag.

### P0.01 — Paketumfang und Abhängigkeiten unabhängig reviewen

<!-- atlas-dependencies {"requires":[],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Vollständige Paketzerlegung und Timeline vorhanden.
- **Auftrag und Ergebnis:** Gegen ursprünglichen Nutzerauftrag Paketgröße, fehlende Schritte, Ein-/Ausgaben, reale Codebesitzer, Abhängigkeiten und mögliche Parallelität prüfen. Jede zu große oder erst später zu definierende reguläre Aufgabe benennen.
- **Prüfung / fertig:** Bericht mit konkreten Befunden und Belegen oder ausdrücklicher Aussage ohne offene Befunde. Keine Implementierung und keine Selbstfreigabe durch den Planersteller.

### P0.02 — Architektur, Messung und Steuerung unabhängig reviewen

<!-- atlas-dependencies {"requires":[],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Vollständige Paketzerlegung, Architekturprüfung, Timeline und Projekthandbuch vorhanden.
- **Auftrag und Ergebnis:** Ein anderer Agent prüft Funktions-/Qualitätserhalt, Messgültigkeit, Fehler-/Datengrenzen, Aufwandannahmen, bedingte Alternativen und Plan–Soll–Ist-Prozess anhand tatsächlichen Codes und Belegen.
- **Prüfung / fertig:** Konkrete Befunde oder ausdrücklich keine offenen Befunde. Fehlende Messungen nicht als positives Ergebnis werten; technische und fachliche Abnahme auseinanderhalten.

### P0.03 — Befunde einarbeiten und Planbasis freigeben

<!-- atlas-dependencies {"requires":["P0.01","P0.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** P0.01 und P0.02 beendet.
- **Auftrag und Ergebnis:** Alle Befunde prüfen und erforderliche Änderungen an Paketen/Timeline/Handbuch durchführen. Jede Änderung den unabhängigen Reviewern erneut vorlegen, bis keine begründete Kritik offen ist. Dann Planbasis v1 mit Hashes und Reviewerbelegen sichern.
- **Prüfung / fertig:** Zwei abgeschlossene saubere Reviews auf genau dem freigegebenen Planstand. Erst danach A0 zur Agentenumsetzung freigeben. Kein stummes Verwerfen von Befunden und kein Erfolg allein durch Ablauf einer Reviewfrist.

## Gate nach A0

### R0.01 — Ergebnis von A0 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A0.01","A0.02","A0.03","A0.04","A0.05","A0.06","A0.07","A0.08","A0.09","A0.10","A0.11"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Alle aktivierten Pakete von A0 abgeschlossen; tatsächliche Diffs, Tests und Artefakte verfügbar.
- **Auftrag und Ergebnis:** Nicht beteiligter Agent prüft Codekorrektheit, Regressionen, Sicherheits-/Datengrenzen und jeden Abnahmepunkt des Meilensteins. Geeignete gezielte Prüfungen selbst reproduzieren; keine bloße Übernahme der Implementiererzusammenfassung.
- **Prüfung / fertig:** Bericht mit konkreten Fixbefunden oder ohne offene Befunde auf benannter Code-/Buildrevision. Abweichungen nach Schwere und betroffener Anforderung zuordnen.

### R0.02 — Annahmen und Plan–Soll–Ist nach A0 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A0.01","A0.02","A0.03","A0.04","A0.05","A0.06","A0.07","A0.08","A0.09","A0.10","A0.11"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Dieselben A0-Ergebnisse und bisheriger Plan-/Istverlauf; unabhängig von R0.01 ausführbar.
- **Auftrag und Ergebnis:** Zweiter unabhängiger Agent prüft, ob Architektur-, Leistungs-, Qualitäts- und Aufwandannahmen den tatsächlichen Ergebnissen standhalten. Soll zum aktuellen Freigabepunkt gegen Ist und beobachteten Verbrauch vergleichen; notwendige Umplanung mit Ursache benennen.
- **Prüfung / fertig:** Begründete Steuerungsempfehlung oder ausdrücklich weiterhin tragfähige Planung. Unbekannte aktive Arbeitszeit, Geldkosten oder Zielhardwarebelege bleiben unbekannt; keine erfundenen Termin-/Kostenaussagen.

### R0.03 — Fixes, Neuplanung und Übergang nach A0 steuern

<!-- atlas-dependencies {"requires":["R0.01","R0.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** R0.01 und R0.02 beendet.
- **Auftrag und Ergebnis:** Konkrete Fixpakete bei Bedarf ergänzen, durch Agenten umsetzen lassen und unabhängig nachprüfen. Bei falscher Annahme Planversion, Abhängigkeiten, Schätzungen und Timeline aktualisieren; Planbasis und Änderungsgrund erhalten. Eigene Änderungen und native Belege auf denselben Stand bringen.
- **Prüfung / fertig:** Keine offenen erforderlichen Ergebnis- oder Planbefunde. Beide Reviewberichte auf gültigem Endstand, Ist-/Sollvergleich dokumentiert; erst dann A1 freigeben. Größere neue Arbeit bleibt ein eigenes Paket und wird nicht im Reviewauftrag versteckt.

## Gate nach A1

### R1.01 — Ergebnis von A1 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A1.01","A1.02","A1.03","A1.04","A1.05","A1.06","A1.07","A1.08","A1.09","A1.10","A1.11","A1.12"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Alle aktivierten Pakete von A1 abgeschlossen; tatsächliche Diffs, Tests und Artefakte verfügbar.
- **Auftrag und Ergebnis:** Nicht beteiligter Agent prüft Codekorrektheit, Regressionen, Sicherheits-/Datengrenzen und jeden Abnahmepunkt des Meilensteins. Geeignete gezielte Prüfungen selbst reproduzieren; keine bloße Übernahme der Implementiererzusammenfassung.
- **Prüfung / fertig:** Bericht mit konkreten Fixbefunden oder ohne offene Befunde auf benannter Code-/Buildrevision. Abweichungen nach Schwere und betroffener Anforderung zuordnen.

### R1.02 — Annahmen und Plan–Soll–Ist nach A1 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A1.01","A1.02","A1.03","A1.04","A1.05","A1.06","A1.07","A1.08","A1.09","A1.10","A1.11","A1.12"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Dieselben A1-Ergebnisse und bisheriger Plan-/Istverlauf; unabhängig von R1.01 ausführbar.
- **Auftrag und Ergebnis:** Zweiter unabhängiger Agent prüft, ob Architektur-, Leistungs-, Qualitäts- und Aufwandannahmen den tatsächlichen Ergebnissen standhalten. Soll zum aktuellen Freigabepunkt gegen Ist und beobachteten Verbrauch vergleichen; notwendige Umplanung mit Ursache benennen.
- **Prüfung / fertig:** Begründete Steuerungsempfehlung oder ausdrücklich weiterhin tragfähige Planung. Unbekannte aktive Arbeitszeit, Geldkosten oder Zielhardwarebelege bleiben unbekannt; keine erfundenen Termin-/Kostenaussagen.

### R1.03 — Fixes, Neuplanung und Übergang nach A1 steuern

<!-- atlas-dependencies {"requires":["R1.01","R1.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** R1.01 und R1.02 beendet.
- **Auftrag und Ergebnis:** Konkrete Fixpakete bei Bedarf ergänzen, durch Agenten umsetzen lassen und unabhängig nachprüfen. Bei falscher Annahme Planversion, Abhängigkeiten, Schätzungen und Timeline aktualisieren; Planbasis und Änderungsgrund erhalten. Eigene Änderungen und native Belege auf denselben Stand bringen.
- **Prüfung / fertig:** Keine offenen erforderlichen Ergebnis- oder Planbefunde. Beide Reviewberichte auf gültigem Endstand, Ist-/Sollvergleich dokumentiert; erst dann A2 freigeben. Größere neue Arbeit bleibt ein eigenes Paket und wird nicht im Reviewauftrag versteckt.

## Gate nach A2

### R2.01 — Ergebnis von A2 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A2.01","A2.02","A2.03","A2.04","A2.05","A2.06","A2.07","A2.08","A2.09","A2.10","A2.11","A2.12"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Alle aktivierten Pakete von A2 abgeschlossen; tatsächliche Diffs, Tests und Artefakte verfügbar.
- **Auftrag und Ergebnis:** Nicht beteiligter Agent prüft Codekorrektheit, Regressionen, Sicherheits-/Datengrenzen und jeden Abnahmepunkt des Meilensteins. Geeignete gezielte Prüfungen selbst reproduzieren; keine bloße Übernahme der Implementiererzusammenfassung.
- **Prüfung / fertig:** Bericht mit konkreten Fixbefunden oder ohne offene Befunde auf benannter Code-/Buildrevision. Abweichungen nach Schwere und betroffener Anforderung zuordnen.

### R2.02 — Annahmen und Plan–Soll–Ist nach A2 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A2.01","A2.02","A2.03","A2.04","A2.05","A2.06","A2.07","A2.08","A2.09","A2.10","A2.11","A2.12"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Dieselben A2-Ergebnisse und bisheriger Plan-/Istverlauf; unabhängig von R2.01 ausführbar.
- **Auftrag und Ergebnis:** Zweiter unabhängiger Agent prüft, ob Architektur-, Leistungs-, Qualitäts- und Aufwandannahmen den tatsächlichen Ergebnissen standhalten. Soll zum aktuellen Freigabepunkt gegen Ist und beobachteten Verbrauch vergleichen; notwendige Umplanung mit Ursache benennen.
- **Prüfung / fertig:** Begründete Steuerungsempfehlung oder ausdrücklich weiterhin tragfähige Planung. Unbekannte aktive Arbeitszeit, Geldkosten oder Zielhardwarebelege bleiben unbekannt; keine erfundenen Termin-/Kostenaussagen.

### R2.03 — Fixes, Neuplanung und Übergang nach A2 steuern

<!-- atlas-dependencies {"requires":["R2.01","R2.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** R2.01 und R2.02 beendet.
- **Auftrag und Ergebnis:** Konkrete Fixpakete bei Bedarf ergänzen, durch Agenten umsetzen lassen und unabhängig nachprüfen. Bei falscher Annahme Planversion, Abhängigkeiten, Schätzungen und Timeline aktualisieren; Planbasis und Änderungsgrund erhalten. Eigene Änderungen und native Belege auf denselben Stand bringen.
- **Prüfung / fertig:** Keine offenen erforderlichen Ergebnis- oder Planbefunde. Beide Reviewberichte auf gültigem Endstand, Ist-/Sollvergleich dokumentiert; erst dann A3 freigeben. Größere neue Arbeit bleibt ein eigenes Paket und wird nicht im Reviewauftrag versteckt.

## Gate nach A3

### R3.01 — Ergebnis von A3 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A3.01","A3.02","A3.03","A3.04","A3.05","A3.06","A3.07","A3.08","A3.09","A3.10","A3.11","A3.12"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Alle aktivierten Pakete von A3 abgeschlossen; tatsächliche Diffs, Tests und Artefakte verfügbar.
- **Auftrag und Ergebnis:** Nicht beteiligter Agent prüft Codekorrektheit, Regressionen, Sicherheits-/Datengrenzen und jeden Abnahmepunkt des Meilensteins. Geeignete gezielte Prüfungen selbst reproduzieren; keine bloße Übernahme der Implementiererzusammenfassung.
- **Prüfung / fertig:** Bericht mit konkreten Fixbefunden oder ohne offene Befunde auf benannter Code-/Buildrevision. Abweichungen nach Schwere und betroffener Anforderung zuordnen.

### R3.02 — Annahmen und Plan–Soll–Ist nach A3 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A3.01","A3.02","A3.03","A3.04","A3.05","A3.06","A3.07","A3.08","A3.09","A3.10","A3.11","A3.12"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Dieselben A3-Ergebnisse und bisheriger Plan-/Istverlauf; unabhängig von R3.01 ausführbar.
- **Auftrag und Ergebnis:** Zweiter unabhängiger Agent prüft, ob Architektur-, Leistungs-, Qualitäts- und Aufwandannahmen den tatsächlichen Ergebnissen standhalten. Soll zum aktuellen Freigabepunkt gegen Ist und beobachteten Verbrauch vergleichen; notwendige Umplanung mit Ursache benennen.
- **Prüfung / fertig:** Begründete Steuerungsempfehlung oder ausdrücklich weiterhin tragfähige Planung. Unbekannte aktive Arbeitszeit, Geldkosten oder Zielhardwarebelege bleiben unbekannt; keine erfundenen Termin-/Kostenaussagen.

### R3.03 — Fixes, Neuplanung und Übergang nach A3 steuern

<!-- atlas-dependencies {"requires":["R3.01","R3.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** R3.01 und R3.02 beendet.
- **Auftrag und Ergebnis:** Konkrete Fixpakete bei Bedarf ergänzen, durch Agenten umsetzen lassen und unabhängig nachprüfen. Bei falscher Annahme Planversion, Abhängigkeiten, Schätzungen und Timeline aktualisieren; Planbasis und Änderungsgrund erhalten. Eigene Änderungen und native Belege auf denselben Stand bringen.
- **Prüfung / fertig:** Keine offenen erforderlichen Ergebnis- oder Planbefunde. Beide Reviewberichte auf gültigem Endstand, Ist-/Sollvergleich dokumentiert; erst dann A4 freigeben. Größere neue Arbeit bleibt ein eigenes Paket und wird nicht im Reviewauftrag versteckt.

## Gate nach A4

### R4.01 — Ergebnis von A4 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A4.01","A4.02","A4.03","A4.04","A4.05","A4.06","A4.07","A4.08","A4.09"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Alle aktivierten Pakete von A4 abgeschlossen; tatsächliche Diffs, Tests und Artefakte verfügbar.
- **Auftrag und Ergebnis:** Nicht beteiligter Agent prüft Codekorrektheit, Regressionen, Sicherheits-/Datengrenzen und jeden Abnahmepunkt des Meilensteins. Geeignete gezielte Prüfungen selbst reproduzieren; keine bloße Übernahme der Implementiererzusammenfassung.
- **Prüfung / fertig:** Bericht mit konkreten Fixbefunden oder ohne offene Befunde auf benannter Code-/Buildrevision. Abweichungen nach Schwere und betroffener Anforderung zuordnen.

### R4.02 — Annahmen und Plan–Soll–Ist nach A4 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A4.01","A4.02","A4.03","A4.04","A4.05","A4.06","A4.07","A4.08","A4.09"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Dieselben A4-Ergebnisse und bisheriger Plan-/Istverlauf; unabhängig von R4.01 ausführbar.
- **Auftrag und Ergebnis:** Zweiter unabhängiger Agent prüft, ob Architektur-, Leistungs-, Qualitäts- und Aufwandannahmen den tatsächlichen Ergebnissen standhalten. Soll zum aktuellen Freigabepunkt gegen Ist und beobachteten Verbrauch vergleichen; notwendige Umplanung mit Ursache benennen.
- **Prüfung / fertig:** Begründete Steuerungsempfehlung oder ausdrücklich weiterhin tragfähige Planung. Unbekannte aktive Arbeitszeit, Geldkosten oder Zielhardwarebelege bleiben unbekannt; keine erfundenen Termin-/Kostenaussagen.

### R4.03 — Fixes, Neuplanung und Übergang nach A4 steuern

<!-- atlas-dependencies {"requires":["R4.01","R4.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** R4.01 und R4.02 beendet.
- **Auftrag und Ergebnis:** Konkrete Fixpakete bei Bedarf ergänzen, durch Agenten umsetzen lassen und unabhängig nachprüfen. Bei falscher Annahme Planversion, Abhängigkeiten, Schätzungen und Timeline aktualisieren; Planbasis und Änderungsgrund erhalten. Eigene Änderungen und native Belege auf denselben Stand bringen.
- **Prüfung / fertig:** Keine offenen erforderlichen Ergebnis- oder Planbefunde. Beide Reviewberichte auf gültigem Endstand, Ist-/Sollvergleich dokumentiert; erst dann A5 freigeben. Größere neue Arbeit bleibt ein eigenes Paket und wird nicht im Reviewauftrag versteckt.

## Gate nach A5

### R5.01 — Ergebnis von A5 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A5.01","A5.02","A5.03","A5.04","A5.05","A5.06","A5.07","A5.08","A5.09"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Alle aktivierten Pakete von A5 abgeschlossen; tatsächliche Diffs, Tests und Artefakte verfügbar.
- **Auftrag und Ergebnis:** Nicht beteiligter Agent prüft Codekorrektheit, Regressionen, Sicherheits-/Datengrenzen und jeden Abnahmepunkt des Meilensteins. Geeignete gezielte Prüfungen selbst reproduzieren; keine bloße Übernahme der Implementiererzusammenfassung.
- **Prüfung / fertig:** Bericht mit konkreten Fixbefunden oder ohne offene Befunde auf benannter Code-/Buildrevision. Abweichungen nach Schwere und betroffener Anforderung zuordnen.

### R5.02 — Annahmen und Plan–Soll–Ist nach A5 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A5.01","A5.02","A5.03","A5.04","A5.05","A5.06","A5.07","A5.08","A5.09"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Dieselben A5-Ergebnisse und bisheriger Plan-/Istverlauf; unabhängig von R5.01 ausführbar.
- **Auftrag und Ergebnis:** Zweiter unabhängiger Agent prüft, ob Architektur-, Leistungs-, Qualitäts- und Aufwandannahmen den tatsächlichen Ergebnissen standhalten. Soll zum aktuellen Freigabepunkt gegen Ist und beobachteten Verbrauch vergleichen; notwendige Umplanung mit Ursache benennen.
- **Prüfung / fertig:** Begründete Steuerungsempfehlung oder ausdrücklich weiterhin tragfähige Planung. Unbekannte aktive Arbeitszeit, Geldkosten oder Zielhardwarebelege bleiben unbekannt; keine erfundenen Termin-/Kostenaussagen.

### R5.03 — Fixes, Neuplanung und Übergang nach A5 steuern

<!-- atlas-dependencies {"requires":["R5.01","R5.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** R5.01 und R5.02 beendet.
- **Auftrag und Ergebnis:** Konkrete Fixpakete bei Bedarf ergänzen, durch Agenten umsetzen lassen und unabhängig nachprüfen. Bei falscher Annahme Planversion, Abhängigkeiten, Schätzungen und Timeline aktualisieren; Planbasis und Änderungsgrund erhalten. Eigene Änderungen und native Belege auf denselben Stand bringen.
- **Prüfung / fertig:** Keine offenen erforderlichen Ergebnis- oder Planbefunde. Beide Reviewberichte auf gültigem Endstand, Ist-/Sollvergleich dokumentiert; erst dann A6 freigeben. Größere neue Arbeit bleibt ein eigenes Paket und wird nicht im Reviewauftrag versteckt.

## Gate nach A6

### R6.01 — Ergebnis von A6 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A6.01","A6.02","A6.03","A6.04","A6.05","A6.06","A6.07","A6.08","A6.09","A6.10"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Alle aktivierten Pakete von A6 abgeschlossen; tatsächliche Diffs, Tests und Artefakte verfügbar.
- **Auftrag und Ergebnis:** Nicht beteiligter Agent prüft Codekorrektheit, Regressionen, Sicherheits-/Datengrenzen und jeden Abnahmepunkt des Meilensteins. Geeignete gezielte Prüfungen selbst reproduzieren; keine bloße Übernahme der Implementiererzusammenfassung.
- **Prüfung / fertig:** Bericht mit konkreten Fixbefunden oder ohne offene Befunde auf benannter Code-/Buildrevision. Abweichungen nach Schwere und betroffener Anforderung zuordnen.

### R6.02 — Annahmen und Plan–Soll–Ist nach A6 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A6.01","A6.02","A6.03","A6.04","A6.05","A6.06","A6.07","A6.08","A6.09","A6.10"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Dieselben A6-Ergebnisse und bisheriger Plan-/Istverlauf; unabhängig von R6.01 ausführbar.
- **Auftrag und Ergebnis:** Zweiter unabhängiger Agent prüft, ob Architektur-, Leistungs-, Qualitäts- und Aufwandannahmen den tatsächlichen Ergebnissen standhalten. Soll zum aktuellen Freigabepunkt gegen Ist und beobachteten Verbrauch vergleichen; notwendige Umplanung mit Ursache benennen.
- **Prüfung / fertig:** Begründete Steuerungsempfehlung oder ausdrücklich weiterhin tragfähige Planung. Unbekannte aktive Arbeitszeit, Geldkosten oder Zielhardwarebelege bleiben unbekannt; keine erfundenen Termin-/Kostenaussagen.

### R6.03 — Fixes, Neuplanung und Übergang nach A6 steuern

<!-- atlas-dependencies {"requires":["R6.01","R6.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** R6.01 und R6.02 beendet.
- **Auftrag und Ergebnis:** Konkrete Fixpakete bei Bedarf ergänzen, durch Agenten umsetzen lassen und unabhängig nachprüfen. Bei falscher Annahme Planversion, Abhängigkeiten, Schätzungen und Timeline aktualisieren; Planbasis und Änderungsgrund erhalten. Eigene Änderungen und native Belege auf denselben Stand bringen.
- **Prüfung / fertig:** Keine offenen erforderlichen Ergebnis- oder Planbefunde. Beide Reviewberichte auf gültigem Endstand, Ist-/Sollvergleich dokumentiert; erst dann A7 freigeben. Größere neue Arbeit bleibt ein eigenes Paket und wird nicht im Reviewauftrag versteckt.

## Gate nach A7

### R7.01 — Ergebnis von A7 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A7.01","A7.02","A7.03","A7.04","A7.05","A7.06","A7.21","A7.22","A7.23","A7.07","A7.08","A7.09","A7.10","A7.11","A7.12","A7.13","A7.14","A7.15","A7.16","A7.17","A7.18","A7.19","A7.20"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Alle aktivierten Pakete von A7 abgeschlossen; tatsächliche Diffs, Tests und Artefakte verfügbar.
- **Auftrag und Ergebnis:** Nicht beteiligter Agent prüft Codekorrektheit, Regressionen, Sicherheits-/Datengrenzen und jeden Abnahmepunkt des Meilensteins. Geeignete gezielte Prüfungen selbst reproduzieren; keine bloße Übernahme der Implementiererzusammenfassung.
- **Prüfung / fertig:** Bericht mit konkreten Fixbefunden oder ohne offene Befunde auf benannter Code-/Buildrevision. Abweichungen nach Schwere und betroffener Anforderung zuordnen.

### R7.02 — Annahmen und Plan–Soll–Ist nach A7 unabhängig prüfen

<!-- atlas-dependencies {"requires":["A7.01","A7.02","A7.03","A7.04","A7.05","A7.06","A7.21","A7.22","A7.23","A7.07","A7.08","A7.09","A7.10","A7.11","A7.12","A7.13","A7.14","A7.15","A7.16","A7.17","A7.18","A7.19","A7.20"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Dieselben A7-Ergebnisse und bisheriger Plan-/Istverlauf; unabhängig von R7.01 ausführbar.
- **Auftrag und Ergebnis:** Zweiter unabhängiger Agent prüft, ob Architektur-, Leistungs-, Qualitäts- und Aufwandannahmen den tatsächlichen Ergebnissen standhalten. Soll zum aktuellen Freigabepunkt gegen Ist und beobachteten Verbrauch vergleichen; notwendige Umplanung mit Ursache benennen.
- **Prüfung / fertig:** Begründete Steuerungsempfehlung oder ausdrücklich weiterhin tragfähige Planung. Unbekannte aktive Arbeitszeit, Geldkosten oder Zielhardwarebelege bleiben unbekannt; keine erfundenen Termin-/Kostenaussagen.

### R7.03 — Fixes, Neuplanung und Übergang nach A7 steuern

<!-- atlas-dependencies {"requires":["R7.01","R7.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** R7.01 und R7.02 beendet.
- **Auftrag und Ergebnis:** Konkrete Fixpakete bei Bedarf ergänzen, durch Agenten umsetzen lassen und unabhängig nachprüfen. Bei falscher Annahme Planversion, Abhängigkeiten, Schätzungen und Timeline aktualisieren; Planbasis und Änderungsgrund erhalten. Eigene Änderungen und native Belege auf denselben Stand bringen.
- **Prüfung / fertig:** Keine offenen erforderlichen Ergebnis- oder Planbefunde. Beide Reviewberichte auf gültigem Endstand, Ist-/Sollvergleich dokumentiert; erst dann Gesamtabschluss gegen den vollständigen Nutzerauftrag auditieren. Größere neue Arbeit bleibt ein eigenes Paket und wird nicht im Reviewauftrag versteckt.

## Abschluss nach R7.03

Der Koordinator führt diese begrenzten Abschlussaufträge anhand der integrierten
Ergebnisse, geltenden Ziele, Planänderungen und Prüfbelege aus. Fachkompetenz:
fachliche Zielprüfung, verständliche Bedien-/Belegübergabe und Ursachenbewertung.
Fehlende Ergebnisse gehen als benannte Arbeit zurück an die Steuerung; weder die
ursprünglichen Ziele noch offene Nutzerentscheidungen werden stillschweigend
verkleinert. Die Antwort des Auftraggebers ist kein geschätzter Agentenlaufaufwand
und kein durch verstrichene Zeit erfülltes Gate.

### C0.01 — Gesamtergebnis vorlegen und Nutzerabnahme einholen

<!-- atlas-dependencies {"requires":["R7.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** R7.03 ohne offene erforderliche Ergebnis-/Planbefunde; vollständiger reviewbarer Gesamtstand mit Build-/Lieferidentität und Abweichungsbericht.
- **Auftrag und Ergebnis:** Ergebnis im Zusammenspiel gegen den vollständigen vereinbarten Nutzerauftrag prüfen und dem Auftraggeber eine kompakte, tatsächlich überprüfbare Vorlage mit Bediennachweisen, Zielwerten, Lieferstand und verbleibenden Grenzen zeigen. Erst mit dieser konkreten Vorlage um Nutzerabnahme bitten; technische Tests und unabhängige Reviews erteilen sie nicht selbst. Entscheidung mit Datum und Bezugsstand in den vorhandenen Projektunterlagen festhalten.
- **Prüfung / fertig:** `userAcceptance` bleibt bis zu einer ausdrücklichen, zum vorgelegten Stand gehörenden Antwort offen. Bei Ablehnung die benannten Mängel an die Steuerung zurückgeben und nach Korrektur erneut vorlegen; Schweigen oder ein noch laufendes Review gilt nicht als Zustimmung. Abschluss nur bei tatsächlicher Abnahme ohne offene erforderliche Kriterien; genehmigte Zieländerungen bleiben nachvollziehbar.

### C0.02 — Bedienung, Belege und Restzuständigkeiten übergeben

<!-- atlas-dependencies {"requires":["C0.01"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** C0.01 mit belegter Nutzerabnahme; die zugehörigen Quellen, Artefakte und Bedienhinweise sind erreichbar.
- **Auftrag und Ergebnis:** Vorhandene Bedien-/Architektureinstiege und Belegreferenzen auf den abgenommenen Stand bringen, reproduzierbare Prüf-/Buildaufrufe übergeben und verbleibende erlaubte Einschränkungen mit konkreter Zuständigkeit und nächstem Anlass festhalten. Endstand und einzigartige eigene Arbeit im permanenten Checkout sichern; temporäre Checkouts gemäß `AGENTS.md` vollständig zurückführen und danach aufräumen.
- **Prüfung / fertig:** Auftraggeber findet Bedienung, Ergebnis, Versionsidentität und Prüfnachweise über die bestehenden Einstiege. Restpunkte besitzen einen benannten Besitzer oder sind ausdrücklich als noch nicht zugewiesen offen; keine Zuständigkeit erfinden. Keine jüngste Arbeit ausschließlich in temporären Dateien oder Agentenchats.

### C0.03 — Ursachen und Lernerfahrungen sichern und Arbeit beenden

<!-- atlas-dependencies {"requires":["C0.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** C0.02 abgeschlossen; dokumentierte Abweichungen, Fix-/Reviewrunden und tatsächlicher Aufwand verfügbar.
- **Auftrag und Ergebnis:** Wesentliche Planabweichungen, ihre belegten Ursachen und konkrete Verbesserungen in den bestehenden Projektunterlagen festhalten; erfolgreiche und verworfene Architekturwege unterscheiden. Nicht mehr benötigte task-eigene Agentenarbeit geordnet beenden und offene Restaufträge eindeutig übergeben. Pausierte Automationen und fremde Arbeit bleiben unter ihrem bestehenden Besitzer; keine neue Nachlaufarbeit ohne Auftrag starten.
- **Prüfung / fertig:** Endbericht nennt Zielerreichung, Belege, reale Nutzerabnahme und Restzuständigkeiten. Kein benötigter Auftrag ist verwaist, keine unnötige task-eigene Arbeit läuft weiter. Fehlende Abnahmekriterien halten den Gesamtabschluss offen; Lernerfahrungen werden nicht ungefragt in persönliche Codex-Memories geschrieben.
