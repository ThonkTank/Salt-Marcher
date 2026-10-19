# Beschriftete Regionen und direkte Atlasgeometrie

Auftrag vom 19.10.2026: Stadt- und Dungeonplatzierung durch direkte Geometriebearbeitung ersetzen; benannte Gebiete mit politischen, geografischen und eigenen Ebenen, Pinsel, Punktkorrektur und individueller Zoom-Prominenz. Vorhandene Atlas-Testbestände benötigen keine Markermigration.

## Verhalten

Landschaft, Bauten und Räume bleiben auf derselben metrischen Karte. Bauten und freie Räume benötigen keine benannte Stadt-/Dungeonanlage. Interne weltfeste Geometriebesitzer dienen den bestehenden Haus-, Geschoss- und Raumdiensten; sie sind keine Ortsmarker oder Regionen. Stadtpapier und Stadt-/Dungeon-Ersatzsymbole entfallen aus Detailansicht, Übersicht und Export. Die alten Speicherbefehle bleiben für bestehende interne Dienste und Importbelege erhalten; der Atlas bietet sie nicht mehr als Platzierungswerkzeuge an.

Unter Regionen eine Ebene, einen Namen und optional ein Elterngebiet wählen. Malen/radieren speichert beim Loslassen. Punktmodus: vorhandene Punkte ziehen, eine Kante doppelklicken zum Einfügen, ausgewählten Punkt mit Entf entfernen. Escape verwirft den laufenden Zug. Name, Darstellung und Ortsinformationen werden mit Änderungen speichern übernommen. Fehler erhalten den Entwurf; ein unklarer Auftragsausgang verwendet die bestehende Speicherstand-Klärung.

Jede Region gehört genau einer Ebene. Elternregionen müssen auf derselben Ebene liegen; Zyklen sind unzulässig. Ein Pinselzug überträgt Nachbarfläche an die bearbeitete Region, begrenzt Kinder auf ihre Eltern und beschneidet Untergebiete rekursiv. Die gesamte Änderung ist atomar und gemeinsam rücknehmbar. Leere Regionen behalten Namen und Informationen. Vor dem ausdrücklichen Löschen einer Elternregion müssen ihre Kinder umgehängt oder gelöscht werden. Themenebenen dürfen sich beliebig überlagern.

Prominenz 0–100 bestimmt die Ausblendschwelle `0,5 × 10^(Wert/20)` Meter/CSS-Pixel. Presets: Gebäude 0, Viertel/Dungeon 20, Stadt 40, Provinz 60, Königreich 80, Kontinent 100. Die letzten 15 Prozent des sichtbaren Maßstabs blenden Grenze, Tönung und Namen gemeinsam aus. Eine ausgewählte Region bleibt zur Bearbeitung sichtbar; Ebenenfilter haben Vorrang. Die Kartengeometrie bleibt unabhängig. Namen liegen automatisch innerhalb der Fläche, können verschoben und gedreht werden; höhere Prominenz gewinnt Beschriftungskollisionen. Der Export komponiert Regionen und Namen einmal über dem vollständigen Bild, unabhängig von den Geometriekacheln.

## Zuständigkeit und Daten

`atlas-territory.ts` besitzt die Polygon- und Hierarchieregeln. `atlas-territory-ui.ts` besitzt Entwürfe und Eingaben. `atlas-territory-view.ts` zeichnet die gemeinsame Anzeige und Exportebene. Die persistente Transaktion in `storage/atlas-territory.ts` hängt am bestehenden Atlas-Receipt-/Historyweg.

`AtlasTerritory` und `AtlasRegionLayer` werden als typisierte Records in der bestehenden räumlich indizierten `atlas_landscape`-Tabelle gespeichert. Regionsebenen bleiben kampagnenlokale Namensräume; Kampagnenkopien ändern Regionen-/Elternkennungen, erhalten aber die gemeinsame Ebenenzuordnung. Neue IPC-Methoden sind nicht nötig: Atlasbefehle, paginierte Objektsuche, Einzelobjekt und Übersicht werden erweitert. `AtlasRegionQuery` bezeichnet weiterhin den geladenen Kartenausschnitt. Ortsinformationen verlassen den Speicher nur bei gezielter Einzelobjektabfrage, nicht im Darstellungsframe.

Der Bereichsframe hält Regionen getrennt von verdichteten Landschaftsrastern. Maximal 20.000 Punkte je Region, 64 Ebenen und ein explizites Antwortbudget begrenzen Daten und Vorschauen. Überschreitungen liefern einen Fehler statt still fehlender Grenzen. Ebenenänderungen gehören derzeit zur gemeinsamen Autorenhistorie; Sichtbarkeiten werden mit der Kampagne gespeichert.

## Nachweise und Grenzen

`tests/desktop-atlas-territories.test.mjs` prüft Hierarchie, Übermalen, Beschneiden, Löcher, getrennte Flächen, Prominenz, Beschriftungskollisionen, atomare Konflikt-/Undo-/Redoabläufe, Neustart, Archivkopie und die Verbindung zum räumlichen Leser. Bestehende Atlasbereichsregressionen prüfen die gemeinsame Geometrie weiter.

`tools/test-desktop-atlas-territories.mjs` startet ein isoliertes synthetisches Profil und bedient das echte Desktopfenster: Pinsel, Unterregion, Beschriftung, Ebenen, Undo/Redo, direkte Häuser/Räume, Export und frischer Prozess. `ATLAS_PACKAGE` wählt eine gepackte Anwendung; `QA_EVIDENCE_DIR` den Belegordner. Der erste lokale Lauf bestand diese Folge ohne Rendererfehler. Er ist keine vollständige Wonderdraft-, Großwelt-, Accessibility- oder Betriebssystemabnahme. Öffentliche Spielerbilder behalten den vorhandenen Wissensfilter; neue GM-Regionsinformationen werden nicht ungeprüft veröffentlicht.
