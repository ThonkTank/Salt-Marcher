# HEX-02: eine Hexkarte tatsächlich bearbeiten und erhalten

Grundlage: [Roadmap](ROADMAP-HEX-ATLAS.md), [HEX-01](ROADMAP-HEX-01-PLAN.md), eigenes abgeschlossenes Aufräumen und [Wonderdraft-Vergleich](WONDERDRAFT-PARITY.md). Dieser Plan kann während der begrenzten [Viewport-Diagnose](ROADMAP-GM-UX-N004-PLAN.md) konkretisiert werden. Produktumsetzung verwendet deren geprüfte Kartenfläche; eine offene Cloud-Abnahme wird nicht stillschweigend geschlossen.

**Nutzbarer Abschluss:** Eine kleine Insel mit Meer und Wald zeichnen, auch jenseits des ursprünglichen Ausschnitts und bei negativen Koordinaten. Ein Zug ist ein rücknehmbarer Befehl. Speichern, Kartenwechsel, frischer Prozess und Wiederherstellung erhalten den bearbeiteten Stand. Dieser Ablauf ist das frühe Benutzbarkeitstor; ausgearbeitete organische Küsten und die vollständige Gestaltung folgen später.

## Direkt gegen das Original planen

Die geprüften Startbelege aus HEX-00-R02 werden weiterverwendet. Vor Produktcode nur eine tatsächlich fehlende kritische Wirkung nachmessen; keine erneute allgemeine Inventur.

| Unterfall | Bereits direkt beobachtet | Konkretes frühes Hostpaar |
|---|---|---|
| WD-004.01 | Klick beziehungsweise zusammenhängender Landzug ist ein Undo-Befehl; geänderte Werkzeugwerte bleiben bei Undo erhalten. | Klick und langer Hexzug einzeln zurücknehmen/wiederholen; Werkzeugwahl/Farbe bleiben erhalten. |
| WD-004.02 | **Escape während des Landzugs erhält die bereits gemalte Fläche**, sie bleibt rücknehmbar. Dialog-/Text-/Pfadregeln sind getrennt. | Escape beendet den laufenden Geländezug als einen Befehl. Kein erfundenes Wegwerfen bereits gemalten Lands. Textfokus löst keine Kartenaktion aus; „Entwurf verwerfen“ ist ein eigener ausdrücklicher Befehl. |
| WD-005.01 | Landpinsel und unterschiedliche Größen; Küsteneffekte gehören zu Map Effects. | Land und Meer als native 3-Meilen-Zellen, zusammenhängender Zug ohne Lücken. Früher fester Einzelhex-Pinsel; breitere/organische Pinsel und Küsteneffekte bleiben HEX-11. |
| WD-007.01 / WD-021.01 | Farbe wirkt nach tatsächlichem Commit; Enter, Tab und Escape im Farbfeld unterscheiden sich. | Land-/Meer-/Waldvorgaben plus begrenztes manuelles Landfarbfeld; Texteingabe allein verändert keine Landschaft. Zwei Kontrollfarben und Entfernen/Zurücksetzen prüfen. Vollständige Picker-/Palettenvarianten bleiben ihren späteren Phasen zugeordnet. |
| WD-003.01 | normales Speichern, abgebrochene Zielwahl, Kopie und frisches Öffnen | Speichern und Speichern unter; abgebrochene Namenswahl erhält die Arbeit. Atlas-Kopie bekommt wegen stabiler Dokument-/Hexkennungen eine neue Weltkennung und eigene Terrain-Dateien. Diese native Anpassung ausdrücklich dokumentieren. |
| WD-003.02/.03 | Save/Discard/Cancel, A→B→A und frischer Prozess; Werkzeugwerte, Kartenfarben und globale Paletten sind verschieden. | Dauerhafter nativer Entwurf schützt A→B→A und Neustart; ausdrückliches Verwerfen stellt die gespeicherte Basis wieder her. Karteninhalt, flüchtige Werkzeugwerte und Entwurfsstatus getrennt prüfen. Automatische native Entwurfserhaltung ist eine benannte Anpassung, keine behauptete Kopie des Originaldialogs. |

Ein bestandener früher Teilfall schließt keine noch offenen Farb-, Pinsel- oder Kartenwechselvarianten. Original-Rohbelege und ihre bisherigen Kennungen bleiben unverändert.

## Begrenzter technischer Bauplan

1. **Spärliche Landschaft:** `chunks` in der nativen Overworld enthalten geprüfte Verweise auf getrennte JSON-Bereiche. Eine Zelle hat stabile axiale Adresse und ausdrückliche Eigenschaften für Land/Meer, Gelände und Farbe. Zunächst ausschließlich Stufe 0 mit 3 Meilen. Ein 32×32-Bereich verwendet vorzeichenrichtige Ganzzahldivision; nur ausdrücklich bearbeitete Zellen werden gespeichert. Keine Breite, Höhe oder Erzeugung leerer Weltzellen. Überschreibungen zurücksetzen entfernt den eigenen Datensatz.
2. **Laden und Ausdehnung:** Eine hostneutrale Terrainquelle lädt referenzierte sichtbare Bereiche und den aktuellen Zug. „Noch nicht geladen“ ist von „unbearbeitet“ verschieden; ein Zug darf ungelesene Daten nicht überschreiben. Bereichsverweise halten eine kleine Inhaltszusammenfassung für Übersicht und Einpassen. Ausdehnung wird aus belegten Zellen abgeleitet; Undo/Redo aktualisieren sie. Beim Zoomen gibt es keine weitere Anlage. Mehrstufige Vorgaben/Vererbung bleiben HEX-06, Großwelt-Optimierung HEX-08.
3. **Durchgehende Befehlsbasis:** Eine `AtlasHistory` besitzt die Undo-/Redo-Folge und arbeitet über stabile Dokumentbesitzer mit Vorher-/Nachheränderungen. In HEX-02 werden nur Terrainänderungen angeschlossen; Orte und Dungeonbefehle folgen in HEX-03/05 an dieselbe Basis. Ein laufender Zug hält Zielwelt, Stufe, Werkzeug und Farbe fest. Axiale Linieninterpolation füllt übersprungene Hexes. Zeigerbewegung liefert Vorschau, Abschluss einen Befehl; Escape folgt der gemessenen Landzugregel. Leertaste/Mitte verschieben die Kamera, ohne Gelände zu malen.
4. **Sicher speichern:** Vorhandenen `FileStore` und konfliktgeschütztes Compare/Write wiederverwenden. Ein hostneutraler `FileTransaction`-Baustein speichert Terrain-Dateien plus Overworld-Verweise gemeinsam mit vorbereitetem/abgeschlossenem Journal und schützt sämtliche Vorherwerte. Er stellt unterbrochene Vorgänge konsistent wieder her und überschreibt keinen extern geänderten Stand. Das Dungeon-Repository wird nicht in einen fingierten Overworld-Datensatz gezwungen. Derselbe Transaktionsbaustein wird für Ort beziehungsweise CITY-01 mit Elternplatzierung wiederverwendbar.
5. **Dauerhafter Entwurf:** Eine versionsgeprüfte `.overworld.draft` hält Weltkennung, exakte gespeicherte Basis und Änderungen der betroffenen Bereiche. Nach abgeschlossenem Befehl sichern; Navigation bleibt flüchtig. Wiederöffnung zeigt den geschützten Entwurf mit verständlichem Status. Externe Änderung wird als Konflikt erhalten. Speichern entfernt nur den eigenen erfolgreich übernommenen Entwurf. Explizites Verwerfen verändert keine vorher gespeicherten Dateien.
6. **Eine Oberfläche:** Bestehende Atlasfläche/Toolbar erweitern: Auswahl, Hand, Land, Meer, Wald, Zurücksetzen, Undo/Redo und Speichern; „Speichern unter“/„Entwurf verwerfen“ bleiben auffindbar im kleinen Kartenmenü. Dieselbe Kamera, sichtbare Werkzeugvorschau, Meilen-/Hexangaben und verständlicher Speicherstatus. Keine Gelände-/Welt-/Dungeonmodi, kein Größen-/Chunkdialog. Renderer zeichnet Zellinhalt und Vorschau im bestehenden Raum.

Betroffene Bereiche: neue Terrain-, Befehls- und Speicherbausteine unter `src/features/atlas/`; begrenzte Overworld-/Renderer-/Editorerweiterungen; dünner Obsidian-Adapter. Bestehende Dungeonregeln und Texte bleiben erhalten. Wiederverwendung bedeutet hier geprüfte gemeinsame Schnittstellen, nicht ungeprüftes Kopieren von internem Dungeonzustand.

## Kleine Ausführungspakete mit frühen Testtoren

| Paket | Konkretes Ergebnis | Sofortige Prüfung |
|---|---|---|
| I01a | Terrainquelle, axiale Züge und ein gemeinsamer Befehlsstapel | negative Bereichsgrenzen, lückenloser Zug, exakte Undo/Redo-Bilder, Zurücksetzen, unveränderte Kamera |
| I01b | Land/Meer/Wald tatsächlich auf der bestehenden Fläche malen | **erster nativer Inselablauf**, Zug/Escape/Undo/Redo, Wachstum ohne Resize, sichtbare Vorschau; erst dann weitere Speicherarbeit |
| I01c | Transaktion, Speichern und Entwurf | echte Dateien plus gezielter Speicherunterbruch/externes Compare/Write; frischer Prozess vor weiterem Ausbau |
| I01d | Kopie, A→B→A und Verwerfen | Hauptablauf einschließlich eigenem Dungeon-Regressionsfall; Original-/Hostteile und Restabweichungen dokumentieren |
| R01 | eigener Fachreview | tatsächlich gespeicherte Inhalte, sichtbare Insel, Neuöffnung und Wortlaut der Schutzmeldungen; Pflichtlücken gezielt nachbessern |
| CLEAN-P/I/R | eigener begrenzter Aufräumzyklus | nur konkrete Reviewreste; danach HEX-03 unmittelbar beginnen |

Jedes abgeschlossen prüfbare Paket wird regulär veröffentlicht; vor Veröffentlichung eingehende Änderungen integrieren und fremde Arbeiten erhalten. Kleine Bibliotheksprüfungen ersetzen keinen nativen Ablauf. Der erste Inselablauf wird schon nach I01b sichtbar geprüft; Speicher-/Neustartfähigkeit entscheidet spätestens I01c, ob die Funktion praktisch trägt. Kein neues Werkzeugpaket beginnt, solange dieser Kernablauf scheitert.

## Verbindlicher durchgehender Prüflauf

Leeren Atlas öffnen → mit einem Landzug Insel zeichnen → Meer und Wald setzen → negative Bereichsgrenze überqueren und außerhalb des ersten Ausschnitts weitermalen → Escape während eines Zugs → genau diesen Zug Undo/Redo → Einzelüberschreibung zurücksetzen und rücknehmen → speichern → Kopie abbrechen, danach erstellen → A→B→A → ungespeichert ergänzen → frischer Prozess stellt Entwurf wieder her → ausdrücklich verwerfen → gespeicherte Insel bleibt erhalten. Anschließend eigene Speicherunterbrechung und externe Änderung prüfen, Dateien vollständig erhalten und den bestehenden Dungeon öffnen.

Der Meilenstein ist **eine wirklich bearbeitbare und wiederöffnungsfähige Karte**. Gemeinsame Orts-/Dungeonverortung und Stadtgeometrie sind damit vorbereitet, werden aber erst in ihren eigenen Phasen abgenommen.
