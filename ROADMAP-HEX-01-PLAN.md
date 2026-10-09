# HEX-01: den gemeinsamen Atlas anlegen und öffnen

Grundlage: [Hex-Roadmap](ROADMAP-HEX-ATLAS.md), [Architektur](ARCHITECTURE.md), bestandenes HEX-00-R02 und eigener CLEAN-P/I/R. Der Atlas ist grenzenlos und verwendet echte Meilen/Meter. Stadt und Dungeon werden in folgenden Phasen in **dieselbe** Kamera, Auswahl, Werkzeugleiste und Historie eingebunden; ein zweiter Editorpfad oder Ansichtsmodus entsteht nicht.

## P01: begrenzter technischer Plan

**Nutzbarer Abschluss:** „Atlas anlegen“ fragt nur nach Name und Hex-Ausrichtung. Die neue `.overworld` öffnet unmittelbar eine Kartenfläche. Ein Hex anklicken zeigt seine stabile Adresse; Mitte oder Leertaste+Links verschiebt, Strg+Rad zoomt um den Zeiger, Plus/Minus und Einpassen sind erreichbar. Keine Pixelmaße und keine Atlasgrenze. Frisches Öffnen erhält Weltkennung, Maßstab, Ursprung und Hex-Ausrichtung. Der bestehende Dungeon-Kern bleibt funktionsfähig.

1. **Hostneutraler Kern:** neue versionierte Overworld-Daten, feste internationale Meile von1.609,344m, kleinster Mittelpunktabstand3Meilen, axiale Adressen mit Weltkennung und Stufe. Geometrie für flache und spitze Hex-Ausrichtung, negative Koordinaten und ×3-Stufen. Keine erzeugten leeren Landschaftskacheln und keine Obsidian-/Node-Imports im Geometrie-/Kamerakern.
2. **Eine Kamera:** Mittelpunkt in Weltmetern, Auflösung als Meter pro Bildpunkt; reine Hin-/Rückumrechnung und Zeiger-Zoom. Navigation verändert keine Landschaft oder dokumentierte Ausdehnung. Ein leerer Atlas wird auf Ursprung und3-Meilen-Ansicht eingepasst; später folgt das aus Inhalt abgeleitete Einpassen.
3. **Begrenztes Zeichnen:** PixiJS zeichnet ausschließlich sichtbare Hexes. Bei weiten Übersichten nutzt das Raster größere ×3-Stufen, ohne Landschaftsdaten anzulegen. Die vollständige Bearbeitung/Vererbung mehrerer Stufen bleibt HEX-06; die Übersicht verhindert schon jetzt ein explodierendes Raster. Getrennte Kartenmodi werden nicht eingeführt. Die Bühne bleibt für eingebundene Stadt-/Dungeon-Kartenszenen erweiterbar.
4. **Dünner aktueller Hostadapter:** `.overworld` als nativen Dateityp registrieren; Anlage atomar gegen einen freien Pfad, kein Überschreiben. Wiederöffnung liest und validiert dieselben Daten. Ein ungültiges Dokument zeigt einen verständlichen Fehler und bleibt unverändert. Kamera/Adresse dürfen keine Entwurfs-/Save-Mutation auslösen. Die vorgeschlagene Plattform-ADR bleibt bis ihrer eigenen Ratifizierung offen.
5. **Frühe Prüfungen:** bekannte Hex-Mittelpunkte/Nachbarabstände, beide Ausrichtungen, negative Adressen und mehrere Stufen; Kameraroundtrip und Zoomanker; serialisierter Zustand bleibt bei Navigation leer und unverändert. Reale Hostfolge: anlegen → positive/negative Hexauswahl → außerhalb des Startausschnitts navigieren → zurück → schließen/neuer Prozess → gleiche Kennung/Adresse. Danach vorhandenen Dungeon öffnen.

Begrenzt betroffene Bereiche: `src/features/atlas/` für Domäne, Kamera und Kartenfläche; aktueller Adapter unter `src/ui/`, schmale Registrierung in `src/main.ts`, gezielte Tests und eigener Fall im vorhandenen Hostharness. Keine pauschale Dungeonrenderer-Neuschreibung, keine neue Datenbank und keine Formatmigration alter Dungeons.

## Oberfläche und gestalterischer Abgleich

Die Kartenfläche ist das Hauptwerkzeug. Eine ruhige, kompakte Leiste enthält Auswahl/Hand und Navigation; ein kleiner Informationsbereich zeigt das gewählte Hex. Der Nutzer sieht Meilen und Koordinaten, keine Chunk-/Renderer-/Versionsverwaltung. Die vorhandenen Hostschriften, Bedienelemente und Fokusfarben bleiben konsistent. Für das noch unbemalte Raster dienen kühlgrünes Papier `#eef4f1`, Linien `#809c9a`, Auswahl `#d4eadd`, Maß-/Ursprungszeichen `#4c6177`; Buttons nutzen den vorhandenen Akzent. Leerer Raum wird nicht als bereits gemaltes Meer ausgegeben.

Abgleich gegen den Auftrag: großzügige gemeinsame Karte statt Übersichts-Dashboard; keine gleichförmigen Kartenkacheln, Hero-Fläche, Dekoration oder automatische Animation. Sichtbarer Tastaturfokus, verständliche Auswahl und ausreichender Kontrast sind Pflicht. Eine Bildschirmaufnahme prüft die tatsächliche Lesbarkeit; die Gestaltung darf den ersten Funktionsablauf nicht verlängern.

## Eigene Folgearbeiten und Tore

| Lauf | Begrenztes Ergebnis | Tor |
|---|---|---|
| HEX-01-I01 | Kern, öffnungsfähige Kartenfläche und Hostadapter samt gezielten Prüfungen | Check/Test/Build und tatsächliche Hostfolge; keine Freigabe aus Testzahl |
| HEX-01-R01 | Eigener Review von Daten, Navigation, Bild, Wiederöffnung und erhaltenem Dungeon | Pflichtlücken gezielt nachbessern und erneut reviewen |
| HEX-01-CLEAN-P/I/R | Eigener begrenzter Aufräumzyklus | Erst danach HEX-02 mit tatsächlichem Gelände-/Undo-/Saveablauf |

HEX-01 gibt noch keine Gelände-, Orts-, Stadt- oder Dungeon-Verknüpfungsabnahme. **HEX-02** liefert den ersten Geländeeditor, **HEX-05** den ersten direkt bearbeitbaren gemeinsamen Atlas mit Dungeon. Für CITY-01 wird nach HEX-05 ein geprüfter Vertrag für Meterkoordinaten, Kamera, Platzierung, gemeinsame Historie und Hostbelege übergeben.
