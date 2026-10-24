# Folge-Roadmap: übrige Dungeondraft-Abläufe angleichen

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: dungeon
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Diese Roadmap setzt [Grundrisse und Objekte](drawing.md) fort. Deren Fachfälle sind mit ausdrücklicher Nutzerausnahme für die nicht ausgeführte Hardwareprobe P7-2 belegt; physische Eingabe bleibt offen. Die übrigen Werkzeuge benötigen ihre eigenen Funktionsnachweise.

Maßstab ist der Pflichtkatalog `acceptance.json` für Dungeondraft 1.2.0.1 „Opulent Kirin“: derzeit 677 `required`-Unterfälle. 42 `excluded`-Fälle und fünf `editor_addition`-Fälle sind keine Paritätstore. Bereits belegte Teilabläufe werden als Regression übernommen, aber nicht pauschal auf ganze Werkzeuge ausgeweitet. Für die weitere Umsetzung gelten die gemeinsamen [Ergebnisgleichwertigkeit und Lieferprioritäten](../../atlas/requirements/atlas.md#wie-kommen-wir-zum-ziel). Eingaben und Werkzeugaufteilung dürfen anders sein; selbständig erreichbare Bearbeitungswirkungen, Zustände und gespeicherte Ergebnisse bleiben Pflicht. Die Fallzahl ist keine Anzahl benötigter Werkzeuge oder Lieferreihenfolge.

Nutzerentscheidung vom 09.10.2026: Vergrößern und Verkleinern einer Karte sind für den grenzenlosen gemeinsamen Atlas unnötig. `DD-038.01–.09` sind deshalb aus dem Pflichtscope genommen; der bisherige Resize-Nachbesserungsplan wird nicht fortgesetzt. Vorhandene Belege bleiben historisch erhalten. Der Atlas wächst durch Bearbeitung in jeder Richtung ohne Resize-Aktion; Ausschnitte und Exportmaße begrenzen Inhalte nicht. Building-Boden-Bedienung bleibt unabhängig davon im Werkzeugscope.

Nutzerpräzisierung vom 09.10.2026: Es gibt eine einzige grenzenlose Atlaskarte für Overworld-Hexterrain, Städte und Dungeons. Dungeondrafts `New Map`, lokale Startmaße, Größenvorlagen, Assistentenstart und daran gebundene Startschalter (`DD-001.01–.06`, `DD-002.01–.09`, `DD-003.01–.02`, `DD-006.01/.02`, `DD-007.01/.02`) sind keine direkten Bedienvorbilder mehr und verlassen das Paritätstor. Bestehende Belege bleiben historisch. Atlasanlage ohne Breiten-/Höhenabfrage gehört zu HEX-01; Schattenwirkung `DD-006.03/.04`, Gebäudeabnutzung `DD-008` und die übrigen übertragbaren Werkzeuge bleiben offen beziehungsweise im gemessenen Scope reviewt. Datei- und Karteninformationsfälle werden für den gemeinsamen Atlas nach Nutzerzweck geprüft.

## Funktionsprüfung

Originalversion, Eingabefolge, Rohbeleg, Host-Build, Vergleich und Restlücke stehen je Unterfall in `acceptance.json`; `docs/dungeon/requirements/tool-inventory.md` hält den lesbaren Befund. Undo/Redo, Speicherung und frische Neuöffnung prüfen, soweit betroffen. Eine Implementierung oder ein grüner Test ersetzt keine Original-/Hostabnahme. Produktive Karten und Texte schützen; physische Eingaben benötigen einen tatsächlichen Hardwaretest.

## Fachphasen und Anforderungen

Die Nummern ordnen den Fachumfang; geliefert wird nach der zentralen Atlaspriorisierung. Die Zugänge stehen ausschließlich im [Werkzeugkatalog](../../atlas/requirements/atlas-2.md#werkzeuge-und-bediengefühl).

| Phase | Pflichtfälle | Nachzuweisender Ablauf |
| --- | --- | --- |
| 1 – Karte, Datei und Ansicht | `DD-006.03/.04`, `DD-008`, `DD-036.01–.16`, `DD-039`, die `required`-Fälle aus `DD-041` und `DD-048` | Übertragbare Dungeon- und Atlasoptionen, Navigation, Raster, Snap, Zoom, Anzeige und Dateifunktionen über Eingabe, History und Neuöffnung prüfen; Atlasanlage folgt HEX-01. |
| 2 – Assetpakete und Ressourcen | `DD-009–010`, `DD-033–035`, `DD-046` | Pakete auswählen, sortieren, aktivieren und verwenden; Tilesets/Texturen laden und Pakete erstellen, einschließlich Neustart. Die bereits ausgeschlossenen ausführbaren Mod-Fälle `DD-037` werden nicht wieder eingeführt; Assetpaketfunktionen bleiben Pflicht. |
| 3 – Geschosse und Nachzeichenvorlage | `DD-032`, `DD-040` | Geschosse anlegen, klonen, umbenennen, löschen, ordnen und vergleichen; Nachzeichenvorlage laden, ausrichten und schalten. Karteninhalt und Ebenenzuordnung nach Neuöffnung prüfen. |
| 4 – Freie Wände, Portale und Höhlen | `DD-016–019` | Freie gerade und gekrümmte Wände, gebundene Türen und Portalvarianten sowie Höhlenpinsel und Radieren paarweise messen; Bindung, Öffnung, Kontur und History prüfen. |
| 5 – Muster, Pfade und Dächer | `DD-020–022` | Formen, Stile, Ebenen, Sortierung, Punktbearbeitung, Vorschau und Abbruch je Werkzeug angleichen; Auswahlwirkung und gespeicherte Geometrie prüfen. |
| 6 – Wasser, Terrain und Material | `DD-023–025` | Pinsel, Mischung, Ufer, Effekte und Radieren anhand gleicher Aufgaben und eigener Bedienung vergleichen; große sowie überlappende Flächen, Undo/Redo und Neuöffnung prüfen. |
| 7 – Kartengeneratoren | `DD-004–005` | Dungeon- und Höhlenassistent einschließlich Startoptionen, erneutem Generieren, Fertigstellen und gespeicherter Karte vergleichen. |
| 8 – Auswahl, Kopieren und Vorlagen | Gesamte `DD-030`, `DD-031`, `DD-042` | Bisher nur objektbezogen geprüfte Auswahl auf alle Filter, Ebenen, Sperren, Gruppen und Elementarten ausweiten; Kopieren/Einfügen und Prefab-Anlage, Platzierung, Trennung und Vergessen prüfen. Bestandene Objektfolgen bleiben Regression. |
| 9 – Streuwerkzeug und Farbe | `DD-027`, `DD-028.13`, `.15`, `.16` und Scatter-Kontext von `.19` | Streumodi, Sets, Dichte, Einzelplatzierung und Streufarbe vergleichen; gemeinsame Pipette im Scatter-Kontext prüfen. |
| 10 – Licht und Umgebung | `DD-029`, `DD-045`, `DD-028.14`, `.17`, `.18` und Light-Kontext von `.19` | Lichtquellen, Blockaden, Farbe und Umgebungslicht einschließlich Rücksetzen vergleichen. `DD-028.19` erst nach Object-, Scatter- und Light-Kontext insgesamt entscheiden. |
| 11 – Text | `DD-044` | Text setzen, bearbeiten, bewegen und löschen; Schrift, Farbe, Box, Sichtbarkeit und gespeicherte Wirkung vergleichen. |
| 12 – Einstellungen und Kürzel | `DD-036.17–.76` | Allgemeine und Interface-Vorgaben, Dialogzustände und erreichbare Aktionen prüfen. Eigene Kürzel müssen verständlich, änderbar und persistent sein; jedes Originalkürzel identisch anzubieten ist keine Pflicht. |
| 13 – Export | `DD-043` | Ausgabeformate, Raster/Licht/Geschosse, Zuschnitt, Qualität, Dateiausgabe und Abbruch auf Karten mit den vorherigen Werkzeugen prüfen. |

## Gesamtabschluss

Die gemeinsame Endabnahme prüft die erreichbaren Pflichtwirkungen des aktuellen Katalogs auf demselben Endbuild. Er prüft verknüpfte Werkzeugfolgen, große Karten, Spielansicht, Raum–Objekt–Key-Verbindungen und geschützte Dateien erneut. Nur direkt belegte Fälle erhalten eine Gesamtfreigabe; ungeklärte Originalwirkung oder Hostabweichung bleibt mit nächstem konkreten Schritt offen.
