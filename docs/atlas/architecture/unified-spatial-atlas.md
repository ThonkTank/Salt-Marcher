# Atlas: gemeinsamer Darstellungspfad

Status: Current; offene Ziele sind als solche beschrieben.
Owner: atlas
Last Reviewed: 2026-10-27 (Preflight und übernommener Umsetzungsplan; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Ziel

Ein durchgehend bearbeitbarer Atlas verbindet Welt, Städte, Gebäude und Räume.
Navigation, Auswahl, Bearbeitung, Reise, Spieleranzeige und Export verwenden
konsistente Daten. Die vollständigen fachlichen Anforderungen bleiben über
[Produktumfang](../../project/requirements/scope.md), [Quellenregister](../../project/requirements/sources.json) und
[Atlasfunktionen](../requirements/atlas.md) gebunden.

Der Nutzerauftrag vom 24.10.2026 ersetzt die frühere verbindliche M0–M8-Reihenfolge
und die Pflicht, alle damals ausgewählten technischen Ansätze zu verbauen.
Technik besitzt keinen Bestandsschutz. Vorhandene Testbestände dürfen neu erzeugt
werden; produktive Nutzerdaten bestehen nicht. Historische Arbeitsberichte gehören
in die Git-Historie, nicht in den aktuellen Arbeitsplan.

## Aktueller Arbeitsstand

Für die nächste Lieferung gilt der bestätigte
[Terrain-/Meerfokus](../requirements/terrain-relief.md#aktueller-lieferfokus-terrain-und-wasser).
Andere Atlasfunktionen bleiben erhalten und vorerst zurückgestellt. Technische
Entscheidungen werden am aktuellen Code und an diesem Nutzerablauf geprüft;
frühere Paketfolgen sind keine verbindliche Ausführungsreihenfolge.

Der gemeinsame metrische deck.gl-Pfad zeichnet Weltgeometrie, Gebäude, Räume
und Ausgabe. Canvas bleibt für Bedienüberlagerungen zuständig. Kamera und
Eingabesteuerung benötigen keine zusätzliche Rendererschicht.

`CampaignAtlasWorkbench` verbindet Sitzungen und Oberfläche. `AtlasRegions`
besitzt Anfragegeneration, bestätigte Projektion und Schreibrevisionen;
`AtlasJourney` besitzt Vorschau, Reisebereitschaft und Wiedergabe. Autoren-Gesten
besitzen gemeinsame Entwurfs-, Abbruch- und Kontextwechselregeln in `AtlasAuthor`.
Pfadvorschau und Commit teilen `atlasPathPreview`; die Darstellung schreibt keine
Autoren-Geometrie. `AtlasOutput` besitzt Bereichswahl und Exportauftrag.

Der [technische Einstieg](rendering.md) erklärt Datenfluss und Prüfwege.
Das [Datenformat](../../project/contract/data-format.md) gilt für Datenbank,
Kampagnenarchive und Build-Metadaten. Frühere Testbestände werden nicht migriert.

## Terrain-/Wasserlieferung: Umsetzungsplan

Planungsstand: 27.10.2026, übernommen; Umsetzung durch den Koordinationschat freigegeben.
Preflight-Basis ist Main `a87b8e99ba8a3954f664a10b0e7a9c141c65eb22`.
Aktuelle Arbeitsbasis: `a87b8e99ba8a3954f664a10b0e7a9c141c65eb22`; letzter
erfolgreicher GitHub-Abgleich 27.10.2026, 14:07 Uhr Europe/Berlin. Keine neuen
Main-Commits offen; Arbeitsstand auf eigenem Checkpoint `83d488c9b` gesichert.
Die [sechs bestätigten Ziele TW-G1–6 und der Messvertrag](../requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe)
gelten unverändert. Hier stehen Ausführung und Entscheidungen, keine zweite Anforderungsliste.

### Nächster Produktnachweis und Entscheidung

**Früher Bediencheck P01–P02:** kontinuierlich malen → echte Terrainänderung
während gedrückter Eingabe → loslassen und speichern → sofort weitermalen →
bestätigten Zustand frisch öffnen. Er prüft die Tragfähigkeit durch alle Schichten;
er liefert weder statistische Leistungsfreigabe noch vollständige Produktabnahme.
Funktion, sichere Ausführung und zuverlässige Beobachtung sind Voraussetzung.
Vollständige Messmatrix und unabhängige Lieferbefunde sind davor keine Pflicht.

**Beginn T0:** 27.10.2026, 13:38 Uhr Europe/Berlin (11:38 UTC), tatsächlicher
P01-Start nach Main-, Plan- und Umsetzungsfreigabe. Implementierer: Subagent
`terrain_native_implementer`, `gpt-6-luna` / `high`; P01/P02 gemeinsam delegiert.
Erster Beleg geschätzt nach **45–75 Minuten**, gemeinsame Entscheidungsgrenze
**T0 + 90 Minuten**. Setup, Build, Ausführung, Fix, Prüfung und Warten zählen mit;
Unterpakete setzen diese Grenze nicht zurück. Konkrete gemeinsame Grenze:
**27.10.2026, 15:08 Uhr Europe/Berlin**; Setup-Entscheidung spätestens 13:58 Uhr.

P01 benötigt geschätzt 15–25 Minuten: Session/GPU/Prozessbesitz 5–10,
aktueller Desktopbuild und kleine kanonische Testfixture 10–15.
P02 benötigt 30–50 Minuten: vorhandene Probe auf den kleinen Ablauf und
aussagefähige Bildbeobachtung zuschneiden 15–25, ausführen 5–10,
Befund/kleinster Korrekturversuch 10–15. Das sind Schätzungen, keine Messergebnisse.

Start mit dem vorhandenen nativen Harness und normalem Atlas in einer erzeugten
Testkampagne, 1920 × 1080 Fensterinhalt bei 100 %. Bevorzugt echter Intel-Wayland-Pfad
auf dem Zielgerät; bei gesperrtem Desktop eine isolierte native Sitzung.
Nach 20 Minuten ungelöstem Setup sofort die konkrete Ursache und kleinste
Alternative entscheiden: verfügbare normale Wayland-Sitzung oder isoliertes KWin;
Softwareausgabe kann nur einen gekennzeichneten Funktionsbefund tragen.
Keine Sperre umgehen, keine Systemeinstellungen ändern, kein Ausbau einer
allgemeinen Messplattform. Fehlender Intel-Nachweis bleibt offen.
Setup-Entscheidung: Die isolierte KWin-/Wayland-Sitzung hat den nativen Ablauf
bereits ausgeführt und bleibt für P02 geeignet; die noch fehlende GPU-Bindung
begrenzt Leistungsaussagen, verhindert diesen Funktionsversuch aber nicht.

P02 benutzt einen 3–5 Sekunden langen Höhenzug über eine kleine trockene Hang-/
Küstenfläche. Bildfolge/Eingabezeitpunkt belegen eine veränderte Terrainfläche
vor Pointerup; Cursor, Overlay oder bloße Nachladung zählen nicht. Ein kanonischer
Höhenvergleich und Wiederöffnung belegen Speicherung. Die zweite Geste beginnt
ohne Warten auf die erste Speicherantwort; anschließend müssen beide bestätigt sein.
Falls nötig hilft ein identischer Kontrollablauf ohne Höhenwirkung, Störeinflüsse
auszuschließen. Kein Erfolg nur aus Revisionszähler oder `terrainDraft`-Attribut.

**Aktuelle Entscheidung:** Der gebündelte Anschluss ist vor der Kontrolle
14:25 vollständig durchgelaufen. M1 wartet auf die gezielte Ergebnisnachprüfung
im Reviewchat `01a17d32-1d64-7ce3-8b48-93d53429877a`; keine weitere Probe oder
Produktänderung währenddessen. Gemeinsame Entscheidungsgrenze bleibt 15:08.
A bleibt begründet: Der fachliche Durchstich ist nun in einem Lauf beobachtet,
ein Renderer-/Datenkernersatz ist durch die bisherigen Befunde nicht begründet.

Aktueller Lauf: `.build/atlas-terrain-stroke/1793103145919-382361/`.
`handoff-report.json` verweist auf unveränderte Primärbelege in `failure.json`,
`evidence.partial.json`, `height-before.json`, `height-after.json` und
`canonical-diff.json` sowie getrennte Vor-up-PNGs und `03-fresh-reopen.png`.
Bei Stärke 1 m/s und Radius 8 m dauerte die erste Geste 4,115 s, die zweite
2,429 s; der Folgezug begann 833 ms nach Pointerup ohne Speicherantwort-Wartepunkt.
Beide cursorfreien Patchänderungen wurden vor Pointerup gespeichert. Direkte
regionale Höhenvergleiche fanden 15.409 bzw. 13.894 angehobene Knoten; Fresh
bestätigte identische Höhenbytes aller 17 Kacheln bei Revision 3. Der lebende
App-WebGL2-Kontext nennt Intel UHD 620/ANGLE. Dies sind Funktionsbelege, keine
First-visible-Latenz, p95- oder Qualitätsfreigabe.

Gesamtstatus bleibt **FAIL**: In Phase `close initial app` meldet der Renderer
einen fehlenden `atlas:terrain-tile`-Handler. Beide App-Prozesse endeten trotzdem
mit Code 0, ohne Signal und mit bestätigter PID-Abwesenheit. Der Bericht hat
zusätzlich einen bekannten Feldfehler: `terrain-save-state.status` enthält den
UI-Text `Gespeichert` statt PASS; die Speicherwartebedingung wurde erreicht.
Das muss vor Verwendung als allgemeines automatisches Gate korrigiert werden.
Sichtbare Kachelübergänge und stempelartige Formen bleiben Darstellungsbefunde.
Kein Filter des Shutdownfehlers und kein zusammengesetzter Erfolg aus alten
Läufen. Frühere Harnessabbrüche und ihre Ansatzentscheidung sind in Checkpoint
`83d488c9b` gesichert; sie setzen die Zeitgrenze nicht zurück.

Der historische
saubere Stand `e5882ae09d70bb38eede86c28a9ae453f8024a06` hat einen nativen
Rasterablauf mit Folgezug, Undo/Redo und Wiederöffnung; das ist keine aktuelle
Abnahme. Hauptunsicherheit ist der aktuelle Übergang von lokaler Bildwirkung zu
Bestätigung, Nachladung und Folgezug. Grundpinsel/Meer sind vorhanden;
Hügel-/Berg-/Schluchtvorlagen sind bisher Grundpinselparameter.
Produktive Rechtszieh-/WASD-Kamera und neue Formbildung bleiben zu liefern.

Spätestens an der 90-Minuten-Grenze: Ergebnis oder erste konkrete Bruchstelle
festhalten und nur betroffene Pakete nachplanen. B, gezielter Terrainersatz,
braucht benanntes Hindernis und positiven Gesamtnutzen einschließlich Umstellung
und Prüfung. C, Ersatz von Renderer/Datenkern, bleibt bei widerlegter Grundlage
erlaubt. Keine vollständige Rendereranalyse vor dem ersten sinnvollen Kontakt.
Ein erfolgloser Versuch rechtfertigt weder Umfangskürzung noch Erfolgsmeldung.

### Meilensteine und Zuständigkeit

| Meilenstein | Prüffähiges Ergebnis | Pakete / Zielbindung |
| --- | --- | --- |
| M1 | Aktueller vertikaler Bediencheck und konkrete Fortsetzungsentscheidung | P01–P02; früher Teilnachweis für G1/G5 |
| M2 | Verlässliche Grundbedienung, Kamera und vergleichbare Ausgangsmessung | P03–P05; G1/G2/G5 |
| M3 | Alle Spezialformen direkt malen und mit Grundpinseln weiterbearbeiten | P06–P08; G3/G1 |
| M4 | Kontinuierliche lesbare Darstellung und begründet optimierter Pfad | P09–P10; G4/G5 |
| M5 | Vollständige Qualifikation und tatsächliche Lieferung | P11–P15; G1–G6 |

H = Hauptchat: steuern, Belege prüfen, integrieren und gemeinsame Dokumentation pflegen.
Jedes Paket wird gemäß `project-steering` **vor eigener Diagnose oder Umsetzung**
mit Ergebnis, Quellen, Schreibbereich, Schnittstellen, Prüfkriterium und Zeitrahmen
an einen Subagenten delegiert. Dieser besitzt Diagnose, Umsetzung, Tests und
Laufüberwachung; H löst das Paket nicht parallel selbst.

I-L = Implementierer mit `gpt-6-luna`, Reasoning `high`, für Harness, Messausführung,
Fixture und Lieferprüfungen. I-S = Implementierer mit `gpt-6.1-sol`, Reasoning `high`,
für gekoppelte Schreibzustände, Kamera, Terrain-/GPU-Algorithmen. Dies sind
explizite günstige Kompetenzentscheidungen; Wechsel nur bei konkreter Überforderung.
Ein geeigneter Implementierer bleibt für Folgepakete verfügbar. Produktarbeit
läuft mit höchstens einem aktiven Implementierer seriell, da Eingabebesitz,
Kamera und Draft gemeinsame Besitzer haben. Höchstens ein eigener Build oder
nativer Lauf auf dem Zielgerät; Fremdlast offenlegen.

R = unabhängiger Reviewchat nach `reviewed`/`reviewer`, kein Fork des Hauptchats.
Nach **jedem** Meilenstein einschließlich M1 wird dort Ergebnis, Qualität, Zeit
und Annahmenstand geprüft. Bei M1 erst **nach** dem ersten Kontakt; der Bediencheck
selbst braucht keinen zusätzlichen Reviewchat. Reviewchat für Korrekturen und
Folgeprüfungen weiterverwenden, Fachprüfung gemäß Skills ohne weitere Rollenserie.
Planungsreviews bleiben gezielte Subagentenprüfungen. Für R bei Eröffnung ebenfalls
ausreichend günstiges Modell/Reasoning ausdrücklich festlegen.

Paketaufwände enthalten betroffene Tests, kurze native Wiederprobe und Prüf-/Wartezeit.
In den letzten Paketen von M2/M3/M4 sind jeweils 30–60 Minuten für den
Meilensteinreview und Integration vorgesehen; längere CI-Wartezeit zählt zur Dauer.
M1-Review folgt dem Versuch innerhalb des gemeinsamen Rahmens; an der 90-Minuten-
Grenze wird auch bei noch offenem Review entschieden und dessen Status offengelegt.
Vor Integration gelten die sechs echten Candidate-Pflichtchecks, kein Ersatz
durch lokale Teiltests. Keine routinemäßige zweite identische lokale Vollsuite.

### Eingaben und Schnittstellen

Alle Pfade sind repositoryrelativ; [rendering.md](rendering.md#wo-ändern-und-prüfen)
führt ergänzende Code-/Testbesitzer.

| Kürzel | Konkrete Eingaben / zu erhaltende Grenze |
| --- | --- |
| N | `tools/native-session.mjs`, `tools/atlas-canonical-fixture.mjs`, `tools/test-desktop-atlas-raster-workbench.mjs`; normales Electron, erzeugtes Profil, Artefakthashes und normales Prozessende |
| B | `src/app/atlas/landscape-brush-session.ts`, `terrain-stroke-queue.ts`, `terrain-brush.ts`, `atlas-surface-draft.ts`, `desktop/atlas-host.ts` und kanonische Store-Writer; lokale Wirkung → Command → Receipt, Main/Preload-Rechtegrenze |
| K | `src/app/atlas/atlas-canvas.ts`, `atlas-raster-presentation.ts`, `atlas-metric-camera.ts`, `campaign-atlas-ui.ts`; eine Kamera, Geländeanker, Eingabebesitz |
| F | B plus `src/app/atlas/landscape-tool-settings.ts`; deterministische Stroke-/Seedsemantik in lokaler Anzeige und kanonischem Höhenoperator |
| D | `src/app/atlas/atlas-surface-tile-stream.ts`, `atlas-terrain-material-layer.ts`, `atlas-deck-surface.ts`; gemeinsame Höhen-/Materialrevision, vollständige Eltern-/Kindübergänge |
| Q | Fachlicher Messvertrag, vorhandene Fixture-/Replay-/Timinghilfen, P02-Beobachtung; festes Manifest, Renderer-Zeitbasis, unveränderte Startstände, Rohsamples |
| L | `AGENTS.md`, [Releasevertrag](../../project/delivery/github-updates.md), Capability-Katalog und betroffene Abnahmen; exakte Quelle, Paket, native Prüfung und Nutzerabnahme getrennt |

### Vollständig zerlegte Pakete

Jede Zeile ist ein Agentenauftrag zusammen mit den obigen Eingaben/Rollen.
Voraussetzungen stehen in der Reihenfolge-/Terminspalte unten; P02 korrigiert die
konkreten M1-Prüfbefunde, Folgepakete sind noch nicht begonnen.
Aufwandsspannen ab M2 sind vorläufig und werden an P02 gezielt nachgeschärft.

| Paket / Kompetenz | Ergebnis und Eingaben | Prüfkriterium / Schnittstelle |
| --- | --- | --- |
| P01 · I-L, Electron/Native | Ausführbare sichere Ausgangsbasis aus N auf freigegebenem Main | Atlas sichtbar, erzeugtes Profil, Quell-/Runtime-/Display-/GPUbindung, eigener Prozess normal schließbar; Details im frühen Bediencheck |
| P02 · I-L, UI/Beobachtung | Kleiner vollständiger Mal-/Speicher-/Folgezug aus N/B | Tatsächliche Terrainwirkung vor Pointerup, beide Züge kanonisch bestätigt und frisch geöffnet, oder exakte erste Bruchstelle; 90-Minuten-Grenze |
| P03 · I-S, TypeScript/History/SQLite | Grundpinsel und Meer vollständig verlässlich; B und P02-Befund | G1 samt Parameterwirkung, ein Undo je Zug, Escape laufenden Zug zurücknehmen, Fokus-/Pointerabbruch einmal abschließen, Folgezüge/Neustart; unbekannte Outcomes klären statt Replay, Nachladefehler nicht doppelt schreiben |
| P04 · I-S, Kamera/Koordinaten/UI | Maus-/optionale WASD-Kamera gemäß Fachvorgaben; K und P03-Gestenbesitz | Native Mausfolge einschließlich Rechtsziehen, Cursorzoom, Hand/Mitteltaste, Geländeanker und Fallback; Textfokus geschützt, kein Durchtauchen, Welt-/Raumskala, Eingabekonflikt während Maltaste ausgeschlossen |
| P05 · I-L, Messmethodik/GPU-Test | Eingefrorenes Q-Manifest und erste vollständige Baseline vorhandener Grundwerkzeuge/Meer | Definierte Welt über ±Kachelgrenzen, 5 Maßstäbe/2 Skalierungen, alle Parameter/Seeds/Pfade/Zeiten/Resets/Reihenfolge; wirkungslose Kontrolle fällt durch, Glätten auf rauer Fläche, Rohfehler behalten; Spezialformen als noch fehlend kennzeichnen |
| P06 · I-S, Terrainalgorithmik/visuelle QA | Zusammenhängende Hügellandschaft auf F, sinnvolle Vorgaben | Überlappung ohne Nähte, Eventdichte/Halten stabil, lokal/kanonisch gleiche Form, Grundpinselweiterarbeit/Undo/Restart; numerische und native Bildprüfung, erste gebundene Formenbaseline |
| P07 · I-S, Terrainalgorithmik/visuelle QA | Malbare verbundene Bergrücken und Hänge auf F/P06 | Keine Kegelreihe; überlappende/kreuzende Züge über Kachelgrenze, Bilder bei 0/45°, weiter sculpten und Undo; erste gebundene Formenbaseline |
| P08 · I-S, Terrainalgorithmik/visuelle QA | Zusammenhängende Schluchten auf F/P06/P07 | Kurven/Überlappung ohne Perlenlöcher/Strichnähte, sinnvolle Tiefe/Ränder, Wasser nach Niveau, Eventdichte/Halten/Undo/Restart; erste gebundene Formenbaseline; gemeinsame G3-Prüfung und Integration |
| P09 · I-S, GPU/LOD/Kartografie | Stetig lesbares Terrain Welt→Raum auf D/F/Q | G4 in Bildfolgen über alle Skalen/0–45–75°/beide Skalierungen, Details erhalten, passende sichtbare Anker, erneut malen nach Nachladung; keine Löcher/Nähte/harten Formwechsel |
| P10 · I-S, Profiling/Terrain/GPU | Gemessene Hauptarbeit gezielt optimiert auf P05/P09 | Identisches Manifest und Bildqualität, Beobachteraufwand getrennt, keine verlorenen Gesten oder versteckten Details; A/B/C-Entscheidung mit Gesamtnutzen, M4-Prüfung/Integration; großer Ersatz nicht in Kurzschätzung enthalten |
| P11 · I-L, natives Replay/Auswertung | Endmatrix Grundpinsel und Meer auf finalem Q-/Quellstand | Alle vorab geplanten 30er-Kombinationen, p95 je Kombination, fehlende Wirkung/Gestenverlust zählt, Kaltladen/Speichern separat, keine Ersatzsamples |
| P12 · I-L, natives Replay/Formprüfung | Endmatrix aller Spezialformen auf demselben Stand | Vollständige 30er-Kombinationen und Formstabilität numerisch/visuell, erste Baselines aus P06–P08 gebunden; keine gepoolte Erfolgszahl |
| P13 · I-L, Native/Regression | Kamera/Darstellung und erhaltener Atlasumfang nach N/K/D/L qualifiziert | Vertragliche Welt-Raum-Fahrten/Neigungen/Skalierungen, zehn Ressourcenfahrten, Kaltladen separat; relevante bestehende Landschaft-/Objekt-/Export-/Spieler-/History-/Restartabläufe, normale Prozessenden und Datenschutz |
| P14 · I-L, Integration/Fachprüfung | Exakte integrierte Lieferquelle aus P11–P13/L | Blockierende Befunde behoben, betroffene Checks/Native erneut, Testdateien nach Inhalt im Capability-Katalog mit `--geprueft`, sechs Pflichtchecks der exakten Candidate-SHA grün auf aktuellem Main, Integration |
| P15 · I-L, Paket/Native/GitHub | Paket und Veröffentlichung nach geltender Pflicht aus P14/L | Paketidentität, normaler Start/Malen/Save/Folgezug/Restart; bei Schwelle Release fortsetzen, Versions-Candidate/Tag/signierte Updateprobe/verifizierte Veröffentlichung; Installations-/Release-/Ownerstatus wörtlich berichten |

P05/P11/P12 dürfen natürlich getrennte, vorab festgelegte Kombinationen in
aufeinanderfolgenden Agentenläufen abarbeiten, falls ein Lauf nicht reicht.
Das bleibt derselbe manifestgebundene Auftrag und dieselbe Zeitgrenze, keine
Ersatzsample-Runde. Änderungen nach Messung erfordern neue vollständige
Messung der betroffenen Populationen; alte Fehlbefunde bleiben erhalten.
Unberührte Populationen nur mit belegter Unabhängigkeit übernehmen.

### Struktur- und Terminplan

Hierarchie: M1(P01→P02) → M2(P03→P04→P05) → M3(P06→P07→P08) →
M4(P09→P10) → M5(P11→P12→P13→P14→P15).
Jedes Paket benötigt das Ergebnis seines Vorgängers, nicht dessen
behauptete Gesamtproduktabnahme. Nach M2–M4 ist die eingeplante Integration
vor Phasenwechsel abzuschließen; M5 liefert die Endqualifikation.
Ein Lieferhindernis darf einen unabhängigen sicheren Frühversuch nicht sperren.

Die Intervalle sind relative **Balken in Stunden ab T0** und enthalten reale
Wartezeit. Annahme: Host und Fortsetzungsautomation kontinuierlich verfügbar.
Keine parallelen Produktänderungen; R liest nur bei Prüfreife.
Die Zahlen sind ein vorläufiger Ressourcen-/Entscheidungsrahmen, keine
Zusage für ungemessene GPU-Zielwerte.

| Phase | Paket / Besitzer | Aufwandsschätzung | Geplantes Zeitfenster ab T0 |
| --- | --- | --- | --- |
| M1 | P01 I-L | 15–25 min | 0:00–0:25 |
| M1 | P02 I-L, R am Abschluss | 30–50 min | 0:25–1:30; gemeinsame Entscheidung |
| M2 | P03 I-S | 1,5–4 h | 1:30–5:30 |
| M2 | P04 I-S | 1,5–4 h | 5:30–9:30 |
| M2 | P05 I-L, R am Abschluss | 2–4 h | 9:30–13:30 |
| M2 | Reserve | 2 h | 13:30–15:30 |
| M3 | P06 I-S | 2–4 h | 15:30–19:30 |
| M3 | P07 I-S | 2–4 h | 19:30–23:30 |
| M3 | P08 I-S, R am Abschluss | 2–4 h | 23:30–27:30 |
| M3 | Reserve | 2 h | 27:30–29:30 |
| M4 | P09 I-S | 2–4 h | 29:30–33:30 |
| M4 | P10 I-S, R am Abschluss | 2–4 h | 33:30–37:30 |
| M4 | Reserve | 2 h | 37:30–39:30 |
| M5 | P11 I-L | 1,5–3 h | 39:30–42:30 |
| M5 | P12 I-L | 1,5–3 h | 42:30–45:30 |
| M5 | P13 I-L | 2–4 h | 45:30–49:30 |
| M5 | P14 I-L, H integriert | 2–5 h | 49:30–54:30 |
| M5 | P15 I-L, R am Abschluss, H integriert | 1–4 h | 54:30–58:30 |
| M5 | Lieferreserve | 4 h | 58:30–62:30 |

Balken aus denselben Tabellenintervallen, auf Stunden gerundet; genaue
Zeiten und Reserveblöcke stehen ausschließlich in der Tabelle.

```text
h ab T0   0         10        20        30        40        50        60
P01       █
P02       ██
P03        █████
P04            █████
P05                █████
P06                      █████
P07                          █████
P08                              █████
P09                                    █████
P10                                        █████
P11                                              ████
P12                                                 ████
P13                                                    █████
P14                                                        ██████
P15                                                             █████
```

Gesamtschätzung rund **24–52 Stunden**, zehn Stunden sichtbare Reserve;
gemeinsamer vorläufiger Entscheidungsrahmen **T0 + 63 Stunden** für Lieferung
oder konkrete Restblocker/gezielte Umplanung. Nach P02 zwingend nur betroffene
Aufwände, Schnittstellen und Termine nachschärfen, keine zweite Vollplanung.
Überziehungen, zusätzliche Releases und CI-Störungen zählen real; kein
Neustart der Frist durch neue Paketnamen. Größere Ersatzarchitektur erfordert
eine neue begründete Spanne der betroffenen Folgearbeit, keine stille
Verlängerung und keine eigenmächtige Zielsenkung.

### Wiederverwendung, Release und Ablage

Git-Synchronisation gemäß Nutzerauftrag: H führt bei jedem Heartbeat, vor
Paketstart sowie vor/nach Integration `git fetch origin` und Basisvergleich aus.
Neue Main-Commits am sicheren Paketübergang übernehmen, spätestens vor dem
nächsten Umsetzungspaket; bei Langpaketen innerhalb von zwei Stunden einen
sicheren Punkt herstellen, betroffene Schnittstellen früher beachten. Vor
Basiswechsel eigene Änderungen sichern, Schreiber geordnet anhalten und
Builds/native Läufe abwarten. Kein Checkoutwechsel während gebundener Messung.
Sauberes Main nur fast-forward, unveröffentlichte eigene Branches rebasen;
geteilte Historie nicht umschreiben, gegebenenfalls frischer Integrationsbranch
mit nur eigenen fertigen Änderungen. Keine fremden Dirtyfiles verwerfen oder
pauschal stashen. Konflikte gezielt lösen/prüfen und Quelländerungen an Belegen
kenntlich machen. Fertige kohärente Pakete zeitnah über Candidate integrieren.
Fetch allein ist kein abgeschlossener Basisabgleich; Netzfehler/Aufschubgrund
und nächster sicherer Synchronisationspunkt ersetzen den aktuellen Status oben.

[Recovery-Snapshot](https://github.com/ThonkTank/Salt-Marcher/tree/d555635c5757a9494d4d556c61f4245b1cc5f712)
ist Reserve, keine aktuelle Architektur oder Abnahme. Vor jeweils berührter
Arbeit alte Logik/Tests mit den aktuellen Besitzern vergleichen; sinnvolle
Teile semantisch portieren, nicht blind cherry-picken. Kein Audit aller Fixes
und keine 14 obligatorischen Vorpakete. Gezielte Zuordnung:

- P03/P13: unbekannte/Postcommit-Outcomes, persistente Write-Referenzen und Draft-Recovery.
- P04/P09: Frame-/Inputfreigabe, Freigabe erst am aktuellen Bild, Surface-/Canvas-Recovery.
- P06–P08: Previewowner, Transferidentität und Persistenz nur bei Berührung dieser Grenzen.
- P13: Exportcancel, Alpha-Picking und Reader-Shutdown bei Eingriff oder konkretem Befund.
- Vor P02 nur ein konkret sicherheits- oder aussagekritischer Defekt; keine pauschale Vorqualifikation.

Nach **jeder** Integration GitHub-Releasezählung prüfen. Beim Planstart gemeldete
Basis: `v0.192.0`, sechs PRs; vor weiterer Integration live aktualisieren.
Eine früher erreichte Pflichtschwelle zieht P15 bzw. die nötigen Releaseanteile
vor, statt bis M5 zu warten. Zusätzliche Veröffentlichung und CI-Zeit erscheinen
dann in der betroffenen Timeline. Fehlende Signierung/GPU-/Paketbelege sind
konkrete Lieferblocker, keine Freigabe durch Planerfüllung.

Dieser Abschnitt ist die einzige aktive Ausführungsplanung; Fachziele bleiben
verlinkt, technische Dauerregeln in [rendering.md](rendering.md). Keine zusätzliche
Ziele-/Status-/Reviewaktenserie. Paketbefunde hier knapp am betroffenen Auftrag
verdichten und native Belege verlinken; Prüfkatalog/Abnahmen nur für tatsächlich
geprüfte Wirkungen aktualisieren. Erledigte Vorhabensdetails bei Abschluss auf
Ergebnis und verbleibende Pflichten verdichten.

## Regressionsziele

Dieselben Nutzerabläufe bestehen vor und nach dem Umbau: Landschaft bearbeiten,
Straßen/Flüsse und Bewuchs anlegen, Regionen beschriften, Gebäude und Räume ändern,
Geschosse wechseln, auswählen, suchen, reisen, rückgängig machen, ausgeben und
frisch wiederöffnen. Öffentliche Ausgaben enthalten keine GM-Daten.

Kleine Waldstreifen, Inseln, Löcher und Küsten bleiben über Maßstäbe sichtbar;
Kachelwechsel erzeugen keine Löcher oder doppelten Eltern-/Kindflächen. Normale
und geneigte Ansichten erhalten maßhaltige Geometrie und richtige Verdeckung.
Abbruch, Quellenwechsel, GPU-Verlust und ungeklärte Schreibantworten sind geprüft.

Native Abläufe bei 100 % und 200 % Skalierung sowie große Mischwelt werden mit der
Ausgangsbasis verglichen. Integration verlangt die grüne exakte Candidate-SHA;
Releasepflicht und Paketprüfung bleiben unverändert.

## Weitere Produktarbeit

Noch nicht implementierte Werkzeuge und vollständige Vergleichs-/Zielgeräteabnahmen
bleiben fachliche Aufgaben. Der technische Umstieg erklärt sie nicht für erledigt.
Es werden keine weiteren Bibliotheken, Worker oder Zwischenspeicher vorsorglich
verpflichtend gemacht.

[Bedienung](../guide.md) · [Technischer Einstieg](rendering.md)

## Funktionsumfang

| Gruppe | Zu erhaltende Werkzeuge und Abläufe | Fachquelle |
| --- | --- | --- |
| Navigation und Auswahl | Zoomen am Weltpunkt, Schieben, Rücksprung, Übersicht, Suche, präzise/mehrdeutige Treffer, Griffe, Größenvergleich, Maße und Einheiten, 200 % | HEX-05/08/22, [Darstellungsregeln](rendering.md) |
| Land und Daten | Formen, Glätten, Bodenfarbe, Geländeeigenschaften, Hexfüllung, Zurücksetzen, Maßstabswahl, Meeresspiegel | HEX-06/16, [Relief](../requirements/terrain-relief.md) |
| Bewuchs | Landschaft malen/umgrenzen, Baumreihe, Freihalten, Ausdünnen, Verdichten, Einzelbaum/Felsen, Einzelkorrektur/Auswahl | HEX-18, [Bewuchs](../requirements/vegetation.md) |
| Gewässer und Trassen | Wasser setzen/entfernen/färben/radieren, Fluss und Straße zeichnen, Geländeprofil und Verlauf korrigieren | HEX-14/15/17, [Trassen](../contract/terrain-routes.md), [Landschaftswerkzeuge](../contract/landscape-tools.md) |
| Regionen und Namen | Regionenpinsel, Grenzen und Hierarchie, freie/gebundene Namen, Stil/Anker, Orte und Schlüssel | HEX-20, [Kartografie](../contract/atlas-cartography.md) |
| Vorlagen und Assets | Referenzbilder importieren/ausrichten, Bibliothek, Symbole, freie Texte, Streuung | HEX-18/19/20, [Landschaftswerkzeuge](../contract/landscape-tools.md) |
| Stadt | Anlegen, Viertel/Wasserflächen, Straße/Platz, Haus/Befestigung, Bebauungsvorschlag, Dichte/Größe/Nutzung, Inspektor/Personen/Fraktionen, SVG/JSON | CITY-03, HEX-22, [Stadtplan](../../city/requirements/city.md) |
| Räume und Gruppen | Rechteck/freies Polygon/Höhle, Radieren/Löcher, Generieren, Skalieren/Teilen, verknüpfte Keys, Einrichtung, Geschosse | HEX-05/22, [Raumgruppen](../contract/room-groups.md) |
| Innenraumobjekte | Wand/Tür/Portal/Treppe, Terrain/Wasser/Pfad/Dach, Objekt/Streuung/Licht/Text/Feature, Bibliothek und Inspektor | [Dungeonumfang](../../dungeon/requirements/smr04-spatial-coverage.md) |
| Räumliche Zusatzwerkzeuge | Volumen, Graph, Wege/Passagen, Schnitt, Dächer, Triggerfelder, Dungeoninhalt, Binder und Raumsuche | [Dungeonumfang](../../dungeon/requirements/smr04-spatial-coverage.md) |
| Gemeinsamer Zustand | Werkzeug/Auswahl über Maßstäbe, Undo/Redo, Autosave, offene/unbekannte Bestätigung, Wiederherstellung/Neustart | [Speichergrenze](../../project/architecture/overview.md) |
| Verbraucher | Reisevorschau/Partymarker/Eingänge, Wissensfilter, Spielerfenster, Bildexport, Kampagnenarchiv | [Reise](../contract/hex-travel.md), [Spieleranzeige](../../runtime/contract/player-projection.md) |


Die reproduzierbaren Prüfwelt-Erzeuger stehen in `tools/atlas-benchmark/`.
Die große Mischwelt liegt unter `tests/fixtures/atlas/mixed-world.sqlite.gz`.
