# Umsetzungsplan zur Roadmap für Building und Object Tool

Stand: 06.10.2026, fortgeschrieben am 07.10.2026 nach dem Phase-1-Review. Dieser Plan konkretisiert [ROADMAP-PARITY.md](ROADMAP-PARITY.md); die Unterfälle und ihre Einzelbelege stehen in `acceptance.json`. Referenz ist das installierte Dungeondraft 1.2.0.1 „Opulent Kirin“. Die alte Baseline in den Abnahmeeinträgen beschreibt nicht automatisch den jetzigen Editor. Vor jedem Paket werden der aktuelle installierte Build, Quellstand und die betreffenden Einträge erneut gelesen.

## Gemeinsame Durchführung und Tor

Pro Fachphase gibt es drei getrennte Arbeitsläufe mit jeweils eigenem Start und Ergebnis: **Planlauf** klärt offene Originalfragen und schreibt die konkrete Phasenentscheidung hier fort; **Umsetzungslauf** ändert und testet den Editor; **Reviewlauf** vergleicht den installierten Endstand mit Roadmap, Plan und Einzelbelegen. Ein offenes Phasentor führt zu einem eigenen Nachbesserungslauf und danach zu einem neuen Reviewlauf; diese beiden Schritte werden wiederholt, bis keine Lücke des Phasentors mehr offen ist. Der vorliegende Nachbesserungsplan konkretisiert die im ersten Review gefundenen Lücken. Nach jeder freigegebenen Fachphase folgt eine eigene **Aufräumphase** mit wiederum getrenntem Plan-, Umsetzungs- und Reviewlauf; auch dort werden Review und Nachbesserung bei Lücken wiederholt. Erst der bestandene Aufräum-Review gibt die nächste Fachphase frei; die Aufräumphase nach Phase 7 schließt die Roadmap ab. Dieser erste Arbeitslauf erstellte den übergreifenden technischen Plan; er war keine Implementierungs- oder Paritätsabnahme.

Jede Phase läuft in dieser Reihenfolge: (1) offene Originalwirkung auf einer isolierten Karte mit definierter Eingabefolge, Screenshots und gespeicherter Rohkarte messen; vorhandene direkte Belege nur für genau ihren beobachteten Fall wiederverwenden; (2) gegen den aktuellen Editor vergleichen und nur bestätigte Unterschiede implementieren; (3) gezielte Kerntests sowie `npm run check`, `npm test`, `npm run build`; (4) Build vor Installation sichern, in einer isolierten Vault-Kopie installieren und denselben Bedienablauf in **einer** Obsidian-Testinstanz prüfen; (5) speichern, Obsidian-Prozess neu starten, Karte und Werkzeugzustand nachprüfen; (6) installierte Build-Prüfsumme, Original- und Hostbelege, verbleibende Grenzen je Unterfall in `acceptance.json` und `TOOL-PARITY.md` eintragen und `checkpoint.json` auf das nächste Paket setzen. Ein synthetischer Hostlauf ersetzt keine ausdrücklich geforderte physische Eingabe.

Testdaten bleiben unter `/home/aaron/.cache/dungeon-native-qa/`. Produktive Dungeontexte, Karten, Links und gespeicherte Bildgrößen werden nicht als Testdaten benutzt oder geändert. Bei Konturmutationen gehören Raumkennung, Portalanker und ein gemeinsamer Undo-Schritt zur Prüfung. Wenn das Original einen Ablauf noch nicht bestimmt, bleibt der Unterfall offen, bis eine direkte Messung eine Regel liefert; aus einem UI-Symbol wird keine Wirkung geraten. Fachphase und zugehörige Aufräumphase werden nacheinander abgeschlossen.

## Phase 1 – Grundformen und Zeichengesten

**Offene Punkte:** `DD-011.01–.04` benötigen den vollständigen aktuellen Hostvergleich für Rechteck, Ellipse, Polygon-Doppelklick und den ein Feld breiten Polygongang. Für `.05` sind Rücktaste, leere Entwurfsgrenze und Vorschaufolge zu messen. Für `.06` fehlen die allgemeine Shift-Segmentregel, Kurvengeometrie in weiteren Richtungen und frische Originalöffnung. Für `.07–.09` sind Rechteck-, Ellipsen- und Polygonradierung einschließlich Innenloch, Randwand und gebundenem Portal zu prüfen; die Original-Portalfolge ist noch offen. `.10` verlangt einen belegten Escape-Abbruch pro Form. `.13` verlangt Snap an/aus mit freien Koordinaten und Umschaltung während eines Entwurfs. `.14` verlangt Strg+Y. `DD-011.15` wird wegen seines Umfangs über alle Building-Optionen in Phase 3 vollständig geprüft; die Neuöffnung jeder Phase-1-Form bleibt hier Pflicht. Die vorhandenen Bau-01-Belege decken einzelne native Folgen ab, nicht diese ganze Matrix.

**Technik:** `src/editor.ts` erhält einen eigenen, segmentbezogenen Polygon-Kurvenentwurf; `src/geometry.ts` liefert eine aus den nativen Messpunkten abgeleitete, deterministisch gesampelte Kontur. Vorschau in `src/renderer.ts` und `composeFloor` bekommen dieselbe Kontur, und Rücktaste entfernt einen ganzen Entwurfsschritt. Kurven dürfen nicht über das bestehende globale `smooth` von Wand/Pfad modelliert werden. Die History-Tastenbehandlung erhält Strg+Y. Die vorhandenen Wege für `snapEnabled`, Doppelklick, Alt/E-Radieren, Escape und `planBuildingMutation` werden gegen die Messung korrigiert, sofern sie abweichen. `tests/core/drawing.test.ts` und `tests/core/building.test.ts` prüfen Kontur, Innenloch, Undo und Portalanker; ein gezieltes Host-Szenario prüft reale Eingabe, Vorschau, Speicherung und Neuöffnung. Eigene zusätzliche Werkzeugwege dürfen bleiben, solange die native Folge wirksam ist.

**Tor:** Alle zwölf zugeordneten Unterfälle haben ihren jeweiligen Original- und installierten Hostbeleg; geschlossene Formen sind ein rücknehmbarer Schritt, Abbruch hat keine Kartenwirkung, und die gespeicherte Boden-/Wandkontur sowie Raum- und Portalbindung überstehen den Frischstart. Der vollständige Pflichtfall `DD-011.15` bleibt bis Phase 3 offen.

### Phase 1 – Nachbesserungsplan nach dem Review vom 07.10.2026

**Ausgangsstand:** Commit `56c3d99` und Kandidaten-Build `17c48aa0e0d00a40bd20a34a112808484d7e4857b08fe86d4f586d5cf4f2d64d`; zehn gemessene Unterfallfolgen bestehen. Offen sind die gehaltene Shift-Handle-Vorschau (`DD-011.06`), der beobachtete Snap-Zustand nach Strg+S (`.13`) und ein aktueller Hostbeleg für einen nummerierten Raum mit unverändertem Key nach Konturänderung. Der frühere Review führte `.15` als offene Phase-1-Anforderung; dieser Plan ordnet den vollständigen Unterfall wegen seines Umfangs über alle Building-Optionen der Phase 3 zu. `acceptance.json` enthält Reviewbefund und konkrete Belege. Die zwei abgebrochenen Raum-Proben belegen keinen Produktfehler.

**Original und Vergleich:** Für `.06` die drei vorhandenen nativen P15–P17-Folgen mit identischen Ankern und verschiedenen Handles aus ihren gehaltenen Screenshots und gespeicherten Karten lesen. Im isoliert installierten Obsidian-Kandidaten denselben Shift-Zug jeweils *vor dem Loslassen* aufnehmen und die laufende Kurve, den Anker und die spätere Kontur getrennt vergleichen. Nur eine bestätigte Abweichung der gehaltenen Vorschau in `src/editor.ts`/`src/geometry.ts`/`src/renderer.ts` korrigieren; gespeicherte Samples nur bei eigener Abweichung ändern. Für `.13` auf einer frischen Dungeondraft-8×8-Karte zuerst über den Menüknopf einen Dateipfad speichern, dann Snap sichtbar einschalten. Den Zustand vor und nach Strg+S ohne dazwischenliegenden Zeigerklick sichern und mit einem weiteren Speichern über den Menüknopf vergleichen. Den Versuch mit neuem Prozess wiederholen und die gespeicherten Koordinaten eines nachfolgenden Zuges prüfen. Erst eine reproduzierbare Originalregel gegen denselben Kandidatenablauf stellen; andernfalls das frühere Umschalten als ungeklärt oder Testartefakt vermerken und keine Verhaltensänderung daraus ableiten.

**Raum-Quertor:** Ein eigenes, kurzes Host-Szenario statt einer Verlängerung der fünf Formfälle anlegen. Auf einer isolierten 8×8-Karte ein Rechteck zeichnen, als nummerierten Raum übernehmen und *zuerst speichern*, damit die Key-Datei aus dem Entwurf geschrieben wird. Raum-ID, Key-Pfad und exakte Key-Bytes festhalten. Eine überlappende Erweiterung und einen Alt-Innenschnitt ausführen; ID, Key-Bytes, Kontur und Wand nach jedem Schritt prüfen. Undo/Redo, Speichern und frischen Obsidian-Prozess prüfen. Ein gebundenes Portal wird in derselben Karte vor einem anschließenden Randschnitt gesetzt; sein Erhalt beziehungsweise Entfernen folgt nur der bereits direkt gemessenen nativen P4/P5-Folge. Einen ausgebliebenen ersten Zeigerzug durch Start-/Capture-Befund aufklären, bevor er als Produktfehler gilt. Host-Testskript und QA-Dateien bleiben unter `tools/host/` beziehungsweise `/home/aaron/.cache/dungeon-native-qa/`.

**Neuöffnung und Entscheidung:** Die direkten Original-Frischöffnungen für Grundformen, Shift-Kurve, Portal-Randschnitt, Alt-Ellipse und Alt-Polygon stehen bereits bei `.15`; eine fehlende Phase-1-Variante gezielt ergänzen. Der Kandidat muss jede in Phase 1 geprüfte Form- und Gestenwirkung nach frischem Prozess behalten. `DD-011.15` als vollständigen Pflichtfall erst nach den Boden-/Wandoptionen aus Phase 3 schließen; die Phase-1-Neuöffnung und den späteren Gesamtfall ausdrücklich getrennt dokumentieren. Danach `npm run check`, `npm test`, `npm run build`, Build-Hash, gezielten Hostlauf und Frischstart erneut prüfen. Der **nächste eigene Reviewlauf** vergleicht diese Belege mit den zwölf Phase-1-Unterfällen und dem Raum-/Portal-Tor; er entscheidet erst dann über die Phase-1-Freigabe.

## Phase 2 – Konturpunkte bearbeiten

Der eigene Planlauf vom 07.10.2026 hat den [konkreten Phase-2-Plan](ROADMAP-PARITY-PHASE2-PLAN.md) mit Ausgangsbelegen, Messreihenfolge, technischem Weg und Phasentor abgelegt. Der nächste Arbeitslauf ist die Umsetzung; der Review und eine mögliche Nachbesserung folgen jeweils getrennt.

**Offene Punkte:** `DD-012.01–.03` brauchen Punktmodus, Trefferzone, Eck- und Ellipsenpunktzug mit laufender Vorschau. `DD-013.01–.03` brauchen die genaue Delete-/Rücktasten-Vorbedingung und die native Mindestpunktzahl; der jüngere Delete-Befund widerspricht einem älteren Versuch und darf nicht aufgelöst behauptet werden. `DD-014.01–.02` brauchen Einfügepunkt an Kanten, Wand- und Portalfolge einschließlich Neuöffnung. Der ältere Esc-Versuch während eines gehaltenen Punktzugs war kein erfolgreicher Abbruch; dessen Wirkung bleibt Messfrage.

**Technik:** Punkt-Treffer und Vorschau in `src/editor.ts`/`src/renderer.ts`, Konturersatz und Topologieprüfung in `src/geometry.ts`, atomare Building- und Portaländerung über `planBuildingContourMutation` in `src/commands.ts`. Erst die Originalmessung legt Delete und Escape fest. Gezielt testen: Ecke verschieben, Ellipsenpunkt verschieben, Kante einfügen, Punkt entfernen, Drei-Punkte-Grenze, gebundenes Portal, Undo/Redo und Neuöffnung.

**Tor:** Jede bestätigte Eingabe verändert genau den erwarteten Punkt; Boden, Wand und Portal bleiben konsistent. Ein strittiger nativer Fall bleibt mit Beleg ausdrücklich offen und blockiert die vollständige Phasenfreigabe.

## Phase 3 – Boden- und Gebäudewandgestaltung

**Offene Punkte:** `DD-011.11–.12` betreffen Bodengalerie, bestehende versus spätere Flächen und Tint. `.15` verlangt die Neuöffnung aller Building-Optionen einschließlich der in Phase 1 geprüften Grundformen. `.16–.22` betreffen Farbknopf, Sättigung/Helligkeit, Hue, RGBA, Hex, Accept/Abbruch und das zunächst zu identifizierende kleine Symbol. `DD-015.01–.07` betreffen Paketwand, Stil ohne Wand, Wandfarbe, Bevel Corners, Wand-Follow nach Punktänderung, möglichen nachträglichen Stilwechsel und Farbknopf. Die genaue Originalwirkung von Pipette, Wandstilwechsel und einigen Farbgrenzen muss vor dem Coding nachgemessen werden.

**Technik:** Material-/Wand-Auswahl und Farbsteuerung in `src/properties.ts`, Assetauflösung in `src/assets.ts`, Building- und Wanddaten in `src/model.ts`/`src/commands.ts`, Darstellung in `src/renderer.ts`. Pickerwerte werden erst bei Accept als Werkzeugvorgabe übernommen; Abbruch verändert keine Karte. Ein bereits gezeichnetes Building behält seinen gespeicherten Stil, sofern die Originalmessung keinen nachträglichen Wechsel zeigt. Paketwand und Bevel werden aus derselben gespeicherten Kontur abgeleitet, damit Punktmutationen kein Auseinanderlaufen erzeugen. Testmatrix: zwei Stile auf benachbarten Flächen, Alpha und Hex, ein Building ohne Wand, eines mit Paketwand und Bevel, Änderung der Kontur, Undo/Redo, Save/Reopen.

**Tor:** Stil, Farbe und Wandanschluss stimmen in den gemessenen Fällen visuell und in gespeicherten Werten; vorbestehende Flächen ändern sich nur, wenn das Original es tut.

## Phase 4 – Objektbibliothek, Suche, Tags und Sets

**Offene Punkte:** `DD-026.01–.08`, `.17`, `.30` benötigen All/Used/Tags, konkrete Bildkacheln, ausgewähltes Asset, Suchauslösung, Fuzzy/Exact, Papierkorb, Suchfeld-X und Custom Set. `DD-047.01–.18` benötigt Default/Override, Tag- und Setanlage, Zuordnung und Entfernen, Save, Close, OK/Cancel sowie Geltung nach Neustart. Besonders offen sind Suchtreffer und Fuzzy-Regel, Priorität von Overrides, Verhalten ungespeicherter Änderungen und Minus-Aktionen; diese werden mit zwei benannten Testassets und einem definierten Testtag/-set direkt im Original gemessen.

**Technik:** `src/assets.ts` liefert eine stabile Objektliste mit Asset-IDs, Paketzugehörigkeit und Default-Tags; ein neues, reines Bibliotheksmodell unter `src/features/objekte/` berechnet All/Used/Tags/Suche/Set ohne UI-Zustand im Kartenmodell. Die Galerie in `src/properties.ts` oder einem dedizierten `src/ui/`-Baustein nutzt dieselbe gefilterte Liste für Kachelwahl und Cursorvorschau. Tag-/Set-Overrides erhalten einen validierten vaultweiten Speicherweg über `src/main.ts` und `src/vault-stores.ts`; die Karte speichert weiter nur Asset-IDs und ihre Paketbindung. Speichern und Verwerfen des Tagdialogs werden als getrennte Transaktion modelliert. Unit-Tests prüfen Treffermengen und Persistenz; der Host prüft Assetbilder, Wechsel der Filter, Save/Close und frischen Prozess.

**Tor:** Dieselbe Such-/Filterfolge wählt dasselbe Testasset; Default und Override behalten die gemessene Priorität und Persistenz. Noch ungemessene Originalregeln werden nicht als gleichwertig markiert.

## Phase 5 – Objektplatzierung und Eigenschaften

**Offene Punkte:** `DD-026.09–.21`, `.28–.29` benötigen Layer, Over/Under, Rotation, einheitlichen Scale, Shadow, Block Light, Custom Color, Cursorbild, Escape und wiederholte Einzelplatzierung. Aus `DD-028` gehören `.01–.12` und die objektbezogene Pipette `.19` hierher; Scatter- und Light-Farbunterfälle `.13–.18` bleiben außerhalb dieser Roadmap. Originalwirkung von Sortierung, Lichtblockade, geeigneter Färbung und Escape-Vorschau sowie Original-Reopen für die vollständige Wertkombination sind vorab zu messen.

**Technik:** Platzierungsvorgaben in `src/properties.ts` und dem Toolzustand von `src/editor.ts` von vorhandenen `MapObject`-Instanzen trennen. `src/commands/objects.ts` erzeugt pro Kartenklick genau eine Instanz und einen Befehl; `src/renderer.ts` zeigt dieselben Rotation-, Scale-, Ebenen-, Farb- und Schattenwerte wie die spätere Instanz. Die vorhandenen Colorable-Helfer unter `src/features/objekte/` und `src/assets.ts` werden auf nur färbbare Bereiche geprüft. `src/model.ts` erhält nur Werte, die nicht schon gespeichert werden. Hostmatrix mit einem gewöhnlichen und einem färbbaren Paketasset, überlappenden Möbeln, Undo/Redo und Neuöffnung.

**Tor:** Vorschau und gesetzte Objekte stimmen in allen geprüften Eigenschaften; zwei Klicks ergeben zwei Instanzen und zwei Undo-Schritte. Gespeicherte Werte und Sichtreihenfolge überstehen den Frischstart.

## Phase 6 – Objektgesten und nötige Auswahl

**Offene Punkte:** `DD-026.22–.27` benötigen einzelne Originalmessungen für Rad, Alt+Rad, Shift+Rad, gehaltenes A, Rechtsklick und Z+Rad, jeweils mit Vorher-/Nachherwert und Kameraposition. Aus `DD-030` werden die für Objekte benötigten Teile von `.19–.25`, `.29` und `.34` geprüft: Direktklick, Mehrfachwahl, Bewegung, Drehung, Skalierung, Spiegelung und Undo/Redo. Fremdobjekt- und vollständige Filterfälle gehören nicht zum Phasentor. Die derzeitigen Ersatzkürzel `[`, `]`, `+`, `-` und A dürfen zusätzlich bestehen, zählen aber nicht als Nachweis der nativen Geste.

**Technik:** Modifier- und Radbehandlung in `src/editor.ts` so routen, dass beim Object Tool die belegte Eigenschaft der Platzierungsvorgabe geändert und der Kameraradweg nicht gleichzeitig ausgeführt wird. Gehaltenes A braucht einen temporären Tastenzustand mit Key-Up/Fokusverlust; Rechtsklick darf keine doppelte Kontextaktion auslösen. Auswahl nutzt `src/selection.ts`, Transformationsbefehle und `objectAtPoint`, damit Raumzuordnung bei Bewegung neu berechnet wird. Renderer-Vorschau und Properties werden nach jeder Geste synchronisiert. Hostläufe erfassen Eigenschaft, Kamera, ausgewählte Instanz, Undo/Redo, Raumzuordnung und Neuöffnung; physische Maus-/Touchpad-Probe ist zusätzlich in Phase 7 verpflichtend.

**Tor:** Jede Geste ändert nur die nativ belegte Eigenschaft; die geprüfte Objektauswahl und Transformation erhalten stabile Karte, Raumzuordnung und History.

## Phase 7 – Gemeinsamer Ablauf

**Offene Punkte:** Der Ablauf Raum zeichnen und bearbeiten → mehrere Objekte platzieren/auswählen → eines in einen anderen Raum verschieben → Feature an einen wortgleichen Key-Abschnitt binden → über Kartenmarker öffnen ist als durchgehende Kette noch nicht gegen diesen Endstand geprüft. Ebenso fehlen für diese Roadmap physische Maus-/Touchpad-Eingaben und eine große kombinierte Karte. Geschützte Bestandsdateien müssen vor/nach dem Test per Hash übereinstimmen.

**Technik:** Ein isoliertes V4-Host-Szenario auf Kopien benutzt die echten UI-Wege und prüft gemeinsame Befehle in `src/editor.ts`, `src/commands.ts`, `src/content.ts` und der Spielansicht. Danach ein frischer Obsidian-Prozess, eine große Testkarte und separat protokollierte physische Eingabe. Regression umfasst Raum-/Feature-IDs, Key-Wortlaut, Links, Spielansicht und gespeicherte Bildgrößen. Nur hier benötigte Fehler werden korrigiert; andere Werkzeuge bekommen keine pauschale Paritätsfreigabe.

**Tor:** Die ganze Kette besteht mit Undo/Redo und Neuöffnung; große Karte und physische Eingabe haben eigene Endstandsbelege.

## Aufräumzyklen nach den Fachphasen

Jeder Zyklus hat einen eigenen Planlauf mit aktuellen Code- und Belegbefunden, einen Umsetzungslauf und einen Reviewlauf. Das folgende Thema ist eine Suchrichtung, keine vorweggenommene Änderung. Der Planlauf begrenzt die konkrete Arbeit erst nach Freigabe der jeweiligen Fachphase.

Für die freigegebene Fachphase 1 liegt der konkrete [Aufräumplan für Building-Grundformen](ROADMAP-PARITY-CLEANUP-1-PLAN.md) vor. Sein eigener Umsetzungslauf folgt als Nächstes; der Aufräum-Review bleibt ein weiterer getrennter Arbeitslauf.

Stand nach dem getrennten Aufräum-Review vom 07.10.2026: Umsetzung und Aufräumtor der Phase 1 sind bestanden. Der [Reviewbericht](/home/aaron/.cache/dungeon-native-qa/parity-phase1-cleanup-review-20261007/cleanup-review.md) und `acceptance.json` enthalten die Einzelbelege. Der nächste eigene Arbeitslauf plant Phase 2; die obige Phasenreihenfolge bleibt bestehen.

| Nach Fachphase | Prüf- und Aufräumfokus |
| --- | --- |
| 1 | Building-Entwurf, gemeinsame Vorschau-/Commit-Geometrie, Selbstschnitt-Bereinigung und deren Kosten bei großen Konturen. |
| 2 | Punktmutation, Topologie- und Portalprüfung sowie atomare History-Befehle. |
| 3 | Boden-/Wandstilzustand, Assetauflösung, Bildressourcen und Farbwerte. |
| 4 | Objektbibliothek, Filter-/Suchzustand, Tag- und Set-Persistenz. |
| 5 | Trennung von Werkzeugvorgabe und Objektinstanz, Vorschau-/Renderdaten. |
| 6 | Modifier-, Rad- und Fokusereignisse sowie Auswahl-/Transformationsbefehle. |
| 7 | Gemeinsame Raum–Objekt–Key-Wege, Ressourcenlebensdauer und Gesamtabgleich. |

## Aufräumen nach Phase 7 und Gesamtarchitekturreview

Nach Phase 7 die neu eingeführten Zustände, Modelle und Ereigniswege auf doppelte Logik, verdeckte Kopplung, ungenutzte Helfer und fehlende Freigabe von Bildressourcen prüfen. Wiederholte Vorschau-/Commit-Berechnungen auf eine gemeinsame reine Funktion bringen, ohne andere Werkzeugfolgen umzudeuten. Test-Hilfen und Belege unter den festgelegten Orten bündeln; temporäre Installationsdateien aus dem Projekt entfernen, fremde oder geschützte Daten nicht anfassen. Danach alle Roadmap-Unterfälle, `ROADMAP-PARITY-PLAN.md`, `acceptance.json`, `TOOL-PARITY.md`, `ARCHITECTURE.md` und `checkpoint.json` gegen den installierten Build abgleichen; Basistests, gezielter Hostlauf, frischer Prozess und Git-Diff-Review bilden das Abschlusstor. Außerhalb der Roadmap offene Unterfälle bleiben offen.
