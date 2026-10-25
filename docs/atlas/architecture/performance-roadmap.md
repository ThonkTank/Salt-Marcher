# Atlas: Meilensteine für die Architekturentscheidung und Umsetzung

Status: Executing A0; Planbasis v1 unabhängig freigegeben. A0–A7 sind noch nicht abgenommen.
Owner: atlas
Last Reviewed: 2026-10-25 (Roadmap aus dem Nutzerauftrag; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt die Reihenfolge und Entscheidungskriterien der Performance-Arbeit; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Der Gesamtauftrag wird mit project-preflight → practical-planner →
project-steering → project-closure fortgesetzt. Die Paketplanung und Timeline
sind als Planbasis v1 unabhängig geprüft; Reviewbelege und Durchführungsstand stehen
im [Projekthandbuch](performance/handbook.md#abschluss-der-planreviews).

## Ziel und Reihenfolge

Bei vollständiger Bildqualität soll der Atlas von der Welt- bis zur Dorfkarte
flüssig navigierbar und unmittelbar bearbeitbar sein.

**Reihenfolge: Architekturgrundlage absichern → Vergleich absichern → Renderer auswählen → Darstellung umbauen →
grenzenlose Welt skalieren → Bearbeitung beschleunigen → Nachladung beschleunigen →
Gesamtprodukt abnehmen.**

Die Architekturwege sind Alternativen. Es gibt keine verpflichtende Folge
„deck.gl → Three.js → WebGPU“. Sobald ein Weg die Anforderungen erfüllt, entfällt
der teurere Ersatz. Die A1–A7-Meilensteine führen die frühere M0–M8-Pflichtfolge
nicht wieder ein.

Aufwände sind geschätzte Personentage einschließlich gezielter Prüfungen.
Der [gemeinsame Atlasplan](unified-spatial-atlas.md) bindet den vollständigen
Funktionsumfang; [Darstellung und Bearbeitung](rendering.md) beschreibt den Istpfad
und seine Prüfwege.

## Arbeitspakete und Ausführung

[Timeline mit einem Balken je Paket](performance/timeline.html) ·
[Maschinenlesbare Abhängigkeiten](performance/work-packages.json) ·
[Projekthandbuch und Plan–Soll–Ist](performance/handbook.md) ·
[Unabhängige Reviewgates](performance/review-gates.md)

Die Timeline berücksichtigt drei Agenten, gemeinsame Schreibbereiche und einen
exklusiven nativen Messplatz mit unveränderten Buildinputs. Ein Balken ist ein
Agentenlauf; relative Planstunden beruhen auf geschätzter Arbeit, Wartezeit und
Reserve und sind keine Kalenderzusage. Abhängigkeiten und bewusst bedingte Wege
sind im Paketgraphen explizit. Nach jedem Meilenstein folgen
zwei unabhängige Reviews und ein Steuerungsschritt mit nötigen Fixes/Neuplanung.


Die folgende Zerlegung ist geplant, nicht umgesetzt. Ein Paket ist der Auftrag
für **einen Agentenlauf**; ein Meilenstein besteht aus mehreren solchen Läufen.
Die Meilensteine werden in der Reihenfolge A0 bis A7 bearbeitet; fachlich unabhängige Pakete innerhalb eines Meilensteins dürfen überlappen. Bedingte Versuche
werden nur durch ihren dokumentierten Befund aktiviert.

| Meilenstein | Ausführbare Arbeitspakete |
| --- | --- |
| A0 – Architekturgrundlage absichern | [Korrektheitsfixes aus unabhängiger Architekturprüfung](performance/a0-foundation.md) |
| A1 – Vergleich absichern | [Messwerkzeuge, Instrumentierung und Ausgangsmessung](performance/a1-measurement.md) |
| A2 – Renderer auswählen | [Begrenzte Prototypen und gemeinsame Entscheidung](performance/a2-renderer-choice.md) |
| A3 – Darstellung umbauen | [Stabile Ressourcen und inkrementelle Veröffentlichung](performance/a3-persistent-rendering.md) |
| A4 – Grenzenlose Welt skalieren | [Sichtbarkeit, Ressourcen und Maßstabswechsel](performance/a4-world-scaling.md) |
| A5 – Bearbeitung beschleunigen | [Lokale Vorschau, Bestätigung und sichtbare Reaktion](performance/a5-editing.md) |
| A6 – Nachladung beschleunigen | [Materialkosten, Auftragssteuerung und Ladevergleich](performance/a6-loading.md) |
| A7 – Gesamtprodukt abnehmen | [Fachabläufe, Verbraucher, Umstellung und Lieferung](performance/a7-qualification.md) |
| Bedingte Wege | [WebGL2, Worker, Parallelität/WASM, WebGPU, Raster und native Entscheidung](performance/conditional-paths.md) |

Für jedes Paket gelten diese gemeinsamen Regeln:

- **Start:** Paket, seine Voraussetzungen, die aktuelle Implementierung und relevante Fachanforderungen lesen. Die unten genannten Codepfade sind Einstiege des Stands vom 25.10.2026, keine Architekturpflicht. Nach A2 gelten die entsprechenden Besitzer des gewählten Renderers.
- **Umfang:** Nur das benannte Ergebnis und seine gezielten Prüfungen liefern. Keine zusätzlichen Renderer, Produktfunktionen oder vorsorglichen Infrastrukturumbauten. Ein Paket umfasst üblicherweise einen fokussierten Lauf von etwa 1–3 Stunden aktiver Arbeit; native Messungen und CI können länger warten lassen. Das ist eine Größenordnung, kein Zeitlimit zum Abbrechen unfertiger Arbeit.
- **Unbekannte Größe:** Bei einem neuen, größeren Befund das betroffene Paket vor der Umsetzung in benannte Unterpakete mit Voraussetzungen und Abnahme teilen. Keine stillschweigende Vergrößerung auf den ganzen Meilenstein und kein Absenken des Ergebnisses. Ein späterer Lauf erhält einen abgeschlossenen Teilauftrag statt eines unbestimmten „weiter optimieren“.
- **Prüfung:** In frischen Checkouts Testassets einmal mit `node build.mjs --test` vorbereiten. Betroffene Tests und Type-/Buildchecks ausführen; bei nativen Änderungen die passende UI-Probe. Native Messungen auf demselben Gerät seriell ausführen. Kein vollständiges `npm test` nach jedem Paket; Vollqualifikation nach Lieferregeln.
- **Übergabe:** Paketkennung, konkretes Ergebnis, Code-/Buildrevision, geänderte Dateien, ausgeführte Prüfungen mit Ergebnis, auffindbare Artefakte und verbleibende Befunde nennen. Belege dürfen nicht nur in einem flüchtigen Terminal stehen. Bei geprüften Nutzerabläufen tatsächliche Testlinks im Capability-Katalog pflegen und `--geprueft` verwenden; keine Abnahme nur aufgrund einer Verlinkung.
- **Status:** Alle Pakete starten offen. „Abgeschlossen“ bedeutet ihr eigenes Ergebnis ist nachgewiesen; eine Messung darf einen nicht bestandenen Leistungswert ehrlich liefern. Der Meilenstein bleibt offen, solange sein Ziel verfehlt ist. Bedingte Pakete bleiben bis zur Aktivierung „bedingt“ oder werden mit Begründung „entfällt“, niemals ungeprüft „bestanden“.
- **Arbeitsstand:** Im permanenten Checkout arbeiten, fremde Änderungen bewahren, keine Automationen starten. Die Umsetzung durch Agenten beginnt nach unabhängiger Freigabe der vollständigen Planung; jedes Meilensteinreview prüft auch die bisherigen Annahmen. Integration und Veröffentlichung bleiben getrennte Vorgänge nach den bestehenden Lieferregeln.

## Meilensteinziele

### A0 — Architekturgrundlage absichern

**Aufwand: zusätzlich etwa 2–4 Tage; nach erster Umsetzung erneut schätzen. Status: offen.**

Die [unabhängige Architekturprüfung](performance/architecture-audit.md) beurteilt
Prozess- und Datenbesitzer als tragfähig, findet jedoch konkrete Korrektheitslücken.
Vor A1 Frameberechtigung, Erststart/Retry, Alpha-Treffer, Verbraucherabbruch,
Graphbarriere und unbekannte Schreibausgänge samt Postcommit-Projektion absichern.
Den bekannten Schließfehler vor fehlerfreien Messgates behandeln.

**Abnahme:** Produktionsnahe Regression je Befund, native betroffene Abläufe,
keine offenen erforderlichen Befunde im unabhängigen Meilensteinreview. Kein
zusätzlicher Komplettumbau ohne neuen Beleg. Originalmessungen bleiben erhalten;
neue Baselines werden dem korrigierten Build zugeordnet.


### A1 — Einen belastbaren Architekturvergleich ermöglichen

**Aufwand: ½–1 Tag. Status: offen.**

- Vorhandene Messungen und Referenzbilder übernehmen; temporäre Messhelfer in einen reproduzierbaren Prüfablauf überführen.
- Geladene Navigation, Navigation mit Nachladung und kaltes Öffnen getrennt erfassen. „Geladen“ verlangt fertiges Terrain und verfügbare Objektgeometrie.
- Zusätzlich Zeichenaufrufe, Modellneuanlagen und gehaltene Ressourcen erfassen; Materialanfragen in Berechnung, Datenzugriff und Warten aufteilen.

**Ergebnis:** Ein gemeinsamer Vergleichsmaßstab für alle Kandidaten. Die bisherige
Messkampagne wird nur dort ergänzt, wo diese Trennung fehlt.

Lokaler Ausgangsbeleg: `.build/atlas-measure-20261025/MESSUNGEN.txt`, gemessener
Commit `984144e8d05be38ce9a19108c5eef8742690ca1a`. Die Messartefakte sind ignorierte,
nicht mit Git ausgelieferte Dateien; A1 muss benötigte Vergleichsbelege dauerhaft
sichern. Die vorhandene Matrix umfasst sechs Maßstäbe (2048, 128, 16, 4, 1 und
0,25 m/CSS-Pixel), drei Neigungen (0°, 45°, 75°), zwei UI-Skalierungen (100 %, 200 %)
und jeweils drei Serien. Sie enthält Nachladung und ersetzt daher noch keine
getrennte Abnahme geladener Navigation.

### A2 — Zwei Renderansätze im direkten Vergleich entscheiden

**Aufwand: 2–4 Tage. Status: offen. Voraussetzung: A1.**

Zwei begrenzte Prototypen verwenden dieselben Quelldaten, Kameras und Gesten:

1. **deck.gl mit gebündelter Geometrie und stabilen Ressourcen.**
2. **Eine explizite Szene in Three.js mit dauerhaft gehaltenen Geometrieblöcken und gebündelten Zeichenaufrufen.**

Der Vergleich umfasst die schwierige Dorfansicht, eine Weltansicht sowie geneigte
Darstellung mit Terrain, Gebäuden, transparenten Flächen, Beschriftungen und
Pinselvorschau. Hier entsteht noch kein vollständiger zweiter Editor.

**Entscheidungsregel:**

- Erfüllt nur ein Kandidat Bild- und Leistungsanforderungen, gewinnt dieser.
- Erfüllen beide sie, gewinnt zunächst der Weg mit weniger neuem Integrations- und Wartungscode.
- Erfüllt keiner sie, wird anhand des verbleibenden Engpasses der passende Zusatzversuch aus der untenstehenden Tabelle durchgeführt. Ein nicht qualifizierter Kandidat wird nicht vollständig eingebaut.

**Ergebnis:** Eine belegte Rendererentscheidung mit Vergleichsbildern, Messwerten
und dokumentierten Einschränkungen. Die Leistungsziele sind p95 ≤ 33,3 ms für
geladene Navigation und p95 ≤ 100 ms bis zur sichtbaren Pinselvorschau.

### A3 — Die gewählte Darstellung dauerhaft und inkrementell machen

**Aufwand: 5–10 Tage. Status: offen. Voraussetzung: A2.**

- Geometrie erhält stabile Kennungen, lokale Ursprünge und dauerhaft gehaltene GPU-Puffer.
- Kameraänderungen verändern Transformationen; lokale Bearbeitungen aktualisieren ausschließlich betroffene Geometrie und ihre notwendigen Abhängigkeiten.
- Kompatible Flächen werden gemeinsam gezeichnet. Reihenfolge, Transparenz, Verdeckung und Auswahl bleiben erhalten.
- Mehrere Änderungen innerhalb eines Bildtakts werden gemeinsam veröffentlicht.

**Interne Schnittstelle:** Szenenbestand, Änderungen und Kamerazustand werden
getrennt übergeben. Ein fertiges Bild bleibt eindeutig Kamera, Quellenrevision
und Ansichtsgröße zugeordnet. Datenbank- und Archivformate ändern sich dadurch nicht.

**Abnahme:** Bei geladener Navigation entstehen keine neuen Geometriemodelle für
unveränderte Inhalte; ein Farbtupfer baut die unveränderte Karte nicht neu auf.

### A4 — Die grenzenlose Karte über alle Maßstäbe skalieren

**Aufwand: 4–7 Tage. Status: offen. Voraussetzung: A3.**

- Darstellung räumlich portionieren und außerhalb des sichtbaren Bereichs früh aussortieren.
- Ressourcen begrenzen und nach langen Navigationsstrecken wieder freigeben.
- Texte und Symbole bündeln, soweit sie nach A3 noch relevante Zeichenkosten verursachen.
- Präzision bei großen Weltkoordinaten, geneigte Ansichten und Übergänge zwischen Maßstäben prüfen.

**Abnahme:** Geladene Navigation erreicht **p95 ≤ 33,3 ms** in allen 36 bisherigen
Kamerakonfigurationen, jeweils in drei Wiederholungen. Zusätzlich werden eine lange
Navigationsstrecke und Rückkehr zum Ausgangspunkt ohne fortlaufendes Ressourcenwachstum geprüft.

### A5 — Bearbeitung bis zum sichtbaren Bild beschleunigen

**Aufwand: 3–6 Tage. Status: offen. Voraussetzung: A4.**

- Lokale Vorschau unabhängig von der Speicherbestätigung anzeigen.
- Entwurf, bestätigte Darstellung und deren Austausch so organisieren, dass unveränderte Ressourcen bestehen bleiben.
- Farbe, Höhe und Glätten sowie Objektbewegung, Auswahl und Undo/Redo zusammenhängend prüfen.

**Abnahme:** Erste sichtbare Pinselreaktion **p95 ≤ 100 ms** bei 100 % und 200 %
Skalierung, mit mindestens 30 Gesten je Pinselart. Keine verlorenen Gesten, keine
Qualitätsreduktion und keine zusätzlichen Historyschritte.

### A6 — Öffnen und Nachladen gezielt beschleunigen

**Aufwand: 4–8 Tage. Status: offen. Voraussetzung: A5.**

- Den in A1 nachgewiesenen Hauptanteil der Materialkosten bearbeiten: gemeinsame Berechnungen, überlappende Datenzugriffe oder Warteschlangen.
- Sichtbare Inhalte vor Vorladung priorisieren; überholte Aufträge tatsächlich beenden.
- Zusätzliche Parallelität oder WASM nur nach einem passenden Vergleich einsetzen.

**Abnahme:** Als neues Arbeitsziel gilt eine **Halbierung der Zeit bis zum
vollständigen Terrain-Detailstand** gegenüber der methodisch identischen
Ausgangsmessung, sowohl beim kalten Öffnen als auch auf den definierten Nachladewegen. Erste nutzbare Oberfläche und vollständige Auswahlbereitschaft
werden separat ausgewiesen. Navigation und Pinsel dürfen dadurch ihre erreichten
Ziele nicht verlieren.

### A7 — Den vollständigen Atlas qualifizieren und umstellen

**Aufwand: 2–4 Tage. Status: offen. Voraussetzung: A6.**

- Welt, Stadt, Gebäude und Innenräume einschließlich Geschossen, Texten, Auswahl und Bearbeitung prüfen.
- Speichern, Neustart, Undo/Redo, Export, Spieleranzeige, Abbruch und GPU-Wiederherstellung durchspielen.
- Den beim Schließen beobachteten Fehler einer laufenden Terrainanfrage beheben und den Ablauf erneut prüfen.
- Nach erfolgreicher Umstellung ersetzten Rendercode entfernen; Prüflinks im Capability-Katalog und Architekturdokumentation aktualisieren.

**Abnahme:** Gleicher Funktionsumfang und gleiche Bildqualität, vollständige
Leistungsmatrix, relevante native Prüfungen und grüne exakte Candidate-SHA.
Fehlende Zielgeräte- oder Nutzerabnahme bleibt ausdrücklich offen.

## Bedingte Architekturwege

Diese Schritte werden am passenden Meilenstein eingeschoben, nicht vorsorglich umgesetzt.
Ihre [einzeln ausführbaren Versuchspakete](performance/conditional-paths.md)
definieren Startbefund, Ergebnis und Rückkehr in die reguläre Meilensteinfolge.

| Befund | Nächster Versuch | Voraussetzung für Übernahme |
| --- | --- | --- |
| Trotz Bündelung dominiert die Renderframework-Verwaltung | **Spezialisierter WebGL2-Zeichenpfad** nach A2 | Erfüllt die Ziele bei gleicher Darstellung und beseitigt den gemessenen Engpass. |
| Renderarbeit blockiert weiterhin Oberfläche und Eingaben | **Renderer im Worker** nach A3/A5 | Verbessert die Bedienreaktion, ohne die Zeit bis zum sichtbaren Kartenbild zu verschlechtern. |
| Materialberechnung dominiert nachweislich | **Begrenzte Worker-Parallelität, danach gegebenenfalls WASM** in A6 | Verbessert reale Ladezeiten ohne schlechtere Interaktion oder unkontrollierten Speicherbedarf. |
| GPU-Arbeit oder Befehlsübergabe bleibt der begrenzende Faktor | **WebGPU-Prototyp** | Unterstützung auf dem Zielsystem und Vorteil im identischen Atlasablauf sind nachgewiesen. |
| Unveränderte flache Inhalte verursachen weiterhin hohe Zeichenkosten | **Rasterkacheln für diese Inhalte** | Schärfe, Auswahl, Bearbeitung und geneigte Darstellung bleiben korrekt. |
| Auch diese Ansätze verfehlen die Ziele | **Separate Entscheidung über native Engine oder Gesamtumbau** | Neuer Vergleich mit belegter Ursache und vollständiger Kostenbewertung; kein automatischer Komplettneubau. |

## Aufwand und feste Annahmen

Der reguläre Weg liegt grob bei **4–8 Personenwochen**; zusätzliche
Architekturversuche kommen nur bei entsprechendem Befund hinzu.

Volle Detailqualität, vollständige Werkzeuge, Datenintegrität und getrennte
Spieler-/GM-Inhalte bleiben verbindlich. Die vorhandenen Bibliotheken,
Rendererstrukturen und Workergrenzen dürfen ersetzt werden. Die Messungen
entscheiden über den technischen Weg. Rendererprivilegien bleiben auf die
geprüfte Preload-Brücke beschränkt; die kanonische Speichergrenze bleibt gewahrt.

Integration und Veröffentlichung folgen weiterhin den
[Lieferregeln](../../project/delivery/github-updates.md). Diese Roadmap erklärt
weder eine technische Prüfung noch eine native oder fachliche Abnahme für erledigt.
