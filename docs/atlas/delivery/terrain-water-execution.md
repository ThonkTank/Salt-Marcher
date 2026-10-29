# Terrain und Wasser: bestätigter Ausführungsauftrag

Status: Übernommener Ausführungsauftrag; offene Ziele und datierte Planannahmen bleiben offen.
Owner: atlas / Koordinationschat
Last Reviewed: 2026-10-29 (Fortsetzungsabgleich von Code, vorhandenen Belegen und Restauftrag; keine neue Qualifikation)
Source of Truth: Dieses Dokument besitzt Pakete, Rollen, Abhängigkeiten und Synchronisation dieser Lieferung; Fachverträge besitzen Nutzerwirkung, Prüfdokumentation und Abnahmeregister den Prüfstand.

## Fortsetzungseinstieg

**Geprüfter Quellenstand:** 29.10.2026, 13:49 Uhr Europe/Berlin; aktueller Checkout
auf `fa2c3eb50af9b8970235f75b2d9c7b05e99602c9` mit fremder Dirtyarbeit.
Dieser Dokumentationsabgleich liest Code, Testinhalte, Fachverträge und den unten
benannten Recoverybericht; er ist weder GitHub-/Mainabgleich noch neuer Testlauf.
Er startet kein Terrainpaket und keine pausierte Automation.

**Nächster Auftrag ist ausschließlich der offene Rest von P03** in der
[Paketliste](#vollständig-zerlegte-pakete), konkretisiert im
[Prüfauftrag](#nächster-produktnachweis-und-entscheidung): Parameter-/Meerwirkung,
Abbruchmatrix und absolute Feinhöhen am aktuellen Stand belegen, nur tatsächlich
gefundene Lücken beheben. Shutdown, frühe Importstilllegung und gehaltene
Folgezüge werden erhalten, nicht erneut entwickelt. P04 und P06–P08 besitzen
bereits Kamera-/Formimplementierung; ihre offenen Nachweise stehen je Paket.

H delegiert P03 vor Diagnose an I-S (`gpt-6.1-sol`, `high`), mit B/F und den
unten begrenzten Schreibbereichen. Ein Implementierer arbeitet seriell;
[Meilensteinreview, Candidate und Release](#meilensteine-und-zuständigkeit)
bleiben Pflicht. Vor Paketstart: fremde Änderungen erfassen, `git fetch origin`
und tatsächlichen Basisvergleich durchführen, keine fremden Änderungen
übernehmen oder verwerfen. Erster sicherer Synchronisationspunkt: vor dem
P03-Start; danach nach geschlossenem/gesichertem Zug, entleerten Schreibern und
beendetem eigenen Build/Native-Lauf, bei Langpaketen spätestens binnen zwei
Stunden. [Zeitanker und offene Entscheidungen](#struktur--und-terminplan)
setzen historische Fristen nicht zurück.

**Konkrete offene Übergabepunkte:** aktueller Main-/Dirty-/Buildabgleich vor
Ausführung; vollständiger P03-Bericht fehlt; vollständige Kamera-/Form-/LOD-Bilder,
Messmanifest/30er-Matrizen am vereinbarten Zielgerät und Paketbindung fehlen.
Ein fehlender Nachweis ist zunächst Prüfbedarf, kein behaupteter Codefehler.
Einzelne historische Paketfenster sind verstrichen; eine bestätigte neue
Restfrist ist nicht belegt. Zulässig ist als nächster Schritt die delegierte,
begrenzte P03-Bestandsprüfung mit offenem Zeitstatus; ein neuer Liefertermin
benötigt die unten beschriebene ausdrückliche Entscheidung.

## Geltung und Herkunft

Dieser Auftrag führt die am 27.10.2026 übernommene und vom Koordinationschat
freigegebene Ausführung des Nutzerumfangs vom 25./26.10.2026 fort. Er wurde am
29.10.2026 aus der [Atlasarchitektur](../architecture/unified-spatial-atlas.md)
verschoben. Die dortigen dauerhaften Regeln für Kamera, Koordinaten,
Rendererrechte, History und kanonische Speicherung bleiben bindend.

Die [Terrain-/Meerziele TW-G1–6 und der Messvertrag](../requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe)
sowie der [bestätigte Flusszyklus mit seinen Schutzregeln](../contract/terrain-routes.md#begrenzter-flussabschluss)
besitzen Nutzerwirkung und Abnahmeumfang. P01–P15 bilden den übernommenen
Terrain-/Meerauftrag ab; sie ersetzen oder verschieben den bestätigten
Flusszyklus nicht. Seine Eingaben und offenen Abschlüsse stehen im bestehenden
Flussvertrag, ohne eine zweite Paketliste hier zu erzeugen. Der
[aktuelle fachliche Lieferstand](../../project/delivery/roadmap.md#nächste-begrenzte-lieferung-terrain-und-meer)
und die verlinkten Prüfstände sind vor der betroffenen Fortsetzung zu lesen.

Der Umzug ändert weder Liefer-/Abnahmestatus noch bestätigte Prozesspflichten.
Schätzungen, T0-Intervalle, 90-Minuten- und Zwei-Stunden-Regeln behalten ihre
bisherige Bedeutung; der Umzug setzt keine Frist und keinen Paketstart neu.
Historische Start-/Main-/Releaseangaben unten sind keine aktuelle Freigabe oder
neue Zeitbasis. Eine Fortsetzung benötigt den dort verlangten aktuellen
Basisabgleich; pausierte Automationen werden nicht gestartet oder fortgesetzt.

Allgemeine [Integrations- und lokale Prüfpflichten](../../../AGENTS.md#delivery),
[Testvorbereitung](../../project/verification/testing.md) und
[Releasepflichten](../../project/delivery/github-updates.md#verbindlicher-release-rhythmus-für-agenten)
bleiben an ihren bisherigen Orten verbindlich. Die folgenden Paketprüfkriterien
wenden diese Regeln auf die Lieferung an.

## Übernommener Planungsstand

Der am 27.10. bestätigte Auftrag bleibt in P01–P15 erhalten. Die
[fest revidierte ursprüngliche Planung](https://github.com/ThonkTank/Salt-Marcher/blob/1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d/docs/atlas/architecture/unified-spatial-atlas.md#terrain-wasserlieferung-umsetzungsplan)
bewahrt damalige Main-SHAs, Startberichte, CI-/Releasezählung und T0-Balken.
Diese historischen Angaben dienen ausschließlich der Herkunft, nicht dem heutigen
Paketstart. Die folgenden Rollen und Kriterien gelten aktiv; nur die Paketliste
besitzt operative Restarbeit.

### Nächster Produktnachweis und Entscheidung

**P03-Ergebnis:** ein quell-/runtimegebundener Bericht über alle noch offenen
TW-G1-Kriterien (HEX-16; Maßstabserhalt HEX-06/08), mit Einzelbefunden statt
Gesamt-PASS aus einer Teilprobe. Die übrigen G1–6- und Flussabschlüsse bleiben
eigenständig offen. Der Implementierer übernimmt folgenden konkreten Restauftrag:

1. Ausgangsdaten mit feinem Relief, gesetzter Farbe/Eigenschaften und stabilen
   Orts-/Gebäude-/Raum-IDs sichern. Anheben, Senken, Aufrauen und Glätten direkt
   malen; Radius, Stärke, Randabfall und Roughness mit definiertem Ausgangsstand
   und unterscheidbarer Wirkung vergleichen. Glätten auf rauer Fläche prüfen.
   Meeresspiegel ändern: Höhen und IDs bleiben gleich, Land/Wasser/Küste ändern
   sich aus dem Höhenschnitt. Parameter, Quelle, Ausgangs-/Enddaten und Bilder
   je Fall binden, nicht allein Revisionszähler/Cursor/Overlay vergleichen.
2. Pro freigegebenem Zug genau einen Historyschritt prüfen; Undo/Redo stellt
   Daten und sichtbare Wirkung wieder her. Escape verwirft nur den laufenden
   Zug ohne Restwirkung, Pointerabbruch/Fokusverlust schließen einmal ab.
   Ein losgelassener speichernder Vorgänger bleibt bei Escape seines Nachfolgers
   erhalten. Anschließender Zug und reguläres Close/Fresh bewahren nur bestätigte
   Höhen/Meerwerte. Kein allgemeiner persistenter Undo-Verlauf über Appneustarts
   wird daraus abgeleitet.
3. Groben Zug über feinem Relief und ±Kachelgrenzen prüfen: absolute Höhenwirkung,
   geschützte Feinanteile und unveränderte Daten außerhalb der tatsächlichen
   Wirkung getrennt vergleichen. Additive Feinhöhen-Tests sind vorhanden;
   deren Erfolg allein beweist den vollständigen absoluten Schutzvertrag nicht.
   Bestehende Gewässer/Trassenschutz bleiben erhalten; neue Flussarbeit gehört
   nicht in diesen P03-Restauftrag.
4. Vorhandene Queue-/Recoverywirkungen durch gezielte Regression erhalten:
   Originalauftrag/Receipt, Unknown/Readfehler, gehaltene geschlossene Folgegeste,
   einmalige Fortsetzung; Quellenkonflikt nur mit ausdrücklichem Anwenden oder
   Verwerfen. Keine erneute Entwicklung des bereits behobenen Folgezugverlusts.

**Einstiege und begrenzte Schreibbereiche:** B/F, insbesondere
`src/app/atlas/landscape-tool-settings.ts`, `landscape-brush-session.ts`,
`terrain-live-stroke.ts`, `terrain-brush.ts`, `terrain-brush-draft.ts`,
`atlas-terrain-edits.ts`, `terrain-stroke-queue.ts`, `terrain-queue-recovery.ts`
und bei belegtem Writerdefekt die betroffenen `src/app/storage/terrain-*.ts`.
`desktop/atlas-host.ts`/Preload und kanonische Speichergrenze sind zu erhalten;
kein Renderer-SQL-Zugriff. Tests/Probe nur im betroffenen P03-Umfang erweitern:
`tests/atlas/terrain-brush.test.mjs`, `terrain-brush-draft.test.mjs`,
`terrain-scale-worker.test.mjs`, `atlas-terrain-edits.test.mjs`,
`terrain-stroke-queue.test.mjs`, `terrain-queue-recovery.test.mjs` und
`tools/test-desktop-atlas-terrain-stroke.mjs`. Fremde Dirtydateien zuerst mit H
abgrenzen; Änderungen an gemeinsamen Kamera-/Darstellungsbesitzern nur nach
konkretem Befund und synchronisierter Schnittstellenentscheidung.

**Ausführbarer Prüfweg nach vorbereiteter Node-22-Umgebung:** einmal
`npm run verify:local -- node build.mjs --test`, dann
`node tools/run-tests.mjs --serial tests/atlas/terrain-brush.test.mjs tests/atlas/terrain-brush-draft.test.mjs tests/atlas/terrain-scale-worker.test.mjs tests/atlas/atlas-terrain-edits.test.mjs tests/atlas/terrain-stroke-queue.test.mjs tests/atlas/terrain-queue-recovery.test.mjs`.
Betroffene Typ-/Buildchecks nach [Testanleitung](../../project/verification/testing.md),
nach Desktopbuild seriell
`npm run verify:local -- python3 tools/ui-session.py node tools/test-desktop-atlas-terrain-stroke.mjs --basic-tools`,
gezielte Recoverywiederprobe mit `--recovery-only --source-conflict`;
`--recovery-only --drop-followup` ist ein absichtlich fehlschlagender Gegenfall.
Die vorhandenen Assertions zuerst gegen die obige Restmatrix lesen; unbelegte
Fälle gezielt ergänzen, keine Vollabnahme aus bloßem Skripterfolg. Vor jedem
gebundenen Lauf Quelle samt Dirtydiff/Hashes, Runtime, Profil, Display/GPU,
Fensterinhalt und normale Exits festhalten. Die laufenden Proben sind
100-Prozent-Einstiege, kein bereits vorhandener statistischer Leistungsnachweis.
Auch die Recoveryvarianten verwenden denselben Ressourcenrahmen und UI-Wrapper;
der gezielte Node-Runner setzt ihn selbst und führt die Dateien seriell aus.

**Erfolgreicher vorhandener Beleg und Grenze:**
[datierter Prüfstand](../../project/verification/end-to-end.md#terrain-wasserbelege-und-zielgerät)
und lokal `.build/atlas-terrain-stroke/1793178461012-357879/result.json`
(28.10., Quelle `c10b9b559da343e3be1d51452ecb90cab971f5ec`) wurden beim
Dokumentabgleich gelesen: PASS ohne aufgezeichnete Fehler; gehaltene Folgegeste,
verlorene Antwort, Quellenkonflikt, einmalige Fortsetzung und Fresh. X11,
Electron 44.7.0, 100 %, 1920 × 980, Intel **TGL GT2**. Fehlender Dirtywert,
abweichendes Gerät/Display und enger Recoveryumfang verhindern die Übertragung
auf vollständiges TW-G1 oder die UHD-620-/Wayland-Leistungsqualifikation.
Der lokale Bericht ist kein portables dauerhaftes Archiv; bei Nichtverfügbarkeit
gilt der verlinkte begrenzte Prüfstand, der nächste Lauf archiviert seine eigenen
Rohbelege. [Historische P01/P02-/Shutdown-/Unknown-Belege](https://github.com/ThonkTank/Salt-Marcher/blob/1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d/docs/atlas/architecture/unified-spatial-atlas.md#nächster-produktnachweis-und-entscheidung)
bleiben separat erreichbar.

**Prüfabschluss und Übergabe:** P03 liefert je Kriterium bestanden/Fehler/nicht
geprüft, Rohbeleg und Quellenbindung, behobene Defekte samt Regression sowie
Blocker und betroffene Restschätzung. Tatsächlich geprüfte Workflows erhalten
ihre Testdateien im Capability-Katalog und `--geprueft`; diese Dokumentänderung
ist kein Workflowcheck. H prüft den Paketbefund und den sicheren Mainabgleich,
erst dann folgt P04-Restqualifikation. M2-Review durch R und Integration folgen
nach P05; ein P03-Teilbericht, Review, grüne Candidate-SHA und Integration sind
verschiedene Abschlüsse. Ein fertiger kohärenter Fix kann vorher über Candidate
integriert werden; dadurch wird M2 nicht als abgenommen bezeichnet.

### Meilensteine und Zuständigkeit

| Meilenstein | Prüffähiges Ergebnis | Pakete / Zielbindung |
| --- | --- | --- |
| M1 | Historischer vertikaler Bediencheck und damalige Fortsetzungsentscheidung | P01–P02; früher Teilnachweis für G1/G5 |
| M2 | Verlässliche Grundbedienung, Kamera und vergleichbare Ausgangsmessung | P03–P05; G1/G2/G5 |
| M3 | Alle Spezialformen direkt malen und mit Grundpinseln weiterbearbeiten | P06–P08; G3/G1 |
| M4 | Kontinuierliche lesbare Darstellung und begründet optimierter Pfad | P09–P10; G4/G5 |
| M5 | Vollständige Qualifikation und tatsächliche Lieferung | P11–P15; G1–G6 |

H = Hauptchat: steuern, Belege prüfen, integrieren und gemeinsame Dokumentation pflegen.
Die im übernommenen Auftrag als `project-steering` bezeichnete Steuerungspflicht
gilt hier konkret: Jedes Paket wird **vor eigener Diagnose oder Umsetzung**
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

R = unabhängiger Reviewchat, kein Fork des Hauptchats. Die übernommenen
Bezeichnungen `reviewed`/`reviewer` meinen hier die folgende verbindliche
Reviewpflicht. Maßgeblich sind die hier lesbar ausformulierten Pflichten.
Nach **jedem** Meilenstein einschließlich M1 wird dort Ergebnis, Qualität, Zeit
und Annahmenstand geprüft. Bei M1 erst **nach** dem ersten Kontakt; der Bediencheck
selbst braucht keinen zusätzlichen Reviewchat. Reviewchat für Korrekturen und
Folgeprüfungen weiterverwenden. Die Fachprüfung beurteilt den Paketbefund gegen
seine verlinkten Fachverträge, Prüfkriterien und Belege, ohne weitere Rollenserie.
Planungsreviews bleiben gezielte Subagentenprüfungen. Für R bei Eröffnung ebenfalls
ausreichend günstiges Modell/Reasoning ausdrücklich festlegen.

Paketaufwände enthalten betroffene Tests, kurze native Wiederprobe und Prüf-/Wartezeit.
In den letzten Paketen von M2/M3/M4 sind jeweils 30–60 Minuten für den
Meilensteinreview und Integration vorgesehen; längere CI-Wartezeit zählt zur Dauer.
Die historische M1-Pflicht war: Review nach dem Versuch innerhalb des gemeinsamen
Rahmens; an der 90-Minuten-Grenze auch bei offenem Review entscheiden und dessen
Status offenlegen. Sie setzt heute keinen erneuten M1-Lauf in Gang.
Vor Integration gelten die [sechs echten Candidate-Pflichtchecks und lokalen
Prüfregeln](../../../AGENTS.md#delivery); lokale Teiltests ersetzen Candidate nicht.
Auf einer frischen Basis von aktuellem `origin/main` muss die reale
`Candidate · exact-SHA aggregate`-CI genau diese sechs Checks bestehen:
`npm run check:repo`, `npm run check`, `npm run check:desktop`, `npm test`,
`npm run build`, `npm run build:desktop`. Nur eigene fertige Änderungen linear
integrieren; fremde Dirtyarbeit und alte Branches erhalten. Node 22 und npm,
gezielte lokale Quell-/Typ-/Buildchecks und relevante Native-Wiederproben bleiben
Pflicht; keine routinemäßige zweite identische vollständige lokale Suite.

### Eingaben und Schnittstellen

Alle Pfade sind repositoryrelativ; [rendering.md](../architecture/rendering.md#wo-ändern-und-prüfen)
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

Jede Zeile verbindet ursprüngliches Ergebnis/Kriterium und den einmaligen
Code-/Belegabgleich vom 29.10.2026. „Vorhanden“ heißt implementierter Anschluss,
kein neuer Test-PASS. P01/P02 sind historische Teilabschlüsse; P03–P15 enthalten
nur ihre benannte Restarbeit. Bereits integrierte Wirkungen werden erhalten und
gezielt qualifiziert. Voraussetzungen stehen im Strukturplan; die gesamte Liste
bleibt die einzige operative Planung.

| Paket / Kompetenz | Ergebnis und Eingaben | Prüfkriterium / Schnittstelle | Abgleich / verbleibender Auftrag |
| --- | --- | --- | --- |
| P01 · I-L, Electron/Native | Ausführbare sichere Ausgangsbasis aus N auf freigegebenem Main | Atlas sichtbar, erzeugtes Profil, Quell-/Runtime-/Display-/GPUbindung, eigener Prozess normal schließbar; Details im frühen Bediencheck | Historischer M1-Frühcheck und späterer Shutdownfix belegt ([feste Herkunft](https://github.com/ThonkTank/Salt-Marcher/blob/1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d/docs/atlas/architecture/unified-spatial-atlas.md#nächster-produktnachweis-und-entscheidung)). Kein neuer Setupauftrag; aktuellen Host/Build vor P03 binden. |
| P02 · I-L, UI/Beobachtung | Kleiner vollständiger Mal-/Speicher-/Folgezug aus N/B | Tatsächliche Terrainwirkung vor Pointerup, beide Züge kanonisch bestätigt und frisch geöffnet, oder exakte erste Bruchstelle; 90-Minuten-Grenze | Historischer früher Mal-/Save-/Fresh-Durchstich; keine statistische Leistung. Nicht neu starten; P03 übernimmt nur die offene G1-Matrix. |
| P03 · I-S, TypeScript/History/SQLite | Grundpinsel und Meer vollständig verlässlich; B und P02-Befund | G1 samt Parameterwirkung, ein Undo je Zug, Escape laufenden Zug zurücknehmen, Fokus-/Pointerabbruch einmal abschließen, Folgezüge/Neustart; unbekannte Outcomes klären statt Replay, Nachladefehler nicht doppelt schreiben | Nächster Restauftrag gemäß obigem Prüfauftrag. Queue/Recovery/Shutdown/Importstilllegung vorhanden; volle Parameter-/Abbruch-/absolute Feinhöhenqualifikation offen. |
| P04 · I-S, Kamera/Koordinaten/UI | Maus-/optionale WASD-Kamera gemäß Fachvorgaben; K und P03-Gestenbesitz | Native Mausfolge einschließlich Rechtsziehen, Cursorzoom, Hand/Mitteltaste, Geländeanker und Fallback; Textfokus geschützt, kein Durchtauchen, Welt-/Raumskala, Eingabekonflikt während Maltaste ausgeschlossen | Kamera in `atlas-canvas.ts`/`atlas-metric-camera.ts` vorhanden; `atlas-metric-camera.test.mjs` und `atlas-perspective-camera.test.mjs` prüfen Mathematik. Vollständige native Maus-/Textfokus-/Ankermatrix offen; Einstieg `tools/test-desktop-atlas-main-camera.mjs`. Kein Kamera-Neubau ohne Befund. |
| P05 · I-L, Messmethodik/GPU-Test | Eingefrorenes Q-Manifest und erste vollständige Baseline vorhandener Grundwerkzeuge/Meer | Definierte Welt über ±Kachelgrenzen, 5 Maßstäbe/2 Skalierungen, alle Parameter/Seeds/Pfade/Zeiten/Resets/Reihenfolge; wirkungslose Kontrolle fällt durch, Glätten auf rauer Fläche, Rohfehler behalten; implementierte Spezialformen samt offenem Baselinestatus kennzeichnen | Vorhandene Probe meldet ausdrücklich keine Latenzabnahme. Eingefrorenes vollständiges Q-Manifest und erste Baseline fehlen; direkte Formen sind bereits vorhanden, nicht als fehlend deklarieren. |
| P06 · I-S, Terrainalgorithmik/visuelle QA | Zusammenhängende Hügellandschaft auf F, sinnvolle Vorgaben | Überlappung ohne Nähte, Eventdichte/Halten stabil, lokal/kanonisch gleiche Form, Grundpinselweiterarbeit/Undo/Restart; numerische und native Bildprüfung, erste gebundene Formenbaseline | Hügelform in `terrain-form-brush.ts` vorhanden; `terrain-form-brush.test.mjs` prüft Kuppen/Kurven/Überlappung, Worker-/Livegleichheit in ergänzenden Tests. Gebundene Bild-/Formenbaseline und vollständige Kriterien bleiben offen; Einstieg `--forms`. |
| P07 · I-S, Terrainalgorithmik/visuelle QA | Malbare verbundene Bergrücken und Hänge auf F/P06 | Keine Kegelreihe; überlappende/kreuzende Züge über Kachelgrenze, Bilder bei 0/45°, weiter sculpten und Undo; erste gebundene Formenbaseline | Bergrücken/Hänge implementiert; gleiche numerische/Worker-Einstiege wie P06. Quellgebundene vollständige 0/45°-Bilder, Überlappungs-/Weiterbearbeitungsbewertung und erste Q-Baseline offen; kein Neuauftrag für den bereits vorhandenen Formoperator. |
| P08 · I-S, Terrainalgorithmik/visuelle QA | Zusammenhängende Schluchten auf F/P06/P07 | Kurven/Überlappung ohne Perlenlöcher/Strichnähte, sinnvolle Tiefe/Ränder, Wasser nach Niveau, Eventdichte/Halten/Undo/Restart; erste gebundene Formenbaseline; gemeinsame G3-Prüfung und Integration | Zusammenhängender Schluchtoperator implementiert; Tests enthalten Kurve/Kreuzung/Halten und Live/Writer. Vollständige Bild-/Wasser-/Restartmatrix, gemeinsame G3-Qualifikation, Baseline, M3-Review/Integration offen. |
| P09 · I-S, GPU/LOD/Kartografie | Stetig lesbares Terrain Welt→Raum auf D/F/Q | G4 in Bildfolgen über alle Skalen/0–45–75°/beide Skalierungen, Details erhalten, passende sichtbare Anker, erneut malen nach Nachladung; keine Löcher/Nähte/harten Formwechsel | Gemeinsamer gekachelter Höhen-/Materialpfad und Eltern-/Kindveröffentlichung vorhanden ([Renderregeln](../architecture/rendering.md#quellenstand-und-veröffentlichung)). Vollständige gebundene Bildmatrix über kontinuierliche Übergänge fehlt; gezielt prüfen, nur belegte Defekte ändern. |
| P10 · I-S, Profiling/Terrain/GPU | Gemessene Hauptarbeit gezielt optimiert auf P05/P09 | Identisches Manifest und Bildqualität, Beobachteraufwand getrennt, keine verlorenen Gesten oder versteckten Details; A/B/C-Entscheidung mit Gesamtnutzen, M4-Prüfung/Integration; großer Ersatz nicht in Kurzschätzung enthalten | Räumliche Dosisindizierung bereits vorhanden; `terrain-brush-budget.test.mjs` vergleicht geordnete Integration. Vollständige Q-Baseline/Profiling/A-B-C-Entscheidung fehlen; vorhandene Optimierung ist kein G5-Nachweis. |
| P11 · I-L, natives Replay/Auswertung | Endmatrix Grundpinsel und Meer auf finalem Q-/Quellstand | Alle vorab geplanten 30er-Kombinationen, p95 je Kombination, fehlende Wirkung/Gestenverlust zählt, Kaltladen/Speichern separat, keine Ersatzsamples | Vollständige finale 30er-Grundpinsel-/Meermatrix am vereinbarten Zielgerät nicht belegt; ausstehende Endqualifikation, abhängig von Q und finaler Quelle. |
| P12 · I-L, natives Replay/Formprüfung | Endmatrix aller Spezialformen auf demselben Stand | Vollständige 30er-Kombinationen und Formstabilität numerisch/visuell, erste Baselines aus P06–P08 gebunden; keine gepoolte Erfolgszahl | Numerische Formtests und native Formprobe vorhanden, vollständige finale 30er-Matrix/Bildauswertung nicht belegt; Baselines aus P06–P08 verwenden. |
| P13 · I-L, Native/Regression | Kamera/Darstellung und erhaltener Atlasumfang nach N/K/D/L qualifiziert | Vertragliche Welt-Raum-Fahrten/Neigungen/Skalierungen, zehn Ressourcenfahrten, Kaltladen separat; relevante bestehende Landschaft-/Objekt-/Export-/Spieler-/History-/Restartabläufe, normale Prozessenden und Datenschutz | Bestehende Einzelproben sind Einstiege, keine vollständige gemeinsame Native-/Ressourcenqualifikation. Endmatrix und zehn Ressourcenfahrten auf finalem Stand offen. |
| P14 · I-L, Integration/Fachprüfung | Exakte integrierte Lieferquelle aus P11–P13/L | Blockierende Befunde behoben, betroffene Checks/Native erneut, Testdateien nach Inhalt im Capability-Katalog mit `--geprueft`, sechs Pflichtchecks der exakten Candidate-SHA grün auf aktuellem Main, Integration | Einzeländerungen sind integriert; TW-G1–6-Endquelle und darauf bestandene vollständige Qualifikation nicht belegt. Exakte Candidate-CI und Integration dieses Abschlusses stehen aus. |
| P15 · I-L, Paket/Native/GitHub | Paket und Veröffentlichung nach geltender Pflicht aus P14/L | Paketidentität, normaler Start/Malen/Save/Folgezug/Restart; bei Schwelle Release fortsetzen, Versions-Candidate/Tag/signierte Updateprobe/verifizierte Veröffentlichung; Installations-/Release-/Ownerstatus wörtlich berichten | Keine abschließende Terrain-Paketqualifikation belegt. Releasepflicht nach jeder tatsächlichen Integration aktuell zählen; alte Releasezahl ist keine Freigabe. Veröffentlichung/Installation/Ownerstatus separat berichten. |

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

**Zeitregeln mit überprüfbarem Bezug:** Die
[feste Ursprungsrevision](https://github.com/ThonkTank/Salt-Marcher/blob/1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d/docs/atlas/architecture/unified-spatial-atlas.md#nächster-produktnachweis-und-entscheidung)
nennt T0 ausdrücklich als tatsächlichen P01-Start am **27.10.2026, 12:38 CET
(11:38 UTC)**. Der frühe Bediencheck P01/P02 hatte die gemeinsame Grenze
**T0 + 90 Minuten = 27.10., 14:08 CET** einschließlich Setup, Fix, Prüfung und
Warten. M1 wurde laut damaligem Bericht um 13:18 begrenzt fachlich entschieden;
der damalige Shutdownfehler und spätere enge Korrektur bleiben im Bericht
sichtbar. Die 90 Minuten sind keine neue Grenze für jeden späteren Paketstart.

Die [historische Terminplanung samt Balken und Spannen](https://github.com/ThonkTank/Salt-Marcher/blob/1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d/docs/atlas/architecture/unified-spatial-atlas.md#struktur--und-terminplan)
belegt 24–52 Stunden Arbeit plus zehn Stunden Reserve, den vorläufigen
Entscheidungsrahmen T0 + 63 Stunden (**30.10.2026, 03:38 CET**) sowie P03s
damaligen Start 27.10., 13:18 / Paketentscheidung 17:18 im oben verlinkten
Startbericht. Der Gesamtzeitrahmen ist am Dokumentabgleich 29.10., 13:49 CET
noch nicht verstrichen, einzelne historische Paketfenster sind es bereits.
Kontinuierlich verfügbarer Host/Fortsetzungsautomation war eine Planannahme;
Pausen/Dirtyarbeit sind kein Beleg für einen neu vereinbarten Zeitrahmen.

**Aktive Synchronisationsregel:** Bei jedem Heartbeat, vor Paketstart und
vor/nach Integration Basis abgleichen; bei einem Langpaket innerhalb von zwei
Stunden einen sicheren Synchronisationspunkt herstellen. Auslöser ist die
laufende Paketarbeit bzw. der letzte tatsächliche sichere Basisabgleich; Fetch
allein genügt nicht. Im Fortsetzungsbefund Zeitpunkt dieses Abgleichs und den
nächsten sicheren Punkt festhalten. Ein verlässlich dokumentierter letzter
Terrain-Synchronisationszeitpunkt nach dem historischen Bericht ist hier
**ungeklärt**; daraus wird keine aktuelle Zwei-Stunden-Frist konstruiert.
Vor Start ersetzt der aktuelle tatsächliche Abgleich diese Wissenslücke.

**Offene Zeitentscheidung:** Es gibt keinen belegten neuen verbindlichen
Resttermin und keine nach heutigem Code neu vermessenen Paketspannen. P03s
historische Restannahme 2–4 Stunden ist keine neue Zusage. H lässt bei
P03-Bestandsprüfung nur betroffene Restarbeit, Beleglücken, Fremdlast und
CI-/Reviewwartezeit schätzen und legt, falls der ursprüngliche Rahmen nicht
mehr tragfähig ist, die konkrete Abweichung mit begründetem Ersatztermin zur
Entscheidung vor. Bis dahin ursprünglichen Rahmen/Überziehung ausdrücklich
berichten; weder Uhr zurücksetzen noch Umfang senken. Größere Ersatzarchitektur
benötigt eine begründete Spanne einschließlich Umstellung und Prüfung.

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

Nach **jeder** Integration gilt die [verbindliche Releasezählung und
Veröffentlichungspflicht](../../project/delivery/github-updates.md#verbindlicher-release-rhythmus-für-agenten).
Die [damalige Releasezählung](https://github.com/ThonkTank/Salt-Marcher/blob/1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d/docs/atlas/architecture/unified-spatial-atlas.md#wiederverwendung-release-und-ablage)
ist ausschließlich historisch; aktuelle Releases, PRs, Tags, Drafts und Workflows
vor Lieferung prüfen und bestehende Releasearbeit fortsetzen. Ab zehn verschiedenen
in `main` gemergten PRs seit dem Quelltag des letzten veröffentlichten stabilen
`saltmarcher-workbench`-Release ist die nächste Veröffentlichung automatisch
Pflicht; manuelle Veröffentlichung hat Vorrang. Alle PRs zählen, nur erfolgreiche
Publikation setzt die Basis zurück. H besitzt Versions-Candidate, exakt grüne
Main-SHA, passenden `vVERSION`-Tag, signierten Paket-/Native-Restartworkflow und
verifizierten veröffentlichten Release. Linuxpaket:
`npm run package:desktop -- <output-directory>`. Basistag, konkrete PR-Zahl,
Release-Link oder Lieferblocker wörtlich berichten; keine weitere Freigabefrage.
Eine früher erreichte Pflichtschwelle zieht P15 bzw. die nötigen Releaseanteile
vor, statt bis M5 zu warten. Zusätzliche Veröffentlichung und CI-Zeit erscheinen
dann in der betroffenen Timeline. Fehlende Signierung/GPU-/Paketbelege sind
konkrete Lieferblocker, keine Freigabe durch Planerfüllung.

Dieses Dokument ist die einzige aktive Paket-/Terminplanung dieses übernommenen
Auftrags; Fachziele bleiben verlinkt. Die [Atlasarchitektur](../architecture/unified-spatial-atlas.md)
und [rendering.md](../architecture/rendering.md) besitzen technische Dauerregeln. Keine zusätzliche
Ziele-/Status-/Reviewaktenserie. Paketbefunde hier knapp am betroffenen Auftrag
verdichten und native Belege verlinken; Prüfkatalog/Abnahmen nur für tatsächlich
geprüfte Wirkungen aktualisieren. Erledigte Vorhabensdetails bei Abschluss auf
Ergebnis und verbleibende Pflichten verdichten.

## Einmaliger Review der Fortsetzungsanweisung

Der Dokumentationsauftrag aus Runde 10, Plan 5 ist abgeschlossen: nächster
P03-Rest, Zuständigkeit, Schreibbereiche, Prüfweg, Abgleich P01–P15 und
Zeitbezüge sind im aktiven Dokument lesbar. Die historischen T0-/P03-Zeitanker
wurden im Review direkt gegen die genannte Gitrevision abgeglichen; die bereits
erfolgreichen Link-, Anker-, Paket- und Strukturprüfungen wurden wiederverwendet.
Als kleine Korrektur verwendet der ausgeschriebene Prüfweg nun ausdrücklich den
bestehenden lokalen Ressourcenrahmen und den seriellen gezielten Test-Runner.
Das ist eine Anleitungskorrektur, kein ausgeführter Terraincheck.

Aktueller Main-/Dirty-/Buildabgleich, vollständige P03- und spätere
Qualifikation sowie die benannte offene Restzeitentscheidung bleiben
Ausführungspflichten beziehungsweise offene Befunde. Sie verlangen vor ihrer
Bearbeitung keine Rekonstruktion alter Chats. Der Review startet weder ein
Paket noch eine Automation und behauptet keine Terrain-/Lieferabnahme.
Damit endet die fünfte und letzte Reviewrunde; keine weitere Planung oder
erneute Reviewrunde wurde eröffnet.
