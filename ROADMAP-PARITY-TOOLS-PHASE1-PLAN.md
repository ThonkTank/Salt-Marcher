# Folge-Roadmap, Phase 1: Karte, Datei und Ansicht

Planlauf vom 09.10.2026 zu [ROADMAP-PARITY-TOOLS.md](ROADMAP-PARITY-TOOLS.md). Referenz ist Dungeondraft 1.2.0.1 „Opulent Kirin“, nicht der frühere Editor. Dieser Plan ändert kein Produkt und entscheidet keinen weiteren Pflichtfall.

## Umfang und Ausgangslage

Die Nutzerentscheidung vom 09.10.2026 ersetzt in diesem Plan die frühere Resize-Aufgabe: `DD-038.01–.09` sind für den grenzenlosen Atlas ausgeschlossen. Die vorigen Messungen bleiben Belege des früheren Plans, lösen aber keinen weiteren Hostlauf aus. Building-Boden-Gesten bleiben in den zuständigen Werkzeugfällen zu prüfen. Anfangsgrößen und Größenvorlagen (`DD-001/002`) werden beim Atlasübergang gesondert auf ihren Nutzerzweck geprüft; diese Entscheidung schließt sie heute nicht aus.

`acceptance.json.strictParity.cases` ordnet dieser Phase genau 68 `required`-Unterfälle zu. Vier weitere `DD-048`-Unterfälle sind `editor_addition` und gehören nicht zum Paritätstor. Die 68 verteilen sich so:

| Fälle | Anzahl | Ausgangslage und zu prüfende Wirkung |
| --- | ---: | --- |
| `DD-001.01–.06` | 6 | Neues Dokument, Breite/Höhe, OK/Cancel/X; `.04/.05` sind belegt und auf dem Endbuild zu wiederholen, vier Fälle offen. |
| `DD-002.01–.09` | 9 | Größenvorlage wählen, anlegen, benennen, ändern, annehmen, verwerfen und entfernen; `.05/.09` belegt, sieben Fälle offen. |
| `DD-003.01–.02` | 2 | Start mit Assistent und Wahl DUNGEON/CAVE; Generatorwirkung bleibt `DD-004/005` in Phase 7. |
| `DD-006.01–.04`, `DD-007.01–.02` | 6 | Separate Startschalter und tatsächliche Schatten-/Abnutzungswirkung einer neuen Karte. |
| `DD-008.01–.05` | 5 | Globale Abnutzung NONE, DUST, GRIME, NOISE, SCRATCHED; der vorhandene Intensitätsregler belegt diese fünf Modi nicht. |
| `DD-036.01–.16` | 16 | Menü, Datei, History, Recent, Save As, About, Preferences-Einstieg, User Folder und Exit samt leeren/ungespeicherten Zuständen; Preferences-Felder und Kürzel `.17–.76` bleiben Phase 12. |
| `DD-039.01–.06` | 6 | Karteninformation, Maße, Pfad, Pakete, Close/X; alle belegt, als Regression auf dem Phasenbuild. |
| `DD-041.02–.04` | 3 | Temporärer Pan mit Leertaste/Mitte und Strg+Rad-Zoom; `.04` hat eine dokumentierte Hostabweichung. |
| `DD-048.01–.11`, `.16–.19` | 15 | Rasterstil/-farbe, Picker, Kamerafilter, Grid/Snap/Licht, Guide/Ruler, Zoommenü, Positionsanzeige, Vollbild und Back; Wirkung überwiegend noch ungemessen. |

Die Bilder in `acceptance.json` belegen häufig zunächst nur Sichtbarkeit und Beschriftung, nicht Wirkung, Zustandsdauer oder Dateiformat. Das gilt besonders für `DD-001.01–.03/.06`, `DD-002.01–.04/.06/.08`, `DD-003`, `DD-006–008`, `DD-036.02–.11/.14–.16` und `DD-048`. Vor Umsetzung werden diese Wirkungen im laufenden Original an isolierten Testkarten aufgenommen. Die vorhandenen Rohakten unter `/home/aaron/.cache/dungeon-native-qa/audit-20261004/karten-verwaltung/` und die je Fall verlinkten Bilder/Reports dienen als Startpunkt; ein UI-Bild allein erhält keine Funktionsfreigabe.

## Mess- und Umsetzungsfolge im eigenen Umsetzungslauf

1. **Originalproben und Host-Baseline.** Eine unveränderte 8×8-Karte, eine Karte mit Building, Objekt, Raum/Key sowie eine Mehrgeschosskarte getrennt nutzen. Je Fall Eingabefolge, Vorher/Nachher-Zustand, Dialogabbruch, Undo/Redo-Regel, gespeicherte Datei und frische Öffnung dokumentieren; beim Original Version, Rohkarte und Bild/Interaktionsspur zuordnen. Den aktuell installierten Obsidian-Build mit denselben Folgen prüfen. Unklare Wirkung als offen belassen. Native Grafikeffekte nur ungefähr gleichwertig vergleichen, Bedienelemente und Funktion genau.
2. **Kartenstart und Vorlagen (`DD-001–003`, `DD-006–007`).** `src/ui/map-modals.ts`, `src/main.ts` und Plugin-Daten für Auswahl, Eingabegrenzen, Vorgaben, Plus/Minus und jeden Schließweg anpassen. Neue Karten bis zum ersten Save, gespeicherte Vorlagen nach frischem Hoststart, Schatten/Abnutzung pro Karte sowie die Assistentenroute prüfen. Die Phase-7-Generatoren nicht vorzeitig als bestanden erklären. Paketwahl aus `DD-009/010` bleibt ihre eigene Phase.
3. **Kartenoptionen (`DD-008`, `DD-039`).** Die fünf globalen Abnutzungsmodi im Original an derselben Geometrie vergleichen und nur bestätigte Wirkung in Modell, Dialog und Renderer aufnehmen. `DD-039` mit und ohne ausgewähltes Paket auf dem Endbuild erneut lesen. Atlaswachstum ohne Größenaktion wird in der Hex-Atlas-Roadmap geprüft.
4. **Dateimenü (`DD-036.01–.16`).** Vor Karte, mit ungespeicherter Karte und nach Save vergleichen. New/Open/Save/Save As/Recent und Exit mit echten Pfad- und Identitätsfolgen, Warnung, Cancel und frischem Prozess prüfen. Obsidian-Hosteinbettung für User Folder, About, Preferences und Exit so gestalten, dass der beobachtete Nutzerzweck erreicht wird; eine Abweichung vom Original bleibt ausdrücklich offen, falls der Host ihn nicht erfüllt. Persistenz, konkurrierende Änderungen und geschützte Key-Bytes kontrollieren.
5. **Ansicht und Navigation (`DD-041`, `DD-048`).** `src/navigation.ts`, `src/editor.ts`, `src/renderer.ts` und Settings nur nach gepaarten Originalfolgen anpassen. Pan/Zoom bei 100/125 %, Ankerpunkt, Modifier und begonnener Zeichnung; Rasterstil/-farbe, Filter, Licht, Guide/Ruler, Zoomwerte, Positionsreadout, Fullscreen und Back jeweils auf sichtbare Wirkung, Gültigkeitsbereich und Neustart prüfen. `DD-041.04` gezielt reproduzieren und beheben oder mit neuen Belegen neu klassifizieren. Die übersprungene P7-2-Hardwareprobe wird durch synthetische Eingaben nicht nachträglich freigegeben.

Innerhalb der Umsetzung können diese Blöcke als einzeln prüfbare Commits veröffentlicht werden; der unabhängige Fachreview beginnt erst auf einem gemeinsamen Endbuild. Der bestehende `DD-039`-Hostbeleg und die vier belegten Start-/Vorlagenfälle sind Regressionen, keine Wiederimplementierungsaufträge.

## Fachreview und Tor

Der getrennte Review liest jeden der 68 Einträge gegen Original- und Hostrohbeleg. Er prüft mindestens leeren Start, bearbeitete Karte, Abbruchpfade, Undo/Redo, Save As/Recent, Schatten/Abnutzung, Zoom/Guide/Ruler und frische Neuöffnung. Eine kombinierte V4-Folge erhält Raum-ID, Feature-Verweis, wortgleiche Key-Bytes und gespeicherte Bildgrößen; eine große Karte deckt Ansichtswechsel und Speichern ab. `npm run check`, `npm test`, `npm run build` und passende isolierte Hostläufe ergänzen die Bedienprüfung. Produktiver Vault und Fremdänderungen bleiben unangetastet; nur eine grafische Testinstanz läuft.

Jeder Fall erhält in `acceptance.json` Originalversion, Ablauf, direkten Rohbeleg, Host-Build, Entscheidung und konkrete Restlücke. `TOOL-PARITY.md` hält den lesbaren Fachbefund. Eine Lücke führt zu getrenntem Nachbesserungsplan, Umsetzung und erneutem Review. Erst nach bestandener Fachphase folgen eigener Aufräumplan, Umsetzung und Review vor Phase 2. Vor jedem Paket und vor jedem Push wird der gemeinsame GitHub-Branch abgerufen und integriert.
