# Roadmap: Räume und Objekte mit Raum-Keys verbinden

Ziel: Bis zum 7. Oktober 2026 morgens lassen sich Räume zeichnen, Objekte platzieren und die benötigten Beschreibungen sowie Features im passenden Raum-Key finden. Die Phasen 1–3 sind abgeschlossen. Danach folgen zuerst die strukturierte Key-Technik und die Verbindung von Features mit Objekten auf eigenen Testdaten; die Drachenhöhle wird erst in Phase 6 migriert und vollständig abgenommen. Produktive Karten und Bestandstexte bleiben bis dahin geschützt.

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

## Phase 4 – Strukturierte Raum-Keys

- **Abgleichen:** Vorhandene Raum-Key-Ausgabe, Feature-Dialog und Spielansicht mit `room-keys.md` und `karten.md` prüfen; Dungeondraft liefert hierfür keinen Raum-Key.
- **Umsetzen:** Raum- und Featuretext im versionierten Kartenmodell als einzige bearbeitbare Quelle halten. Eine eigene Obsidian-Ansicht setzt den Key daraus zusammen und bietet abschnittweise Markdown-Bearbeitung mit formatierter Vorschau. Neue Räume benötigen keine Raum-`.md`-Datei. Stabile Raum- und Abschnittskennungen ersetzen Dateipfade als interne Linkziele. Übersicht, Kreaturen, Items und Handouts bleiben Markdown-Dateien.
- **Prüfen:** Anlage, Anzeige, Bearbeitung, Undo/Redo, Speichern und Frischöffnung an eigenen Testdaten prüfen. Bestehende Karten und Raumdateien bleiben in dieser Phase unverändert lesbar; ihre Migration folgt erst in Phase 6.

**Umsetzung:** Neue Karten verwenden V4 mit geordneten, stabil identifizierten Markdown- und Durchgangsabschnitten im Kartendokument. Die rechte Raumansicht und der Editor-Dock zeigen den zusammengesetzten Key mit abschnittweiser Bearbeitung und Vorschau. Raum- und Abschnittslinks verwenden Karten-, Raum- und Abschnitts-IDs. V2/V3 behalten ihre bisherigen Raumdateien; V4-Feature-Erstellung und Objektverknüpfung folgen in Phase 5. Der Phase-4-Build bleibt im Worktree und wird erst mit Phase 5 produktiv installiert.

**Nachweis:** 111 Kernprüfungen, Typprüfung und Build bestanden. Im isolierten Obsidian-Vault wurden ein V4-Raum ohne `.md`, zwei Markdown-Abschnitte, formatierte Vorschau, Undo/Redo, Speichern und frische Neuöffnung geprüft. Geschosskopie, Durchgang und Archiv/Wiederherstellung sind in Kernprüfungen abgedeckt. Alle 89 produktiven Dungeondateien blieben während der abschließenden Hostprüfung bytegleich. Feature-Dialog, Objektverknüpfung und Drachenhöhlenmigration bleiben Phase 5 beziehungsweise 6.

## Phase 5 – Features und Objekte verbinden

- **Umsetzen:** Der Feature-Dialog übernimmt den eingegebenen Beschreibungstext wortgleich in den richtigen Key-Abschnitt. Neue ortsgebundene Features erhalten den nächsten Buchstaben nach dem höchsten vorhandenen; bestehende Zuordnungen und Lücken bleiben erhalten. Ein ausgewähltes Kartenobjekt wird mit genau einem Feature-Vorkommen und dessen stabilem Abschnittsziel verbunden.
- **Raumwechsel:** Beim Verschieben eines verknüpften Objekts in einen anderen Raum wandert sein Feature-Abschnitt mit. Ist die Beschreibung Teil eines gemeinsam genutzten Abschnitts, bleibt dieser im Ursprungsraum und die Beschreibung wird für das bewegte Feature im Zielraum kopiert. Kennzeichnung und Raumzuordnung werden gemeinsam geändert. Ohne Zielraum wird der Zug ohne Änderung angehalten.
- **Prüfen:** Featuretext, Buchstabe, Linkziel und direkter Sprung vom Kartenobjekt zum Abschnitt; außerdem Einzel- und Sammelabschnitt, Raumwechsel, Undo/Redo, Speichern und Frischöffnung auf eigenen Testdaten. Die Drachenhöhle bleibt unverändert.

**Umsetzung:** V4-Feature-Vorkommen schreiben den eingegebenen Markdown-Wortlaut in einen Raumabschnitt und verknüpfen genau ein Kartenobjekt. Verdeckte Abschnittsgrenzen identifizieren den jeweiligen Featuretext; Definitionen halten nur gemeinsame Metadaten. Buchstaben werden nach dem höchsten vorhandenen vergeben und nicht wiederverwendet. Objektzüge ändern Raum, Abschnitt, Kennzeichnung und Vorkommen in einem rücknehmbaren Befehl. Ein alleiniger Abschnitt wandert mit; aus einem gemeinsamen Abschnitt wird nur der betreffende Featuretext ins Ziel kopiert. Der Kartenmarker öffnet den stabilen Abschnitt rechts, auch nach einem Raumwechsel.

**Nachweis:** 114 Kernprüfungen, Typprüfung und Build bestanden. Der installierte Build wurde im isolierten Obsidian-Vault mit Feature-Dialog, wortgleichem Text, Key-Bearbeitung, Objektzug, Undo/Redo, Speichern, direktem Abschnittssprung und frischer Neuöffnung geprüft. V3-Drachenhöhlenansicht und Phase-4-Key-Ablauf bestanden die Regression. Vor der Installation wurde das Plugin vollständig gesichert; alle 89 produktiven Dungeondateien blieben bytegleich. Die produktive Drachenhöhle wird erst in Phase 6 migriert.

## Phase 6 – Drachenhöhle migrieren und Gesamtabnahme

- **Vorbereiten:** Bestehende Raum-Keys, Abschnittsgrenzen, Anker und Verweise vollständig erfassen. Die 15 Raumdateien zunächst auf einer isolierten Drachenhöhlenkopie verlustfrei in raum- und featuregebundene Texte übertragen. Verweise im Vault auf stabile Plugin-Ziele umstellen, sichtbare Linktexte und übrigen Wortlaut erhalten; native Obsidian-Dateirücklinks zu den entfallenden Raumdateien werden dadurch ersetzt.
- **Abnehmen:** Raum zeichnen und nummerieren, Objekte setzen, Feature beschreiben und verknüpfen, Raumwechsel sowie den Sprung vom Kartenobjekt zum richtigen Key-Abschnitt als zusammenhängenden Ablauf prüfen. Die Spielansicht einschließlich Key-Liste, rechter Detailansicht, Gliederung und Linknavigation auf der Kopie kontrollieren; Undo/Redo, Speichern, frischen Obsidian-Start und physische Maus-/Touchpad-Bedienung einschließen.
- **Übertragen:** Erst nach bestandenem Kopielauf Produktstand und Originaldateien sichern, Editor und Spielansicht installieren und die produktive Drachenhöhle konfliktgeschützt migrieren. Die Raum-`.md`-Dateien erst nach vollständigem Inhalts- und Linkabgleich entfernen; Sicherungen liegen außerhalb des Vaults. Übersicht, Kreaturen, Items und Handouts bleiben erhalten. Weitere Dungeondraft-Optionen bleiben als eigene Fälle in `acceptance.json`.
