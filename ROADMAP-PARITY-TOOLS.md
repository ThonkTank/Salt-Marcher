# Folge-Roadmap: übrige Dungeondraft-Abläufe angleichen

Diese Roadmap setzt [Grundrisse und Objekte](ROADMAP-PARITY.md) fort. Deren Phase-7-Fachphasentor ist mit der ausdrücklichen Nutzerausnahme für die nicht durchgeführte Hardwareprobe P7-2 bestanden. Diese Folge-Roadmap beginnt erst nach der getrennten abschließenden Aufräumphase. Bis dahin ist sie **Planung, keine Abnahme**.

Maßstab ist der Pflichtkatalog `acceptance.json` für Dungeondraft 1.2.0.1 „Opulent Kirin“: derzeit 707 `required`-Unterfälle. Zwölf `excluded`-Fälle und fünf `editor_addition`-Fälle sind keine Paritätstore. Bereits belegte Teilabläufe werden als Regression übernommen, aber nicht pauschal auf ganze Werkzeuge ausgeweitet. Bedienfolge, Optionen, Zustandswechsel und gespeicherte Funktion müssen dem Original entsprechen; die Dungeon-Grafik darf ungefähr gleichwertig sein.

## Ablauf und Phasentor

Für jede Fachphase folgt ein eigener konkreter Plan neben dieser Roadmap: offene Unterfälle und Originalbelege lesen, fehlende Originalwirkung auf isolierten Daten messen, den aktuellen installierten Host vergleichen, nur belegte Abweichungen umsetzen und alle zugeordneten Pflichtfälle in einem getrennten Review entscheiden. Der Hostlauf umfasst die jeweils wirksamen Eingaben, Undo/Redo, Speichern und frische Neuöffnung. Ein Befund führt zu eigenem Nachbesserungsplan, Umsetzung und erneutem Review. Danach folgen vor der nächsten Fachphase getrennte Plan-, Umsetzungs- und Reviewläufe für das technische Aufräumen.

`acceptance.json` hält je Unterfall Originalversion, genaue Folge, Rohbeleg, Host-Build, Vergleich und Restlücke; `TOOL-PARITY.md` hält den lesbaren Befund und `checkpoint.json` nur den aktuellen Lauf. Ein grüner Test oder eine vorhandene Implementierung schließt keinen Fall. Es läuft höchstens eine grafische Testinstanz. Produktive Vault-Texte, Karten, Links und Bildbreiten bleiben geschützt; physische Eingaben werden nur durch eine wirkliche Hardwareprobe abgenommen. Vor jedem Paket und Push wird der gemeinsame GitHub-Branch abgerufen und integriert.

## Fachphasen in Reihenfolge

| Phase | Pflichtfälle | Nachzuweisender Ablauf |
| --- | --- | --- |
| 1 – Karte, Datei und Ansicht | `DD-001–003`, `DD-006–008`, `DD-036.01–.16`, `DD-038–039`, die `required`-Fälle aus `DD-041` und `DD-048` | Karte anlegen, öffnen, sichern und in der Größe ändern; Start- und Kartenoptionen, Navigation, Raster, Snap, Zoom, Anzeige und Dateimenüs über Eingabe, History und Neuöffnung prüfen. |
| 2 – Assetpakete und Ressourcen | `DD-009–010`, `DD-033–035`, `DD-037`, `DD-046` | Pakete auswählen, sortieren, aktivieren und verwenden; Tilesets und Texturen laden, Paketierung und Mod-Menüabläufe einschließlich Neustart prüfen. Die Architekturentscheidung gegen ein getrenntes ausführbares Mod-System wird vor `DD-037` mit dessen Pflichtwirkung abgeglichen; ungelöste Funktionslücken bleiben offen. |
| 3 – Geschosse und Nachzeichenvorlage | `DD-032`, `DD-040` | Geschosse anlegen, klonen, umbenennen, löschen, ordnen und vergleichen; Nachzeichenvorlage laden, ausrichten und schalten. Karteninhalt und Ebenenzuordnung nach Neuöffnung prüfen. |
| 4 – Freie Wände, Portale und Höhlen | `DD-016–019` | Freie gerade und gekrümmte Wände, gebundene Türen und Portalvarianten sowie Höhlenpinsel und Radieren paarweise messen; Bindung, Öffnung, Kontur und History prüfen. |
| 5 – Muster, Pfade und Dächer | `DD-020–022` | Formen, Stile, Ebenen, Sortierung, Punktbearbeitung, Vorschau und Abbruch je Werkzeug angleichen; Auswahlwirkung und gespeicherte Geometrie prüfen. |
| 6 – Wasser, Terrain und Material | `DD-023–025` | Pinsel, Mischung, Ufer, Effekte und Radieren mit denselben Eingaben und Optionen vergleichen; große sowie überlappende Flächen, Undo/Redo und Neuöffnung prüfen. |
| 7 – Kartengeneratoren | `DD-004–005` | Dungeon- und Höhlenassistent einschließlich Startoptionen, erneutem Generieren, Fertigstellen und gespeicherter Karte vergleichen. |
| 8 – Auswahl, Kopieren und Vorlagen | Gesamte `DD-030`, `DD-031`, `DD-042` | Bisher nur objektbezogen geprüfte Auswahl auf alle Filter, Ebenen, Sperren, Gruppen und Elementarten ausweiten; Kopieren/Einfügen und Prefab-Anlage, Platzierung, Trennung und Vergessen prüfen. Bestandene Objektfolgen bleiben Regression. |
| 9 – Streuwerkzeug und Farbe | `DD-027`, `DD-028.13`, `.15`, `.16` und Scatter-Kontext von `.19` | Streumodi, Sets, Dichte, Einzelplatzierung und Streufarbe vergleichen; gemeinsame Pipette im Scatter-Kontext prüfen. |
| 10 – Licht und Umgebung | `DD-029`, `DD-045`, `DD-028.14`, `.17`, `.18` und Light-Kontext von `.19` | Lichtquellen, Blockaden, Farbe und Umgebungslicht einschließlich Rücksetzen vergleichen. `DD-028.19` erst nach Object-, Scatter- und Light-Kontext insgesamt entscheiden. |
| 11 – Text | `DD-044` | Text setzen, bearbeiten, bewegen und löschen; Schrift, Farbe, Box, Sichtbarkeit und gespeicherte Wirkung vergleichen. |
| 12 – Einstellungen und Kürzel | `DD-036.17–.76` | Allgemeine und Interface-Vorgaben, Dialogzustände und jedes aufgeführte Tastenkürzel samt Änderung, Anwendung, Schließen und Neustart prüfen. |
| 13 – Export | `DD-043` | Ausgabeformate, Raster/Licht/Geschosse, Zuschnitt, Qualität, Dateiausgabe und Abbruch auf Karten mit den vorherigen Werkzeugen prüfen. |

## Gesamtabschluss

Nach Phase 13 folgt ein eigener Endplan, Umsetzungslauf und unabhängiger Review über die `required`-Fälle des dann aktuellen Katalogs. Er prüft verknüpfte Werkzeugfolgen, große Karten, Spielansicht, Raum–Objekt–Key-Verbindungen und geschützte Dateien erneut. Nur direkt belegte Fälle erhalten eine Gesamtfreigabe; ungeklärte Originalwirkung oder Hostabweichung bleibt mit nächstem konkreten Schritt offen.
