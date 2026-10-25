# Atlas-Performance: Projekthandbuch

Status: Executing A0; Planbasis v1 unabhängig freigegeben, erste Produktpakete in Arbeit.
Owner: atlas
Last Reviewed: 2026-10-25
Source of Truth: Ausführungsregeln, Steuerungsentscheidungen und Beleggrenzen dieses Vorhabens. Fachumfang und Leistungsziele bleiben in der [Roadmap](../performance-roadmap.md).

## Auftrag und Zuständigkeiten

Der aktuelle Auftrag verlangt die vollständige Skill-Kette project-preflight →
practical-planner → project-steering → project-closure. Bereits abgestimmte Ziele
werden übernommen. Die frühere Interpretation der bloßen Ablage als Pausenauftrag
war falsch und ist aufgehoben; pausierte Projekt-Automationen bleiben unverändert.

Der Nutzer beauftragt Paketzerlegung, Architekturprüfung mit nötigen Fixes,
abhängigkeitsbasierte Balken-Timeline, unabhängige Planreviews bis keine offenen
begründeten Befunde verbleiben und danach schrittweise Umsetzung durch Agenten.
Nach jedem Meilenstein folgen unabhängige Ergebnis- und Annahmenreviews, Fixes
und gegebenenfalls Neuplanung. Der Hauptagent koordiniert, bewahrt den gemeinsamen
Stand und prüft Übergaben; Implementierer liefern je ein benanntes Paket.

- Maximal drei arbeitende Unteragenten neben dem Koordinator. Auftrag enthält Paket-ID, Eingaben, erlaubte Schreibbereiche, erwartetes Ergebnis und Prüfungen.
- Keine parallelen Änderungen an demselben Codebesitzer. Native Messungen exklusiv auf dem Zielgerät; während eines gepinnten nativen Laufs dessen Buildinputs nicht ändern. Timeline-Überlappung ist erlaubte fachliche Parallelität, keine Pflicht zur gleichzeitigen Arbeit.
- Permanenter Checkout laut `AGENTS.md`; eigene Änderungen und fremde Arbeit unterscheiden. Vor jedem Lauf Zustand und Vorgängerbelege prüfen. Temporäre Checkouts nur bei tatsächlichem Isolationsbedarf, anschließend vollständig zurückführen und aufräumen.
- Reviews unabhängig vom jeweiligen Implementierer und ohne dessen Chatverlauf: tatsächlicher Diff, Anforderungen, Tests und Artefakte sind die Grundlage. Agentenberichte allein ersetzen keine Prüfung ihrer Belege.
- Kein automatischer Übergang zum nächsten Meilenstein bei offenem erforderlichen Befund. Korrekturen als benannte Unterpakete erfassen und mit demselben Befund erneut unabhängig reviewen. Kein Reviewabbruch nach einer festen Anzahl Runden; keine begründete Kritik als bloße Präferenz abtun.

## Zielübernahme und Phasenübergaben

**Preflight:** Zielgruppe sind Spielleitungen, die Welt, Stadt, Dorf und Innenräume
im selben Atlas ansehen und bearbeiten. Der belegte Ausgangspunkt ist zu langsame
Navigation und Pinselreaktion, nicht ein fehlender Funktionsumfang. Die bestehende
Prozess-/Speichertrennung ist nutzbar; die [Architekturprüfung](architecture-audit.md)
nennt konkrete Korrektheitslücken. Messlücken und noch unbewiesene GPU-Ursachen
bleiben Risiken. Die Architektur darf sich ändern; Bildqualität, Detailumfang,
Auswahl, Datenintegrität und GM-/Spielertrennung bleiben verbindlich.

Die verbindlichen Ziele und Messumfänge stehen einmalig in der
[Roadmap](../performance-roadmap.md#meilensteinziele): geladene Navigation in A4,
sichtbare Bearbeitung in A5, Öffnen/Nachladen in A6 und vollständige Qualifikation
in A7. Fälligkeit ist jeweils der dort genannte Meilensteinabschluss. Ein absolutes
Lieferdatum wurde nicht vereinbart. Die 4–8 Personenwochen sind eine Schätzung,
kein nachträglich behaupteter Nutzertermin. Die Architekturwege und ihre
Nutzen-/Aufwandsentscheidung stehen in A2 und der Tabelle bedingter Wege; sie
werden anhand identischer Messungen entschieden, ohne die Qualitätsziele zu senken.

**Planner:** Paketdateien bilden den hierarchischen Projektstrukturplan;
Paketgraph und Timeline bilden den ressourcenabhängigen Ablaufplan. Vor Übergabe
an Steering müssen unabhängige Reviews alle erforderlichen Befunde schließen.
Der Koordinator prüft dabei Eingaben, Schnittstellen, Zuständigkeiten, Kompetenz,
Aufwand und Abnahme jedes Pakets. Fachkompetenz ist je nach Paket TypeScript/
Electron/SQLite, GPU-Darstellung oder native Messung; die Zuweisung benennt den
konkreten Agenten und seine Schreibbereiche. Gemeinsame Vorgaben stehen in den
[Paketregeln](../performance-roadmap.md#arbeitspakete-und-ausführung).

**Steering:** Nach Planfreigabe folgen A0–A7 samt ihren unabhängigen Reviews.
Meilensteinintegration und erforderliche Candidate-Prüfung liegen vor dem
Phasenwechsel; Arbeitsstand, lokale Tests, Integration und Produktabnahme werden
getrennt nachgewiesen. Kein Überspringen von Fixes wegen Schätzungsüberschreitung.

**Closure:** Nach A7 wird die gesamte Zielmatrix gegen integrierte Ergebnisse
geprüft. Übergabe umfasst Bedien-/Architekturdokumentation, Belege, Änderungen,
Restzuständigkeiten und Lernerfahrungen. Technische Prüfung ersetzt keine
Nutzerabnahme; diese wird mit dem konkreten geprüften Ergebnis eingeholt und
bis dahin als offen geführt. Fehlende Ergebnisse gehen zurück an Steering.

## Gemeinsamer Paketvertrag

Jedes Paket hat bei Zuweisung genau einen verantwortlichen Implementierer; P-/R-
Reviews erhalten einen unbeteiligten Reviewer, Steuerungspakete den Koordinator.
Die Zuweisung nennt Paket-ID, Agent, konkrete Schreibbereiche und die fällige
Übergabe. Die Fachkompetenz richtet sich nach dem Paketprofil und genannten
Codebesitzer: TypeScript/Electron-Lebenszyklus, SQLite/Receipt-Verträge,
GPU-/Geometriearbeit oder native Messmethodik. Bei fehlender Kompetenz neu zuweisen,
keine stillschweigende Auslassung des schwierigen Teils.

Eingaben sind die benannten Fachquellen, Ergebnisse der maschinenlesbaren
Vorgänger und der exakte Code-/Build-/Fixturestand. Ausgang ist das beschriebene
Ergebnis samt tatsächlich ausgeführten Tests, Artefakten, Grenzen und notwendigen
Informationen für Nachfolger. JSON-Schreibbereiche und native Buildbindung
konkretisieren die gemeinsam genutzten Schnittstellen; Main besitzt native
Fähigkeiten und IPC, der Store-Worker die kanonische SQLite-Schreibverbindung.
Der Renderer nutzt die eingeschränkte Preload-Brücke. Neue Verträge müssen mit
ihren Verbrauchern zusammen geprüft werden.

Aufwand und Dauer sind Schätzungen im Paketgraphen, keine Abbruchfristen.
Ein Lauf umfasst typischerweise 1–3 Stunden aktive Arbeit; Mess-/CI-Warten wird
getrennt ausgewiesen. Größer werdende Pakete vor Fortsetzung mit klaren Ergebnissen
teilen, Auswirkungen auf Vorgänger/Nachfolger und Timeline aktualisieren. Eine
Überschreitung ändert weder Qualitätsziel noch Abnahme. Vor nativer Prüfung bleiben
deren Buildinputs unverändert; währenddessen keine parallele Produktänderung im
gemeinsamen Checkout. Reine Dokumentation kann unabhängig weitergeführt werden.

## Plan, Soll und Ist

Die unabhängig freigegebene **[Planbasis v1](plan-basis-v1.json)** ist mit
Dateiprüfsummen und Reviewbelegen gesichert; ihr vollständiger Inhalt liegt im
Git-Commit `97b47da21df2d1456a37bdfc306030d5861e8b5c`. Vorherige Fassungen sind Arbeitsentwürfe. Anpassungen
erhalten fortlaufende Version und Grund; die Ausgangsbasis wird nicht nachträglich
an den Iststand angeglichen.

| Größe | Führung und Vergleich |
| --- | --- |
| Plan | Pakete, Abhängigkeiten, Leistungs-/Qualitätsziele und Aufwandsschätzung der freigegebenen Basis |
| Soll | Die bei aktuellem Durchführungsstand freigegebenen/zu beendenden Pakete samt ihren Gates; ohne vereinbarten Kalendertermin keine erfundene Terminabweichung |
| Ist | Tatsächliche Starts/Enden, Agent/Revision, Ergebnisse, Test-/Messartefakte, offene Befunde und erfüllte Gates |
| Aufwand/Kosten | Agentenlaufzahl und beobachtete Laufzeit einschließlich gesonderter Wartezeiten; aktive Personenstunden und Geldkosten nur bei tatsächlicher Erhebung bzw. bekanntem Satz. Tokenwerte nur aus verfügbaren Nutzungsdaten, nicht schätzen |
| Abweichung | Fehlendes Ergebnis, überschrittene Schätzung, neue Abhängigkeit, Ressourcenengpass oder falsche Annahme; Ursache und nächste Steuerungsmaßnahme benennen |

Jeder Balken repräsentiert einen abgegrenzten Agentenlauf. Seine relative Dauer
folgt der paketbezogenen Erstschätzung im Graphen: aktive Arbeit, unsichere
native/CI-Wartezeit und ausgewiesene Reserve. Überlappung verringert die geplante
Durchlaufzeit, nicht die Summe aktiver Arbeit. Die Achse ist kein Kalender und
unterstellt verfügbare Agenten-/Hostkapazität; Unterbrechungen werden im Iststand
erfasst. Die ursprünglichen 4–8 Personenwochen plus A0 sind eine grobe frühere
Schätzung. Nach A0 und A2 sowie jedem weiteren Meilenstein wird sie gegen
beobachtete Paketgrößen und verbleibende Arbeit geprüft. Es gibt keinen vereinbarten
Fixtermin oder Geldbetrag; diese dürfen nicht als eingehalten behauptet werden.

Nach **jedem Paket** Übergabe und Iststand aktualisieren. Nach **jedem Meilenstein**
Plan–Soll–Ist vergleichen, Ursachen beurteilen und Korrektur/Umplanung entscheiden.
Bei schwerem neuem Befund unmittelbar reagieren, nicht auf den Meilenstein warten.

## Managementzyklus und Nachweise

1. Plan und reale Voraussetzungen prüfen; nächstes freigegebenes Paket auswählen.
2. Begrenzt implementieren und relevante Prüfungen ausführen; tatsächlichen Aufwand und Artefakte erfassen.
3. Unabhängig Ergebnis, Wirkung und Planannahmen prüfen. Besonders: GPU-/CPU-Ursache, Quellenbereitschaft, Messpunkt, Gleichwertigkeit und Paketgröße.
4. Abweichungen erklären; Fixpaket, verworfenen Versuch, neue Reihenfolge oder aktualisierte Schätzung dokumentieren.
5. Angepasste Planung unabhängig prüfen; Timeline neu erzeugen und erst dann abhängige Arbeit fortsetzen.

Die Timeline und ihr maschinenlesbarer Paketgraph werden zusammen aus den
Paketdefinitionen geführt. Erfolgreiche Tests, fehlgeschlagene Versuche und
offene Einschränkungen bleiben unterscheidbar. Fachliche Testlinks wohnen weiterhin
im vorhandenen Capability-Katalog; hier entsteht keine parallele Abnahmedatenbank.

## Aktueller Stand und Entscheidungen

| Datum | Ist / Entscheidung | Auswirkung |
| --- | --- | --- |
| 2026-10-25 | A1–A7 und bedingte Wege in fokussierte Pakete zerlegt; nur Dokumentation verändert | Produktumsetzung noch offen |
| 2026-10-25 | Unabhängige Planreviews finden RAF-Messlücke, fehlendes Streamingziel, zu späte Schließreparatur und zu breite Pakete | Primärmetrik neue Renderframes; Streaminghalbierung ergänzt; B4/Innenräume geteilt; früher Fix |
| 2026-10-25 | Unabhängige Architekturprüfungen beurteilen Grundlage mit konkreten Fixes als tragfähig | A0 vor A1: Frameberechtigung, Retry, Alpha, Verbraucherabbruch, Graphbarriere, Write-Outcomes/Postcommit-Lesen |
| 2026-10-25 | Vermuteter gewöhnlicher Spieler-Sync-Fehler bereits im Besitzer abgefangen | Nicht als Defekt/unnötiges Fixpaket weitergeführt |
| 2026-10-25 | Nutzer erweitert Auftrag um laufendes Controlling und unabhängige Annahmenprüfung | Meilenstein-Reviewgates und fortgeschriebene Planbasis verbindlich |
| 2026-10-25 | Ablage wurde irrtümlich als Pause interpretiert; Nutzer beauftragt ausdrücklich die vollständige Skill-Kette | Gesamtziel aktiv; Ziele übernommen, offene Planbefunde werden geschlossen |
| 2026-10-25 | Skill-Abgleich verlangt relativen Schätzterminplan und explizite Abschlussphase | Aufwand/Dauer/Puffer sowie echte Abnahme und Übergabe werden vor Planfreigabe ergänzt |
| 2026-10-25 | Originalmessungen vor Produktänderungen inventarisiert: 107 Dateien, 29.049.331 Bytes | Lokales Manifest `.build/atlas-performance-plan/original-measurements-manifest.json`, SHA-256 `701fb83d5d91b75032ecdae5d6a9ef3c974df0d48f5b77b2356771c072670445`; dauerhafte Vergleichsablage bleibt A1.01 |

## Abschluss der Planreviews

Stand 2026-10-25: Nach Korrektur der folgenden Befunde haben P0.01 und P0.02
unabhängig keine offenen begründeten Planbefunde gemeldet. Beide prüften denselben
unveränderten Stand mit 17 Dateiprüfsummen; Zuordnung und Belege stehen in der
Planbasis. P0.03 ist abgeschlossen. Der irrtümliche Pausenvermerk wurde korrigiert.

- **Parallelität:** Gemeinsame Schreibbereiche und unveränderte Buildinputs sind im Scheduler abgebildet. A1.04/A1.07/A1.08 sowie A0.06/A0.10 kollidieren nicht mehr; A0.07 und A0.10 belegen den nativen Host.
- **B4-Alternative:** Render- und Compute-Route werden getrennt berechnet. Aktivierungs- und Rückkehrgates einschließlich A6.08 für Compute sind explizit.
- **Reihenfolge:** A1/A2-Kopftexte entsprechen den Verzweigungen. Vier maschinenlesbare Abhängigkeitsfelder pro Paket werden zwischen Markdown und Graph verglichen.
- **Messnachweis A1.04:** GPU-/Präsentationsrückstand und künstliche Verzögerung sind verpflichtende Gegenproben; CPU-Submission allein gibt keinen sichtbaren Navigations-Pass.
- **Postcommit A0.09:** `atlasRoomCommit` und seine `RoomCommit`-Leseprojektion sind ausdrücklich mit Receipt, Kennung und unverändertem Historyschritt enthalten.

Die Liste dokumentiert die behobenen Reviewbefunde. Die strukturelle Prüfung
bestätigt zusätzlich Paketvollständigkeit und erzeugten Dateistand. Sieben gezielte
Scheduler-/Routentests und Repository-/Diffprüfungen bestanden. Browserprüfung:
154 Zeilen, lesbare Zeitachse; B4-Compute aktiviert nur B4.01, B4.07 und B4.05,
zeigt A6.08 als Eingang und A6.09/A6.10 als Rückkehr. Die übrigen B4-Pakete bleiben
sichtbar als inaktive Alternativen.

## Laufende Durchführung

| Paket | Verantwortlich | Ist und nächstes Gate |
| --- | --- | --- |
| P0.01 / P0.02 | plan_final_review / review_architecture | Unabhängig abgeschlossen, siehe Planbasis; keine Produktabnahme |
| P0.03 | Koordinator | Planbasis gesichert; Übergang an project-steering |
| A0.01 | review_packages | Beauftragt: produktive Framebindung; Präsentation/Canvas/Surface und eigene Regressionen |
| A0.04 | audit_atlas_boundaries | Beauftragt: Verbraucherabbruch; Main/Lesedienst/Ausgabevertrag und eigene Regressionen |

Die beiden ersten Pakete bearbeiten getrennte Besitzer. Native Läufe beginnen
erst bei gesperrten Buildinputs. Testassets einmal mit `node build.mjs --test`
vorbereitet. Starts/Enden und Status im Paketgraphen; unbekannte aktive Arbeitszeit
wird nicht aus verstrichener Laufzeit abgeleitet. A0 bleibt offen bis eigenen
Paketnachweisen, unabhängigen Reviews, Fixes und erforderlicher Integration.

## Abschlussgrenzen

Ein Paket kann seine Untersuchung mit einem negativen Ergebnis abschließen; das
Leistungsziel gilt dadurch nicht als erreicht. Implementiert, lokal getestet,
nativ qualifiziert, integriert, veröffentlicht/installiert und vom Nutzer
abgenommen sind getrennte Zustände. Das Gesamtziel ist erst erreicht, wenn die
beauftragte Umsetzung samt Reviews/Fixes abgeschlossen und alle erforderlichen
Liefer- und Abnahmegrenzen ehrlich ausgewiesen sind. Ausbleibende Kritik eines
noch laufenden Reviewers ist keine Freigabe.
