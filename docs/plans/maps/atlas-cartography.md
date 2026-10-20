# Regionenpinsel und maßstabsabhängige Beschriftung

Beauftragter Ausbau vom 19.10.2026: Kartenlesen nach dem Vorbild von Google Maps, benannte Straßen, Gewässer, Regionen und Gebäude. Für Regionen gilt ausdrücklich **erst malen, anschließend Punkte verfeinern**. Die ursprünglichen Quellenbindungen in `docs/scope-sources.json` und die offenen Abnahmen für HEX/CITY/SMR-04 bleiben erhalten.

## Bedienung

Im Atlas **Landschaft → Regionen → Regionenpinsel** öffnen. Eine Ebene wählen, eine Region anlegen und mit gedrückter linker Maustaste malen. Der Radius ist in Weltmetern angegeben und auf der Karte sichtbar. Loslassen speichert den gesamten Zug; Escape verwirft die Vorschau. Leertaste und Ziehen verschiebt die Karte.

Geografisch und Politisch sind vorhanden; eigene Ebenen, Reihenfolge, Sichtbarkeit und Typen lassen sich ergänzen. Regionen besitzen einen Namen, einen Typ, eine unabhängig einstellbare Bedeutung (0–5), Farbe, Füllung und Grenzstil. Eine optionale Oberregion muss derselben Ebene angehören. Ein Ortsverweis übernimmt den kanonischen Ortsnamen.

Regionseigenschaften und Ebeneneinstellungen sind getrennte Entwürfe im aktuellen
Editor. **Eigenschaften übernehmen** bestätigt nur die Region, **Ebene übernehmen**
nur die Ebene. Noch offene Werte des anderen Formulars bleiben erhalten, auch wenn
eine bereits laufende Leseantwort eintrifft. Die Rückmeldung nennt verbleibende
offene Eigenschaften; **Verwerfen** verwirft die verbleibenden lokalen Entwürfe.
Regionswechsel, Neubeginn und automatische Beschriftungsaktionen dürfen offene
Regionsänderungen nicht stillschweigend ersetzen. Ein noch ungeklärter Schreibbefehl
bleibt derselbe, bis er geklärt oder ausdrücklich verworfen wird. Diese lokalen
Formularentwürfe sind keine dauerhafte Wiederaufnahme unbestätigter Eingaben nach
Prozessende; gespeichert bestätigte Werte werden nach Neustart wieder geladen.

Auftragen nimmt berührte Fläche von Nachbarn mit derselben Oberregion. Unterregionen bleiben auf ihre Oberregion begrenzt. Abtragen legt den unzugewiesenen Rest der Oberregion frei. Änderungen, die vorhandene Unterregionen ausschließen würden, werden vollständig abgewiesen. Ein Zug, einschließlich aller Nachbarn, bildet einen gemeinsamen Undo-/Redo-Schritt.

**Grenze verfeinern** zeigt Punkte: ziehen zum Verschieben, Umschalt-Klick auf eine Kante zum Einfügen, die Punktaktion im Eigenschaftsbereich zum Entfernen. Gemeinsame Punkte und Dreiländerecken ändern sich zusammen. Selbstüberschneidungen und zusammenfallende Flächen werden abgewiesen. Verzweigte Grenzpunkte bleiben beim Entfernen erhalten: Das betrifft Dreiländerecken und das Ende einer gemeinsamen Grenze am Außenrand. Dort kann die Grenze durch Verschieben verfeinert werden. Eine gewöhnliche Biegung zwischen zwei Regionen lässt sich weiterhin gemeinsam entfernen. Eine Punktauswahl gilt nur für den geladenen Regionsstand; nach Undo/Redo oder erneutem Laden muss ein Punkt erneut gewählt werden. Nach einer eigenen bestätigten Punktbearbeitung wird er wie bisher anhand seiner Position ausgewählt. Reines Auswählen eines Punkts schreibt weder Geometrie noch Revisionen oder Undo-Schritte; eine bereits vorhersehbar ungültige Entfernung bleibt eine lokale Rückmeldung ohne Schreibentwurf. **Beschriftung platzieren** setzt einen Anker innerhalb der Region; **Beschriftung automatisch** hebt die Korrektur auf. **Region einpassen** zeigt ihre Ausdehnung.

Bei ausgewählten Straßen, Flüssen, Orten und Stadtelementen enthält der Bereich **Beschriftung** Bedeutung, Ausblenden, Position und Drehung. Leere Werte verwenden die automatische Platzierung. Bei Stadtelementen beziehen sich Positionen auf die Stadtkoordinaten, bei Landschaftsobjekten auf Weltkoordinaten. Namen bleiben am vorhandenen Objekt gebunden.

## Darstellung und Speicher

`atlas-scale-policy.ts` bestimmt die Mindestbreite sichtbarer Wege/Flüsse und ihre lesbare Bildschirmbreite. Der vorhandene Wechsel von Stadtgrundrissen zu Ortsmarkern bleibt erhalten; sehr kleine Gebäudegrundrisse entfallen. Die Autorengeometrie und genaue Objektabfragen werden durch diese Darstellung nicht verändert.

`atlas-cartography.ts` erzeugt und platziert Kandidaten mit Bildschirm-Schriftgrößen, Halo, Kollisionsprüfung und Priorität. Flächen verwenden innere Anker unter Berücksichtigung von Löchern, Linien ausreichend lange, leserichtig gedrehte Abschnitte. Bedeutung, verfügbare Fläche und Maßstab bestimmen die Sichtbarkeit. Eine stabile Platzierungswahl, Hysterese und kurzes Einblenden vermindern Sprünge; reduzierte Bewegung wird respektiert. Mehrere Kandidaten derselben Straße und mehrere Darstellungen desselben Orts konkurrieren um eine gemeinsame Beschriftung.

Bereichsleser liefern Namen unabhängig von Vektor-/Rastergeometrie mit begrenztem Kandidatenbudget. Große Regionskonturen erhalten eine Rasterdarstellung; die exakten Konturen bleiben für die Bearbeitung gespeichert. Die öffentliche Ausgabe verwendet ihre bestehende Freigabeprojektion und erhält diese Autorenbeschriftungen nicht. Der PNG-/JPEG-Export berechnet die Beschriftungsanordnung einmal für das gesamte Bild und verwendet sie in allen Kacheln.

SQLite-Format 49 ergänzt `atlas_territory_layer` und `atlas_territory`. Alte Karten erhalten keine erfundenen Regionen. Die vorhandene Main-Schreibgrenze, Quellen-Fences, Receipts, Autorhistorie und Bereichsinvalidierung bleiben zuständig. Kampagnenkopien remappen eigene Ebenen und Oberregionen; die beiden vorgegebenen Ebenen und lokale Typkennungen bleiben stabil. Fehlende Tabellen eines bereits migrierten Speichers werden als Beschädigung abgewiesen.

Bearbeitung begrenzt einzelne Regionsgrenzen auf 100.000 Punkte, Pinselzüge auf 2.000 Abtastpunkte und geladene Regionsdaten auf 8 MiB. Die Darstellung behält ihr bestehendes Gesamtbudget von 2 MiB. Bei überschrittenen Grenzen wird eine ausdrückliche Fehlermeldung gezeigt. Diese Grenzen sind keine Abnahme beliebig großer Weltkarten.

## Nachweise und Abnahmegrenzen

- [Automatische Regression](../../../tests/desktop-atlas-territories.test.mjs): Nachbartransfer, Oberregionen, Löcher, Dreiländerecken, Einfügen/Entfernen, Transaktionsabbruch, Undo/Redo, Neustart, Archivkopie, Migration, Beschriftungspriorität, Unicode und gemeinsame Exportkoordinaten.
- [Formularregression](../../../tests/desktop-territory-drafts.test.mjs): unabhängige Speicherreihenfolgen, Eingaben während laufender Leseantworten und unveränderter ungeklärter Schreibbefehl.
- [Native Electron-Probe](../../../tools/test-desktop-atlas-cartography.mjs): isolierte Kampagne, tatsächliche Gesten, gemeinsame Änderungen, unabhängige Formularentwürfe bei 100/200 %, Neustart und gekachelter PNG-Export. Ergebnis und Fensterbilder liegen unter `QA_EVIDENCE_DIR` beziehungsweise `.build/cartography-native`.
- Bestehende Bereichs-, Raster-, Karten- und Landschaftstests prüfen zusätzlich die Integration in kleine und dichte Ausschnitte.

Wonderdraft 1.1.8.2 wurde vor der Implementierung in einem getrennten Profil geöffnet. Beobachtet wurden Regionsanlage durch geschlossenen Punktzug, transparente Füllung, geglätteter Rand sowie Bearbeitungs-/Stilkontrollen. Die versuchten nachträglichen Stil-/Punktänderungen waren nicht eindeutig sichtbar; Speichern/Wiederöffnen wurde dort nicht abgeschlossen. Das ist keine vollständige Wonderdraft-Paritätsabnahme. Der ausdrücklich gewünschte Pinselablauf von SaltMarcher ist davon unabhängig. Ebenso wird keine vollständige Google-Maps-Parität behauptet. Produktabnahme durch den Eigentümer, Paketinstallation und CI bleiben von diesen lokalen Nachweisen getrennte Aussagen.
