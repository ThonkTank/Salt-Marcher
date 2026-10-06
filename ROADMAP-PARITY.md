# Roadmap: Dungeondraft-Verhalten für Grundrisse und Objekte angleichen

Diese Roadmap folgt auf [Räume und Objekte mit Raum-Keys verbinden](ROADMAP.md). Deren Phasen sicherten zunächst den funktionierenden Ablauf. Hier werden das **Building Tool** und das **Object Tool** des installierten Dungeondraft 1.2.0.1 „Opulent Kirin“ in ihren vollständigen Werkzeugabläufen nacheinander abgeglichen. Bedienwirkung und Kartenwirkung sollen gleichwertig sein; eine andere Oberfläche und einzelne andere Pixel sind zulässig.

Der verbindliche Unterfallkatalog steht in `acceptance.json`. Die Phasen decken `DD-011` bis `DD-015`, `DD-026` und die für dessen Bibliothek nötigen Tags und Sets aus `DD-047` ab. Farbwahl, Assetpakete und Auswahl werden nur für Abläufe dieser beiden Werkzeuge einbezogen. Die vollständige Parität anderer Werkzeuge bleibt offen. Raum-Key und Feature-Verknüpfung haben kein Dungeondraft-Vorbild; sie werden als Projektablauf gegen die bestehenden Anforderungen geprüft.

## Regel für jede Phase

1. Den aktuellen **installierten** Editorstand und den passenden Unterfall in `acceptance.json` lesen. Vorhandene Nachweise sind Ausgangspunkte, keine pauschale Paritätsfreigabe.
2. Die Eingabefolge, Optionen, Vorschau, Zustandswechsel und gespeicherte Wirkung direkt in Dungeondraft auf isolierten Testdaten belegen. Eine noch unbekannte Originalwirkung vor der Umsetzung gezielt nachmessen.
3. Nur bestätigte Abweichungen angleichen. Danach denselben Ablauf im installierten Obsidian auf einer isolierten Kopie prüfen, einschließlich Undo/Redo, Speichern und frischer Neuöffnung, soweit der Unterfall diese Zustände betrifft.
4. Die betroffenen Unterfälle erst nach Originalbeleg, implementierter Wirkung, Hostlauf und Endstandsprüfung schließen; Beleg, Build, Abweichung und Restarbeit in `acceptance.json` und `TOOL-PARITY.md` festhalten. `checkpoint.json` nennt danach die nächste Phase. Typprüfung, Kerntests und Build sind zusätzliche Prüfungen.

Die Phasen laufen in der folgenden Reihenfolge. Es läuft höchstens eine grafische Testinstanz. Produktive Dungeontexte, Karten, Links und gespeicherte Bildgrößen bleiben bei den Werkzeugprüfungen geschützt. Physische Maus- und Touchpad-Eingaben werden nicht durch synthetische Ereignisse als abgenommen ausgegeben.

## Phase 1 – Grundformen und Zeichengesten

**Unterfälle:** `DD-011.01` bis `.10` sowie `.13` bis `.15`.

Rechteck, Ellipse, Polygon und ein schmaler Polygongang erhalten dieselbe wirksame Vorschau und Abschlussfolge wie das Original. Rücktaste, Shift-Kurve, Alt-Radieren, Escape und Snap an/aus werden jeweils mit fertigem Boden und umlaufender Wand verglichen. Die eigenen zusätzlichen Eingänge dürfen bleiben, sofern der originale Ablauf funktioniert.

**Phasentor:** Jede Form und jede genannte Geste ist beidseitig belegt; Abbruch erzeugt keinen Teilstand, ein abgeschlossener Schritt ist rücknehmbar und nach frischem Öffnen erhalten. Räume und bestehende Durchgänge bleiben bei geänderten Konturen konsistent.

## Phase 2 – Konturpunkte bearbeiten

**Unterfälle:** `DD-012` bis `DD-014`.

Punktbearbeitung aktivieren, Eck- und Ellipsenpunkte ziehen, Punkte an Kanten einfügen und mit Delete beziehungsweise Rücktaste entfernen. Mindestpunktzahl, Trefferzonen, fortlaufende Vorschau und die Folgen für Boden, Wand und gebundene Öffnungen werden am Original verglichen.

**Phasentor:** Einfügen, Ziehen und Entfernen liefern die belegte Konturwirkung; Undo/Redo und Neuöffnung erhalten Geometrie, Portalbindung und Raumzuordnung.

## Phase 3 – Boden und Gebäudewand gestalten

**Unterfälle:** `DD-011.11` und `.12`, `DD-011.16` bis `.22` sowie `DD-015`.

Boden- und Wandgalerie, Stil ohne Wand, Färbung und Farbwähler, Bevel Corners und Stilwechsel vor und nach dem Zeichnen werden mit denselben Testkonturen geprüft. Paketwände müssen Punktänderungen folgen. Farbwahl wird nur für diese Werkzeugoptionen einbezogen.

**Phasentor:** Stil, Farbe, Kontur und Wandverbindung zeigen die belegte Wirkung und bleiben nach Bearbeitung, Undo/Redo, Speichern und Neuöffnung erhalten.

## Phase 4 – Objektbibliothek, Suche, Tags und Sets

**Unterfälle:** `DD-026.01` bis `.08`, `.17`, `.30` und `DD-047`.

All, Used, Tags, Suche einschließlich Fuzzy/Exact und ihrer Löschaktionen, Bildkachelwahl sowie Custom Set werden mit identischen Testassets verglichen. Die nötige Tag- und Setverwaltung umfasst Anlage, Zuordnung, Override, Save, Close, Abbruch und frischen Start. Der allgemeine Paketmanager gehört nicht zu dieser Phase; die verwendeten Paketassets müssen in der Objektbibliothek richtig erscheinen.

**Phasentor:** Dieselbe Suche und Filterfolge führt zum beabsichtigten Asset; Tag- und Setänderungen haben die belegte Geltung und Persistenz. Unbestätigte Originalregeln bleiben ausdrücklich offen.

## Phase 5 – Objektvorschau, Platzierung und Eigenschaften

**Unterfälle:** `DD-026.09` bis `.21` sowie `.28` und `.29`; objektbezogene Farbwahl aus `DD-028`.

Ebene und Over/Under, Drehung, einheitliche Skalierung, Schatten, Lichtblockade, geeignete Custom Color, Cursorvorschau, Escape und wiederholte Platzierung werden mit demselben Asset geprüft. Werkzeugvorgaben und bereits gesetzte Objekte bleiben getrennt.

**Phasentor:** Vorschau und gesetztes Objekt stimmen in den geprüften Eigenschaften überein; jeder Klick erzeugt genau eine Instanz und einen Undo-Schritt. Reihenfolge, Farbe, Lichtwirkung und sämtliche gespeicherten Werte bestehen die Neuöffnung.

## Phase 6 – Objektgesten und nötige Auswahl

**Unterfälle:** `DD-026.22` bis `.27`; aus `DD-030` die für ausgewählte Objekte benötigten Klick-, Bewegungs-, Dreh-, Skalierungs-, Spiegel- und Undo-Abläufe.

Mausrad, Alt+Mausrad, Umschalt+Mausrad, gehaltenes A, Rechtsklick und Z+Mausrad werden einzeln am Original vermessen. Anschließend werden gesetzte Objekte ausgewählt, verschoben und transformiert. Die vollständigen Filter-, Gruppen- und Fremdobjektabläufe des Select Tools bleiben eine eigene Abnahme.

**Phasentor:** Jede Geste verändert nur die belegte Eigenschaft und bewegt die Kamera nicht unbeabsichtigt. Auswahl, Raumzuordnung, Undo/Redo und frische Neuöffnung stimmen für die geprüften Objektfolgen.

## Phase 7 – Gemeinsamer Ablauf und Abschluss

Auf einer isolierten Kopie einen Raum zeichnen und bearbeiten, mehrere Objekte auswählen und setzen, eines zwischen Räumen verschieben, ein Feature mit seinem wortgleichen Key-Abschnitt verbinden und den Abschnitt über die Karte öffnen. Danach Undo/Redo, Speichern und einen frischen Obsidian-Prozess prüfen. Die zuvor übersprungene physische Maus-/Touchpad-Probe und eine große kombinierte Testkarte erhalten eigene Ergebnisse; ohne diese Belege werden sie nicht als abgeschlossen markiert.

**Abschluss:** Alle Pflicht-Unterfälle dieser Roadmap besitzen direkte Original- und Endstandsbelege. Der bestehende Raum–Objekt–Key-Ablauf, die Spielansicht, IDs, Links und geschützte Texte bestehen die Regression. Offene Fälle außerhalb dieser Roadmap werden nicht als erledigt ausgewiesen.
