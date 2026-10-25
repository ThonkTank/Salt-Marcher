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
Nach jeder Kontextzusammenfassung wird der aktuell relevante Skill erneut gelesen.
Die regelmäßigen Reviewagenten verwenden zusätzlich `architecture-review` und
`documentation-review`, jeweils lesend und mit konkretem Prüfbereich. Erforderliche
Korrekturen übernimmt anschließend die bestehende Steuerung.

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
| 2026-10-25 | v1.1 konkretisiert Schreibschnittstellen: A0.01 benötigt den Präsentationsvertrag; A0.04 Consumertransport bis Preload/Tile-Fetcher/Export | Getrennte Besitzer bleiben erhalten; Planbasis v1 unverändert in Git, aktuelle Ressourcen im Graph |
| 2026-10-25 | A0.04: reines Umrouten auf den Editorleser kollidiert mit dessen einzelner Terrain-Wartespur | Feste begrenzte Surface-/Geometry-Spuren und kooperative Unterbrechung als notwendige Abbruchkorrektur untersuchen; keine neuen Worker, keine Wiederholung echter Fehler/Schreibaufträge; im A0-Review gezielt prüfen |
| 2026-10-25 | Unabhängige Annahmenprüfung von review_architecture bestätigt A0.04-Erweiterung innerhalb des Pakets | Vor Abschluss: Identität/Cancelgeneration erhalten, echter mehrschrittiger Tilejob trotz Kamera/Geometrie vollständig korrekt, keine Wiederbelebung nach Fehler/Cancel/Ersetzung, endlicher Fortschritt und konstante Worker-/Queuegrenzen nachweisen |
| 2026-10-25 | v1.2: Nutzer ergänzt Architecture-/Documentation-Review-Skills für die regelmäßigen Prüfer und erneutes Skilllesen nach Kontextzusammenfassungen | In bestehende Rn.01/Rn.02 eingebunden; keine neue Berichtsserie oder Verkleinerung des Auftrags |
| 2026-10-25 | A0.10 findet fehlenden Atlas-Deactivate-Hook in der Workspace-Registry; vorhandenes `hide()` beendet Präsentation und Nachladung bereits | Zusätzliche Schreibbereiche `workspace-editors.ts`, `renderer.ts` und Registry-Test freigegeben; exklusive native Gegenprobe erforderlich |

Version v1.3 ergänzt nach unabhängiger Zwischenprüfung das erforderliche Fixpaket
A0.12: Ein GPU-Fehler während eines ausstehenden Canvas-Batches hinterlässt den
Canvas im Fehlerzustand, obwohl der Raster-Retry wieder bereit ist. Der bisherige
isolierte Retrytest deckt den Besitzerverbund nicht ab. A0.11 und beide R0-Reviews
warten zusätzlich auf den Verbundfix. Die ursprüngliche Planbasis bleibt erhalten;
der aktuelle Graph enthält 155 Pakete. Umfang und Ziele A1–A7 bleiben unverändert.
Die unabhängige Prüfung durch `a0_interim_review` bestätigt v1.3 ohne offene
erforderliche Plan-/Dokubefunde. Sie hat den aktuellen Leseweg, alle 155 Pakete,
Abhängigkeiten und die generierte Timeline geprüft. Der Implementierungsbefund
bleibt bis Verbundfix, nativer Probe und Ergebnisreview offen.

Version v1.4 konkretisiert nach der lesenden A0.06/A0.09-Vorbereitung den
Postcommit-Transport im vorhandenen Worker-Catch sowie die echte Transaktionsgrenze
bei Terrain-Nachlese. Der vorhandene City-Workerwrapper wird mit derselben
begrenzten Korrektur abgesichert; es entsteht kein allgemeiner Storeumbau.
A0.06 führt hierfür einen wiederverwendbaren tatsächlichen Main-/Preload-Testaufbau
ein. Ergänzte Schreibbereiche stehen im Graphen. Die unabhängige Prüfung durch
`a0_interim_review` bestätigt v1.4 anhand des tatsächlichen Worker-/Storepfads
ohne offene erforderliche Planbefunde; die A0.06-Abhängigkeit bleibt verbindlich.

Version v1.5 schließt den unabhängig bestätigten fehlenden Neustartpfad:
A0.13 liefert kompakte dauerhafte Klärungsreferenzen und reine Atlas-/Reise-
Receiptleser; A0.07/A0.08 hängen ihre Besitzer daran an. A0.14 prüft anschließend
expliziten Abschluss und Wiederaufnahme nativ, ohne ungeklärte Aufträge als
bestätigt oder andere Entwürfe als verzichtbar zu behandeln. Die bisher in A0.07
enthaltene native Probe liegt nun in A0.14; Ziel und Nachweis bleiben verbindlich.
A0.13 folgt A0.09 wegen gemeinsamer Storebesitzer. A0.11 und R0 hängen von beiden
Ergänzungen ab; der Graph enthält 157 Pakete. Die unabhängige Nachprüfung durch `a0_interim_review` akzeptiert v1.5 nach
Korrektur von UI-Schreibbesitz, Schedulerprüfungen und veralteten Statusaussagen.
Graph-/Timelinecheck mit 157 Paketen und alle sieben Plantests wurden unabhängig
erneut grün ausgeführt. A0.13 wartet auf die korrigierte A0.09-Implementierung.

Version v1.6 ergänzt nach konkret reproduziertem A0.09-Reviewbefund drei begrenzte
Pakete: A0.15 führt Vorschauänderung und Receipt unter einem transaktionalen
Besitzer; A0.16 erhält genau diesen Bestand samt Identität bei Neustart; A0.17
bindet Autorenaktionen und Undo/Redo ausdrücklich an die Vorschau. A0.16/A0.17
dürfen nach stabilem A0.15-Vertrag an getrennten Codebesitzern parallel laufen. Erst danach
endet die A0.09-Nachprüfung; A0.13 und alle Folgegates bleiben davon abhängig.
Der Graph enthält nun 160 Pakete. Die zusätzliche Speicherung umfasst die vorhandene
begrenzte Graphvorschau, keine vollständige Kampagnenkopie. Abnahmegrenzen und
Schreibzuständigkeiten stehen in A0. `a0_interim_review` akzeptiert v1.6 nach
Präzisierung des Unknown-Besitzes direkter Graphaktionen einschließlich erster
Vorschauerzeugung und lesend klärbarem Restore-Retirement. Der Reviewer führte
Graph-/Timelinecheck mit 160 Paketen und alle sieben Plantests selbst erneut grün
aus. Der Plananschluss ist freigegeben; Implementierungs- und Nativegates bleiben offen.

## Abschluss der Planreviews

Stand 2026-10-25: Nach Korrektur der folgenden Befunde haben P0.01 und P0.02
unabhängig keine offenen begründeten Planbefunde gemeldet. Beide prüften denselben
unveränderten Stand mit 17 Dateiprüfsummen; Zuordnung und Belege stehen in der
Planbasis. P0.03 ist abgeschlossen. Der irrtümliche Pausenvermerk wurde korrigiert.

- **Parallelität:** Gemeinsame Schreibbereiche und unveränderte Buildinputs sind im Scheduler abgebildet. A1.04/A1.07/A1.08 sowie A0.06/A0.10 kollidieren nicht mehr. In der ursprünglichen Planbasis belegten A0.07 und A0.10 den nativen Host; seit v1.5 liegt die native Neustartprobe aus A0.07 in A0.14. A0.07/A0.08 folgen auf A0.13 und bearbeiten wegen des gemeinsamen Recoveryhandlers in `campaign-atlas-ui.ts` ihre Änderungen nacheinander. A0.10/A0.11/A0.14 sperren weiterhin sämtliche Buildschreiber während nativer Läufe.
- **B4-Alternative:** Render- und Compute-Route werden getrennt berechnet. Aktivierungs- und Rückkehrgates einschließlich A6.08 für Compute sind explizit.
- **Reihenfolge:** A1/A2-Kopftexte entsprechen den Verzweigungen. Vier maschinenlesbare Abhängigkeitsfelder pro Paket werden zwischen Markdown und Graph verglichen.
- **Messnachweis A1.04:** GPU-/Präsentationsrückstand und künstliche Verzögerung sind verpflichtende Gegenproben; CPU-Submission allein gibt keinen sichtbaren Navigations-Pass.
- **Postcommit A0.09:** `atlasRoomCommit` und seine `RoomCommit`-Leseprojektion sind ausdrücklich mit Receipt, Kennung und unverändertem Historyschritt enthalten.

Die Liste dokumentiert die behobenen Planreviewbefunde. Die strukturelle Prüfung
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
| A0.01 | review_packages | Implementiert in `3779e6ecb23c6e4286497e6214fff0c7a9d3e617`; 93/93 gezielte Tests und Typecheck bestanden; native Qualifikation folgt in A0.11 |
| A0.02 | review_packages | Implementiert in `5a864b384`; 91/91 Tests und Typecheck bestanden (Testbeleg `.build/atlas-performance-plan/A0.02-tests.tap`); native Qualifikation und R0 offen |
| A0.03 | plan_final_review | Implementiert in `cdbdd3ff2`; 11/11 Zeichnungs- und 77/77 Canvastests, finaler Typecheck bestanden (Dateibindung `.build/atlas-performance-plan/A0.03-files.sha256`); native Qualifikation und R0 offen |
| A0.04 | audit_atlas_boundaries | Implementiert in `1e2c629601d2cf2b96584e9f83ae4e1acbcd071c`; 97/97 Tests, Type-/Desktopcheck bestanden (Übergabe `.build/atlas-performance-plan/A0.04-handoff.json`); native Qualifikation und R0 offen |
| A0.05 | audit_atlas_boundaries | Implementiert in `6235ca15`; 30/30 Tests, Type-/Desktopcheck bestanden (Übergabe `.build/atlas-performance-plan/A0.05-handoff.json`); native Qualifikation und R0 offen |
| A0.12 | plan_final_review | Nacharbeit in `4859dadee`; 115/115 Tests und Typecheck bestanden; unabhängige Nachprüfung lokal akzeptabel; A0.11/R0 offen |
| A0.10 | review_packages | Implementiert in `0494bf17`; 79/79 Tests und vier native Fälle bestanden (Übergabe `.build/atlas-performance-plan/A0.10-handoff.json`); unabhängiges Zwischenreview akzeptabel; gemeinsame A0.11-Qualifikation und R0 offen |
| A0.06 | audit_atlas_boundaries | Implementiert in `da8f63cb`; 76/76 Tests und beide Typechecks bestanden (Übergabe `.build/atlas-performance-plan/A0.06-handoff.json`); Besitzerreaktionen A0.07/08 und R0 offen |
| A0.09 | review_packages | Storefix `950b79eb` und Graphnacharbeit bis `0d6f54ed` lokal geprüft und akzeptiert; A0.13 freigegeben, native A0.11/R0 offen |
| A0.15 | review_packages | Implementiert in `5c1e878d`; 155 gezielte Tests und unabhängig 25/25 bestanden; `a0_15_review` lokal akzeptiert; Typanschluss A0.17 und Neustart A0.16 inzwischen lokal akzeptiert; native Qualifikation offen |
| A0.16 | a0_interim_review | Lokal akzeptiert durch `a0_preview_review_r3`: 28/28 finale Restartfälle, unabhängig 18/18; frühere unveränderte Verbundfälle bleiben belegt; gemeinsame Typ-/Produktionsbuilds bestanden; native A0.14/A0.11 offen |
| A0.17 | plan_final_review / Root | `0d6f54ed`, lokal akzeptiert durch R2–R4 nach Korrekturen; finale Typ-/Buildchecks grün; vollständige Recovery A0.07/A0.13 und native Qualifikation offen |

Die parallelen Pakete bearbeiten getrennte Besitzer. Native Läufe beginnen
erst bei gesperrten Buildinputs. Testassets einmal mit `node build.mjs --test`
vorbereitet. Starts/Enden und Status im Paketgraphen; unbekannte aktive Arbeitszeit
wird nicht aus verstrichener Laufzeit abgeleitet. A0 bleibt offen bis eigenen
Paketnachweisen, unabhängigen Reviews, Fixes und erforderlicher Integration.

Die genannten `.build`-Belege sind lokale Arbeitsartefakte; dauerhafte
Qualifikationsbelege folgen mit den Liefergates. Für A0.01 liegt kein separater
persistierter TAP-Lauf vor; der nachstehende Aufruf und die zugehörige Revision
sind die Reproduktionsgrundlage für R0, keine native Abnahme.

A0.01 lief von 11:46:54 bis 11:58:38 UTC am 25.10.2026. Diese 11:44 Minuten sind
beobachtete Laufzeit einschließlich Prüfungen, keine gemessene aktive Arbeitszeit.
Produktionsnahe Regressionen verwenden echte Canvas-/Raster-/Surface-Besitzer
mit kontrollierten Rendercallbacks. Reproduzierbarer Aufruf:
`node --test --test-concurrency=1 tests/atlas-deck-surface.test.mjs tests/atlas-deck-geometry-overview.test.mjs tests/atlas-presentation-source.test.mjs tests/desktop-atlas-canvas.test.mjs`.
Zusätzlich `npm run check` bestanden. Kataloglinks für die beiden betroffenen
Darstellungs-/Höhenabläufe seriell ergänzt und als geprüft markiert; dies ist
keine vollständige native Abnahme dieser Abläufe. R0 prüft Ergebnis und Annahmen
unabhängig nach allen A0-Paketen.

A0.02 beendet Öffnungswaiter bei Fehler und Deaktivierung; Retry erzeugt einen
neuen Versuch mit aktueller Quelle. Zehn neue Tests führen den tatsächlichen
Raster-/Surface-Besitzer aus. Ein laufendes `Surface.create` kann weiterhin erst
nach Abschluss oder Timeout entsorgt werden; verspätete Ressourcen erhalten keine
Freigabe. Belege: `.build/atlas-performance-plan/A0.02-tests.tap` und
`A0.02-check.log`. Native Prüfung bleibt offen.

A0.03 führt exakte Alphawerte des Bildassets im normalen Zeichnungspfad mit.
Der Cache benötigt ein Byte pro Pixel, die temporäre Readbackfläche höchstens
1024² Pixel ohne zusätzliche Skalierung. Transformation, Neigung, transparente
Löcher und Freigabe sind lokal geprüft. Belege: `A0.03-*-tests.log`,
`A0.03-typecheck-final.log/.exit` und `A0.03-files.sha256` im selben Belegordner.
Der frühere fehlgeschlagene Typecheck bleibt als eigener Versuch erhalten.

A0.05 prüft die Graphbarriere nach Quellen-Await auch für Terrain-Projektion und
Quellenbootstrap. Zwölf produktive Host-Lesepfade werden mit angehaltener
Quellenantwort geprüft: vor der Korrektur scheiterten drei Fälle, danach bestanden
30/30 Tests einschließlich A0.04. Root hat die zwei Übergabedateihashes und alle
drei erfolgreichen Prüfausgänge gegen `A0.05-handoff.json` geprüft. Electron ist
in diesen Tests ersetzt; der SQLite-Leseworker ist echt. Native Abnahme bleibt offen.

Die betroffenen Retry-, Alpha- und Graphwechselabläufe sind seriell im gemeinsamen
Capability-Katalog mit den tatsächlichen Testdateien und Prüfdatum verknüpft.
Eine unabhängige lesende Zwischenprüfung von A0.01–A0.05 auf Commit `6235ca15`
läuft parallel zu A0.10; sie ersetzt nicht R0 auf dem vollständigen A0-Stand.

A0.10 lief von 12:13:39 bis 12:27:46 UTC. Ursache war der fehlende
Atlas-Deactivate-Hook in der gemeinsamen Editorregistrierung. Die vorhandene
`hide()`-Methode wird jetzt erst nach erfolgreichem Abschluss der Schreibsicherung
aufgerufen; abgelehnte oder noch ausstehende Schreibbestätigungen werden geschützt.
Der native Vorherlauf reproduzierte beide Stoppfehler. Der
native Nachherbeleg `.build/atlas-performance-plan/A0.10-native-r2/result.json`
enthält getrennt Material-/Geometrieschließen und echte injizierte Material-/
Geometriefehler: vier normale Exits (Code 0), je acht erfasste PIDs danach abwesend.
Die Fehlergegenproben blieben sichtbar, die Schließfälle ohne falschen Ladefehler.
Root prüfte 917 Buildinput- und 88 Runtimehashes aus der
Identität `.build/atlas-performance-plan/A0.10-native-r2/identity.json`
gegen den unveränderten Stand vor dem Commit sowie alle vier Prozessnachweise.
107 ursprüngliche Messdateien blieben unverändert. Fehlgeschlagene Harnessversuche
sind separat erhalten und geben keine Freigabe. Die native Probe hält IPC-Antworten
und das abschließende `app.quit()` kontrolliert zurück; sie behauptet weder einen
physischen Datenträgerfehler noch eine allgemeine native Produktabnahme.

Nach expliziter Hostfreigabe arbeiten A0.06 und A0.12 an getrennten Codebesitzern.
Das unabhängige A0.10-Zwischenreview durch `a0_interim_review` akzeptiert den
Codepin `0494bf17` ohne offene erforderliche Befunde. Der Reviewer verifizierte
alle 917 Inputhashes gegen diesen Commit und prüfte Bestätigungsreihenfolge,
Reaktivierung und native Probegrenzen. Die einzige zusätzliche Harnessänderung
zwischen Vorher-/Nachherlauf entfernt `state.armed=false;` ausschließlich aus der
Fehlergegenprobe. Die Rückeinfügung rekonstruiert exakt den gespeicherten Vorherhash
`56b8a53bd42b74dc8c1c5ae91871af8a306716a88dcb881555fbebcef4c0e9a7`;
Root reproduzierte diesen Abgleich. Die Schließzweige sind unverändert.
Dies ist eine hashbestätigte Rekonstruktion, kein erhaltenes Originalskript.
Das vollständige R0 bleibt erforderlich.

A0.12 ist in `4859dadee` lokal korrigiert. Der Erstfix `c20be8c3` trennte
besitzereigene Präsentationsfehler von echten Canvasfehlern, reichte aber im
Terrainmodus nicht: Ein GPU-Retry konnte alte Revision-1-Tiles freigeben, während
Revision 2 noch lud. Der unabhängige Reviewer reproduzierte diesen Restbefund.
Die Nacharbeit verlangt aktuelle Höhen-/Materialkacheln und ihren abgeschlossenen
GPU-Frame gemeinsam; Quellenwechsel widerrufen die Freigabe, alte Antworten bleiben
unwirksam. Kamera/Navigation bleiben erhalten, aktuelle Lesefehler sichtbar.
Vorherregression Exit 1, danach 115/115 gezielte Tests und Typecheck Exit 0;
Root verifizierte beide Dateihashes gegen Übergabe `.build/atlas-performance-plan/A0.12-rework-handoff.json`
und Commit. `a0_interim_review` führte die vier Suites selbst mit 115/115 erneut aus
und akzeptiert den lokalen Fix ohne offene Befunde im Terrain-Retrybereich.
Kontrollierte GPU-/DOM-Ersatzplattform ist keine native Qualifikation; A0.11/R0 bleiben offen.

A0.06 lief von 12:28:20 bis 12:40:30 UTC. Main erhält die tatsächliche
`StoreOutcomeUnknownError`-Klasse als expliziten Result-Marker; Erfolg und reguläre
Ablehnungen bleiben unverändert. Sieben neue Tests führen echte Worker, StoreClient,
Main und Preload aus, einschließlich verlorenem Ergebnis vor/nach Commit und
unübertragbarer Antwort. Ein bestehender Item-Buchungsbesitzer klärt seine erhaltene
Referenz nach explizitem Hostneustart ohne zweite Buchung. Die Gesamtprüfung bestand
76/76 Tests und beide Typechecks. Root verifizierte sechs Quelldateien, sechs
Belegdateihashes und alle drei Exitcodes vor Commit. Vorläufige Logpfade kollidierten;
die unveränderten Prüfungen wurden mit getrennten Logs wiederholt. Atlas-/Reise-
Besitzerreaktionen sind damit noch nicht bewiesen. Entsprechend wurden nur der
Transport-/Receiptablauf und die geprüfte Item-Belegklärung im Katalog verknüpft.

Die unabhängige Prüfung bestätigte drei Neustartlücken: Atlas-/Reisekennungen
liegen nur im Renderer, Reise-Recovery ruft bei fehlendem Receipt den Writer erneut
auf, und Pending verhindert den benötigten Abschluss. Plananschluss v1.5 ergänzt
dafür A0.13/A0.14; Inhalt und Abhängigkeiten stehen oben und in A0. Die unabhängige
Planprüfung bestätigte nach Korrekturen aktuelle Schedulerprüfungen und expliziten
Schreibbesitz am gemeinsamen UI-Recoveryhandler.

A0.09 und der Besitzeranschluss A0.15–A0.17 sind lokal abgeschlossen. Der erste
Storefix `950b79eb` typisiert Postcommit-Projektionsfehler, liest RoomCommit ohne
zweiten Edit und erhält den Rollback innerhalb der äußeren Prepared-Transaktion.
Der anschließende Graphfix `5c1e878d` bündelt Vorschauänderung, Kopplung, History und
Receipt in einer Shadowtransaktion; Accept und Lifecycle teilen den Maincommit.
`0d6f54ed` ergänzt Persistenz, profilgebundene Wiederöffnung und ausdrückliche
Autoren-/Historyziele. Fehlende oder beschädigte Zuordnungen erlauben keinen
Ersatzbestand. Die erste definitiv abgelehnte Graphaktion bleibt nach Korrektur
unter derselben Vorschau bearbeitbar. Ungeklärte Resultate benutzen diesen
Rücklesepfad nicht. Ortslinks lesen kanonische Existenz ohne Schema-Vollkopie.

Die unabhängigen R2–R4-Prüfungen sind einschließlich Architektur-, Dokumentations-
und Testfachreviews abgeschlossen; ihre erforderlichen Befunde wurden behoben.
A0.15 bestand 155 Implementierertests und unabhängig 25 Preview-/Postcommitfälle.
Die erste A0.16/A0.17-Verbundprüfung bestand 46 beziehungsweise 101 Tests;
nach den begrenzten Korrekturen bestanden 28 Restart- und 65 Autorenfälle.
R3 wiederholte unabhängig 18 Speicher- und 17 UI-Fälle. Das letzte Marker-Delta
bestand Root 3/3 sowie laut unabhängigem Fachreview 3/3 und eine zusätzliche
Gegenprobe mit zuvor wirklich angewandter Graphänderung. Dessen temporäre
Gegenproben wurden bereinigt; der Bericht und die Root-Vorher-/Nachher-TAPs bleiben
als Belege erhalten. Diese Zahlen betreffen unterschiedliche
Prüfstände und werden nicht zu einer Vollqualifikation addiert.

Die endgültigen Quellen-, Abhängigkeits- und Loghashes stehen in
`.build/atlas-performance-plan/A0.16-handoff.json` und `A0.17-handoff.json`.
Die gemeinsamen Typprüfungen und beide Produktionsbuilds sind grün; R4 hat die
918 Eingaben, 88 Desktopartefakte und vier Logs aus
`A0.16-17-r4-build-handoff.json` unabhängig nachgerechnet. Frühere rote Repros,
Übergaben und Fehlversuche bleiben in `.build/atlas-performance-plan/` erhalten;
die Befundübernahme ist zusätzlich im Gitstand `0d6f54ed` gesichert. Der direkte
Paket-/Fachquellen-/UI-Testleseweg und die tatsächlichen Capability-Testlinks sind
gepflegt. Transferrollen für lokale Previewidentitäten sind mit `26446391`
und 11 Transferfällen belegt; aktive Vorschauen bleiben außerhalb von Archiven.

A0.13 ist mit `27438057` lokal abgeschlossen: kompakte dauerhafte Referenzen,
reine Statusleser und eine passende Freigabe eindeutig abgelehnter Graphaufträge.
Der Fachvertrag steht in [Dauerhafte Atlas- und Reisereferenzen](../../../project/architecture/canonical-store-worker.md#dauerhafte-atlas--und-reisereferenzen).
Root hat die 14 Quellen-, 14 Eingabe- und 20 Loghashes der Übergabe
`A0.13-handoff.json` geprüft. Der letzte Stand besteht 37 gezielte Fälle und beide
Typprüfungen; die 60 bestehenden Regressionen liegen vor dem letzten
Activity-Delta, das im 37er-Lauf gedeckt ist. Beide Produktionsbuilds und die
Transferprüfung sind grün; `A0.13-root-control.json` bindet Logs und Buildartefakte.
Diese Belege liegen in `.build/atlas-performance-plan/` und ersetzen keine native
oder integrierte Abnahme.

A0.07 ist mit `1016c1f4` lokal abgeschlossen: Referenzsicherung, Pending und
Wiederaufnahme der Atlas-, Raum-, Zeichen-, World- und Graphautoren. Root hat
17 Quellen-/Testdateien, 19 Logs, sieben Capability-Einträge und die unveränderten
14 A0.13-Eingaben geprüft. Der breitere Lauf hatte 262 bestandene Fälle und zwei
fehlende DOM-Fixtures; beide sind im anschließenden 101/101-Verbraucherlauf behoben.
Das letzte begrenzte Delta besteht 12/12 Fälle. Diese überlappenden Läufe werden
nicht addiert. Beide Typprüfungen und Produktionsbuilds sind grün.
`A0.07-handoff.json` und `A0.07-root-control.json` in
`.build/atlas-performance-plan/` binden Quellen, Logs und 90 Buildartefakte.
Alle 107 ursprünglichen Messdateien sind unverändert.

Die Root-Gegenprobe zeigte, dass bloßer Texterhalt nicht genügt: Nach dem Anlegen
von Raum B konnte die lokale Auswahl den noch offenen Text von Raum A aus der
Flushprüfung entfernen. Der Recovery-Callback erhält nun auch dessen Besitzer;
der tatsächliche Renderer-Test prüft rohe Eingaben und verweigerten Wechsel.
Bestätigte Rechtecke beenden nur unveränderte zugeordnete Eingaben, damit der
nächste Raum gezeichnet werden kann. Statusklärung wiederholt keinen Writer;
fehlgeschlagene Ansichtsleser bleiben separat wiederholbar.

A0.08 ist an `a0_travel_recovery` vergeben (gpt-6.1-sol, high): dauerhafte
Reiseidentität und rein lesende Wiederaufnahme auf derselben UI-Datei. Danach folgt A0.14 mit echter
nativer Wiederaufnahme und A0.11 mit der gemeinsamen Fehlerprobe. Keine dieser
Grenzen ist durch die lokalen Vorschauprüfungen ersetzt. R0 und A1 bleiben offen.

## Abschlussgrenzen

Ein Paket kann seine Untersuchung mit einem negativen Ergebnis abschließen; das
Leistungsziel gilt dadurch nicht als erreicht. Implementiert, lokal getestet,
nativ qualifiziert, integriert, veröffentlicht/installiert und vom Nutzer
abgenommen sind getrennte Zustände. Das Gesamtziel ist erst erreicht, wenn die
beauftragte Umsetzung samt Reviews/Fixes abgeschlossen und alle erforderlichen
Liefer- und Abnahmegrenzen ehrlich ausgewiesen sind. Ausbleibende Kritik eines
noch laufenden Reviewers ist keine Freigabe.
