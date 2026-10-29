# Terrain und Wasser: bestätigter Ausführungsauftrag

Status: Übernommener Ausführungsauftrag; offene Ziele und datierte Planannahmen bleiben offen.
Owner: atlas / Koordinationschat
Last Reviewed: 2026-10-29 (Trennung von Architektur und Ausführung; keine neue Qualifikation)
Source of Truth: Dieses Dokument besitzt Pakete, Rollen, Abhängigkeiten und Synchronisation dieser Lieferung; Fachverträge besitzen Nutzerwirkung, Prüfdokumentation und Abnahmeregister den Prüfstand.

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

Die Aufwandsschätzungen und relativen T0-Fenster stammen aus dem Planungsrahmen
vom 27.10.2026; die unten übernommenen engen Implementierungsbefunde entsprechen
dem Architekturstand vom 28.10.2026. Beides wird hier ohne neuen Lauf-, Liefer-
oder Abnahmebefund weitergeführt.

Planungsstand: 27.10.2026, übernommen; Umsetzung durch den Koordinationschat freigegeben.
Alle lokalen Uhrzeiten gelten in Europe/Berlin (CET, UTC+1). Frühere UTC+2-
Umrechnungen wurden korrigiert; UTC-Anker und verstrichene Zeitbudgets bleiben gleich.
Historische Preflight-Basis des übernommenen Plans: Main `a87b8e99ba8a3954f664a10b0e7a9c141c65eb22`.
Historische Arbeitsbasis des übernommenen Plans: `613c012f00c99f0e110d081285049399173c4d11`; damaliger letzter
erfolgreicher GitHub-Abgleich 27.10.2026, 13:52 Uhr Europe/Berlin. PR #1420
war damals integriert und übernommen. Dieser datierte Befund ist kein aktueller Main-Abgleich.
Die [sechs bestätigten Ziele TW-G1–6 und der Messvertrag](../requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe)
gelten unverändert. Hier stehen Ausführung und Entscheidungen, keine zweite Anforderungsliste.

### Nächster Produktnachweis und Entscheidung

**Nächster Produktnachweis P03:** verlässliche Grundpinsel und Meer einschließlich
Parameterwirkung, Undo/Redo, Abbruchregeln, Folgezug und Neustart. M1 besitzt einen
begrenzten funktionalen Frühdurchstich; vollständiges G1 und statistische Leistung
bleiben offen. PR #1428 hat inzwischen geländegebundene Kameranavigation, direkte Hügel-/Berg-/Schluchtpinsel und maßstabsübergreifende Bearbeitung integriert. Ihre jeweiligen begrenzten Nachweise stehen im [Landschaftsvertrag](../contract/landscape-tools.md#direkte-terrainformpinsel--27102026) und bei den aktuellen Prüfwegen; daraus folgt keine vollständige G1–6- oder Nutzerabnahme.

Vier enge Anschlüsse der dort beschriebenen Bereinigungsrunde sind implementiert und lokal
geprüft; sie schließen keine vollständige E2E- oder Terrainabnahme:

- Import/Wechsel entwertet alte Atlasregionsantworten vor Mainaktivierung;
  [Editor-Lebenszyklus](../../project/architecture/editor-lifecycle.md) und
  [Importprüfweg](../../campaign/contract/archive.md#copy-complete-import-remap-und-ownerlieferung).
- Geschlossene Terrain-Folgegesten bleiben über Unknown/Readfehler gehalten;
  Speicherantworten werden automatisch gelesen. Ohne Quellenkonflikt setzt sich
  die ursprüngliche Folge fort; ein bestätigter Zug wird nicht erneut angewandt.
  Bei Konflikt stehen „Erneut anwenden“ auf aktuellem Gelände und „Verwerfen“
  ausdrücklich zur Wahl, ohne erzwungenen Dialog.
  [Queue, Receiptregeln und Nachweise](../architecture/rendering.md#speicherklärung-im-atlas).
- Fachliche Speicherbesitzer sind ohne gegenseitige Gesamtwriter aufgeteilt;
  [Besitz und atomare Grenzen](../../project/architecture/storage-ownership.md).
- Kanonische SQL-/Payload-/Receiptwerte werden strukturell und fachlich geprüft;
  [Werte- und Belegverträge](../../project/architecture/storage-ports.md).

Der frühere enge Folgezugverlust ist damit kein offener Implementierungsauftrag
mehr. Die übrigen G1-Werkzeug-/Parameter-/Abbruchkriterien, Schutz absoluter
Feinhöhen, vollständige Produktabnahme und Lieferung bleiben offen. Codeeinstiege,
automatisierte Prüfungen und native Qualifikation stehen in [rendering.md](../architecture/rendering.md);
Originalanforderungen und Abnahmestände bleiben unverändert.

[Historische P01/P02-/Shutdown-/erste Unknown-Berichte und Zeitpunkte](https://github.com/ThonkTank/Salt-Marcher/blob/1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d/docs/atlas/architecture/unified-spatial-atlas.md#nächster-produktnachweis-und-entscheidung)
bleiben unter fester Gitrevision erreichbar. Deren offene Folgezugbefunde und
Paketstarts beschreiben den damaligen Stand. Die folgenden Pakete behalten ihre
fachlichen Ziele und den bestätigten Planungsrahmen; alte Uhrzeiten sind keine
neuen Startsignale. Pausierte Automationen werden dadurch nicht fortgesetzt.

### Meilensteine und Zuständigkeit

| Meilenstein | Prüffähiges Ergebnis | Pakete / Zielbindung |
| --- | --- | --- |
| M1 | Aktueller vertikaler Bediencheck und konkrete Fortsetzungsentscheidung | P01–P02; früher Teilnachweis für G1/G5 |
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
M1-Review folgt dem Versuch innerhalb des gemeinsamen Rahmens; an der 90-Minuten-
Grenze wird auch bei noch offenem Review entschieden und dessen Status offengelegt.
Vor Integration gelten die [sechs echten Candidate-Pflichtchecks und lokalen
Prüfregeln](../../../AGENTS.md#delivery); lokale Teiltests ersetzen Candidate nicht.

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

Jede Zeile ist ein Agentenauftrag zusammen mit den obigen Eingaben/Rollen.
Voraussetzungen stehen in der Reihenfolge-/Terminspalte unten. M1 ist als früher
Funktionsbefund geprüft; Shutdown, frühe Importstilllegung und Queueklärung sind enge abgeschlossene Anschlüsse. P03 enthält weiterhin die übrige G1-Qualifikation.
Die übrige Aufwandsspanne für P03 bleibt 2–4 Stunden; P04 und spätere Pakete sind
im übernommenen Plan als nächste Arbeit benannt. Der aktuelle Umfang wird vor Fortsetzung gegen die oben verlinkten Abschlüsse abgeglichen.

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

Nach **jeder** Integration gilt die [verbindliche Releasezählung und
Veröffentlichungspflicht](../../project/delivery/github-updates.md#verbindlicher-release-rhythmus-für-agenten).
Historischer Livebefund vom 27.10.2026 um 14:34 Uhr Europe/Berlin: Basistag
`v0.192.0`, **7 PRs** mit Mergecommit nach diesem Tag in Main
(#1413–1416, #1418–1420); die Schwelle 10 war damals noch nicht erreicht.
Das ist keine aktuelle Zählung und kein neuer Releasebaseline-Entscheid.
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
