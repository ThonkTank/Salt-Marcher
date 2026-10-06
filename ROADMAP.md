# Roadmap: Räume und Objekte mit Raum-Keys verbinden

Ziel: Bis zum 7. Oktober 2026 morgens lassen sich Räume zeichnen, Objekte platzieren und die benötigten Beschreibungen sowie Features im passenden Raum-Key finden. Jede Phase folgt demselben Ablauf: aktuellen Editor am entsprechenden Dungeondraft-Werkzeug und am Raum-Key-Schema prüfen, Lücken angleichen oder gezielt ergänzen, dann auf einer isolierten Drachenhöhlenkopie mit Speichern und frischem Obsidian-Start verifizieren. Produktive Karten und Bestandstexte bleiben geschützt.

## Phase 1 – Grundrisse und Raum-Key

**Umfang:** Rechteck, Ellipse, Polygon und ein Feld breiter polygonaler Gang mit sichtbarer Vorschau, Boden und Kontur; einen Grundriss als nummerierten Raum mit neuem Key übernehmen; Rückgängig/Wiederholen, Speichern und Frischöffnung.

**Abgleich:** Dungeondraft 1.2.0.1 zeichnet die Grundformen und schließt Polygone per Doppelklick. Im bisherigen Editor blieb der Polygonentwurf offen, weil `pointerup.detail` statt des Doppelklickereignisses ausgewertet wurde. Die Grundform- und Raum-Key-Funktionen waren bereits vorhanden.

**Umsetzung:** Doppelklick beendet den aktiven Polygonentwurf über denselben Abschlussweg wie Enter. Rechteck, Ellipse, Polygon, schmaler Gang und Raumübernahme wurden auf der Drachenhöhlenkopie geprüft.

**Nachweis:** Isolierter Obsidian-Bearbeitungslauf mit sieben bestandenen Fällen, Speichern der V3-Karte und eines neuen Raum-Keys; frischer Prozess bestätigt den gespeicherten Karten- und Key-Stand. Typprüfung, 129 Kernprüfungen und Build bestanden. Physische Maus-/Touchpad-Bedienung und vollständige Dungeondraft-Parität für Snap, Kurven, Radieren, Stile und komplexe Konturen bleiben getrennte offene Fälle in `acceptance.json`.

## Phase 2 – Ein Objekt platzieren

- **Abgleichen:** Objektwahl, Cursorvorschau und Kartenklick in Dungeondraft 1.2.0.1 und im installierten Editor.
- **Angleichen/ergänzen:** Nur die Lücken beheben, die das Wählen und sichtbare Platzieren eines Objekts verhindern.
- **Prüfen:** Ein Objekt im neuen Testraum setzen; Position, Darstellung, Undo/Redo, Speichern und Frischöffnung auf der Kopie bestätigen.

**Umsetzung:** Das gewählte Paketobjekt folgt als flüchtiges Bild dem Cursor. Die Vorschau übernimmt Größe, Farbe und Drehung der Platzierung, verschwindet beim Verlassen der Karte und verwirft verspätete Assetbilder. Der vorhandene Klickbefehl setzt weiterhin genau ein Objekt mit Raumkennung und einem Undo-Schritt.

**Nachweis:** `qa_chest` wurde im isolierten Raum 16 bei (4, 3) sichtbar platziert. Cursorvorschau ohne Karten- oder Verlaufsänderung, Position, `roomId`, Undo/Redo, V3-Speicherung und frischer Obsidian-Prozess bestanden mit dem installierten Build. Alle 89 produktiven Dungeondateien blieben bytegleich. Die vollständige Objektbibliothek und weitere Dungeondraft-Unterfälle bleiben in `acceptance.json` offen.

## Phase 3 – Mehrere Objekte und Raumzuordnung

- **Abgleichen:** Wiederholte Platzierung und Auswahl mit Dungeondraft; `roomId` und Verschieben zwischen Räumen mit dem Kartenmodell.
- **Angleichen/ergänzen:** Wiederholt setzen und die Zuordnung zum tatsächlichen Raum bei Platzierung und Verschiebung sichern.
- **Prüfen:** Zwei Objekte setzen, eines verschieben; Auswahl, Raumzuordnung, Undo/Redo und Frischöffnung auf der Kopie kontrollieren.

**Abgleich:** Dungeondraft 1.2.0.1 behält das Objektwerkzeug für Folgeklicks bei und erzeugt getrennte Instanzen. Die direkte Auswahl- und gemeinsame Zugprobe belegt einen rücknehmbaren Bewegungsschritt. Raum-Keys und `roomId` sind eigene Kartenfunktionen.

**Umsetzung:** Platzierung und Objektzüge ermitteln den Raum anhand des Objektmittelpunkts auf demselben Geschoss; außerhalb eines Raums entfällt `roomId`. Der Raumwechsel bleibt Teil des Bewegungsbefehls und aktualisiert den angezeigten Key der Auswahl.

**Nachweis:** Im installierten Build wurden zwei `qa_chest`-Objekte nacheinander in Raum 16 gesetzt. Eines wurde in den angrenzenden QA-Raum 17 gezogen; Auswahl, beide Raumkennungen, Key-Anzeige, Undo/Redo, V3-Speicherung und frischer Obsidian-Prozess bestanden. Die vorhandenen Texte der isolierten Drachenhöhlenkopie blieben bytegleich. Typprüfung, 109 Tests und Build bestanden. Physische Eingabe, weitere Objektoptionen und vollständige Dungeondraft-Parität bleiben offen.

## Phase 4 – Feature im Raum-Key anlegen

- **Abgleichen:** Vorhandenen Feature-Dialog und Key-Ausgabe mit `room-keys.md` und `karten.md` prüfen; Dungeondraft liefert hierfür keinen Raum-Key.
- **Angleichen/ergänzen:** Neue Beschreibung am Feature im richtigen Raum ergänzen, mit nächstem freien Buchstaben und stabilem Überschriftenanker; Bestandstext erhalten.
- **Prüfen:** Featuretitel, Beschreibung, Buchstabe und Anker im neuen Test-Key sowie Undo/Redo und Frischöffnung kontrollieren.

## Phase 5 – Objekt und Feature verbinden

- **Abgleichen:** Auswahl → Feature-Vorkommen → Kartenobjekt, `roomId` und Key-Anker im installierten Editor verfolgen.
- **Angleichen/ergänzen:** Das ausgewählte Objekt mit genau einem passenden Feature im Raum-Key verbinden und dessen Beschreibung direkt erreichbar machen.
- **Prüfen:** Klick auf das Objekt öffnet den richtigen Key-Abschnitt; Link, Buchstabe, Text und Zuordnung bleiben nach Speichern und Frischöffnung erhalten.

## Phase 6 – Gesamtabnahme

- **Abgleichen:** Einen Raum zeichnen, nummerieren, Objekte setzen, ein Feature beschreiben und vom Kartenobjekt zum Key wechseln; Brüche im Ablauf erfassen.
- **Angleichen/ergänzen:** Gefundene Brüche im selben Ablauf beheben.
- **Prüfen:** Den vollständigen Ablauf auf einer isolierten Drachenhöhlenkopie einschließlich Undo/Redo, Speichern, frischem Obsidian-Start und physischer Bedienung wiederholen. Weitere Dungeondraft-Optionen bleiben als eigene Fälle in `acceptance.json`.
