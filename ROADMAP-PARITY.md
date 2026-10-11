# Roadmap: Dungeondraft-Verhalten für Grundrisse und Objekte angleichen

Diese Roadmap folgt auf [Räume und Objekte mit Raum-Keys verbinden](ROADMAP.md). Deren Phasen sicherten zunächst den funktionierenden Ablauf. Hier werden das **Building Tool** und das **Object Tool** des installierten Dungeondraft 1.2.0.1 „Opulent Kirin“ in ihren vollständigen Werkzeugabläufen nacheinander abgeglichen. Bedienwirkung und Kartenwirkung sollen gleichwertig sein; eine andere Oberfläche und einzelne andere Pixel sind zulässig.

Für alle Phasen gilt: Bedienung und Funktion müssen mit dem Vorbild übereinstimmen; eine ungefähr gleichwertige grafische Darstellung genügt. Pixelwerte sind nur Diagnosemittel für sichtbare oder funktionale Abweichungen.

Der verbindliche Unterfallkatalog steht in `acceptance.json`. Die Phasen decken `DD-011` bis `DD-015`, `DD-026` und die für dessen Bibliothek nötigen Tags und Sets aus `DD-047` ab. Farbwahl, Assetpakete und Auswahl werden nur für Abläufe dieser beiden Werkzeuge einbezogen. Die vollständige Parität anderer Werkzeuge bleibt offen. Raum-Key und Feature-Verknüpfung haben kein Dungeondraft-Vorbild; sie werden als Projektablauf gegen die bestehenden Anforderungen geprüft.

Die [Folge-Roadmap für die übrigen Dungeondraft-Abläufe](ROADMAP-PARITY-TOOLS.md) ist geplant enthält die weiteren Werkzeuganforderungen.

## Funktionsprüfung

Originalwirkung und den passenden Unterfall in `acceptance.json` vergleichen. Eingabefolge, Optionen, Vorschau, Undo/Redo, gespeicherte Wirkung und frische Neuöffnung auf isolierten Testdaten belegen. Nur bestätigte Abweichungen angleichen; fehlende Original-, Host- oder physische Nachweise bleiben offen. Produktive Karten, Kennungen und Nutzertexte schützen.

## Phase 1 – Grundformen und Zeichengesten

**Unterfälle:** `DD-011.01` bis `.10` sowie `.13` und `.14`. `DD-011.15` wird vollständig in Phase 3 geprüft; das Speichern und frische Wiederöffnen aller hier gezeichneten Formen bleibt Teil dieses Phasentors.

Rechteck, Ellipse, Polygon und ein schmaler Polygongang erhalten dieselbe wirksame Vorschau und Abschlussfolge wie das Original. Rücktaste, Shift-Kurve, Alt-Radieren, Escape und Snap an/aus werden jeweils mit fertigem Boden und umlaufender Wand verglichen. Die eigenen zusätzlichen Eingänge dürfen bleiben, sofern der originale Ablauf funktioniert.

**Phasentor:** Jede Form und jede genannte Geste ist beidseitig belegt; Abbruch erzeugt keinen Teilstand, ein abgeschlossener Schritt ist rücknehmbar und nach frischem Öffnen erhalten. Räume und bestehende Durchgänge bleiben bei geänderten Konturen konsistent.

## Phase 2 – Konturpunkte bearbeiten

**Unterfälle:** `DD-012` bis `DD-014`.

Punktbearbeitung aktivieren, Eck- und Ellipsenpunkte ziehen, Punkte an Kanten einfügen und mit Delete beziehungsweise Rücktaste entfernen. Mindestpunktzahl, Trefferzonen, fortlaufende Vorschau und die Folgen für Boden, Wand und gebundene Öffnungen werden am Original verglichen.

**Phasentor:** Einfügen, Ziehen und Entfernen liefern die belegte Konturwirkung; Undo/Redo und Neuöffnung erhalten Geometrie, Portalbindung und Raumzuordnung.

## Phase 3 – Boden und Gebäudewand gestalten

Aktueller getrennter Nachbesserungsplan: [Bevel und QAWall01-Konturen (historisch)](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6a90f3ee2f50f0be45f0e256784576f13722c319/ROADMAP-PARITY-PHASE3-REPAIR-BEVEL-POINTS-PLAN.md). Der vorherige [Wear-/Building-Plan (historisch)](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6a90f3ee2f50f0be45f0e256784576f13722c319/ROADMAP-PARITY-PHASE3-WEAR-BEHAVIOR-PLAN.md) ist umgesetzt und reviewt. Bedienung und Funktion müssen dem Original entsprechen; die Grafik genügt ungefähr gleichwertig. Pixelmessungen dienen der Diagnose sichtbarer Fehler.

**Unterfälle:** `DD-011.11`, `.12`, `.15`, `.16` bis `.22` sowie `DD-015`.

Boden- und Wandgalerie, Stil ohne Wand, Färbung und Farbwähler, Bevel Corners und Stilwechsel vor und nach dem Zeichnen werden mit denselben Testkonturen geprüft. Paketwände müssen Punktänderungen folgen. Farbwahl wird nur für diese Werkzeugoptionen einbezogen.

**Phasentor:** Stil, Farbe, Kontur und Wandverbindung zeigen die belegte Wirkung und bleiben nach Bearbeitung, Undo/Redo, Speichern und Neuöffnung erhalten. `DD-011.15` umfasst danach alle Building-Optionen einschließlich der bereits in Phase 1 geprüften Formen.

**Wear und Building, getrennt umgesetzt und reviewt:** Der Originalschalter „Disable Building Wear“ wurde an zwei gleich gezeichneten, gespeicherten und frisch geöffneten Karten mit Wood Vertical, Battlements, QAWall01 und einer verankerten Tür gepaart. Der isolierte Host bietet und speichert denselben binären Modus; Boden, eingebaute und Paketwände sowie Vorschau verwenden ihn. Beide Hostmodi bestehen Zeichnen, Undo/Redo, Save und frische Neuöffnung; eine bestehende V2-Karte öffnet mit unverändertem Zahlenwert. [Umsetzungslauf 1](/home/aaron/.cache/dungeon-native-qa/parity-phase3-wear-implementation-20261007/wear-implementation.md) und [Umsetzungslauf 2](/home/aaron/.cache/dungeon-native-qa/parity-phase3-wear-followup-20261007/implementation-run2.md) sind abgeschlossen. Der [unabhängige 17-Fälle-Review](/home/aaron/.cache/dungeon-native-qa/parity-phase3-wear-review-20261007/phase3-independent-review.md) verifiziert 14 Unterfälle. Der [Bevel-/QAWall01-Nachbesserungsplan (historisch)](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6a90f3ee2f50f0be45f0e256784576f13722c319/ROADMAP-PARITY-PHASE3-REPAIR-BEVEL-POINTS-PLAN.md) ist [teilweise umgesetzt](/home/aaron/.cache/dungeon-native-qa/parity-phase3-bevel-points-20261007/phase3-bevel-points-implementation.md): Die direkte Originalmatrix, die abweichende Punkt-Stilregel sowie sechs Host-Bevel-Karten mit frischer Neuöffnung sind belegt; der Hostpatch und die Endbuild-Regressionen bestanden. Der Schalterwechsel an einer bestehenden Originalform sowie Innen-/Mehrteil-Punkt-, Alt- und Portalentfernungsfolgen fehlen. `DD-011.15`, `DD-015.04`, `DD-015.05` und das Phase-3-Tor bleiben bis zum vollständigen Paar und getrennten Review offen. Installierter Build und produktiver Vault bleiben unverändert.

## Phase 4 – Objektbibliothek, Suche, Tags und Sets

**Unterfälle:** `DD-026.01` bis `.08`, `.17`, `.30` und `DD-047`.

All, Used, Tags, Suche einschließlich Fuzzy/Exact und ihrer Löschaktionen, Bildkachelwahl sowie Custom Set werden mit identischen Testassets verglichen. Die nötige Tag- und Setverwaltung umfasst Anlage, Zuordnung, Override, Save, Close, Abbruch und frischen Start. Der allgemeine Paketmanager gehört nicht zu dieser Phase; die verwendeten Paketassets müssen in der Objektbibliothek richtig erscheinen.

**Phasentor:** Dieselbe Suche und Filterfolge führt zum beabsichtigten Asset; Tag- und Setänderungen haben die belegte Geltung und Persistenz. Unbestätigte Originalregeln bleiben ausdrücklich offen.

## Phase 5 – Objektvorschau, Platzierung und Eigenschaften

Der [eigene Phase-5-Umsetzungsplan (historisch)](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/6a90f3ee2f50f0be45f0e256784576f13722c319/ROADMAP-PARITY-PHASE5-PLAN.md) legt Originalproben, Werkzeug- und Pickerausbau, Hostpaare und das getrennte Fachreview fest. `DD-026.17` bleibt als bestandener Phase-4-Fall Regression; von `DD-028.19` wird zunächst nur der Objektkontext geprüft. Dieser Planlauf ändert keinen Produktcode und nimmt keine neuen Fachfälle ab.

**Unterfälle:** `DD-026.09` bis `.21` sowie `.28` und `.29`; objektbezogene Farbwahl aus `DD-028`.

Ebene und Over/Under, Drehung, einheitliche Skalierung, Schatten, Lichtblockade, geeignete Custom Color, Cursorvorschau, Escape und wiederholte Platzierung werden mit demselben Asset geprüft. Werkzeugvorgaben und bereits gesetzte Objekte bleiben getrennt.

**Phasentor:** Vorschau und gesetztes Objekt stimmen in den geprüften Eigenschaften überein; jeder Klick erzeugt genau eine Instanz und einen Undo-Schritt. Reihenfolge, Farbe, Lichtwirkung und sämtliche gespeicherten Werte bestehen die Neuöffnung.

## Phase 6 – Objektgesten und nötige Auswahl

**Unterfälle:** `DD-026.22` bis `.27`; aus `DD-030` die für ausgewählte Objekte benötigten Klick-, Bewegungs-, Dreh-, Skalierungs-, Spiegel- und Undo-Abläufe.

Mausrad, Alt+Mausrad, Umschalt+Mausrad, gehaltenes A, Rechtsklick und Z+Mausrad werden einzeln am Original vermessen. Anschließend werden gesetzte Objekte ausgewählt, verschoben und transformiert. Die vollständigen Filter-, Gruppen- und Fremdobjektabläufe des Select Tools bleiben eine eigene Abnahme.

**Phasentor:** Jede Geste verändert nur die belegte Eigenschaft und bewegt die Kamera nicht unbeabsichtigt. Auswahl, Raumzuordnung, Undo/Redo und frische Neuöffnung stimmen für die geprüften Objektfolgen.

## Phase 7 – Gemeinsamer Ablauf

Auf einer isolierten Kopie einen Raum zeichnen und bearbeiten, mehrere Objekte auswählen und setzen, eines zwischen Räumen verschieben, ein Feature mit seinem wortgleichen Key-Abschnitt verbinden und den Abschnitt über die Karte öffnen. Danach Undo/Redo, Speichern und einen frischen Obsidian-Prozess prüfen. Die zuvor übersprungene physische Maus-/Touchpad-Probe und eine große kombinierte Testkarte erhalten eigene Ergebnisse; ohne diese Belege werden sie nicht als abgeschlossen markiert.

**Phasentor:** Alle Pflicht-Unterfälle dieser Roadmap besitzen direkte Original- und Endstandsbelege. Der bestehende Raum–Objekt–Key-Ablauf, die Spielansicht, IDs, Links und geschützte Texte bestehen die Regression. Offene Fälle außerhalb dieser Roadmap werden nicht als erledigt ausgewiesen.
