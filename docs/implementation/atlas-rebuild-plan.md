# Atlas-Neubau und Aufräumen: ausführbarer Implementierungsplan

Dieser Plan erhält den vollständigen Zielumfang **F01–F19 mit D01–D11** und die
Pakete P0–P9. Der aktuelle Auftrag aus dem Review von PR #1469 ist dagegen das
begrenzte **Konsolidierungspaket K1–K6 in Abschnitt 5**. Es behebt konkrete
Lebenszyklus-, Fehler-, Nachweis- und Wartungsprobleme am vorhandenen P0-Kandidaten;
es aktiviert nicht den vollständigen Funktionsneubau.

[Status](status.md) nennt allein den geprüften Commit, Messergebnisse, offene
Fehler und Umgebungsgrenzen. [Produktvertrag](../product-contract.md) und
[Architektur](../architecture.md) beschreiben den implementierten Zustand.
Dieser Plan enthält künftige Entscheidungen, Restarbeit und ihre Abschlusskriterien.
Ausgangsvertrag für den vollständigen Ersatz bleibt
`1bb3932fcffcb2d5fea47fae616c3b69489443bc`; V7 bleibt bis zur Ablösung regulärer Einstieg.

## 1. Auftrag und Ausführung

Ein späterer ausdrücklicher Umsetzungsauftrag auf diesen Plan mit **„erledige das“**
umfasst P0–P9 bis zum regulär gestarteten, auslieferbaren Atlas.
Eine ausdrücklich begrenzte Richtungsprobe umfasst nur ihre benannten Fälle.
Ein Planungsauftrag ist keine Implementierungsfreigabe.

### Ziel und erhaltener Nutzerumfang

Eine gemeinsame flache Weltkarte lässt sich vom Raum bis zur Welt navigieren
und bearbeiten. Navigation, lokale Eingriffe und Weiterarbeiten nach einem
Ortswechsel bleiben zügig, auch neben Speichern und längeren Berechnungen.
Arbeit hängt von Ausschnitt, Maßstab und tatsächlich geänderten Daten ab.

**Gleiche Nutzerfunktionalität bedeutet F01–F19 mit D01–D11.** Die ausdrücklich
vereinbarten D10-/D11-Regeln für zeitabhängige Pinselwirkung und sichtbare lokale
Freigabe sind im aktuellen P0-Vertrag umgesetzt und bleiben beim Ausbau erhalten.
V7 bleibt Funktionsreferenz; der kleine Höheneditor ist nicht der Zielumfang.
Innere Formate, ungenutzte APIs und Implementierungstests haben keinen Bestandsschutz.

| Nutzerbereich                    | Erhaltener Umfang                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Navigation und Bedienung         | F01–F04: Kamera, 14 Ansichten, Auswahl, Inspector, Kontext, Gesten und Fokus           |
| Gelände und Landschaft           | F05–F07: sämtliche Höhen-, Farb- und Landschaftswerkzeuge, Vorlagen und lokale Details |
| Straßen und Bebauung             | F08–F12: Straßen, Geländefolge, Parzellen, Erzeugung und freie/gebundene Häuser        |
| Innenräume                       | F13–F14: Räume, Geschosse/Keller, Identitäten, Türen, Durchgänge und Treppen           |
| Regionen, Wasser und Kartenbild  | F15–F18: Regionen, Flüsse/Seen, Nachführung und lesbare Fantasykartografie             |
| Projekte und sichere Bearbeitung | F19: Dateien, Shortcuts, History, Fehler-, Abbruch- und Sessionverhalten               |

### Vereinfachungsmaßstab

Ein Paket ist aufgeräumt, wenn seine Nutzerfälle bestehen und der ersetzte Weg
mit Aufrufern, Tests, Konfiguration und Dokumentation entfernt ist. Weniger
Dateien oder Zeilen sind kein eigenes Erfolgsmaß. Vor einer Änderung die
entfallende Zuständigkeit, Wartebedingung oder Wiederholungsarbeit benennen.
Notwendige Unterschiede zwischen Modell, History, Persistenz und Darstellung
bleiben erhalten; kein globales `fresh`-Flag und keine Hüllen allein wegen Dateilänge.

Bereits umgesetzt sind ein effektiver Controllerzustand mit React-Feldentwürfen,
maßstabsgerechte Reads, Quellenpatches statt Vollkopien, lokale sichtbare Freigabe,
begrenzte Dosis, priorisierter Rasterablauf und Reads während asynchroner Saves.
Diese Grundlagen erweitern und gezielt absichern; nicht erneut als offene
Aufräumprojekte beginnen. Aktuelle Restarbeit steht ausschließlich in Abschnitt 5.
Zwei Hosts und Prüfpfade bleiben bis zur vollständigen Ablösung in P9 nötig.

### Arbeitsregeln

1. `AGENTS.md`, relevante Teile der vier kanonischen Dokumente und diesen Plan
   lesen. Head und fremde Änderungen feststellen. Seit dem Ausgangsstand
   hinzugekommene aktive Funktionen in F01–F19 einordnen.
2. A01–A10 im jeweils beauftragten Paket anwenden; keine generische Service-, Eventbus-,
   Plugin- oder Jobserver-Schicht. Bestehende brauchbare Komponenten erweitern.
   Ein Sprachwechsel oder die Erhaltung alten Codes ist kein eigenes Ziel.
3. Den begrenzten Konsolidierungsauftrag aus Abschnitt 5 ausführen. P0 bleibt
   bis zu seiner fachlichen und nativen Abnahme offen; P1–P9 werden dadurch nicht
   aktiviert. Kleine dafür notwendige gemeinsame Teile dürfen in P0 entstehen.
4. Jedes Paket benennt Nutzerergebnis, betroffene Pfade, entfallende Altlogik und
   gezielten Nachweis. Unabhängige Fachpakete können parallel bearbeitet werden;
   Dokumentautorität, Integration und gemeinsame Verträge haben einen Besitzer.
5. Hypothese und Widerlegungskriterium vor einem unsicheren Versuch festhalten.
   Nach ausbleibendem Erkenntnisgewinn Ursache/Ansatz neu entscheiden; keine
   Kette unbelegter Mikrooptimierungen. A01 erlaubt einen gezielten Gegenkandidaten.
6. Nachweise am ausgeführten Stand führen. Relevante Änderungen öffnen nur ihre
   betroffenen Nachweise. Die kurze Richtungsprobe und die vollständige native
   Leistungsabnahme sind verschiedene Prüfzwecke, keine verschiedenen Produktwege.
7. Die Arbeitsmatrix in Abschnitt 7 enthält nur Paketstatus und Verweise.
   Ergebnisse stehen ausschließlich im ersetzten Kurzstatus; Rohbelege liegen
   ignoriert unter `artifacts/atlas-rebuild/<run>/`. Keine parallelen Pläne,
   Fortschrittsberichte oder neuen Prüfframeworks.
8. Bei Umsetzung bestehende Branchregeln und `Candidate · exact-SHA aggregate`
   einhalten. Keine Schwellen absenken, Fehler verschlucken oder Prüfungen
   ungenutzter Software als Ersatz anführen. Äußere Blocker konkret benennen;
   nach erfüllten Kriterien abschließen, ohne weitere optionale Runden.

### Umfang und Nichtziele

Der aktive Produkteinstieg umfasst Atlas. Neue Encounter-/Lootfunktionen,
Globus/3D, Mehrbenutzerbetrieb, Cloud-Sync, Bild-/PDF-/SVG-Kartenexport,
Assetimporte, Möblierung, Zentimeterraster, zusätzliche Dachtypen und neue
Generatorprodukte sind nicht Teil dieses Auftrags. Der Fantasykartenstil,
Landschaftsdeckung und Lichtungen bleiben erhalten.

Es bestehen laut `AGENTS.md` keine zu migrierenden Produktionsdaten.
Ein neues Format ist zulässig; keine Altformatadapter auf Vorrat.
Fremde Dateien werden nicht gelöscht oder bei fehlgeschlagenem Öffnen überschrieben.

### Gesicherter V7-Ausgangsbefund

Der V7-Kamerapfad verändert den Zustand lokal (`useCamera.ts`); vorhandene
Darstellung kann während weiterer Reads gezeichnet werden. Raster und Geometrie
werden bereits teilweise wiederverwendet. Die Ursache der gemeldeten langsamen
leeren Navigation ist deshalb nicht allein durch einen angeblichen SQL-Roundtrip
jedes Zoomereignisses erklärt. Die Ursachenmessung trennt Eingabe, React-/Framevorbereitung,
Zeichnen, Nachladen und native Grafikdarstellung.

Bei Höhenabschnitten sind dagegen Quellenwrite, Gewässer-/Flussnachführung und
Darstellungsvorbereitung vor der Bestätigung tatsächlich gekoppelt
(`src-tauri/src/atlas/application/terrain_stroke.rs`). Reads, Fachbefehle und
Dateioperationen teilen den seriellen `src-tauri/src/document_worker.rs`.
Diese Befunde begründen die Entkopplung, aber noch keinen Geschwindigkeitsvorteil
einer bestimmten Sprache oder Desktopumgebung. Die bisherigen drei-Striche-Werte
und grünen Funktionstests sind keine aktuelle native Zoom- oder Leistungsabnahme.

## 2. Bewusste Änderungen gegenüber Atlas V7

Die übrigen beobachtbaren Fachregeln des Ausgangsstands bleiben erhalten oder
werden fachlich gleichwertig umgesetzt. Andere Änderungen an Produktverhalten
brauchen eine konkrete Begründung im Plan; interne Transport-/Cacheformate,
Testanzahl und exakte Canvas-Antialiasingpixel müssen nicht erhalten werden.

| ID  | Festgelegter Zielvertrag                                                                                                        | Konsequenz für Umsetzung und Abnahme                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Höhe besteht aus grober Form plus feineren relativen Abweichungen.                                                              | Grobes Anheben nimmt einen lokal ausgearbeiteten Graben mit. Relative Tiefe bleibt bis zur ausdrücklich geclippten natürlichen Höhengrenze ±100.000 Fuß erhalten. V7s Vorrang absoluter Feinhöhen wird ersetzt.                                             |
| D02 | Grobe Boden-/Landschaftsbearbeitung erhält ausdrücklich bearbeitete feinere Ausnahmen.                                          | Eine Lichtung und lokal gesetzte Farbe bleiben erhalten. Grobe Striche schreiben keine feineren Quellen um. „Lokale Details zurücksetzen“ ist eine eigene Bereichsaktion mit Vorschau und Undo.                                                             |
| D03 | Große Geländeänderungen erzwingen keine synchrone globale Wasser-/Fundamentnachführung.                                         | Die unten festgelegten Regeln für aktualisierte, veraltete und ausdrücklich neu berechnete Ableitungen gelten. Eine verspätete Wasserberechnung wird niemals unsichtbar an einen alten Undo-Schritt angehängt.                                              |
| D04 | Navigation verändert keine Autoren und startet keine neue Fachplanung allein wegen des Zooms.                                   | Straßenrauheit wird bei Entwurfsbeginn aus dem damaligen Maßstab in Weltmaße umgerechnet und danach festgehalten. Neu planen geschieht bei Inhalt-/Parameteränderung oder ausdrücklicher Aktion.                                                            |
| D05 | Gewöhnliche lokale Bearbeitung verändert den aktiven Zustand direkt; Arbeitskopie und Projektdatei werden getrennt nachgeführt. | Im Editor geändert, abgeschlossene Aktion, in Arbeitskopie bestätigt und ausdrücklich gespeichert sind verschiedene Zustände. Die bisherigen Gesten-Abbruchregeln bleiben erhalten.                                                                         |
| D06 | Das neue `.saltatlas`-Format ist eigenständig versioniert.                                                                      | Ausgangsformat 22 darf verständlich abgelehnt werden. Quelle und aktuelle Session bleiben bei fehlgeschlagenem Öffnen unberührt. Keine zweite Fachpipeline zur Altkompatibilität.                                                                           |
| D07 | Reine Altbestandstypen ohne aktuelles Erzeugungswerkzeug entfallen.                                                             | Die alten Materialpolygone und dekorativen Landschaftsstriche mit konkreten Assets werden nicht neu gebaut. Boden-/Felsfarbe und Landschaftsdeckung ersetzen sie vollständig. Entsprechende Legacy-Tests gezielt ausmustern; aktive Werkzeugfälle erhalten. |
| D08 | Grafik wird fachlich und visuell gleichwertig auf der GPU dargestellt.                                                          | Reihenfolge, Positionen, Löcher, Materialien, Lesbarkeit und Auswahl stimmen; alte Canvas-Pixelbilder sind keine bindende Rastervorgabe.                                                                                                                    |
| D09 | Fachliche Einheiten und Weltumfang bleiben bestehen.                                                                            | Fuß als interne Längeneinheit, metrische Anzeige, 5-Fuß-Innenraster, vorhandene 14 Ansichten und maßstabsabhängige Werkzeugfreigaben. Kein zusätzlicher Produktumbau der Maßstäbe.                                                                          |
| D10 | Halten wirkt weiter, langsame Züge stärker; bei Hängern entsteht keine Nachholdosis.                                            | Kleine Schritte mit begrenzter Dosis folgen dem Darstellungsfortschritt. Stärke ist eine Zielrate, Wartezeit darf verfallen. Ein kleiner Klickimpuls bleibt möglich.                                                                                        |
| D11 | Bearbeitung beginnt auf sichtbarem, lokal bereitem Gelände; fehlende Bereitschaft ist sichtbar.                                 | Keine Eingriffe oder vorgemerkten Striche auf noch unsichtbarem Gelände. UI, Eingabeannahme und Beobachtung verwenden dieselbe lokale Freigabe. Nach einer abgewiesenen Geste ist ein neuer Gestenbeginn nötig.                                             |

### D10/D11: bestehender P0-Vertrag

Die vollständigen beobachtbaren Regeln stehen einmal im
[P0-Produktvertrag](../product-contract.md#optionaler-atlas-p0-versuch): Halten und
langsame Züge wirken stärker, höchstens eine begrenzte Dosis wartet auf ihre
Darstellung, Hänger erzeugen keine Nachholdosis. Ein Strich beginnt erst auf
sichtbarem lokalem Terrain; vorherige Eingaben werden nicht vorgemerkt.

Diese Nutzerentscheidungen gelten für Konsolidierung und späteren Ausbau.
Ihre Besitzer und Rückkopplungsgrenzen stehen in der Architektur. M03/M10 prüfen
sie am tatsächlichen Produktpfad, mit getrennten Belegen für bewusst blockierte
Vorabgesten und danach begonnene Bearbeitung. Historische Proben, die nur
Quellenbereitschaft abwarteten, belegen keine sichtbare Freigabe.

### D03 konkret: Wasser, Flüsse, Fundamente und History

- **Fundamente** sind abgeleitete Darstellung aus Hausgrundfläche, Einstellungen
  und aktueller natürlicher Oberfläche einschließlich bestätigter Flussbetten.
  Betroffene sichtbare Fundamente werden mit begrenztem Budget nachgeführt;
  entfernte erst bei Bedarf. Innenraumdaten und Hausidentitäten ändern sich nicht.
  Eine Ableitungsaktualisierung ist kein eigener Autoren-/Undo-Schritt.
- **Bestätigte Flussprofile und Seemasken** bleiben bei einer späteren
  Terrainänderung zunächst erhalten. Die betroffenen Abhängigkeiten erhalten
  einen Veraltet-Status. Dieser Status gehört zu den gespeicherten Quelldaten
  beziehungsweise lässt sich beim Öffnen eindeutig aus deren Versionen ableiten.
  Fehlende Neuberechnung darf nicht als aktuelle hydrologische Lösung erscheinen.
  Dafür räumliche Quellen-/Bereichsversionen verwenden: Ein großer Terrainstrich
  durchläuft nicht alle Flüsse, Seen oder Häuser, um sie einzeln zu markieren.
  Betroffene sichtbare Ableitungen erkennen den geänderten Eingabestand bei Bedarf.
- **Darstellung lokaler Seen** verwendet die bestätigte Wasserfläche und ihren
  Pegel, geclippt gegen die aktuelle natürliche Oberfläche. Terrain oberhalb des
  Pegels ist sichtbar trocken. Eine dauerhafte Entfernung solcher Teile aus der
  gespeicherten Wasserfläche erfolgt erst durch „Gewässer an Gelände anpassen“.
  Erneutes Absenken vor dieser Aktion kann daher wieder Wasser sichtbar machen;
  dies ist eine ausdrückliche Änderung gegenüber V7s sofortiger Trockenlegung.
- **„Gewässer an Gelände anpassen“** berechnet für den gewählten Bereich alle
  betroffenen Seen und verbundenen Flusskomponenten, einschließlich nötiger
  Anschlüsse außerhalb des Ausschnitts. Eine versionierte Aufgabe erzeugt einen
  korrigierbaren Vorschlag. Übernahme ist eine eigene atomare Compoundaktion;
  Undo stellt Wasser-/Profilstand und Veraltet-Markierungen wieder her.
  Der Berechnungsstand besitzt inhaltliche Quellidentitäten, die Undo/Redo mit
  den Quellen restauriert. Sie sind von monotonen Ausführungsrevisionen zu
  unterscheiden: Terrain A → B → Undo zu A macht ein korrektes Profil für A
  wieder aktuell, obwohl die Ausführungsrevision inzwischen höher ist.
- **Neuer See, neuer/veränderter Fluss und Geländefolge einer Straße** bleiben
  vollständige Werkzeuge. Ihre aufwendige Planung läuft im Hintergrund. Nötige
  hydrologische Abhängigkeiten werden innerhalb dieser Aufgabe auf ihren
  Eingabestand gebracht; vorgeschlagene Quellenänderungen werden gemeinsam mit
  dem Ergebnis übernommen. Kein Commit wartet auf eine globale Weltbereinigung.
  Profile und Masken verwenden dabei den vollständigen unveränderlichen Kandidaten
  einschließlich eigener Terrainabsenkung/Uferpatches. Quellen, Wasserergebnis
  und Berechnungsidentität gehören zu derselben Übernahme und deren Undo/Redo.
- Direkte Terrainbearbeitung, nachfolgende Hydrologiekorrektur und deren Undo
  sind bewusst getrennt. Normale Terrainstriche warten nicht auf ein Flussnetz.
  Fertige Straßen werden wie bisher nicht durch spätere Höhenmalerei umgeplant.
- Ein Abbruch verwirft die noch nicht übernommene Aufgabe. Ein veralteter Vorschlag
  kann neu berechnet werden; er überschreibt keine zwischenzeitlichen Änderungen.

### Beobachtbare Grob-/Fein- und Gewässerszenen

Diese Bedienentscheidungen sind ausdrücklich Teil der Produktabnahme:

- **D01:** Einen feinen Graben innerhalb einer gleichmäßig angehobenen Region
  prüfen. Außerhalb des Übergangsrands und ohne Höhensättigung steigen Umgebung
  und Graben gleich weit; die relative Tiefe bleibt erhalten. Ein eigener
  Grenzfall prüft die einmalige Sättigung bei ±100.000 Fuß. P0c prüft die
  Grundfolge, P3 zusätzlich Detailrückkehr, Undo/Redo und Dateirundlauf.
- **D02:** Eine fein maskierte Lichtung überlebt grobe Waldänderung. Eine lokale
  Farbe und ausdrücklich transparente Feinmaske überleben grobe Farbänderung.
  „Lokale Details zurücksetzen“ zeigt Bereich und Felder, stellt dort Vererbung
  wieder her und lässt sich vollständig rückgängig machen. P3 prüft Landschaft,
  P4 zusätzlich Farbe und Bereichsaktion.
- **D03:** Bestätigtes Flussprofil, See und Haus in einer vorbereiteten Szene
  verwenden. Nach grober Anhebung behält das Flussprofil zunächst seine absoluten
  Höhen; sein Bett kann daher weiterhin tief einschneiden. Den Veraltet-Zustand
  und die Aktion „Gewässer an Gelände anpassen“ an der betroffenen Darstellung
  auffindbar machen. Sichtbares Seewasser wird gegen das aktuelle Gelände
  begrenzt, seine gespeicherte Maske bleibt bis zur Anpassung erhalten. Das
  Fundament folgt dem aktuellen Gelände einschließlich bestätigtem Flussbett.
  P3 zeigt diese Folgen mit echten vorbereiteten Quellen, bevor alle
  Gewässerwerkzeuge angebunden sind. P7 ergänzt Anpassung als eigenen atomaren
  Undo-Schritt, A → B → Undo nach A, stale Jobs und Reopen.

Die D03-Vorführung ist eine frühe fachliche Prüfung, kein zusätzlicher
Bestätigungsdialog für Aaron. Die beschriebenen Regeln bleiben der Vertrag;
eine andere Gewässersemantik darf nicht still als Performancekorrektur entstehen.

## 3. Architekturentscheidungen

### A01 — Bevorzugte Grundlage, frühe Auswahl und wenige Besitzer

**Bevorzugter Neubauansatz:** TypeScript für den Editor, React für Panels,
PixiJS 8 mit ausdrücklich gewähltem WebGL-Renderer, Electron als Desktoprahmen
und SQLite über `better-sqlite3` in einem eigenen Utility-Prozess. Electron Forge
baut mindestens Linux/RPM. Ein gemeinsamer Sprachraum und eine festgelegte
Chromium-Laufzeit begründen diesen Ausgangspunkt; sie beweisen keine Atlas-Latenz.
Passende stabile Versionen in P0 prüfen, gemeinsam pinnen und während des Umbaus
keine ungeplanten großen Versionssprünge durchführen.

Die Auswahl optimiert den einfachsten kohärenten Zielzustand. Bereits vorhandener
Code begründet keinen Bestandsschutz; ein vollständiger Sprachwechsel ist
umgekehrt kein Produktziel. P0a–P0f prüfen den bevorzugten Ansatz und bestätigen
den gewählten Ansatz vor dem vollständigen Quellen-, Datei- und Werkzeugausbau
nativ.

| Entscheidung      | Bevorzugte Wahl und Begründung                                                                                | Wann ein Gegenkandidat geprüft wird                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kartendarstellung | Pixi/WebGL: gemeinsame individuelle Darstellung von Kacheln, Fantasy-Symbolen, Werkzeugen und Hausinnenräumen | Nur bei konkreter Vereinfachung oder verfehltem Renderziel einen passenden Kartenrenderer prüfen; eigene ebene Koordinaten nicht pauschal als Ausschlussgrund für OpenLayers/MapLibre anführen. |
| Desktoprahmen     | Electron: festgelegter Chromium-Unterbau und zusammenhängender TypeScript-/Prüfpfad                           | Bei belegtem hostbezogenem Problem oder konkret einfacherer vollständiger Integration denselben kleinen Editorfall beispielsweise in Tauri prüfen.                                              |
| Fachkerne         | Gemeinsamer TypeScript-Kern für aktive Quellen und häufige lokale Änderungen                                  | Reine bestehende Berechnungen nur nach A08 übernehmen; keine pauschale Portpflicht und kein zweiter Dokumentserver.                                                                             |

Pixi liefert Grafikbausteine, nicht das Mehrstufen-, Nachlade- oder Undo-Modell.
Kartenbibliotheken können Kamera, Kacheln und Labels übernehmen, lösen aber nicht
automatisch Atlas-Pinsel, Detailerhaltung und Innenraumlogik. Diese Kosten kurz
im vorhandenen Status gegeneinander abwägen; keine allgemeine Bibliotheksstudie.

Besteht das P0-Abschlussgate und ist kein konkreter Nachteil belegt, bleibt es beim bevorzugten
Stack. Nur eine benannte, überprüfbare Ursache oder Vereinfachung rechtfertigt
je Entscheidung höchstens einen passenden Gegenkandidaten im gleichen kleinen
Szenario. Erfüllen beide die Ziele, den einfacheren vollständigen Produktions-
und Prüfpfad wählen. Liegt der Fehler im gemeinsamen Algorithmus, diesen ändern;
ein weiterer Hostwechsel ersetzt keine Ursachenklärung. Keine zwei vollständigen
Editoren und kein allgemeines Mehrhost-Framework bauen.

Die gewählte Laufzeit, Speicheranbindung und Abweichungen mit Grund und
Nachweis im Status festhalten und die Zielstellen dieses Plans angleichen. Fehlender GPU-/Display-/Paketquellenzugriff ist
ein Umgebungsblocker und kein Beweis gegen einen Stack. Ein alternativer Host muss
dieselbe native Datei-, Paket- und Präsentationsabnahme ermöglichen.

Es gibt genau diese fachlichen Zuständigkeiten, keine generische Serverarchitektur:

| Besitzer                                | Darf                                                                                                 | Darf nicht                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `EditorDocument` im Renderer            | Aktive Quellen, geordnete Änderungen, Gesten, Auswahl, History und Versionsstand besitzen            | Eine vollständige hochaufgelöste Welt im RAM voraussetzen                                     |
| `WorldRenderer`                         | Aktuelle Kamera und begrenzte sichtbare Darstellung zeichnen                                         | Autoren verändern oder eine globale Bearbeitungsfreigabe bestimmen                            |
| `JobScheduler` mit Hintergrundworkern   | Unveränderliche Eingaben bearbeiten; versionierte Darstellungsdaten oder Änderungsvorschläge liefern | Ein zweites unabhängig veränderliches Dokument besitzen                                       |
| `ProjectStore` außerhalb des UI-Threads | Arbeitskopie, räumliche Reads, geordnete Persistenz und Dateigrenzen ausführen                       | Fachentscheidungen in einer zweiten Implementierung nachrechnen oder den UI-Thread blockieren |

Beim Electron-Default besitzt Main nur Fenster, Dialoge, Prozesslebenszyklus und
die schmale Anbindung. Renderer: `contextIsolation: true`, kein direkter Node-/
Dateisystemzugriff, lokale Ressourcen und begrenzte Preload-API. SQLite und
Generatoren laufen weder im Renderer noch im Main-Prozess. Native SQLite-
Abhängigkeit früh gegen die tatsächliche Electron-ABI bauen und im installierten
Paket prüfen. Eine bestätigte Alternative erhält dieselben Zuständigkeiten,
Schutz- und Nichtblockierungsregeln mit ihrem konkreten schmalen Speicher-/Dateiadapter.

### A02 — Koordinaten und Kacheln

- Welt: ebene Fläche innerhalb `[-100_000_000, +100_000_000]` Fuß je Achse,
  kein Wraparound; Höhen endlich innerhalb der bestehenden fachlichen Grenzen.
  Zoom `0.000002` bis `25.6` CSS-Pixel pro Fuß, 14 benannte Ansichten wie bisher.
- CPU-Geometrie: JS-Doubles; Hauszellen: ganzzahlige lokale Koordinaten und
  bestehendes 5-Fuß-Raster. Für GPU-Positionen den Kamera-/Kachelursprung zuerst
  mit CPU-Genauigkeit abziehen. Große absolute Weltwerte nicht vorher in Float32
  umwandeln. Picking verwendet dieselbe Transformation und echte Geometrie.
- **Autorenkacheln:** 64 × 64 Werte, unabhängig von der Bildschirmauflösung.
  Höhenabstand `5 * 2^level` Fuß, Level 0–21. Boden-/Felsfarbe und Landschaft
  `2^level` Fuß, Level 0–24. Schlüssel `(layer, level, tileX, tileY)`.
  Negative Koordinaten mit `floor`, Halbintervalle und feste Randbesitzregel.
- **Darstellungskacheln:** normalerweise 256 × 256 Pixel plus nötigem Halo;
  DPR und sichtbare Auflösung dürfen diese Darstellung anpassen, niemals die
  Autorenauflösung. Quellen, Übersichten und GPU-Texturen sind getrennte Typen.
- Leere Welt: Metadaten mit Ozean, Meeresspiegel 0 und Grundhöhe −100 Fuß.
  Keine vorbereitete Quadtree-Vollbelegung, leeren Objektlisten pro Weltzelle oder
  hochaufgelösten Ozeanraster anlegen. Eine Sparse-Tabelle mit Levelschlüsseln reicht.

### A03 — Zusammensetzung und numerische Übersichten

**Autoren bleiben die einzige fachliche Wahrheit.** Der kanonische Sampler
rekonstruiert positive kubische Restfelder, addiert sie zur Grundhöhe und begrenzt
erst die vollständige Summe auf ±100.000 Fuß. Oberfläche, Küste und exakte
Werkzeugabfragen verwenden diese Mathematik. Grobe Änderungen lassen feinere
Restwerte unverändert; Quellen und abgeleitete Darstellung sind verschiedene Typen.

Boden-/Felsfarbe besteht aus lokaler Maske und vormultiplizierten RGBA-Werten,
Landschaft aus Maske und vier normierten Gewichten. Fehlender Autor erbt;
explizit transparente Farbe/leere Landschaft unterdrückt den gröberen Wert.
Eine Maske ist kein Farbalpha. Beim Feinmalen zuerst den gültigen geerbten Wert
ermitteln. Glätten/Einebnen betrifft die gewählte Formstufe; vollständiges
Zurücksetzen lokaler Ausnahmen ist eine eigene Bereichsaktion mit Vorschau und Undo.
Sie trifft die gewählten Felder, keine Häuser, Räume oder Straßen.
Zu große atomare Aktionen verständlich ablehnen oder begrenzt vorbereiten.

**Bevorzugter kleiner Versuch für Höhe:** Pro weltverankerter Darstellungsstufe
numerische Samples der feineren additiven Beiträge speichern. Grobe Autoren
werden aus wenigen passenden Quellen separat hinzugerechnet. Erst danach
Höhenlimit, Land/Wasser und Materialdarstellung bestimmen.
Die Übersicht speichert keine Autoren und kein bereits eingefärbtes Bild.

1. Rasterursprung, Abtastpunkte, Halo und die Grenze zwischen zusammengefassten
   feinen und direkt ausgewerteten gröberen Stufen einmal festlegen. Jeder Beitrag
   geht genau einmal ein. An einem Render-Abtastpunkt ist die Zusammenfassung die
   Summe derselben kubischen Basis; simples 2×2-Mitteln verschobener Samplepunkte
   oder eingefärbter Pixel ist kein gleichwertiger Ersatz.
2. Ein Quellenpatch aktualisiert nur betroffene Übersichtssamples in seinem
   kubischen Stützbereich auf den darüberliegenden Darstellungsstufen.
   Kein Lesen oder Invalidieren sämtlicher feiner Nachfahren bei grober Änderung.
   Stufenanzahl, wirklich berührte Zellen, Reads und Bytes mitzählen.
3. Der Pointerpfad ändert Quellen und nur die aktuell benötigte Darstellung.
   Der Store führt abgeleitete Übersichtswerte mit derselben reinen Deltafunktion
   innerhalb seiner geordneten Commit-Grenze nach. Er trifft keine Fachentscheidung.
   Quellen und zugehörige Übersicht einer bestätigten Sequenz bleiben konsistent.
4. Noch nicht in einer gelesenen Übersicht enthaltene lokale Patches werden
   genau einmal darüber projiziert. Ihre Entfernung setzt voraus, dass die
   aktive Basis bereits auf denselben Stand fortgeschrieben wurde. Ein
   Persistenz-Ack allein macht eine alte geladene Übersicht nicht aktuell.
   Alte Antworten dürfen weder Änderungen ausblenden noch doppelt anwenden.
5. Keine neue unbeschränkte Patchchronik oder zweite veränderliche Welt bauen.
   Bestehende unbestätigte Patches, Quellidentitäten und begrenzte aktive
   Darstellungsdaten reichen als erster Kandidat. Fehlende/alte Übersicht ist
   ausdrücklich unbekannt, nicht Höhe null oder Ozean.
6. Übersichtsaufbau und laufende Pflege getrennt nachweisen. Vorbereitete Fixtures
   sind erlaubt; globale Vorbereitung nicht vor jedem Open/Zoom wiederholen.
   Save/Undo/Redo/Reopen prüfen konsistente Zusammenfassung und unveränderte Autoren.
   Delta-Drift, negative Koordinaten, Halo, Höhensättigung und Küstenschwellen gegen
   unabhängig erwartete Werte prüfen. Ein hoher Bestand darf nicht hinter
   Vorladen oder einem nachträglich geleerten Cache verschwinden.

Der Höhenpfad ist implementiert; sein erreichter Nachweisumfang steht im Status.
Farb-/Landschaftsausbau und native Leistung bleiben eigenständig zu beweisen.
Eine feste Stufenzahl allein beweist keine ausreichende Geschwindigkeit. Nur ein
konkreter neuer Befund rechtfertigt eine andere Übersichtslösung.

Farb-/Landschaftsübersichten folgen ihren Masken-/Vererbungsregeln, nicht der
additiven Höhenformel. P3/P4 erweitern den Höhenbeweis darauf.
Landschaftskandidaten bleiben ortsfest/reproduzierbar und nur sichtbar erzeugt.
Ferne Wälder verwenden Deckung, entfernte Häuser keine Innenpayloads.

### A04 — Aktive Daten und gezielte Ladebereitschaft

`EditorDocument` besitzt aktive Autoren, angenommene Änderungen und History.
Bestätigte entfernte Daten dürfen verdrängt werden. Unbestätigte Patches,
aktive Gesten und notwendige Undo-Vorherwerte bleiben gehalten oder liegen in
begrenzter temporärer Ablage.

Es gibt zwei Lesezwecke mit einer gemeinsamen, typisierten Antwortgrenze:

- **Exakte Bearbeitung:** benötigte Quellstufen/-schlüssel plus Eltern/Halo und
  relevante Owner-/Kollisionsdaten. Ein grober additiver Höhenpinsel verlangt
  keine vollständigen feineren Autoren.
- **Darstellung:** zum Maßstab passende numerische/Geometrieübersichten und
  die benötigten groben Quellen. Keine Vollständigkeitsfreigabe sämtlicher
  Feindaten des sichtbaren Weltbereichs.

SQLite-RTree begrenzt räumliche Auswahl und Quellenstufe vor der Enumeration.
Für zusätzliche aktive Geometrie einen kleinen räumlichen Index nutzen. Objektliste,
Labels, Auswahl und Kollision laden nicht sämtliche Weltobjekte; ausgewählte
vereinfachte Straßen/Flüsse erhalten exakte Header. Innenpayloads bleiben getrennt.

Die vorhandenen Quellenzustände, lokale Freigabe und gemeinsame Antwortprüfung
stehen in der Architektur. Neue Felder/Objekte müssen dieselben Session-,
Sequenz- und Patchprojektionsregeln verwenden; keine zweite Ladestrategie aufbauen.
Der aktuelle Werkzeugbedarf bleibt von einer Modellgeste unabhängig. Bereits
zulässige Hausgesten dürfen nötige Offscreen-Owner revisionsgleich auflösen;
daraus entsteht keine globale Sichtbarkeitsfreigabe. M10 erweitert den bestehenden
kalten Höhenfall auf die neuen Quellen und Werkzeuge.

### A05 — Befehle, Gesten und direkte Bearbeitung

Gemeinsame reine Typen und Funktionen unter `src/editor/model/` besitzen
Koordinaten, Kachelschlüssel, Bounds, Patches und fachliche Validierung.
Store und Worker verwenden sie; native Binärcodecs und Vertrauensgrenzen bleiben
an ihren jeweiligen Eingängen. Grenzen werden nicht durch unvalidierte Casts ersetzt.
Alle Werkzeuge verwenden dieselbe Fachmathematik und denselben atomaren
Übernahmepfad; keine zweite Vorschau-/Commit-Logik oder Werkzeug-eigene Queue.

Wirksame Einstellungen, Fehler und Auswahl haben genau einen Besitzer im
Editorzustand. React hält nur echte noch nicht übernommene Feldentwürfe.
Saved/Dirty wird aus den tatsächlichen Grenzen abgeleitet. Session, Quellrevision,
abgeschlossene Aktion, bestätigte Arbeitskopie und gespeicherte Datei bleiben
verschieden; sie dürfen nicht zu einem einzelnen `fresh`-Flag zusammenfallen.

- Kamera und hochfrequente Pointerzustände bleiben außerhalb von React-State.
  Ersetzbare Darstellung/Vorschau darf `latest wins` sein, angenommene
  Quellenänderungen nicht. Die bestehenden D10-/D11-Höhengesten bleiben erhalten.
- Aktive Gesten halten Originalwerte und geänderte Bereiche. Kleine Änderungen
  verändern bereite Quellen direkt; große Geometrie-/Netzoperationen werden
  Hintergrundaufgaben. Andere Flächenpinsel erhalten ihren räumlichen Pfad und
  bei Farbfluss die Zeit.
- **Boden/Landschaft/Region/Gewässer:** Loslassen übernimmt; Escape, Blur,
  Pointercancel und Werkzeugwechsel setzen die aktive Geste auf ihre Vorherwerte
  zurück. Live-Anzeige darf dieselben Daten benutzen, benötigt aber echte Rücknahme.
  Nicht abgeschlossene abbrechbare Gesten nicht als dauerhafte Aktion speichern.
- **Mehrknotenentwürfe:** Enter, Button oder Rechtsklick übernehmen nur gesetzte
  Geometrie; Escape verwirft den Entwurf, innerhalb eines Drags zunächst den Drag.
  Feld-Enter/-Escape wirken nur im Feld. Eine angenommene Aktion wird durch
  nachfolgende Navigation, Escape oder UI-Remount nicht verloren.
- Parameter, Weltradius und Autorenstufe am Gestenbeginn festhalten. Bestehende
  Regel „kein Zoom mitten im aktiven Pinselstrich“ erhalten; Pan/Zoom zwischen
  Gesten und während Hintergrundaufgaben bleibt verfügbar.
- Compoundaktionen prüfen ihre vollständige lokale Abhängigkeitsmenge und
  übernehmen atomar. IDs erst bei Annahme vergeben. No-ops erzeugen keinen
  Historyeintrag und verwerfen keinen Redozweig. Undo/Redo verwenden dieselben
  Invalidierungs- und Persistenzwege wie normale Änderungen.

### A06 — Kurzer Darstellungsweg und begrenzte Hintergrundarbeit

Die Kamera transformiert vorhandene Darstellung sofort. Sie schreibt keine Autoren,
wartet nicht auf SQL und rasterisiert nicht bei jeder Bewegung die ganze Szene.
Grobere vorhandene Darstellung darf überbrücken; sie ist weder exakte
Bearbeitungsquelle noch Inhalt einer anderen Projektsession.

Der vorhandene Quellenpatch-, Raster- und lokale Submitpfad ist in der
[Architektur](../architecture.md#lokale-freigabe-und-frameablauf) beschrieben.
Diesen auf neue Schichten erweitern: begrenzte eigene Quellkopien, aktuelle
lokale Ergebnisse vor unabhängigem Bildaufbau, versionierte Teilresultate und
begrenzte Uploads. Keine zweite Vorschau-/Commitdarstellung. Angenommene
Autorenänderungen dürfen nicht mit überholbaren Darstellungsaufträgen verwechselt werden.

Der verbleibende Höhen-Leistungsfall wird im Konsolidierungspaket gezielt
diagnostiziert. CPU-Rasterung bleibt zulässig; alternative Rasterung nur bei
belegtem Rechenengpass erproben. Keine zweite Produktionsmathematik auf Vorrat.

Längere Fachjobs erhalten unveränderliche Eingaben und vollständige lokale
Readsets: vorhandene Quellen, bestätigte Abwesenheit und räumliche Abfragen.
Nur das aktive Dokument übernimmt geprüfte Änderungsvorschläge. Neue Objekte
im gelesenen Bereich invalidieren alte Vorschläge; unabhängige Änderungen
anderswo tun es nicht. Aktive noch unpersistierte Änderungen gehören zur Grundlage.

Priorität ist lokale Bearbeitung, sichtbare Darstellung, Navigationsrand, entfernte
Ableitungen. Höchstens zwei rechenintensive Jobs aktiv; keine unbegrenzte Queue.
Eine kleine konkrete Aufgabenverwaltung genügt, kein allgemeiner Jobserver.
Bei ausgelasteten Workern reservierte Kapazität, kurze Pakete oder Unterbrechung
nachweisen; synchrone Aufrufe nicht nur als „abbrechbar“ bezeichnen.
P3 beginnt den Lastfall mit zwei tatsächlich rechnenden Jobs und Save.
Übernommene native Fachjobs zählen zum selben Budget.

Quellgültigkeit, Aktualität abgeleiteter Schichten und Bildschirmpräsentation
bleiben verschieden. Höhen-, Material- und Wasserschichten konsistent kombinieren
oder einen Zwischenstand erkennbar als noch nicht aktuell ausweisen.

### A07 — Arbeitskopie, Projektdatei und Fehler

- Neues Projekt beginnt in einer temporären SQLite-Arbeitskopie. Abgeschlossene
  Aktionen erhalten eine Sequenznummer und werden in Reihenfolge transaktional
  geschrieben. Die Bestätigung benennt die letzte gesicherte Arbeitssequenz.
- Projektdatei bleibt `.saltatlas`; neue eindeutige Versionskennung. Der aktuelle
  P0-Kern verwendet Format 24 für persistierte numerische Übersichten; der frühere
  Versuch verwendete 23 statt V7s 22. Bei weiterer Schemaänderung die nächste
  freie Version wählen. Das vollständige Schema umfasst Metadaten/Versionen, Quellkacheln mit Masken,
  Objektheader, getrennte Innenpayloads, Regionen/Katalog und Hydrologiedaten.
  Räumliche Indizes und Vorschauen sind abgeleitet und rekonstruierbar.
- Arbeitskopie und Quellenrevisionen werden nicht bei jeder Navigation geschrieben.
  Metadatenänderung oder Hausbewegung liest keine vollständigen Hauszellen.
  Öffnen lädt Metadaten und nötige Ausschnitte, nicht alle Innenräume in den RAM.
- **Speichern/Speichern unter** reserviert eine abgeschlossene Sequenz S, erstellt
  einen konsistenten SQLite-Snapshot und ersetzt das Ziel über eine benachbarte
  synchronisierte temporäre Datei atomar. WAL-Dateien nicht blind kopieren.
  Navigation bleibt frei; spätere Änderungen bleiben gegenüber S ungespeichert.
  Die Implementierung muss den Snapshot von S auch bei weiterlaufenden Writes
  beweisen, etwa durch eine passende SQLite-Lesesnapshot-/Backup-Grenze.
- **Dringende Reads:** Die vorhandene Trennung synchroner Reads von geordneten
  Mutationen und asynchronen Dateioperationen erhalten. Neue Lesezwecke verwenden
  dieselbe Session-/Sequenzprüfung und lokale Patchprojektion; keine weitere
  Datenbankverbindung oder zweite Queue für Quellenänderungen auf Vorrat.
- Saved-Status hängt am erfolgreich ersetzten Ziel, nicht an einer Workerantwort
  über die temporäre Arbeitskopie. Speicherdialogabbruch verändert kein Ziel.
  Fehler behalten den aktuellen Zustand und die vorherige gültige Zieldatei.
- Undo: bis zu 100 Aktionen; zusätzlich ein ausdrücklich dokumentiertes
  Bytebudget. Große Vorherwerte dürfen in der temporären Historyablage liegen.
  Älteste komplette Aktionen begrenzt entfernen, niemals Teile einer Compoundaktion.
  History wird nicht als dauerhafter Projektinhalt wieder geöffnet.
- Workerabsturz/Schreibfehler: noch nicht bestätigte Änderungen erhalten,
  verständlichen Fehler melden und keine unsichere Aktion blind doppelt senden.
  Über Sequenz und Transaktionskennung abgleichen. Notfalls weitere Schreibannahme
  begrenzen; Kamera und Lesen bereits vorhandener Daten bleiben bedienbar.
- Neu/Öffnen/Schließen verwenden den vorhandenen Save/Discard/Cancel-Vertrag.
  Fehlerhafte Dateien, unbekannte Versionen, ungültige Referenzen oder beschädigte
  Payloads werden atomar abgelehnt. Aktives Dokument und Quelldatei bleiben erhalten.

### A08 — Fachkerne nach Integrationsaufwand und Nachweis wählen

Aktive Quellen, Gesten, History und der häufig aufgerufene Surface-Sampler liegen
im gemeinsamen TypeScript-Kern. Direkte Bearbeitung darf keine synchrone native
Anfrage pro Sample benötigen. Für aufwendige oder klar abgegrenzte Fachberechnungen
ist die Sprache eine Implementierungsentscheidung, kein Abnahmekriterium.

Den hauslokalen Solver aus `src-tauri/src/interior/` und geeignete reine Teile von
Straßen-, Bebauungs- und Gewässerberechnungen vor ihrem jeweiligen Fachpaket kurz
prüfen. Bevorzugt in den gemeinsamen TypeScript-Pfad übernehmen. Ein vorhandener
Rust-Kern darf stattdessen isoliert weiterverwendet werden, wenn alle Bedingungen
erfüllt sind:

1. Er erhält begrenzte unveränderliche Eingaben und liefert reine Ergebnisse oder
   Vorschläge. Er besitzt weder Dokumentzustand noch History, Persistenz oder eine
   eigene Commitgrenze. Der Innenraumsolver bleibt hauslokal und unabhängig von
   SQL, Kamera, Weltkoordinaten und Desktoprahmen.
2. Adapter, Versionierung, Fehlerbehandlung, Paketbau und reale Tests sind zusammen
   konkret einfacher als ein Port, oder ein gemessener Vorteil wird für ein
   verbindliches Ziel benötigt. Vorhandene Codezeilen allein reichen als Grund nicht.
3. Vorschau und Übernahme verwenden denselben Kern und dieselbe Fachmathematik.
   Die gemeinsamen Quellen-/Oberflächenverträge, Abbruch-/Stale-Regeln und Budgets
   gelten auch über die Sprachgrenze. Keine unabhängige zweite Terrainlösung.
4. Verhaltenstests und neue Desktop-/Lastfälle prüfen den tatsächlich ausgelieferten
   Pfad einschließlich seines Adapters. Ein isolierter Rust-Test allein genügt nicht.

Die Wahl mit den betroffenen Modulen im vorhandenen Status festhalten. Ein
übernommener Kern braucht keinen zusätzlichen vollständigen TypeScript-Port.
Ein Port darf den alten Kern vorübergehend für isolierte Referenzfälle nutzen;
danach dessen ungenutzte Kopie entfernen. Ein zweiter autoritativer Dokumentserver
ist in beiden Varianten ausgeschlossen.

Für Polygon-Union, Difference, Intersection und Buffer im TypeScript-Pfad JSTS
hinter einem kleinen Adapter verwenden; RBush dient der aktiven räumlichen Suche.
Ein nach obigen Kriterien übernommener Kern darf seine bewährte Geometriebibliothek
behalten. Lokale Ursprungsverschiebung, Toleranzen, Ringkanonisierung und Kollisions-
verträge aus den vorhandenen Parzellen-/Regionstests gelten unabhängig davon.
Keine konkurrierenden Vorschau-/Commitberechnungen desselben Vorgangs und keine
eigene allgemeine Geometrieengine oder neues Plugin-/ECS-Framework bauen.

Aufwendige Fachaufrufe laufen als versionierte Hintergrundaufgaben. Seed und Rezept
bestimmen reproduzierbare Ergebnisse; bestehende Häuser werden durch neue Varianten
nicht neu gewürfelt. Die Innenraumfälle für Identitäten, Raumteilung/-vereinigung,
Türen und Treppen bleiben vollständig erhalten.

### A09 — Budgets und Überlastverhalten

Startwerte zentral unter `src/editor/budgets.ts` definieren und messen:

| Ressource                    | Anfangsbudget / Regel                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU-Quellenarbeitsmenge      | 256 MiB einschließlich gehaltenem Bearbeitungsrand; gesonderte Zählung noch nicht bestätigter Patches                                                            |
| CPU-Darstellungen            | 128 MiB einschließlich laufender Resultate; keine zweite unbegrenzte Kopie neben dem Cache                                                                       |
| GPU-Texturen/Geometrie       | 256 MiB, einschließlich alter noch gezeichneter und neuer hochgeladener Ressourcen                                                                               |
| History im RAM               | 128 MiB, zusätzlich maximal 100 Aktionen; größere erlaubte Deltas in temporärer Ablage                                                                           |
| Ausstehende Schreibdaten     | 32 MiB; vor weiterer ungesicherter Annahme begrenzen, keine Daten verlieren                                                                                      |
| Rechenjobs                   | höchstens zwei aktiv; kurze lokale Arbeit nach A06 auch bei ausgelasteten Workern ermöglichen; maximale nicht unterbrechbare Zeit in P0d/P3 festlegen und messen |
| Aufnahme fertiger Ergebnisse | zunächst höchstens 2 ms CPU-Arbeit und 4 MiB Texturupload je Frame; Rest später                                                                                  |
| Landschaftssymbole           | höchstens 16.384 Kandidaten einschließlich Überblendung/Rand                                                                                                     |
| Beschriftung                 | höchstens 3.000 priorisierte Kandidaten, 500 sichtbare kollisionsfreie Labels                                                                                    |

Dies sind Startwerte und überprüfbare Obergrenzen, keine alleinige Definition
von Geschwindigkeit. In P3/P9 dürfen sie aufgrund dokumentierter Messungen
angepasst werden, ohne globale Verarbeitung oder unbeschränkte Reserven einzuführen.
Aktive Referenzen, Patches, Workerinputs und Übergangstexturen mitzählen.
Speicherdruck reduziert Darstellung oder Vorladen; er darf niemals Autoren
stillschweigend löschen oder eine angenommene Geste verkürzen.
Das Schreibbudget ist ein Backlogbudget, kein neues fachliches Aktionslimit.
Größere erlaubte atomare Aktionen werden begrenzt in der temporären Ablage
vorbereitet. Sie dürfen bei leerer Queue nicht endlos auf ein unerreichbares
freies Budget warten und werden nicht in sichtbare Teilcommits zerlegt.

Die vorhandenen fachlichen Aktionsgrenzen sind zunächst beizubehalten, soweit
der neue Auflösungs-/Patchvertrag sie sinnvoll abbildet. Ein darstellungsbedingtes
Budget darf keine feineren Autoren überschreiben. Überladene exakte Bereiche
fordern verständlich engeren Ausschnitt oder eine ausdrückliche größere Aufgabe.

### A10 — Zielpfade und endgültige Ablösung

Die folgenden Pfade beschreiben den bevorzugten TypeScript-/Electron-Aufbau.
Nur Module mit tatsächlicher Verantwortung schaffen. Kleine reine Hilfen sind
zulässig; zusätzliche Manager oder Hüllen allein wegen einer langen Datei nicht.
`EditorController` verbindet Eingaben und Lebensdauer mit den vier Besitzern aus
A01; er wird kein weiterer Fach- oder Speicherbesitzer.
Eine nach A01/A08 bestätigte Abweichung benennt ihre konkreten wenigen Modulpfade
im Status und passt diese Tabelle an; sie erzeugt keine parallele Implementierung.

| Zielpfad                                                 | Inhalt                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/editor/model/`                                      | Koordinaten, Quellen, Objekte, Surface-Sampler, Änderungen, History und gemeinsame Typen                               |
| `src/editor/tools/`                                      | Gesten und Fachoperationen; eine gemeinsame Übernahmegrenze                                                            |
| `src/editor/render/`                                     | Pixi-Kamera, aktive Szene, Kacheln, Geometrie, Labels und Werkzeuganzeigen                                             |
| `src/editor/jobs/`                                       | Versionierte Aufgaben, Scheduler und reine Worker-Einstiege                                                            |
| `src/editor/ui/`                                         | React-Panels und Verbindung zum Editor; vorhandene passende UI übernehmen                                              |
| `src/interior/`                                          | Reiner lokaler Innenraumsolver mit Verhaltenstests bei TypeScript-Port; sonst schmaler Adapter zum isolierten Fachkern |
| `desktop/`                                               | Electron Main/Preload, Store-Utility-Prozess, Dateiabläufe, Buildanbindung                                             |
| `tests/product/`, `tests/desktop/`, `tests/performance/` | Verhaltens-, echte Desktop- und Leistungsszenarien                                                                     |
| `scripts/atlas-performance.mjs`                          | Reproduzierbarer Referenzrunner mit fehlerschließendem Ergebnis                                                        |

Dies sind gezielte Modulgruppen, keine Aufforderung für jede Tabellenzeile eine
generische Abstraktionsschicht zu bauen. Am Ende startet `src/main.tsx` den neuen
Editor. Der alte Rust-Dokumentworker, ersetzte `src/atlas/`-Pfade, Transporttypen,
JSONL-Testbridge und Buildpfade entfallen, soweit ihre Verbraucher ersetzt sind.
Tauri entfällt beim bestätigten Electron-Aufbau; ein bewusst gewählter anderer
Host und nach A08 tatsächlich genutzte Rust-Fachmodule behalten ihre notwendigen
Build-/Paket-/Prüfpfade. Keine ungenutzte alte Dokumentlaufzeit mitführen.
Kein dauerhaftes `old/new`-Flag, kein zusätzlicher Produktionsweg und keine
Prüfungen gegen ungenutzte Software im Gesamtgate.

## 4. Verbindliche Funktionsmatrix

Die Abschnitte des [Produktvertrags am Ausgangsstand](https://github.com/ThonkTank/Salt-Marcher/blob/1bb3932fcffcb2d5fea47fae616c3b69489443bc/docs/product-contract.md)
enthalten die detaillierten Fachfälle. F01–F19 werden über die Pakete verteilt;
D01–D11 überschreiben nur ihre ausdrücklich genannten Punkte. Pfade in der
Tabelle sind **Istanker**, keine Vorgabe, die alte Architektur zu erhalten.

| ID  | Pflichtumfang                                                                                                                                                               | Istanker / vorhandene Verhaltenstests                                                                                                                                 | Paket  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| F01 | Zeigerverankerter freier Zoom, Pan, Fit, Doppelklick, Weltgrenzen, erhaltener Kartenmittelpunkt bei Panels/Resize und Klickanker bei Auswahl                                | `src/atlas/useCamera.ts`, `lod.ts`; `lod-navigation`, `navigation-readiness`, `house-lod`, `street-lod`                                                               | P3     |
| F02 | 14 Ansichten, LOD-Hysterese, Außen-/Haus-/Parzellenkontext, leere Grundstücke, explizites Innenöffnen, Keller/Geschosse, Rückkehr nach Ownerlöschung                        | `editorView.ts`, `editorSelection.ts`; `room-lod`, `parcel-lod`, `interior-layers`, `world-lod`                                                                       | P3, P6 |
| F03 | Kartenwahl/Objektliste, Kontextinspector, Griffpriorität, exakte gewählte Objekte, Zahlenfelder beim ersten Kartenklick, lokale Feldtasten, Fehler/Modals/Fokus bei 900×620 | `AtlasApp.tsx`, `Inspector.tsx`, `Fields.tsx`, `src/Modal.tsx`; `interaction`, `planning-actions`, `modals`, `name-validation`                                        | P3, P8 |
| F04 | Bildschirmgrößen 8–512 px, Größenkurzbefehle, fixierter Weltradius, getrennte Stärke/Deckkraft, Abbruch und verständliche Limits ohne stille Kürzung                        | `useCanvasInput.ts`, `interaction.ts`; `room-lod`, `terrain-live`, `ground`, `landscape`, `water`                                                                     | P3, P4 |
| F05 | Land/Meer, Anheben/Absenken/Glätten/Einebnen, runde/kräuselige Küsten, Bergkette/Hügel/Schlucht mit realen Vorlagen, Höhenlinien/Cursorhöhe                                 | `featureBrush.ts`, `src-tauri/src/atlas/terrain.rs`; `terrain`, `terrain-live`, `terrain-features`, `terrain-coast`                                                   | P4     |
| F06 | Getrennte Boden-/Felsfarbe, weich/hart/wolkig, zeitlicher Farbfluss, Deckkraft, Halten, Pipette, Radierer, Vorlagen; Fels/Schnee und nahtlose Kacheln                       | `GroundControls.tsx`, `src-tauri/src/atlas/ground.rs`; `ground`, `terrain-materials`                                                                                  | P4     |
| F07 | Wald/Buschland/Wiese/Felsgebiet, Zieldichte, Lichtung, stabile Kandidaten, Flächen/Kronendach/Nahsymbole ohne Leerband, Wasser maskiert ohne Quellenverlust                 | `landscapeView.ts`, `landscapeLod.ts`, `forestCanopy.ts`; `landscape`, relevante aktive Fälle aus `scenery`, `presentation-stability`                                 | P4     |
| F08 | Straßenbreite/-material/-name, kubische Nodes/Griffe, Einfügen/Löschen/Bewegen, beide Enden verlängern, stabile Sections, Rauheit/Variation und Entwurfserhalt              | `roadDraft.ts`, `roadGeometry.ts`, `RoughnessControls.tsx`; `roads`, `overview-roads`, `planning-actions`                                                             | P5     |
| F09 | Gelände folgen bei Neu/Verlängern, Toleranz, feste Endpunkte, Wasser-/Hangkosten, begrenzte deterministische Suche, bestehende Teile erhalten                               | `src-tauri/src/atlas/road_terrain.rs`; `terrain-road`, Rust-Fachfälle                                                                                                 | P5, P7 |
| F10 | Keine/Nur Parzellen/Parzellen+Häuser, Seiten, Seed/Variante, Größen/Abstände, endliche Budgets/Diagnosen, idempotentes Populate, atomarer Verbund                           | `PopulationPanel.tsx`, `src-tauri/src/atlas/population.rs`; `road-planning`, `roads`, Rust-Fachfälle                                                                  | P5     |
| F11 | Einzelne Vorschläge per Griff/Feld ändern, auslassen/wieder einschalten, Aufteilung neu erzeugen, Nachbarn unverändert, Bestandsparzelle ändern/herauslösen                 | `ParcelProperties.tsx`, `parcelPlanning.ts`, `parcelEditor.ts`; `road-planning`, `parcels`, `parcel-lod`                                                              | P5     |
| F12 | Freie/gebundene Häuser, Name/Dachfarbe/Wichtiger Ort/Fundament, freie bzw. rastergebundene Pose, Ownererhalt, Containment/Kollision und Löschkaskaden                       | `Inspector.tsx`, `workflowOperations.ts`; `editor`, `parcels`, `paint-and-navigation`, `terrain`                                                                      | P5, P6 |
| F13 | Räume zeichnen/radieren/zuweisen/benennen/bewegen, Merge/Split-Identitäten, Selbstüberlappung, getrennte Gruppen, untere Geschosse und Raumlisten                           | `src-tauri/src/interior/room_edit.rs`; `room-movement`, `interior-layers`, `rotated-tiles`, `room-lod`                                                                | P6     |
| F14 | Außen-/Innentüren, Durchgänge, Umwandeln/Löschen, halbe Öffnungspositionen, Verbindungsbereinigung; Treppen 2–64 Zellen und benachbarte Geschosse                           | `src-tauri/src/interior/connection_edit.rs`, `src-tauri/src/interior/stair_geometry.rs`; `interior-connections`, `stairs`, `editor`                                   | P6     |
| F15 | Kategorien/Ränge/Regionen, Malen/Radieren, Löcher/Teilflächen/leere Namen, ranggleiche Gebietsübertragung, geometrische N:N-Beziehungen, Stile/Labels/Ortssymbole           | `RegionPanel.tsx`, `src-tauri/src/atlas/regions.rs`; `regions`, `presentation-stability`                                                                              | P8     |
| F16 | Flüsse zeichnen/bearbeiten/verlängern, Namen/Breiten/Richtung/Mäander, Snapping/gemeinsame Nodes, Zuflüsse ohne Zyklen/Teilungen und Einschnittanzeigen                     | `RiverPanel.tsx`, `src-tauri/src/atlas/rivers.rs`; `rivers`, Rust-Flussfälle                                                                                          | P7     |
| F17 | Nicht ansteigende Profile, Seepegel/Einmündungen/Rückstau/Betten; Seenpinsel mit Absenkung/Ufer/Vereinigung/Inseln und gemeinsamer Höhenaktion; D03-Nachführung             | `src-tauri/src/atlas/water.rs`, `src-tauri/src/atlas/application/water_store.rs`, `src-tauri/src/atlas/application/river_store.rs`; `water`, `rivers`, `terrain`      | P7     |
| F18 | Fantasykartografie, Relief/Material-/Ebenenfolge, Bebauungsdichte, Dächer/Löcher, einfache Walmdächer, priorisierte lesbare Labels und Auswahl                              | `cityView.ts`, `houseRoof.ts`, `mapLabels.ts`, `mapTypography.ts`; `city-view`, `street-lod`, `paint-and-navigation`                                                  | P3, P8 |
| F19 | Neu/Open/Save/Save As/Close, Save/Discard/Cancel, Shortcuts, History pro Geste/Verbund, No-ops, sichere Dateien, stale Antworten, korrekte Offscreen-Löschzahlen            | `useDocumentSession.ts`, `documentQueue.ts`, `src-tauri/src/atlas/application/persistence.rs`; `input-and-files`, `document-queue`, `interaction-lifecycle`, `modals` | P2, P9 |

Testnamen ohne Pfad/Endung bezeichnen `tests/product/<name>.spec.ts`.
Unqualifizierte TypeScript-Dateinamen in dieser Tabelle liegen unter `src/atlas/`.
Für jede Zeile im jeweiligen Paket Umsetzungs- und Testpfade festhalten; kein
pauschales „Parität erledigt“ ohne diese Zuordnung.

### Unverzichtbare fachliche Randfälle

- Dachkonturen enthalten nur nichtnegative Geschosse; Belegung/Containment alle
  Geschosse einschließlich Keller. Reine Kellerhäuser haben kein Dach/Fundament.
  Nachbarhäuser behalten ihre Dächer bei geöffnetem Innenraum.
- Höchstens ein Hausowner je Parzelle. Haus löschen erhält die Parzelle;
  Parzelle löschen entfernt ihr Haus; Straße löschen entfernt nur gebundene
  Parzellen/Häuser. Herauslösen friert Rahmen und Polygon ein.
- Hausraster und Innenbytes bleiben bei Straßen-/Parzellenbewegung erhalten.
  Randberührung ist zulässig; echte Kollision/Containmentfehler sind atomar.
- Lokale Seen und Flüsse dürfen Häuser/Straßen überlagern und löschen sie nicht.
  Sie beeinflussen die geländefolgende Routenplanung. Die entfallenden manuellen
  Wasserpolygone bringen keine zweite Wasser-Kollisionsregel in den Neubau.
- Raum-/Verbindungsidentitäten, Namensvalidierung und Zähler sind Autoren.
  Fehler und No-ops dürfen sie nicht verbrauchen; Undo darf IDs nicht duplizieren.
- Geladene Darstellung, exakte Bearbeitungsquelle und dauerhaft gespeicherter
  Zustand sind getrennt. Auswahl darf niemals verkleinerte Geometrie verändern.
- Exakt entfernte Farbe/Landschaft ist ein Autor mit Maske. Undo muss einen
  vorher fehlenden Autor wieder wirklich entfernen, nicht mit Nullwert ersetzen.

## 5. Arbeitspakete und Abhängigkeiten

### Aktueller Auftrag: P0-Konsolidierung K1–K6

Dieses begrenzte Paket folgt aus dem Review von PR #1469. Vorhandenes Verhalten,
Höhenmodell und Format bleiben Grundlage. Es endet mit den unten benannten
Nachweisen und einem aktualisierten Status; **F01–F19 und P1–P9 werden nicht in
diesem Auftrag umgesetzt**. Eine offene native oder zeitliche P0-Abnahme wird
nicht durch den Abschluss des Konsolidierungspakets ersetzt.

1. **K1 — Projekt- und Prozesslebenszyklus:** Neu/Öffnen erst nach erfolgreicher
   Vorbereitung auf das neue Dokument umschalten; bei Fehler den bisherigen
   Editorzustand und seine Änderungen erhalten. Schließen mit aktiver oder
   ungesicherter Arbeit über den vorgesehenen Save/Discard/Cancel-Pfad führen.
   Fenster, Store-Utility und Listener gemeinsam beenden. Mit echten
   Prozess-/Dateifällen Fehler beim Öffnen, Abbruch, Wechsel und Shutdown prüfen.
2. **K2 — Persistenzfehler:** Angenommene, noch unbestätigte Änderungen bei
   Schreibfehlern erhalten, keine falsche Saved-Meldung und keine unbegrenzt
   weiterwachsende Schreibannahme. Fehler, gesicherter Stand und mögliche
   Fortsetzung eindeutig halten; Wiederholungen nur mit Session-/Sequenz- und
   Transaktionsabgleich. Einen echten Storefehler über die Anbindung prüfen;
   sichtbarer Fehler und erhaltene Modell-/Historydaten gehören zum Nachweis.
3. **K3 — Nativen Nachweis ausführbar vorbereiten:** Referenzprofil ausdrücklich
   auswählen und Umgebungs-/Nachweisvorprüfung vor Fixtures und Sammlung ausführen.
   Ein kleiner Probeweg darf benötigte Referenz-/Trace-Metadaten erheben. Er ist
   keine Leistungsabnahme. Fehlende qualifizierte Referenz und noch nicht
   implementierte Präsentationszuordnung als verschiedene Blocker benennen.
   Die eigentliche Atlas-Generation→Compositor-Präsentationszuordnung benötigt
   geeignete native Belege und bleibt bis dahin offene P0-Arbeit. Keine Captures,
   RAF-Zeiten, ersten Folgeframes oder bloße Markernähe als Präsentation umetikettieren.
   Eine positive Profilmarkierung allein erfüllt das Gate nicht. Ohne nutzbare
   Zuordnung vor der teuren Vollsammlung stoppen; bekannte Inhalts-/Zeitfehler
   daneben weiterhin als `FAIL` ausweisen.
4. **K4 — CI und sauberes Paket:** Einen begrenzten echten Electron-Smoke mit
   normalem Einstieg, Preload/IPC, SQLite und Dateirundlauf im bestehenden Gate
   ausführen. Den P0-Paketbau aus einem sauberen Stand und den ausgelieferten
   Einstieg prüfen; zufällig vorhandene Dev-Dateien dürfen kein Paket retten.
   V7 bleibt aktiv und behält seine Checks. Software-CI behauptet keine native
   Zeitabnahme, ein Paketstart keine installierte RPM-Bedienabnahme.
5. **K5 — Gemeinsame Verträge und tote APIs:** Produktverbraucher der alten
   Quellen-/Snapshot-/JSON-Hilfen und Transportfelder prüfen; ungenutzte Pfade
   samt reinen Spiegeltests entfernen. Duplizierte gemeinsame Typen aus einer
   passenden vorhandenen Quelle beziehen. Quellenzustände und Validierung an
   Prozess-/Dateigrenzen erhalten. Keine allgemeine neue Abstraktionsschicht.
   Doku nach README/Architektur/Produktvertrag/Status/Plan entflechten.
6. **K6 — Begrenzte Großpinsel-Diagnose:** Im vorhandenen Journal die bisher
   zusammengefasste Zeit zwischen Dispatch, Workerbeginn/-ende, Main-Antwort und
   tatsächlichem Submit aufteilen. Dieselbe kurze große warme Geste prüfen;
   Eingaben, Dosis und Inhalt bleiben unverändert. Nur auf einen dominierenden
   Befund eine begründete Änderung folgen lassen. Ohne erwartete Verbesserung
   Hypothese verwerfen, nicht weitere Caches/Worker/Shaderpfade hinzufügen.

**Abschluss dieses Pakets:** K1/K2/K4/K5 sowie Referenzprofil, Probeweg und
fehlerschließende Vorprüfung aus K3 mit gezielten positiven/negativen Fällen
geprüft. Die tatsächliche native Präsentationszuordnung ist ein gesonderter
P0-Restnachweis, wenn geeignete Belege fehlen. K6 liefert eine nachvollziehbare
Ursache oder ausdrücklich noch unaufgelöste Zeitanteile. Ersetzte Pfade sind
entfernt, vorgeschriebene Repo-Checks am veröffentlichten Kandidaten belegt und
Doku konsistent. Nicht gelöste
Leistungs- oder native Nachweisprobleme bleiben im Status offen. Keine
vollständige Sammlung allein zum Wiederholen eines bekannten Fehlers.

### P0 — Vorhandene Grundlage und verbleibendes Gate

P0a–P0f bezeichnen die Teile des Höhenversuchs, keinen erneuten Bauauftrag:

| Teil | Vorhandene Grundlage                                                  | Verbleibende Verantwortung                                                                     |
| ---- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| P0a  | Nutzervertrag D01–D11 und enger Auftrag festgelegt.                   | Neue Befunde in Status und Restauftrag einordnen; keine obligatorische neue V7-Benchmarkreihe. |
| P0b  | Gemeinsame lokale Freigabe und normaler Produkt-/Prüfpfad.            | Referenz/Vorprüfung nach K3; tatsächliche Präsentationszuordnung bis P0-Abschluss nachweisen.  |
| P0c  | Höhenmodell, Graben, grobe Änderung, History und Dateirundlauf.       | Bei Änderungen relevante Funktionsbelege erhalten.                                             |
| P0d  | Ein priorisierter begrenzter Rasterpfad mit Live-Zwischenständen.     | Großen warmen Zeitfall nach K6 klären und anschließend unveränderte Ziele prüfen.              |
| P0e  | Numerische Übersicht, 32/1.024/9.000-Quellenfälle und Detailerhalt.   | Betroffene Reads/Übersichten/History/Dateifälle bei Änderungen erneut prüfen.                  |
| P0f  | Reine Reads während asynchroner Snapshots, gemeinsame Antwortprüfung. | Snapshot S, spätere Dirty-Änderungen und tatsächliche Read-/Save-Überlappung erhalten.         |

**P0-Abschluss:** M01 sowie Höhenanteile aus M03/M04/M10 mit D10/D11 bestehen
im gebauten Kandidaten. Dazu gehören Inhalt, laufender Verlauf, History,
Dateirundlauf, Budgets sowie qualifizierte Referenz, tatsächlich zugeordnete
Präsentation und die Stichprobe aus Abschnitt 6. Funktionserfolg oder schneller
Submit allein schließen dieses Gate nicht. Fehlende Umgebung/Zuordnung ist
`blockiert`; ein bekannter Inhalts-/Budget-/Zeitfehler bleibt `FAIL`.

Erst nach bestandenem P0-Gate und entsprechendem Umsetzungsauftrag gilt
**P1 → P2/P3 → P4 → P5/P6/P7/P8 → P9**. P6 darf seinen reinen hauslokalen Kern
parallel vorbereiten; gemeinsame Dokument-, Oberflächen- und Undo-Verträge
werden nicht mehrfach implementiert.

### P1 — Zustände, Datenverträge und Fachkern konsolidieren

**Abhängigkeit:** P0-Gate. **Lieferung:** der gemeinsame Kern für F01–F19.

- Vorhandenen `EditorDocument` erweitern: Quellen/Masken, Objektheader,
  getrennte Innenpayloads, IDs, lokale Abhängigkeiten, atomare Patches und History.
  A03/A04 auf Boden/Landschaft/Geometrie übertragen; A08-Kerne gezielt anbinden.
- Den vorhandenen effektiven Controllerzustand auf neue Werkzeuge erweitern.
  React-Feldentwürfe bleiben lokal; Kamera-/Pointerarbeit bleibt außerhalb
  hochfrequenter React-Updates. Keine erneute Zentralisierung bereits gemeinsamer Einstellungen.
- Reine Koordinaten-, Schlüssel-, Bounds- und Patchverträge gemeinsam verwenden.
  Fachliche und binäre Eingangsvalidierung erhalten. Kleine Module nach
  Verantwortung schneiden, keine Hüllen nur zum Weiterreichen.
- Den nach K5 bereinigten Quellen-/Transportvertrag erweitern, ohne entfernte
  Alternativen wieder einzuführen. Selektive Lesezwecke und tatsächliche
  Quellenzustände erhalten.
- Eine konkrete begrenzte Jobverwaltung gemäß A06 anbinden. Keine zweite
  Dokumentautorität und keine pro Werkzeug separat entwickelte Queue.

**Entfällt:** bislang erforderliche Höhen-Sonderverträge, soweit der erweiterte
Quellen-/Objektkern ihre Verbraucher übernimmt. In K5 entfernte Alt-APIs bleiben entfernt.
**Nachweis:** Koordinatenränder, fehlend/explizit leer, lokale Bereitschaft,
Grob-/Fein-Semantik, No-op/IDs/History und stale Jobs.
Neue leere Welt bleibt sparse. P0-Belege nur nach betroffenen Änderungen erneuern.

### P2 — Gemeinsame Persistenz und vollständige Dateiabläufe

**Abhängigkeit:** P1. **Pflichtumfang:** F19-Grundlage.

Vorhandenen SQLite-Pfad auf das vollständige Schema erweitern: binäre Quellen,
Objektheader, selektive Innenpayloads und A03-Übersichten.
Eine geordnete Commit-/Dateigrenze, gemeinsame Validierungsregeln, bestätigte
Abwesenheitsreads, Historyspooling und begrenzter Schreibbacklog.
Editorannahme, Store-Ack und gespeicherter Snapshot bleiben getrennt.

Neu/Open/Save/Save As/Close inklusive echter Dialoge und Save/Discard/Cancel
über diesen Pfad führen. Snapshot S neben späteren Änderungen beweisen;
Disk-/Writefehler, Abbruch, beschädigte Datei, Workerabbruch und Sessionwechsel
in isolierten Testdateien prüfen. Reopen materialisiert kein globales Detailraster.

**Entfällt:** ersetzte Format-/Status-/Queueadapter und unbenutzte JSON-Umwege.
Sicherheitsprüfung an Prozess-/Dateigrenzen bleibt bestehen.
**Nachweis:** echter Dateirundlauf mit Prozessneustart, unveränderte alte Zieldatei
bei Fehler, spätere Änderungen bleiben dirty, falsche Formate ohne Teilübernahme.

### P3 — Gemeinsamen Kern mit Landschaft, Haus und Konkurrenz prüfen

**Abhängigkeiten:** P1; für Abschluss P2. **Pflichtumfang:** F01–F04/F18-Basis.

- Kamera, 14 Ansichten, Kontextwechsel, DPR/Resize, Auswahl und Werkzeugoverlay
  vervollständigen. Keine globale `fresh=false`-Sperre bereiter lokaler Werkzeuge.
- Höhen-/Landschaftspinsel und einfaches Haus über denselben Kern führen:
  Landform → fernes Dorf → Graben/Lichtung/Haus → Welt → grobe Änderung →
  Detailrückkehr → Undo/Redo → Save/Neustart/Reopen.
- P0e auf echte Maskenquellen erweitern; höchste Bestandsgröße überschreitet
  das aktive Budget. Keine feinen Nachfahrenscans/Neurasterung bei grober Änderung.
- Exakte lokale Bearbeitung und kaltes Ziel bei zwei tatsächlich gestarteten
  rechenintensiven Aufträgen und Save prüfen. P0s einzelner Sampling-Worker
  ersetzt diesen Nachweis nicht. Priorität/Unterbrechung und Save S gemeinsam prüfen.
- D03-Szene mit vorbereiteten Fluss-/See-/Hausquellen: bestätigtes Bett,
  erkennbar veraltete Hydrologie, aktuell geclipptes Wasser und aktuelles Fundament.
  Keine vollständigen Gewässerwerkzeuge für diesen Beweis vorziehen.

**Entfällt:** Höhen-Sonderwege, sobald die gemeinsamen Verträge sie ersetzen.
**Nachweis:** M01, Kernanteile M02–M04/M06/M10 im gebauten Desktop; Referenzzeiten,
Arbeits-/Speicherbudgets und D01–D03 gelten zusammen. Fehlende spätere Werkzeuge
im Teilprofil benennen. Erst danach weitere Fachpakete.

### P4 — Terrain, Farben und Landschaft vollständig übernehmen

**Abhängigkeit:** P3. **Umfang:** F04–F07.

Sämtliche Höhenmodi und Formen, Küsten, Höhenlinien/Cursorhöhe sowie
Boden-/Felsfarbe mit Vorlagen, Modi, zeitlichem Fluss, Pipette und Radierer
übertragen. Landschaftsdeckung, Lichtungen und stabile Kandidaten vervollständigen.
A03-Masken, Material-/Schnee-/Felsdarstellung und nahtlose Rand-/Haloregeln gelten.
„Lokale Details zurücksetzen“ bleibt explizite Bereichsaktion mit Vorschau/Undo.

**Entfällt:** werkzeugeigene Patch-, Vorschau-, History- und Persistenzpipelines.
**Nachweis:** alle F04–F07-Modi einschließlich Halten, Abbruch, Rändern,
kalter Bearbeitung und Grob-/Feinfolge; Vorschau und Übernahme verwenden denselben Kern.

### P5 — Straßen, Parzellen und Außenhäuser übernehmen

**Abhängigkeit:** P3/P4, gemeinsame Wasseroberfläche mit P7. **Umfang:** F08–F12.

Kurven/Griffe, Verlängerung, stabile Sections, Gelände-/Wasserkosten, festgehaltene
Rauheit sowie deterministische Vorschläge/Varianten mit endlichen Budgets erhalten.
Parzellen/Häuser einzeln bearbeiten, auslassen, herauslösen und erneut erzeugen.
Objekte/Innenpayloads trennen; Pose, Owner, Containment, Kollision und Löschfolgen
über den gemeinsamen atomaren Kern führen. Reine bestehende Fachkerne nach A08 wählen.

**Entfällt:** ersetzte Vorschau-/Commit-Doppelmathematik, eigene Dokument- oder
Historyserver. Aktive verwendete Fachberechnungen erhalten ihre Prüfungen.
**Nachweis:** F08–F12 einschließlich idempotentem Populate, No-ops, gebundenen
Bewegungen ohne Innenraumverlust, Undo/Redo, Reopen und Wasseranschluss.

### P6 — Hausinnenräume übernehmen

**Abhängigkeit:** P1/P2; für UI und Abnahme P5. **Umfang:** F02/F12–F14.

Reinen hauslokalen Solver nach A08 übernehmen oder portieren. Räume, Merge/Split-
Identitäten, Türen/Durchgänge, halbe Öffnungspositionen, Treppen und Etagenregeln
vollständig erhalten. Innenpayload selektiv laden; Welttransform, Außenheader,
Dachkontur und alle Geschosse einschließlich Keller getrennt behandeln.

**Entfällt:** unnötiger Welt-/SQL-Kontext im Solver und ersetzte Innenraumadapter.
**Nachweis:** freie/gebundene gedrehte Häuser, Keller/Etagen, Raumbewegung,
Verbindungen/Treppen, Löschkaskaden, kalter Innenraumwechsel und Dateirundlauf.
Ferne Innenräume werden weder geladen noch gezeichnet.

### P7 — Gewässer und ausdrückliche Nachführung übernehmen

**Abhängigkeit:** P4, gemeinsamer Vertrag mit P5/P6. **Umfang:** F09/F16/F17.

Flussgeometrie, Breiten, Mäander, Richtung, Snapping und gemeinsame Nodes
integrieren. Profile/Betten mit Seepegeln, Rückstau und Zuflüssen als versionierte
Aufgaben berechnen. Seenpinsel erhält Aushub, Ufer, Vereinigung/Inseln und die
atomare Höhen-/Wasseraktion. D03 mit Veraltet-Anzeige, lokal aktueller Darstellung
und ausdrücklicher Korrektur vollständig umsetzen.

**Entfällt:** synchrone globale Nachführung pro Terrainereignis sowie eine zweite
Oberflächenmathematik. Keine alte hydrologische Lösung als aktuell ausgeben.
**Nachweis:** F16/F17 und D03 einschließlich Abbruch, Zyklen/Überlast,
stale Ergebnissen, A→B→A, Undo/Redo und Reopen; Navigation bleibt verfügbar.

### P8 — Regionen, Bedienung und Kartenbild vervollständigen

**Abhängigkeit:** P3, Integration P4–P7. **Umfang:** F03/F15/F18.

Regionen/Ränge, Malen/Radieren, Löcher/Teilflächen, leere Namen und geometrische
N:N-Beziehungen mit Flächenanteilen erhalten. Labels/Marker teilen Priorisierung
und Kollisionsbudget. Fantasykartografie mit Waldkronen, Relief, Materialien,
Dächern/Löchern und Walmdächern fertigstellen. Panels, Felder, Shortcuts, Modals,
Fokus und Auswahl bei 900×620 und 1440×960 prüfen.

**Entfällt:** dauerhaftes P0-Diagnose-UI, Debugdarstellung als Endprodukt und
doppelte Panelzustände. Diagnosefunktionen bleiben separat erreichbar.
**Nachweis:** F01–F19 besitzen aktive Implementierungs-/Testpfade;
lesbare nahe/mittlere/ferne Ansichten und exakte Fachwerte stimmen.

### P9 — Übergang beenden und endgültigen Stand abnehmen

**Abhängigkeit:** alle vorherigen Pakete. **Lieferung:** ein regulärer Editor.

1. `src/main.tsx`, Desktopstart und Paket auf den bestätigten Pfad umstellen.
   V7 bis dahin als Funktionsreferenz erhalten; keinen unfertigen P0 als Ersatz liefern.
2. Ersetzte `src/atlas/`-Canvas-/Workflowpfade, Rust-Dokumentserver/Queue,
   Transporttypen, JSONL-Testbridge und Contractgenerator nur nach Verbrauchersuche
   und übertragener Verhaltensabdeckung entfernen. Tauri nur bei bestätigtem
   Electron-Host entfernen; benötigte reine Rust-Kerne samt Builds behalten.
3. P0-Sondereinstieg/-Befehle, Übergangsflags und doppelte Build-/CI-Aufrufe
   in die endgültigen Befehle überführen. Keine zweite ungenutzte Produktlaufzeit.
4. `check:all`, Desktop-/Paketprüfung und Referenzabnahme vollständig verdrahten.
   Den erforderlichen Checknamen erhalten. Fehler und fehlenden Pflichtwert
   isoliert einspeisen: zentraler Ausgang muss scheitern, danach Normalfall bestätigen.
5. M01–M10 samt Fach-/Fehlerfällen und Ressourcen am endgültigen Release prüfen.
   RPM installieren und die installierte Anwendung ohne Entwicklungsserver mit
   echten Dialogen bedienen. Nach Änderungen nur betroffene Nachweise erneuern.
6. Vier kanonische Dokumente auf tatsächlichen Stand bringen; diesen Plan und
   seine Matrix schließen. Regulär integrieren, wenn die Repo-Gates bestehen.
   Äußere Integrationsblockade offen halten, prüfbaren Kandidaten erhalten.

**Gate:** Abschnitt 8 vollständig erfüllt. Funktionsparität, kurze direkte
Datenwege und entfernte Altverbraucher gehören zusammen zum Abschluss.

## 6. Prüf- und Performancevertrag

### Beobachtung statt künstlicher Fertigsignale

Eine Testanbindung darf Kamera, Quellen-/Aktionssequenz, Rendererabschluss,
Speichergrenzen und Ressourcen beobachten. Sie darf weder Produktsteuerung noch
„bereit“-Flags setzen. Fach- und Dateipfade bleiben echt.

Für GPU-Rendering den Zeitpunkt nach dem tatsächlichen Renderaufruf der passenden
Generation erfassen. Ende des JavaScript-Aufrufs, GPU-Abschluss und physische
Bildschirmpräsentation nicht gleichsetzen. Unter anderem über zusätzliche
Bild-/Pixelproben außerhalb der Zeitmessung bestätigen, dass die Karte wirklich
den geänderten Zustand zeigt. Ein beweglicher Cursor allein ist kein Pinselbeleg.

Der Runner korreliert je Eingabesequenz vier Zeiten: Eingabeentstehung einschließlich
Wartezeit in der Eventqueue, genaue Modelländerung, Render-Submission der passenden
Generation und Präsentation des zugehörigen Compositorframes. Beim Electron-Default
dafür eine Chromium-Trace mit zuordenbaren Präsentations-/Framebeobachtungen nutzen;
ein anderer Host benötigt eine gleichwertige Beobachtung. Uhren und Sequenzen
ausdrücklich abgleichen. Diese Messung endet bei der gemeldeten
Framepräsentation, nicht beim physikalischen Pixelumschlag des Monitors. Kann die
Umgebung nur Submission beobachten, diese als Proxy ausweisen und den
Sichtbarkeitsnachweis offen lassen. Screenshots außerhalb der Zeitmessung belegen
Inhalt, aber keine 50-ms-Präsentationslatenz. P0b stellt die Messanbindung her;
der Nachweis umfasst ganz P0 einschließlich P0d/P0e und wird in P3 erweitert.

### Verbindliche Szenarien

| ID  | Eingaben / Fixture                                                                                                   | Erforderlicher Nachweis                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| M01 | Neue leere Ozeankarte, Raster an/aus; 30 Sekunden Wheel/Pan                                                          | Keine Autorenänderung und keine datenbankabhängige Kamerafreigabe; tatsächliche Kameraantwort und Frameverteilung                   |
| M02 | Welt→Raum→Welt über alle Ansichten, am Ursprung sowie nahe ±90.000.000 Fuß                                           | Durchgehende Navigation, geringe aktive Arbeitsmenge, kein Koordinatenzittern; Position/Griffe/Picking stimmen                      |
| M03 | Höhen/Boden/Landschaft, je kleine/große normale Pinsel; Haus- und Straßenpunktbewegung                               | Eingabe bis exakter Live-Quellenstand und zugehörige Präsentation; zusätzlich Pointerup bis übernommener Aktionsstand               |
| M04 | Graben/Lichtung/Haus fein; große Höhe/Walddichte ändern; zurück, Undo/Redo/Reopen; drei feine Bestandsgrößen nach P3 | D01/D02, erhaltene Details, geänderte Küste/Materialien, begrenzte Quell- und Renderarbeit, echte Persistenz                        |
| M05 | Gleicher aktiver Ort bei 100.000 und 250.000 entfernten Häusern, zusätzliche Weltregionen                            | Keine lineare Weltiteration pro Frame/Interaktion; vorbereitete Übersichten und selektive Header-/Innenreads                        |
| M06 | Navigation und unabhängige Bearbeitung während Save; Bebauungs- und Hydrologieauftrag zu Beginn tatsächlich aktiv    | Exakte lokale Reaktion einschließlich Präsentation/Pointerup unter Last; wirksame Priorität, konsistente Ergebnisse und Save-Grenze |
| M07 | Schnelle Navigation A→B→A, Dokumentwechsel, verzögerte/abgebrochene Workerantworten                                  | Keine alten Quellen/Pixel/Commits in neuer Session; keine anwachsende Queue überholter Darstellungsjobs                             |
| M08 | Zehn Minuten wiederholte Rundreise mit Zoom, Malen und Undo/Redo                                                     | Speicherplateau innerhalb der Budgets; Texturen/Buffer/Listeners/Workerinputs tatsächlich freigegeben                               |
| M09 | Save, vollständiger Programmneustart, Reopen; zusätzlich Fehler-/Abbruchdateien                                      | Identische Autoren/Fachobjekte, keine fälschliche Saved-Meldung, alte Zieldatei bleibt bei Fehler gültig                            |
| M10 | Navigation zu kalten gespeicherten Details, erste lokale Bearbeitung; Außen-/Innenkontext, Rückkehr und Konkurrenz   | Navigation → lokale Bearbeitbarkeit und → erste exakt präsentierte Änderung einschließlich tatsächlicher Lade-/Wartezeit            |

Fixtures sind deterministisch und verwenden das neue echte Schema. Entfernte
Innenräume und fein bearbeitete Ausschnitte tatsächlich speichern; bloße leere
Boundingboxes beweisen keine skalierbare Datenhaltung. Für lokale Lastfälle sowohl
leere als auch bebaute Küste mit Wasser/Flüssen und einem ausgearbeiteten Haus nutzen.

### M10 konkret: nach Navigation weiterarbeiten

M10 beginnt in einem geöffneten Projekt. Prozessstart und vollständiges Öffnen
werden separat in M09 erfasst. Für kalte M10-Unterfälle fehlen die benötigten
Zieldetails zu Beginn der Navigationsfolge im Anwendungscache. Gewöhnliches Vorladen während der Navigation
ist erlaubt; die Folge, ihre Dauer und die Fixtures stehen vor dem Messlauf fest.
Ein neuer Prozess leert den Anwendungscache, nicht automatisch den Dateicache des
Betriebssystems. Diesen Zustand benennen, keine ungemessene kalte Platte behaupten.

- `t0`: Entstehung des letzten echten Navigationseingabeereignisses, das Zielort,
  Maßstab oder Hauskontext festlegt, einschließlich seiner Eventqueue-Wartezeit.
  Zusätzlich die gesamte Zeit ab Beginn der Navigationsfolge berichten.
- `t_sources`: benötigte Quellen, Eltern/Halos und Ownerdaten sind verfügbar;
  ausschließlich Ursachenmessung, keine Bedienfreigabe.
- `t_gate`: Produktfreigabe nach dem zugeordneten lokalen Terrain-Submit. Das
  ist der unmittelbar beobachtbare Laufzeitpunkt, noch kein Beleg nativer Sichtbarkeit.
- `t_ready`: erster Zeitpunkt, an dem das wirkliche Werkzeug am festgelegten Ziel
  nach D11 sichtbar und lokal bereit ist. Richtiger Terrainstand im sichtbaren
  Eingriffsbereich, Session/Ansicht und benötigte Daten gehören zusammen.
  Frühestens nach `t0` und Anwendung der zielbestimmenden Navigation erfassen.
  Ein alter Übergangsframe, eine Ladefläche oder Quellenbereitschaft allein
  genügen nicht. Eine reguläre numerische Übersicht des gewählten Maßstabs ist
  zulässig. Ferne fehlende Bildschirmkacheln sind keine globale Sperre.
  In der nativen Abnahme den zugeordneten Präsentationszeitpunkt des freigegebenen
  Basisstands getrennt erfassen: `t_ready` liegt erst vor, wenn Produktfreigabe
  und diese Präsentation vorliegen. `t_gate` darf ihn nicht ersetzen.
- `t_edit`: Entstehung der ersten echten Bearbeitungseingabe, die bei Bereitschaft
  unverzüglich durch den normalen Eingabepfad ausgelöst wird. Die Instrumentierung
  beobachtet Bereitschaft und setzt sie nicht selbst. Die gesamte Wartezeit seit
  `t0` bleibt Teil der Messung. Der Monitor löst beim ersten beobachteten
  Produktfreigabeübergang aus; kein zusätzlicher Wait auf `exact()`, Screenshot,
  Warmup, Retry oder Sleep. `readyToInputMs` ausweisen und vollständig in der
  Gesamtzeit belassen. Erst im gültigen Zielzustand bearbeiten.
  Entsteht der unmittelbar ausgelöste Input in einem nativen Lauf noch vor der
  nachgewiesenen Bereitschaftspräsentation, ist die Reihenfolge als Nachweis
  „Eingabe nach sichtbarer Bereitschaft“ ungültig. Diesen Vorlauf offen ausweisen;
  weder Zeitpunkte verschieben noch einen späteren Rettungsinput wählen. Eine
  fehlende Präsentationszuordnung bleibt blockiert. Keine zusätzliche Produkt-API
  für diesen Messnachweis einführen.
- `t_exact`: zugeordnete Compositorpräsentation des exakt geänderten Kartenstands.
  `t_ready − t0`, `t_exact − t0` und `t_exact − t_edit` direkt messen; Quantile
  nicht aus getrennten Komponentenquantilen addieren. Dauer gröberer/veralteter
  Darstellung ebenfalls ausweisen.

Zusätzlich vor Bereitschaft Down/Move/Up sowie eine weiter gehaltene Taste
prüfen. Nach D11 ist das Soll: sichtbares Warten, keine Modelländerung, keine
History und keine spätere Wirkung dieser Eingaben. Nach Freigabe muss ein neuer
Druck funktionieren. Diese Vorabfälle sind keine erfolgreichen Editlatenzsamples;
ihre komplette Wartezeit und Eingabezuordnung bleiben im Bericht. Eine nie
erreichte Freigabe oder fehlende anschließende Erholung scheitert.

Der danach begonnene kalte Strich verwendet denselben Ablauf und dieselben
Live-/50-ms-Kriterien wie der warme Strich. Der erste Input liefert zusätzlich
die Navigationsmaße; alle Inputs bleiben im Journal. Eine schnelle Navigation
entschuldigt keinen langsamen ersten freigegebenen Edit. Ohne zugeordnete native
Präsentation sind Freigabe-Submit und Edit-Submit nur Untergrenzen; Bildprüfungen
belegen Inhalt, keine erfundenen Präsentationszeitpunkte.

Das endgültige Szenarienmanifest enthält mindestens:

1. Feinen Graben, maskierte Bodenfarbe und Lichtung an einer Kachelgrenze;
   Höhen-, Boden- und Landschaftseingriff benötigen echte Detail-/Nachbardaten.
2. Bebauten Küstenausschnitt mit Häusern, Straßen, Wasser und Fluss; derselbe
   Zielausschnitt mit den entfernten Beständen von 100.000/250.000 Häusern aus M05.
3. Gedrehtes mehrgeschossiges Haus mit Räumen, Türen und Treppe; Welt → Hauskontext
   → erste Innenraumbearbeitung, einschließlich selektivem Innenpayloadread.
4. Rückkehr A → B → A getrennt für tatsächlich warmes und verdrängtes Ziel sowie
   mindestens einen kalten Fall bei Save und Hintergrundarbeit gemäß M06.

Positionen, Quellmengen, Navigationsfolge, Cachezustand und beabsichtigten ersten
Eingriff vor dem Timinglauf festlegen. Pflichtfälle nicht durch längere Vorladezeit,
kleinere Fixtures oder einen später angesetzten Messbeginn nachträglich erleichtern.
P0 prüft den Höhenfall einschließlich P0d/P0e/P0f und D11, P3 zusätzlich Landschaft und ein einfaches Haus; P4–P7
ergänzen die fertigen Werkzeuge. P9 verlangt sämtliche endgültigen Unterfälle.

### Zeitziele und Messumfang

Die folgenden Werte sind **verbindliche Zielwerte, keine vorhandenen Ergebnisse**:

- Referenzviewport 1440×960 CSS-Pixel, DPR 1; zusätzlich Funktions-/Budgetproben
  bei 900×620 und 3840 Pixel Breite sowie DPR 2. Gleiche Fenster-/Displayeinstellung
  für vergleichende Zeitmessungen verwenden.
- M01/M02/M06 bei laufender Navigation: Ziel 60 Bilder/s auf einer festgehaltenen
  Referenzumgebung. p95 CPU-Arbeit für Eingabe und Framevorbereitung höchstens
  8 ms; p95 Frameintervall höchstens 20 ms bei 60-Hz-Betrieb; keine durch normale
  Kameraarbeit ausgelösten Pausen über 100 ms. VSync-Quantisierung dokumentieren.
- M03/M04 und die entsprechenden lokalen Eingriffe unter Last in M06 bei
  bereitliegenden Quellen: p95 Eingabe → Präsentation des exakt geänderten
  Kartenstands höchstens 50 ms. Modelländerung und Submission separat
  korrelieren. Während einer abbrechbaren Geste zählt der exakte rücknehmbare
  Quellenstand als Live-Ergebnis; Cursor, Pinselkreis und vereinfachte Näherung
  zählen nicht. Zusätzlich Pointerup → atomar übernommener und präsentierter
  Aktionsstand messen; für diese gewöhnlichen lokalen Aktionen ebenfalls p95
  höchstens 50 ms. Aufwendige Werkzeuge mit gesonderter Übernahme separat ausweisen.
- Bei fortlaufender Pinselbewegung darf die Ergebnisanzeige nicht nach wenigen
  frühen Zwischenständen stehen bleiben. Die längste Pause mit ausstehenden
  Änderungen während weiterer Eingaben wird zusätzlich ausgewiesen; mehr als
  **100 ms** sind ein Live-Fehler, kein erlaubtes Ziel für gewöhnliche Reaktion.
  Das ist eine Stillstandsgrenze für den laufenden Verlauf, kein neues
  pauschales Maximum für jede einzelne Eingabe. Fehlt native Präsentation,
  belegt schon eine entsprechend lange Submit-Pause das verfehlte Mindestziel;
  ein kurzer Submit-Abstand allein beweist keine native Sichtbarkeit.
- M10: p95 Zielnavigation → sichtbare lokale Bearbeitbarkeit nach D11 höchstens **500 ms** und p95
  Zielnavigation → erste exakt präsentierte Änderung höchstens **750 ms**.
  Beide Zeiten dürfen in keinem regulären Abnahmefall **2.000 ms** überschreiten.
  Das sind neue Produktziele, keine gemessenen Eigenschaften eines Stacks.
  Pilotläufe prüfen Messung und Erreichbarkeit; sie bestimmen oder lockern die
  Grenzen nicht. Für den ersten nach Freigabe begonnenen Edit und den weiteren
  Strich gilt zusätzlich p95 ≤ **50 ms**; die Cold-Auswertung erhält keine
  Ausnahme. Ladezeit wird vollständig in den Navigationsmaßen erfasst.
  Ein nach fünf Sekunden fehlendes Ergebnis beendet den Fall als Timeoutfehler;
  die Produktabnahme scheitert bereits an der 2.000-ms-Überschreitung.
- Große Generatoren separat messen. Sofortige Kamerabewegung mit gröberem Bild
  bleibt Pflicht; das M10-Budget umfasst lokale Ladebereitschaft und gewöhnliche
  Eingriffe, nicht die exakte Lösung eines großen Flussnetzes. Ein gewöhnlicher
  Pinsel wird nicht wegen vieler gespeicherter Feindetails zu einem Generator.
- Mindestens drei unabhängige Release-Läufe; je Lauf und verpflichtendem Unterfall
  mindestens 30 Sekunden Navigation beziehungsweise 100 zuordenbare lokale
  Änderungsereignisse. Für M10 gilt die nachfolgende eigene Stichprobe.
  p50/p95/p99/Maximum und fehlende Samples angeben. Kalt/Warm getrennt halten;
  keine p95-Aussage aus drei Strichen und keine nachträgliche Ausreißerentfernung.
  Für jeden verpflichtenden M10-Unterfall mindestens 30 echte Zielwechsel je Lauf
  und mindestens 100 insgesamt. Pflichtgrenzen gelten je Unterfall und Release-Lauf;
  gemeinsame Quantile über Werkzeuge, Cachezustände oder Läufe ersetzen diese
  Einzelbewertung nicht. Maximum, Timeouts und fehlende Ergebnisse über sämtliche
  Samples prüfen. Timeouts und fehlende Ergebnisse bleiben Fehler, keine entfernten Samples.
- Referenzprofil in P0/P3 mit tatsächlich verfügbarer Desktopumgebung erfassen:
  CPU, RAM, GPU/Grafikbackend, OS, Displayfrequenz, gewählter Host/Renderer samt
  Versionen (beim Default Electron/Chromium/Node/Pixi),
  Commit, Build-/Pakethash und Fixtures. Software-Rendering ausdrücklich benennen;
  es ist kein Nachweis hardwarebeschleunigter Leistung auf Aarons Gerät.
- Der Referenzrunner endet bei verfehltem Pflichtziel, fehlenden Samples oder
  fehlendem Szenario ungleich null. Maschinenabhängige Zeitziele gehören in die
  Referenzabnahme; CI prüft deterministische Struktur-/Budgetregeln zusätzlich.
  Fehlt eine geeignete native Referenz, bleibt die Zeitabnahme `blockiert`.

Frühe Teilprofile aus P0/P3 enthalten ein ausdrückliches Teilmengenmanifest und
erfüllen nur ihr jeweiliges Gate. Die endgültige Referenzabnahme verlangt alle
Szenarien und Unterfälle; fehlende spätere Werkzeuge dürfen darin nicht als
übersprungenes erfolgreiches Ergebnis erscheinen.

Die alte Vorher-/Nachher-Reihe mit drei Strichen und die vorhandenen
`targetsMet`-Berichte belegen diese Ziele nicht. P0a dient der kurzen Ursachen-
eingrenzung; eine vollständige vergleichende Benchmarkreihe gegen V7 ist optional.
Sie darf kein Altformat und keine zweite Runtime zum dauerhaften Produkt machen.

### Ein Szenarioablauf, zwei Prüfzwecke

Kurze Richtungsprobe und native Abnahme verwenden dieselben echten Eingaben,
Sollwerte und Inhaltsprüfungen. Sie unterscheiden sich nur im expliziten Umfang,
in Wiederholungen und erforderlicher Umgebung. Eine Auswahl darf niemals den
unabhängig festgelegten Umfang der endgültigen Abnahme verkleinern.

| Zweck                   | Umfang                                                                                                                | Erlaubte Aussage                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Auswerteränderung       | Vorhandene Journale plus gezielte fehlerhafte/unvollständige Eingaben                                                 | Auswertung korrekt; keine neue Produktmessung |
| Kurze Architekturprobe  | Vollständige relevante Bedienfolge, beide Pinsel, drei Quellgrößen, warmer/kalter Lastfall, passende Fehlerkontrollen | Strukturelle Richtung für genau diesen Umfang |
| Native Leistungsabnahme | Festes vollständiges Manifest und Stichprobe aus diesem Abschnitt                                                     | Leistungsziele des geprüften Umfangs erfüllt  |

**Ein Ablauf je Szenario:** Parameter für Pinselgröße, Last und Wiederholungen
statt gesonderter Pilot-/Serienimplementierungen. Der analytisch geprüfte einzelne
Dab bleibt eine sinnvolle Eingabeform; er ersetzt keinen bewegten Strich.
Räumlich getrennte Pixelproben bleiben erhalten. Bei Last dieselbe Eingaberoutine
in nachgewiesene echte Save-/Workerintervalle starten.

**Ein Ergebnis je Szenario:** Rohereignisse und Store-Aktivität einmal pro Prozess;
Versuche referenzieren Identitäten/Intervalle. Der Laufbericht enthält jedes
Szenario einmal. Nach Abschluss Ergebnis und Auswertung sichern; ein kleiner
Laufindex nennt geplant, abgeschlossen, fehlgeschlagen und nicht ausgeführt.
Bei Abbruch bleiben Teilbelege und fehlende Fälle erhalten. Keine vollständige
Ereignischronik in jedem Versuch und keine manuelle Berichtsrekonstruktion als Normalfall.

**Eine Auswertung:** Zweck und Scope, D11-Freigabesemantik, Inhaltsresultat, vorhandene Messwerte und
verbleibende Abnahme eindeutig unterscheiden. Gesammelt ist nicht bestanden.
Edit/Pointerup und warm/kalt getrennt auswerten; p95 nach Abschnitt 6 prüfen,
Einzelüberschreitungen zusätzlich ausweisen. Ein einzelner Wert über 50 ms ist
nicht dasselbe wie ein verfehltes p95-Ziel. Fehlende/falsche Zuordnung,
Ereignisverlust, Inhalts-/Budgetfehler scheitern; fehlende native Referenz oder
Präsentationszuordnung bleiben ausdrücklich blockiert. Beides kann zugleich vorliegen.
Vor Freigabe absichtlich abgewiesene Gesten, begründetes Coalescing und unter D10
verworfene Wartezeit sind keine erfolgreich dargestellten Änderungen und auch
nicht pauschal derselbe Fehler. Ihr jeweiliges Soll prüfen: vollständige
Eingabezuordnung, keine unerlaubte Wirkung, korrekte angenommene Dosis und
laufender Fortschritt nach Freigabe. Unbekannte Auslassungen oder verloren
gegangene angenommene Änderungen scheitern weiter. Eine Ladephase darf nicht
nachträglich um bereits angenommene, verspätet dargestellte Änderungen gelegt werden.

Eine kurze Probe beendet die Richtungssuche, wenn das entscheidende Verhalten
widerlegt ist; keine weitere identische Messgruppe ohne neue Hypothese starten.
Ein ausdrücklich angeforderter vollständiger Vergleich darf weiter sammeln,
muss erkannte Fehler aber unmittelbar melden. Verbindliche negative Kontrollen
für ignorierten Zoom, Pointerup-only, verzögertes/fehlendes Rendering und Erholung
bleiben erhalten; sie verwenden denselben primären Inhaltsprüfer.
Für D11 ergänzen: Daten fertig/Bild verzögert; alter Frame in neuer Ansicht;
frühe gehaltene Geste ohne Replay; schnelle Freigabe mit absichtlich langsamem
erstem Edit; fehlende dauerhafte Freigabe. Der normale Pfad muss sich jeweils
erholen. Vorhandene Tests erweitern, keine neue Runner- oder Berichtswelt bauen.

**Diagnose und Build:** Ausführliches Journal/Trace nur bei explizitem Diagnosestart.
Produktzustände sind davon unabhängig; Beobachtung setzt weder Bereitschaft noch
Renderabschluss. Keine durch Diagnose anwachsenden Vollkopien.
Produktpaket, Messprogramm und Fixture getrennt identifizieren.
Umgebungs-Vorprüfung vor teurer Fixtureerzeugung; nur benötigte Fixtures erzeugen,
unveränderte Basis pro Lauf wiederverwenden. Einen gebauten Stand einmal verwenden.
Keine automatische Dauersammlung derselben nicht zuordenbaren Chromium-Traces.

### Testarten und Befehle

Bestehende Vitest-/Playwright-Infrastruktur weiterverwenden. Für Desktopintegration
die gebaute Anwendung einschließlich Hostanbindung, Store und echten Dateien
starten. Beim Electron-Default die vorhandene Playwright-Electron-Anbindung
verwenden; bei einer Alternative deren reale native Anbindung nachweisen.
Deterministische Dateitests dürfen ausschließlich die OS-Dialogantwort ersetzen;
der nachfolgende Produktpfad bleibt echt. Sichtbare native Dialoge ergänzend bedienen.

Die folgende Tabelle beschreibt **neu herzustellende endgültige Befehle**:

| Befehl                                             | Verbindlicher Inhalt                                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                           | Reproduzierbare Installation einschließlich erforderlicher nativer Module für die gewählte Laufzeit; beim Electron-Default Native-Rebuild                                                           |
| `npm run desktop`                                  | Neuer regulärer Desktopeditor                                                                                                                                                                       |
| `npm run check:all`                                | Typen einschließlich Desktop/Worker, Fach-/Integrations-/Budgettests, Format, Produktionsbuild, Produkt-E2E und Desktopintegration; erforderliche Checks tatsächlich übernommener nativer Fachkerne |
| `npm run test:desktop`                             | Gebaute Anwendung des gewählten Hosts mit realer Prozessanbindung, SQLite und Dateirundlauf; beim Electron-Default echter Preload/IPC                                                               |
| `npm run package`                                  | Auslieferbares Linux/RPM erzeugen; bei Forge intern `make`, nicht nur `package`                                                                                                                     |
| `npm run test:package`                             | RPM inspizieren, in geeigneter Umgebung installieren und installierten Einstieg mit Dateirundlauf prüfen                                                                                            |
| `npm run perf:atlas -- --reference <profile.json>` | M01–M10 mit festgelegtem Profil und Szenarienmanifest erfassen, Pflichtwerte bewerten und bei Nichtbestehen fehlschlagen                                                                            |

Während der Umstellung bestehende sinnvolle Checks weiter ausführen. Sobald ein
alter Pfad tatsächlich ersetzt ist, seine Implementierungschecks durch die neue
Verhaltensabdeckung ersetzen. Aktive native Fachkerne und der gewählte Host behalten
ihre erforderlichen Checks. Keine dauerhaft grünen Prüfungen gegen ungenutzte Software.
CI bleibt auf den exakten Kandidaten gebunden und prüft Paketbau. Installation
und Hardwaremessung können eigene Umgebungen benötigen; fehlende Abnahmen offen
ausweisen, nicht als erfolgreichen Teil der CI interpretieren.

## 7. Arbeits- und Abnahmematrix

Nur Paketstatus und Verweise hier pflegen. Commit, Prüfzahlen, Messwerte und
konkrete Fehler stehen ausschließlich im [Status](status.md). Historische
Rohbelege werden nicht umgeschrieben.

| Paket | Umfang                                                                | Status / Nachweis                                                     |
| ----- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| K1–K6 | Begrenzte Konsolidierung aus Abschnitt 5.                             | Beauftragt; geprüfter Abschluss im Status.                            |
| P0    | Höhenversuch P0a–P0f, D10/D11 und native Höhenabnahme.                | Grundlage implementiert; Gate offen, genaue Fehler/Blocker im Status. |
| P1    | Gemeinsamer Kern für F01–F19, A02–A06/D01/D02.                        | Offen; benötigt P0-Gate.                                              |
| P2    | F19, A07 und vollständige Projektdateien.                             | Offen.                                                                |
| P3    | F01–F04/F18-Basis, Mehrskaligkeit, Konkurrenz, D03 und M10-Teilfälle. | Offen.                                                                |
| P4    | F04–F07, D01/D02 und komplette Flächenwerkzeuge.                      | Offen.                                                                |
| P5    | F08–F12/D04: Straßen, Parzellen und Außenhäuser.                      | Offen.                                                                |
| P6    | F02/F12–F14: hauslokale Innenräume.                                   | Offen.                                                                |
| P7    | F09/F16/F17/D03: Gewässer und Nachführung.                            | Offen.                                                                |
| P8    | F03/F15/F18: Regionen, Bedienung und Kartografie.                     | Offen.                                                                |
| P9    | F01–F19 integriert, M01–M10, RPM, Altpfadabbau und Doku.              | Offen.                                                                |

## 8. Definition von „erledigt“

- [ ] Ein wirksamer Zustand je Einstellung und ein genutzter Daten-/Renderpfad je
      Zweck; ersetzte APIs, Adapter, Schattenzustände und Spiegeltests entfernt.
- [ ] Ein Szenarioablauf und ein gespeichertes Ergebnis je Fall; kurze Probe und
      vollständige Abnahme verwenden dieselben Regeln. Teil-/Fehlerfälle werden
      sofort sichtbar, Diagnose belastet den normalen Produktstart nicht.
- [ ] F01–F19 vollständig auf dem neuen aktiven Pfad umgesetzt und geprüft;
      D01–D11 ausdrücklich im neuen Produktvertrag beschrieben.
- [ ] Eine abgeleitete lokale Freigabe verbindet tatsächlich dargestelltes Terrain
      und benötigte Quellen. Warte-/Fehlerzustand ist sichtbar; frühe Eingaben
      erzeugen weder unsichtbare Änderungen noch späteres Replay. Kurze gültige
      Klicks, Halten und fortlaufende Rückmeldung behalten ihre Wirkung.
- [ ] Welt→Raum→Welt, Grob-/Feinbearbeitung, Undo/Redo und Reopen funktionieren
      zusammen; die erste Demo wurde zum vollständigen Produkt ausgebaut.
- [ ] Kamerabewegung benötigt weder Quellenmutation noch synchronen Speicher-/
      Fachauftrag; normale lokale Werkzeuge erreichen den Zeitvertrag auch unter
      Hintergrundlast. Kalte Navigation erreicht sichtbare Bearbeitbarkeit und erstes
      exaktes Ergebnis innerhalb der M10-Grenzen.
- [ ] Reine lokale Reads warten nicht auf den Abschluss asynchroner Save-
      Dateioperationen; gespeicherter Snapshot, Sessiongrenzen und lokale Patches
      bleiben korrekt. Der Nachweis läuft über den echten Dispatcher.
- [ ] Sparse-Daten, räumliche Auswahl, begrenzte aktive Darstellung und
      Speicher-/Jobbudgets auch bei großen gespeicherten Welten nachgewiesen.
- [ ] M01–M10 und alle erforderlichen Fach-/Fehler-/Dateifälle am endgültigen
      Stand verifiziert; Messfehler oder fehlende Werte führen zentral zu Fehler.
- [ ] Neue Desktopanwendung regulärer Einstieg; gebautes RPM installiert und
      ohne Entwicklungsserver bedient, echte Dateiabläufe und Dialoge geprüft.
- [ ] Tatsächlich ersetzte Host-/Rust-Dokument-/Canvas-/JSONL-Pfade und ihre
      ungenutzten Abhängigkeiten entfernt; nach A01/A08 bewusst gewählte aktive
      Module geprüft. Keine dauerhafte Übergangsdoppelarchitektur.
- [ ] README, Architektur, Produktvertrag, aktueller Status und dieser Plan
      widersprechen sich nicht; Rohbelege bleiben außerhalb der Produktdokumente.
- [ ] Repo-Gates am aktuellen Kandidaten erfüllt und reguläre Integration abgeschlossen.

Eine externe Integrationsblockade lässt dieses letzte Kriterium sowie P9 und den
Gesamtauftrag offen beziehungsweise `blockiert`. Der Kandidat kann trotzdem als
vollständig implementiert und geprüft bezeichnet werden; der Gesamtauftrag ist
damit noch nicht erledigt.

Fehlende native Umgebung oder nicht herstellbare Präsentationszuordnung bedeutet
`blockiert`; ein gemessen verfehltes Inhalts-, Budget- oder Zeitziel bedeutet
`FAIL`. Beide Zustände können zugleich bestehen. Keiner bedeutet „fertig, nur
noch manuell testen“. Nach bestandenen Kriterien abschließen, ohne weitere
optionale Features oder Optimierungsrunden anzuhängen.

## 9. Quellen und Lesereihenfolge

### Repository

1. [AGENTS.md](../../AGENTS.md): Daten-/Kompatibilitäts- und Dokumentationsregeln.
2. [README](../../README.md): aktuelle Befehle und Auslieferung.
3. [Produktvertrag](../product-contract.md): aktuelles beobachtbares Verhalten.
4. [Architektur](../architecture.md): aktuelle Besitzer und ersetzte Pfade.
5. [Status](status.md): aktueller Prüfstand und nächste Übergabe.
6. [Unveränderlicher Ausgangsvertrag](https://github.com/ThonkTank/Salt-Marcher/blob/1bb3932fcffcb2d5fea47fae616c3b69489443bc/docs/product-contract.md): Inventar für F01–F19, auch nachdem die aktuellen Docs umgestellt wurden.

### Primärquellen für Ansatz und Auswahl

Am 8. November 2026 geprüft; bei P0 die konkret verwendeten Versionen abgleichen.
Diese Quellen belegen Bibliotheksfunktionen, keine SaltMarcher-Latenzen.

- [PixiJS-Renderer](https://pixijs.com/8.x/guides/components/renderers) und
  [Culling](https://pixijs.com/8.x/guides/components/application/culler-plugin).
- [PixiJS: Render Groups](https://pixijs.com/8.x/guides/concepts/render-groups) und
  [Performancehinweise](https://pixijs.com/8.x/guides/concepts/performance-tips):
  wiederverwendbare Darstellung und eigene Verantwortung für Arbeitsgrenzen.
- [OpenLayers: ebene Bildkoordinaten](https://openlayers.org/en/latest/examples/static-image.html),
  [WebGL-Kacheln](https://openlayers.org/en/latest/examples/webgl-tiles.html) und
  [MapLibre: experimentelle eigene Koordinatensysteme](https://maplibre.org/maplibre-gl-js/docs/guides/custom-crs/):
  Vergleichsmöglichkeiten, keine Empfehlung für einen zusätzlichen Produktionspfad.
- [Tauri-Prozessmodell](https://v2.tauri.app/concept/process-model/):
  plattformeigene Webviews und alternative Hostanbindung.
- [Electron-Prozessmodell](https://www.electronjs.org/docs/latest/tutorial/process-model),
  [Utility-Prozess](https://www.electronjs.org/docs/latest/api/utility-process),
  [Performance](https://www.electronjs.org/docs/latest/tutorial/performance) und
  [native Node-Module](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).
- [Electron-Sicherheitsgrenzen](https://www.electronjs.org/docs/latest/tutorial/security).
- [Electron Forge: RPM](https://www.electronforge.io/config/makers/rpm) und
  [Konfiguration/Rebuild](https://www.electronforge.io/config/configuration).
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) und
  [Workerhinweise](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/threads.md).
- [JSTS](https://github.com/bjornharrtell/jsts), [Module](https://bjornharrtell.github.io/jsts/index_modules.html)
  und [RBush](https://mourner.github.io/rbush/).
- [Playwright: Electron](https://playwright.dev/docs/api/class-electron).
- [Geometry Clipmaps](https://hhoppe.com/proj/geomclipmap/): Hintergrund zu
  begrenzten mehrstufigen Darstellungen; kein vorgeschriebener 3D-Renderer.
