# Atlas-Neubau: ausführbarer Implementierungsplan

Stand: 8. November 2026. **Planung abgeschlossen; Implementierung noch nicht begonnen.**

Ausgangsstand: `1bb3932fcffcb2d5fea47fae616c3b69489443bc` auf `main`.
Dieser ausdrücklich angeforderte, versionierte Arbeitsauftrag beschreibt den
Zielzustand. Er ist kein Nachweis bereits implementierter Funktionen oder gemessener
Beschleunigung. Der aktuelle Produktvertrag steht weiterhin in
[product-contract.md](../product-contract.md).

## 1. Auftrag und Ausführung

Ein Agent, der auf diesen Plan mit **„erledige das“** verwiesen wird, soll den
beschriebenen Neubau vollständig implementieren, integrieren und prüfen. Das Ziel
ist der regulär gestartete und auslieferbare SaltMarcher-Editor, nicht eine Demo,
ein weiterer Analysebericht oder eine dauerhaft parallele Experimentieransicht.

### Ziel

Eine gemeinsame flache Weltkarte lässt sich vom Raum bis zur Welt stufenlos
navigieren und mit dem vereinbarten Funktionsumfang bearbeiten. Kamera und
gewöhnliche lokale Bearbeitung reagieren unmittelbar. Weltweite Datenhaltung,
Speichern und aufwendige Generierung verursachen keine regelmäßigen mehrsekündigen
Bedienpausen. Die Arbeit einer normalen Interaktion hängt überwiegend vom
sichtbaren beziehungsweise bearbeiteten Ausschnitt ab.

### Arbeitsregeln für den ausführenden Agenten

1. `AGENTS.md`, die vier kanonischen Dokumente und diesen Plan lesen. Arbeitsbaum,
   Branch und aktuellen Head feststellen. Fremde Änderungen erhalten. Gegenüber
   dem Ausgangsstand hinzugekommene aktive Funktionen in F01–F19 einordnen; den
   Auftrag nicht ungefragt auf die ursprüngliche Teilmenge verkleinern.
2. Die Entscheidungen D01–D09 und A01–A10 bilden die Zielvorgabe. Die alte
   Implementierung ist Quelle für Fachverhalten und Testfälle, kein Architekturzwang.
   Gewöhnliche Implementierungsentscheidungen selbst treffen. Nur nachgewiesene
   Widersprüche oder echte fehlende Zugriffe als Blocker behandeln.
3. P0–P9 entlang ihrer Abhängigkeiten bearbeiten. Große Pakete intern in kleine
   überprüfbare Änderungen teilen. Unabhängige Fachpakete können an Subagenten
   gehen; gemeinsame Verträge, Integration und endgültige Abnahme haben einen
   verantwortlichen Hauptagenten.
4. Nach einem bestandenen Zwischenziel automatisch mit dem nächsten offenen
   Paket fortfahren. Das erste vollständige Beispiel aus P3 ist eine technische
   Freigabe für den weiteren Ausbau, nicht das Ende dieses Auftrags.
5. In der Arbeitsmatrix nur `offen`, `umgesetzt, ungeprüft`, `verifiziert` oder
   `blockiert` verwenden. Prüfbelege an den tatsächlich geprüften Commit binden.
   Nach relevanten Änderungen betroffene Belege erneut prüfen. Fehlende native
   Messungen, übersprungene Tests und bloße Cursorvorschauen sind kein Abschluss.
6. Rohmessungen, Screenshots und Zwischenberichte ignoriert unter
   `artifacts/atlas-rebuild/<run>/` speichern; diesen Pfad in P0 ignorieren.
   Keine zusätzlichen Status-, Architektur- oder Fortschrittsdokumente anlegen.
   Den aktuellen Übergabestand in `docs/implementation/status.md` ersetzen.
7. Nach vollständiger Prüfung die normale Repo-Integration erledigen. Bestehende
   Branchregeln und den erforderlichen Check `Candidate · exact-SHA aggregate`
   einhalten. Keine Schutzregeln ändern, Prüfungen abschalten oder veraltete
   Ergebnisse als Freigabe eines neuen Heads verwenden.
8. Bei einem echten Blocker dessen Ursache, betroffene Kriterien, bereits
   erledigte unabhängige Arbeit und einen reproduzierbaren nächsten Schritt
   festhalten. Keine Implementierung durch eine neue Planung ersetzen und keine
   routinemäßige Zwischenabnahme durch Aaron verlangen.

### Umfang und Nichtziele

Der aktive Produkteinstieg enthält am Ausgangsstand ausschließlich Atlas. F01–F19
unten sind vollständig umzusetzen, mit den ausdrücklich beschriebenen Änderungen
D01–D09. Der Stil bleibt eine lesbare, stilisierte Fantasykarte.

Nicht Teil des Neubaus sind neue Encounter-/Lootfunktionen, ein Globus, 3D,
Mehrbenutzerbearbeitung, Cloud-Synchronisierung, Kartenexport als PNG/PDF/SVG,
Assetimporte, Möblierung, ein neues Zentimeterraster, neue komplexe Dachtypen oder
ein zusätzlicher Stadtgenerator außerhalb der vorhandenen Straßenbebauung.
Einzelbaumverschiebung war im Entwurf ein Beispiel für später mögliche lokale
Ausnahmen; sie ist kein zusätzliches Werkzeug dieses Auftrags. Die vorhandenen
Landschaftsdeckungen und Lichtungen bleiben dagegen Pflichtumfang.

Laut `AGENTS.md` bestehen keine zu erhaltenden Produktionsdaten. Neue Fixtures
und ein neues Dateiformat sind erlaubt; Migrationen und Altformatadapter sind
nicht erforderlich. Keine Nutzerdateien automatisch löschen oder überschreiben.

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

## 3. Architekturentscheidungen

### A01 — Technische Grundlage und wenige Besitzer

Ziel: TypeScript, React für Panels, PixiJS 8 mit ausdrücklich gewähltem WebGL-
Renderer, Electron als Desktopumgebung, SQLite über `better-sqlite3` in einem
eigenen Utility-Prozess. Electron Forge baut mindestens Linux/RPM. Passende stabile
Versionen in P0 anhand der Primärquellen prüfen, zusammen auswählen und im Lockfile
festhalten; nicht während des Umbaus nebenbei große Versionssprünge durchführen.

Es gibt genau diese fachlichen Zuständigkeiten, keine generische Serverarchitektur:

| Besitzer                              | Darf                                                                                                 | Darf nicht                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `EditorDocument` im Renderer          | Aktive Quellen, geordnete Änderungen, Gesten, Auswahl, History und Versionsstand besitzen            | Eine vollständige hochaufgelöste Welt im RAM voraussetzen                                     |
| `WorldRenderer` mit Pixi              | Aktuelle Kamera und begrenzte sichtbare Darstellung zeichnen                                         | Autoren verändern oder eine globale Bearbeitungsfreigabe bestimmen                            |
| `JobScheduler` mit Hintergrundworkern | Unveränderliche Eingaben bearbeiten; versionierte Darstellungsdaten oder Änderungsvorschläge liefern | Ein zweites unabhängig veränderliches Dokument besitzen                                       |
| `ProjectStore` im Utility-Prozess     | Arbeitskopie, räumliche Reads, geordnete Persistenz und Dateigrenzen ausführen                       | Fachentscheidungen in einer zweiten Implementierung nachrechnen oder den UI-Thread blockieren |

Electron Main besitzt nur Fenster, Dialoge, Prozesslebenszyklus und die schmale
Anbindung. Renderer: `contextIsolation: true`, kein direkter Node-/Dateisystemzugriff,
lokale Ressourcen und begrenzte Preload-API. SQLite und Generatoren laufen weder
im Renderer noch im Main-Prozess. Native SQLite-Abhängigkeit früh gegen die
tatsächliche Electron-ABI bauen und im installierten Paket prüfen.

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

### A03 — Zusammensetzung der Quelldaten

- Höhe: Grundhöhe plus Summe vorhandener relativer Detailfelder. Die positive
  kubische Höhenrekonstruktion aus V7 als reine TypeScript-Funktion übernehmen
  und für Abfragen, Küste und Darstellungsaufbereitung gemeinsam verwenden.
  Keine zweite angenäherte Oberflächenmathematik für den Editor.
  Die zusammengesetzte natürliche Höhe einmal auf ±100.000 Fuß begrenzen;
  Residuen als endliche Differenzen validieren, nicht als absolute Höhen.
  An dieser Grenze kann relative Detailtiefe
  gesättigt werden. Dafür keine feinen Nachfahren prüfen oder umschreiben.
- Farbe: je Boden/Fels eine lokale Maske und vormultiplizierte RGBA-Werte.
  Landschaft: Maske plus vier normierte Gewichte. Fehlender Autor erbt; eine
  explizite transparente Farbe beziehungsweise leere Landschaft unterdrückt
  den gröberen Wert. Maske und Farbalpha sind nicht dasselbe.
- Beim Feinmalen vor der Änderung den gültigen geerbten Wert bestimmen.
  Pinseloperation auf der gewählten Autorenstufe ausführen. Höhendelta gegen
  deren gröbere Basis berechnen; feinere Ebenen bleiben unberührt.
- Große Form ändern und lokale Details behalten ist der Standard. Einebnen
  betrifft zunächst die gewählte Formstufe. Vollständiges Einebnen oder Entfernen
  aller lokalen Ausnahmen verwendet die ausdrücklich bezeichnete Bereichsaktion.
- „Lokale Details zurücksetzen“ trifft nur die gewählten Felder im Bereich,
  keine Häuser, Räume oder Straßen. Es erzeugt begrenzte Undo-Patches und darf als
  größere Hintergrundaufgabe laufen. Eine übergroße atomare Aktion verständlich
  ablehnen; nicht still in unwiderrufliche Teillöschungen zerlegen.
- Abgeleitete Übersichtsbilder dürfen nie zurück in grobe Autorenwerte fließen.
  Feine Änderungen invalidieren nur ihre Darstellung und betroffene Vorfahren.
  Grobe Änderungen erhöhen eine Quell-/Vorfahrenversion; keine Enumeration oder
  Neuberechnung sämtlicher feiner Nachfahren. Sichtbare Nachfahren werden bei
  Verwendung anhand ihrer Abhängigkeiten erneuert.
- Landschaft bleibt Dichte plus reproduzierbare ortsfeste Kandidaten. Nur
  sichtbare Kandidaten erzeugen. Entfernte Wälder werden ohne Einzelbäume aus
  Deckung dargestellt. Hausinnenräume werden unabhängig vom Außenheader geladen.

### A04 — Aktive Daten, räumliche Suche und Ladezustände

Ein `EditorDocument` besitzt die aktuell bearbeiteten Quellen und noch nicht
persistierte Änderungen. Bereits bestätigte entfernte Quellen liegen in der
Arbeitsdatenbank. Geladene unveränderte Daten dürfen verdrängt werden; nicht
bestätigte Änderungen, aktive Gesten und notwendige Undo-Vorherwerte bleiben
gehalten oder liegen in der dafür vorgesehenen temporären Historyablage.

Quellen haben mindestens `unknown`, `loading`, `ready`, `absent` und `error`.
`absent` ist eine bestätigte Abwesenheit; ein Cachemiss ist kein Ozean und kein
leeres Haus. Vor exakter Bearbeitung müssen die betroffenen Quellen, benötigte
Eltern/Halos sowie relevante Kollisions-/Ownerdaten vorliegen. Diese Bedingung
ist lokal. Fehlende entfernte Bildschirmkacheln sperren keine bereite Pinselstelle.

Sichtbaren Bereich und einen kleinen Navigationsrand vorladen. Bei kalter
Bearbeitungsstelle eine erkennbare Ladeanzeige geben. Höhen-, Boden- und
Landschaftspinsel dürfen einen ausdrücklich als ausstehend markierten, begrenzten
Pfad halten und nach Vorliegen ihrer Quellen ausführen; Abbruch und Dokumentwechsel
widerrufen noch nicht angenommene Arbeit. Haus-/Raumgesten ohne erforderliche lokale
Szenen-/Belegungsgrundlage beginnen dagegen nicht und werden später nicht überraschend
nachgeholt. Die revisionsgleiche zusätzliche Offscreen-Ownerauflösung einer bereits
zulässigen Hausgeste bleibt erlaubt. Kein unbegrenztes Sammeln und keine stille
Interpretation unbekannter Quellen als leer.

SQLite-RTree und abgeleitete räumliche Indizes begrenzen Quellenreads. Für aktive
Geometrien einen kleinen RBush-Index einsetzen. Objektliste, Auswahl, Labels und
Kollision dürfen nicht alle Weltobjekte laden. Große Übersichten verwenden
vorbereitete Dichte-/Geometrieübersichten; ausgewählte Straßen/Flüsse laden ihren
exakten Header. Vereinfachte Übersichtspunkte werden niemals bearbeitet.

### A05 — Befehle, Gesten und direkte Bearbeitung

Gemeinsame Typen unter `src/editor/model/` definieren, beispielsweise:

```ts
type SourceKey = string; // validierter Quellen- oder räumlicher Abfrageschlüssel
type SourceStamp = { key: SourceKey; revision: number };
type ChangeSet = {
  label: string;
  expected: SourceStamp[];
  patches: SourcePatch[]; // genaue Vorher-/Nachherwerte, auch Abwesenheit
  dirtyBounds: Bounds[];
};
type JobInput = {
  sessionId: string;
  requestId: string;
  inputs: SourceStamp[];
  payload: ImmutableJobPayload;
};
```

Dies sind Zielverträge; die endgültigen Typen müssen auch Session, Quellidentität,
Abwesenheit und zusammengesetzte Änderungen eindeutig abbilden. Alle normalen
Werkzeuge verwenden dieselben reinen Fachfunktionen und denselben Übernahmepfad.
Keine parallele Vorschau-/Commit-Mathematik und keine pro Werkzeug gebauten Queues.

- Kamera und hochfrequente Pointerzustände außerhalb von React-State verwalten.
  Eingaben pro Frame bündeln; den räumlichen Pinselpfad und bei Farbfluss die Zeit
  erhalten. Nur ersetzbare Darstellungs-/Vorschauaufträge dürfen `latest wins` sein.
- Eine aktive Geste hält Originalwerte und geänderte Bereiche. Kleine Änderungen
  an bereitliegenden Quellen sind sofort exakt und sichtbar. Punktbewegungen
  validieren lokal; große Geometrie-/Netzoperationen werden Hintergrundaufgaben.
- **Höhen:** Loslassen, Escape, Blur, Werkzeugwechsel oder Pointerabbruch beenden
  und behalten den übernommenen Strich; ein Undo entfernt ihn. Fehler behalten
  nur bereits gültig übernommene Teile als genau einen rückgängig machbaren Strich.
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

### A06 — Hintergrundarbeit und Darstellung

Worker erhalten unveränderliche Eingaben samt Session und Quellversionen.
Jobresultate enthalten geprüfte Abhängigkeiten und entweder Darstellungsdaten
oder einen `ChangeSet`. Nur `EditorDocument` übernimmt Autorenänderungen.
Readsets umfassen auch Abwesenheits- und räumliche Abfragen: Neu hinzugekommene
Objekte oder Kacheln im gelesenen Bereich invalidieren ein Ergebnis ebenso wie
veränderte bereits vorhandene IDs. Bereichsversionen oder eine begrenzte erneute
Abfrage verhindern, dass beispielsweise ein inzwischen gebautes Haus bei der
Kollisionsprüfung eines alten Vorschlags fehlt.
Reads aus der Arbeitsdatenbank müssen zusätzlich die noch nicht dort bestätigten
Änderungen des aktiven Dokuments berücksichtigen. Der Bestätigungsstand der
Arbeitskopie ersetzt nicht den aktuellen Bearbeitungsstand.
Unabhängige Änderungen in anderer Region müssen einen passenden Auftrag nicht
verwerfen; geänderte Eingabequellen und Sessionwechsel tun es.

Priorität: aktueller Bearbeitungsbedarf, sichtbare Darstellung, Navigationsrand,
entfernte Übersichten. Maximal zwei rechenintensive Jobs gleichzeitig; ein eigener
Speicherprozess. Veraltete Renderaufträge vor Ausführung entfernen, große Aufträge
kooperativ unterbrechen. Ergebnisse und Texturuploads pro Frame begrenzen.
Transfer nur eigener Ergebnisbuffer; keine kanonischen Arrays versehentlich durch
`transfer` aus dem Dokument abtrennen. Kein Base64 für interne Pixelkommunikation.

Pixi erhält nur aktive Kacheln und relevante Objekte. Kameraändert nur deren
Transformation; kein Durchlauf über sämtliche Weltobjekte, keine neue
Flächenrasterung und kein Persistenzaufruf vor dem Kameraframe. Bisherige gröbere
Darstellung bleibt verfügbar, bis passende Details eintreffen. Dokumentwechsel
darf niemals Bilder der vorherigen Welt als Inhalt der neuen Welt zeigen.

Quellgültigkeit und Darstellungsaktualität bleiben getrennt. Eine ersetzte Textur
darf als Übergang dienen, aber nicht Quelle für Picking, Pipette oder neue
Fachänderungen sein. Abhängige Material-/Höhen-/Wasserschichten gemeinsam versioniert
komponieren oder den Zwischenstand sichtbar als noch nicht aktuell behandeln.

### A07 — Arbeitskopie, Projektdatei und Fehler

- Neues Projekt beginnt in einer temporären SQLite-Arbeitskopie. Abgeschlossene
  Aktionen erhalten eine Sequenznummer und werden in Reihenfolge transaktional
  geschrieben. Die Bestätigung benennt die letzte gesicherte Arbeitssequenz.
- Projektdatei bleibt `.saltatlas`; neue eindeutige Versionskennung, am
  Ausgangsstand Format 23 statt 22. Bei später geänderter Basis nächste freie
  Version wählen. Schema umfasst Metadaten/Versionen, Quellkacheln mit Masken,
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

### A08 — Fachkerne wiederverwenden, alte Laufzeit ersetzen

Den hauslokalen Solver aus `src-tauri/src/interior/` als reine TypeScript-
Funktionen nach `src/interior/` portieren. Seine Verhaltenstests sind Referenzen
für Identitäten, Raumteilung/-vereinigung, Türen und Treppen. Er bleibt frei von
SQL, Kamera, Weltkoordinaten und Electron.

Für Polygon-Union, Difference, Intersection und Buffer eine bewährte Bibliothek
hinter einem kleinen Adapter verwenden: JSTS. Lokale Ursprungsverschiebung,
Toleranzen, Ringkanonisierung und Kollisionsverträge aus den vorhandenen
Parzellen-/Regionstests beibehalten. RBush dient der aktiven räumlichen Suche.
Keine eigene allgemeine Geometrieengine und kein neues Plugin-/ECS-Framework bauen.

Straßen, Bebauung, Flüsse und Gewässer als reine Fachfunktionen portieren;
aufwendige Aufrufe im Worker ausführen. Seed und Rezept bestimmen reproduzierbare
Ergebnisse; bestehende Häuser werden durch neue Varianten nicht neu gewürfelt.
Während des Ports darf der alte Kern isolierte Referenzfälle liefern. Er bleibt
nicht als zweiter autoritativer Dokumentserver hinter den neuen Werkzeugen aktiv.

### A09 — Budgets und Überlastverhalten

Startwerte zentral unter `src/editor/budgets.ts` definieren und messen:

| Ressource                    | Anfangsbudget / Regel                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| CPU-Quellenarbeitsmenge      | 256 MiB einschließlich gehaltenem Bearbeitungsrand; gesonderte Zählung noch nicht bestätigter Patches |
| CPU-Darstellungen            | 128 MiB einschließlich laufender Resultate; keine zweite unbegrenzte Kopie neben dem Cache            |
| GPU-Texturen/Geometrie       | 256 MiB, einschließlich alter noch gezeichneter und neuer hochgeladener Ressourcen                    |
| History im RAM               | 128 MiB, zusätzlich maximal 100 Aktionen; größere erlaubte Deltas in temporärer Ablage                |
| Ausstehende Schreibdaten     | 32 MiB; vor weiterer ungesicherter Annahme begrenzen, keine Daten verlieren                           |
| Rechenjobs                   | höchstens zwei aktiv, wartende ersetzbare Arbeit nach aktueller Sicht priorisieren                    |
| Aufnahme fertiger Ergebnisse | zunächst höchstens 2 ms CPU-Arbeit und 4 MiB Texturupload je Frame; Rest später                       |
| Landschaftssymbole           | höchstens 16.384 Kandidaten einschließlich Überblendung/Rand                                          |
| Beschriftung                 | höchstens 3.000 priorisierte Kandidaten, 500 sichtbare kollisionsfreie Labels                         |

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

| Zielpfad                                                 | Inhalt                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/editor/model/`                                      | Koordinaten, Quellen, Objekte, Surface-Sampler, Änderungen, History und gemeinsame Typen |
| `src/editor/tools/`                                      | Gesten und Fachoperationen; eine gemeinsame Übernahmegrenze                              |
| `src/editor/render/`                                     | Pixi-Kamera, aktive Szene, Kacheln, Geometrie, Labels und Werkzeuganzeigen               |
| `src/editor/jobs/`                                       | Versionierte Aufgaben, Scheduler und reine Worker-Einstiege                              |
| `src/editor/ui/`                                         | React-Panels und Verbindung zum Editor; vorhandene passende UI übernehmen                |
| `src/interior/`                                          | Reiner lokaler Innenraumsolver mit Verhaltenstests                                       |
| `desktop/`                                               | Electron Main/Preload, Store-Utility-Prozess, Dateiabläufe, Buildanbindung               |
| `tests/product/`, `tests/desktop/`, `tests/performance/` | Verhaltens-, echte Desktop- und Leistungsszenarien                                       |
| `scripts/atlas-performance.mjs`                          | Reproduzierbarer Referenzrunner mit fehlerschließendem Ergebnis                          |

Dies sind gezielte Modulgruppen, keine Aufforderung für jede Tabellenzeile eine
generische Abstraktionsschicht zu bauen. Am Ende startet `src/main.tsx` den neuen
Editor. Tauri, `src/atlas/`, Rust-Dokumentworker, generierte Rust-Transporttypen,
JSONL-Testbridge und alte Buildpfade entfallen, soweit ihre Verbraucher ersetzt
sind. Vorher nützliche reine Hilfen übernehmen. Kein dauerhaftes `old/new`-Flag,
kein zusätzlicher Produktionsweg und keine ungenutzten Altprüfungen im Gesamtgate.

## 4. Verbindliche Funktionsmatrix

Die Abschnitte des [Produktvertrags am Ausgangsstand](https://github.com/ThonkTank/Salt-Marcher/blob/1bb3932fcffcb2d5fea47fae616c3b69489443bc/docs/product-contract.md)
enthalten die detaillierten Fachfälle. F01–F19 werden über die Pakete verteilt;
D01–D09 überschreiben nur ihre ausdrücklich genannten Punkte. Pfade in der
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

Reihenfolge: **P0 → P1 → P2/P3 → P4 → P5/P6/P7/P8 → P9**.
P3 verlangt P2 für seinen vollständigen Datei-Rundlauf. P6 kann seinen reinen
Innenraumkern parallel zu P5 vorbereiten, braucht dessen Häuser für UI-Abnahme.
P5/P7 stimmen den gemeinsamen Surface-/Wasservertrag aus P1 ab; P8 verwendet
denselben Geometrieadapter. Parallelisierung darf keine verschiedenen Dokument-
oder Undo-Implementierungen erzeugen.

### P0 — Ausgangsvertrag, Arbeitszweig und echte Laufzeit

**Lieferung:** reproduzierbarer neuer Desktoprahmen und eindeutiger Arbeitsstand.

1. Aktuellen Ausgangsstand und F01–F19 prüfen, D01–D09 im Arbeitsstand festhalten.
   Bestehende Fehler/fehlende Nachweise nicht als neue Regressionen oder Erfolge
   ausgeben. Keine weitere offene Grundsatzrecherche an die Stelle dieses Plans setzen.
2. Arbeitszweig anlegen, Abhängigkeiten pinnen, `desktop/` und Forge integrieren.
   Browserrenderer ohne Vite im gebauten Electron starten. SQLite-Utility-Prozess,
   Preload und Icons tatsächlich paketieren; Native-ABI prüfen.
3. Minimalen Pixi-WebGL-Canvas mit Kamera und einer realen SQLite-Lese-/Schreibprobe
   in der gebauten Anwendung betreiben. OS-Dialoge und Fensterminimum anbinden.
4. Artefaktpfad ignorieren und Beobachtung für Eingabesequenz, Kamera-/Quellversion,
   gerenderten Stand, Jobs, Cachebytes und Speicherbestätigung vorbereiten.
5. Node-Pinning in `.node-version`, `package.json`, CI und README konsistent
   machen. Nicht ungeprüft behaupten, Host-Node sei Electrons eingebettetes Node.

**Gate:** gebautes Electron startet, nutzt WebGL, lädt seinen echten Preload und
SQLite-Treiber und führt eine Datei-Schreib-/Leseprobe aus. Kein Browsermock als
Ersatz. Noch keine Behauptung vollständiger Performance oder Produktparität.

### P1 — Quellen, Geometrie, Befehle und Versionsgrenzen

**Abhängigkeit:** P0. **Lieferung:** gemeinsamer neuer Fach-/Dokumentkern.

1. A02/A03 implementieren: Sparse-Kacheln, Masken, Höhenresiduen, Source-Sampler,
   Nachbar-/Haloregeln, Ursprungstransformation und eindeutige Abwesenheit.
2. Objektheader, lokale Innenpayloads und räumliche Suche definieren. JSTS/RBush
   hinter kleinen Adaptern anbinden; bestehende Grenz-/Kollisionsfälle übertragen.
3. `EditorDocument`, Gestenpatches, atomare `ChangeSet`-Übernahme, monotone IDs,
   Undo/Redo und Quellversionen implementieren. Keine SQL-Fachlogik im Renderer.
4. Quellen- und Darstellungsinvalidierung trennen. Grobe Änderung ohne
   Nachfahrenscan und feine Änderung mit begrenzten Übersichtsvorfahren beweisen.
5. Jobverträge und Scheduler einschließlich Sessionwechsel, Stale-Readsets,
   Abbruch, Priorität und begrenzten Arrays/Resultaten implementieren.

**Gate:** Tests für negative Kachelkoordinaten/Ränder, fehlend versus explizit
leer, Grob-/Fein-Semantik, Reihenfolge/No-op/Undo, stale Jobs und Offscreen-Daten.
Eine leere Welt legt keine Quellenkacheln an. Keine doppelte writable Welt im Worker.

### P2 — Arbeitskopie und vollständige Dateiabläufe

**Abhängigkeit:** P1. **Pflichtumfang:** F19-Grundlage.

1. Neues Schema und binäre Kachel-/Innenpayloads mit vollständiger Validierung
   implementieren; Arbeitsdatenbank und Projektdatei trennen. Räumliche Indizes
   aus Quellen pflegen. Reopen darf kein globales Detailraster materialisieren.
2. Sequenzierte persistierte Aktionen, bestätigte Abwesenheitsreads und lokale
   Quellvorladung integrieren. Fehler-/Crashabgleich ohne Doppelanwendung prüfen.
3. Neu, Öffnen, Speichern, Speichern unter und Schließen einschließlich realer
   Dialoge, Dirty-Status und Save/Discard/Cancel umsetzen.
4. Konsistenten Save-Snapshot S unter weiterlaufender Navigation und Änderungen
   prüfen. Fehlerfälle in isolierten Testdateien: Disk-/Writefehler, abgebrochener
   Dialog, beschädigte Datei, Workerabbruch und Dokumentwechsel.
5. Innenraum- und Objektpayloads selektiv laden; Historyspooling und Backpressure
   ergänzen, bevor große Fixtures verwendet werden.

**Gate:** echtes Desktopprojekt erstellen → ändern → speichern → Anwendung
beenden → identisch wieder öffnen. Alte Datei bleibt bei Fehler erhalten;
nach S akzeptierte Änderungen bleiben dirty. Grobe und feine Quellen überleben
den Rundlauf. Falsche Formatversion wird ohne Teilübernahme abgewiesen.

### P3 — Durchgehendes, messbares Welt-bis-Haus-Beispiel

**Abhängigkeiten:** P1, für Abschluss P2. **Pflichtumfang:** F01–F04 und F18-Basis.

1. Pixi-Szene mit begrenzten aktiven Kacheln, Kameraanker, 14 Ansichten,
   Kontextnavigation, DPR/Resize und getrenntem Werkzeugoverlay implementieren.
2. Übersicht, Nachladen, gröbere Übergangsdarstellung, Auswahl und exakten
   Headerread verbinden. Kein globales `fresh=false` als Sperre aller Werkzeuge.
3. Je einen echten Höhen- und Landschaftspinsel sowie ein einfaches Hausobjekt
   durch den gemeinsamen Pfad führen, einschließlich Undo und Projektdatei.
4. Folgendes End-to-End-Beispiel automatisieren: große Landform → weit entferntes
   Dorf → feiner Graben/Lichtung/Haus → Weltansicht → Region anheben/Walddichte
   ändern → zurück → Details prüfen → Undo/Redo → Save/Restart/Reopen.
5. M01 vollständig sowie die Kernanteile von M02–M04 und die Arbeitsbudgets
   messen: Navigation bis Raummaßstab, Höhe, Landschaft, einfaches Haus,
   Grob-/Feinfolge und Dateirundlauf. Bodenpinsel und Straßenpunktbewegung folgen
   in P4/P5; vollständige Innenräume und deren Picking in P6. Diese frühen
   Teilmessungen ausdrücklich als solche kennzeichnen. Navigation bei
   ausstehenden Reads, Speichern und langsamer Hintergrundaufgabe prüfen.

**Gate:** dieses Beispiel läuft in der gebauten Desktopanwendung mit echten
Quellen. Leere Navigation und die hier implementierten lokalen Änderungen
erreichen die Referenzziele; strukturelle Budgets bestehen. Das Gate verlangt
keine erst später implementierten Werkzeuge. Bei Verfehlung dieses Paket beheben,
bevor weitere Werkzeuge den Kern vergrößern. Danach P4–P9 ausführen.

### P4 — Vollständige Terrain-, Farb- und Landschaftswerkzeuge

**Abhängigkeit:** P3. **Pflichtumfang:** F04–F07.

1. Alle Höhenmodi, Küstenrauheit und Reliefvorlagen mit dem gemeinsamen Sampler
   portieren. Strichabtastung und Haltverhalten unabhängig von Ereignisrate prüfen.
2. Boden/Fels mit Spitzen, zeitlichem Fluss, Pipette, Radierer, Masken sowie
   Material-/Schneeanzeige umsetzen. Abbruch setzt denselben Quellenstand zurück.
3. Vier Landschaftsgewichte, Zieldichte, Lichtungen, ortsfeste Kandidaten und
   überlappende Darstellungsbänder umsetzen. Keine Einzelbaum-Weltmaterialisierung.
4. D01/D02 einschließlich ausdrücklichem Detailzurücksetzen und vollständigem
   Einebnen implementieren. Vorschau nennt betroffenen Bereich und Felder.
5. Naht-/Halo-, negative Koordinaten-, Weltrand-, große Pinsel-, Hold-/Cancel-,
   History- und Persistenzfälle auf den tatsächlichen neuen Pfad übertragen.

**Gate:** alle Pinselmodi auf kleinem und großem Maßstab bedienbar; normaler
Strich zeigt innerhalb des Ziels die echte Änderung. Grobe Bearbeitung berührt
keine feinen Nachfahren; Lichtungen und relative Gräben bleiben erhalten.

### P5 — Straßen, Parzellen, Bebauung und Außenhäuser

**Abhängigkeit:** P3/P4; Wasseranbindung gemeinsam mit P7. **F08–F12.**

1. Straßenkurven/-Sections/-Griffe/-Verlängerungen und D04-Rauheit portieren.
   Übernommene Geometrie bleibt beim Zoom unverändert; exakte Auswahl in Übersicht.
2. Terrainfolge als versionierten Planungsjob integrieren, mit begrenzter Suche,
   reproduzierbaren Kosten und unveränderten alten Verlängerungsteilen.
3. Bebauung, Parzellengeometrie, Kollisionen, Rasterposes und Generationdiagnosen
   portieren. Leere Parzellen und idempotentes Populate ausdrücklich abdecken.
4. Individuelle Vorschläge, Skip/Restore, Neugenerierung, Bestandsänderung und
   Herauslösen erhalten. Straße plus abhängige Parzellen/Häuser gemeinsam prüfen.
5. Freie/gebundene Häuser, Dachfarbe, Wichtiger Ort und Fundamentparameter
   verbinden. Kaskaden einschließlich Offscreen-Bestand vor Löschen exakt zählen.

**Gate:** vollständige Straßenplanung im Welt-/Ortsmaßstab, im Detail veränderte
Parzellen und Häuser, Undo/Redo sowie Reopen. Keine Teilübernahme bei Konflikt;
keine Innenraum-Neuschreibung bei reiner Hauspose. Straßenpunktbewegung und
Hausbewegung gehen in M03 ein; größere Population bleibt Hintergrundaufgabe.

### P6 — Vollständige Hausinnenräume

**Abhängigkeit:** P1 für Kern, P5 für Integration. **F02, F12–F14.**

1. Reinen Solver nach `src/interior/` portieren und die bestehenden Raum-/Tür-/
   Treppenfälle auf diesem Code ausführen. Keine Welt-/Speicherimporte im Solver.
2. Draw/Erase/Assign/Move/Rename, Merge/Split und stabile lokale Zähler anbinden.
   Getrennte Raumgruppen, Keller und Selbstüberlappung berücksichtigen.
3. Türen/Durchgänge samt halben Positionen und Treppen samt vollständigen
   Fußabdrücken, beiden Geschossen und „Zur anderen Seite“ umsetzen.
4. Innenraumdarstellung, Auswahl, untere Geschosse, Listen/Fit, gedrehte
   Hausraster und Außen-/Innenkontext integrieren. Hauspayload nur bei Bedarf laden.
5. Änderungen der Allfloor-Belegung gegen Grundstück und Außenobjekte prüfen;
   Dachkontur davon getrennt führen. Letzter Raum entfernt Haus, nicht Parzelle.

**Gate:** reale Bedienfolge mit freiem und gebundenem gedrehtem Haus, Keller,
mehreren Etagen, Türen/Treppen, Raumbewegung und Reopen. Welt→Haus bleibt auch
nahe der Weltgrenze präzise; ferne Innenräume werden weder geladen noch gezeichnet.

### P7 — Flüsse, Seen und ausdrückliche Nachführung

**Abhängigkeit:** P4; gemeinsame Oberfläche mit P5/P6. **F09, F16/F17.**

1. Flussgeometrie, Punktbreiten, Mäander, Verlängerungen, Richtungen, gemeinsame
   Knoten und Topologievalidierung portieren. Detailread und Übersicht trennen.
2. Profil-/Bettberechnung mit Pegelanschlüssen, Zuflüssen und Rückstau als
   versionierte Aufgabe umsetzen. Kein versteckter globaler Lauf pro Pointerevent.
3. Seenpinsel mit echter Terrainabsenkung, Pegelkontakt, Vereinigung, Ufer und
   Inseln erhalten. Die Übernahme seiner zusammengehörigen Autoren ist atomar.
4. D03 vollständig integrieren: Veraltet-Anzeige, lokale aktuelle Darstellung,
   ausdrücklicher Korrekturvorschlag, eigener Historyschritt und Persistenz.
5. Generierung mit veränderten Eingangsdaten, Abbruch, übergroßen Netzen und
   Änderungen außerhalb des sichtbaren Bereichs prüfen. Veraltete Ergebnisse
   dürfen auch nach A→B→A-Kontextwechsel nicht übernommen werden.

**Gate:** Wasserfälle des Produktvertrags unter D03, einschließlich Gelände-
änderung → Veraltet → Anpassen → Undo/Redo → Reopen. Navigation und unabhängige
lokale Arbeit bleiben während längerer Netzberechnung möglich.

### P8 — Regionen, vollständige UI und kartografische Darstellung

**Abhängigkeit:** P3; Gesamtintegration mit P4–P7. **F03, F15, F18.**

1. Kategorien, geordnete Ränge, Regionen, Rangübermalung, Löcher, leere benannte
   Regionen, Stile und Löschkaskaden portieren. Geometrische N:N-Zugehörigkeit
   samt Flächenanteilen erhalten; keinen vereinfachten Elternbaum einsetzen.
2. Regionspinsel verwendet denselben Gesten-/Undo-Vertrag. Teure Boolean- und
   Beziehungsarbeit läuft im Worker mit begrenztem, indexiertem Eingabebereich.
3. Rangautomatik, feste Ränge, Ortsmarker, Labelanker/Zoomgrenzen integrieren.
   Namen sämtlicher Objektarten teilen Priorisierung und Kollisionsbudget.
4. Fantasy-Darstellung, Waldkronen, Relief, Schnee/Fels, Dächer/Löcher und
   Walmdachdetails prüfen. Keine dauerhafte Darstellung nur als Debugrechtecke.
5. Alle Panels, Shortcuts, Feldfehler, Modals und Kontextwechsel in 900×620 und
   1440×960 bedienen; Auswahl und Kartenfokus bei Öffnen/Schließen erhalten.

**Gate:** F01–F19 haben neue aktive Implementierungs- und Prüfabschnitte.
Screenshots/Bedienproben bestätigen lesbare nahe, mittlere und ferne Ansichten;
exakte Quelldaten werden unabhängig von visuellen Proben geprüft.

### P9 — Vollständiger Wechsel, Auslieferung und endgültige Abnahme

**Abhängigkeit:** alle vorherigen Pakete. **Lieferung:** fertiger regulärer Editor.

1. `src/main.tsx`, `npm run desktop` und Paketstart ausschließlich auf den neuen
   Editor umstellen. Temporäre Flags und ersetzte Altpfade entfernen.
2. Tests zu Produktverhalten behalten/portieren; ersetzte Implementierungsprüfungen
   gezielt entfernen. Rust-/Tauri-/JSONL-/Contractgenerator-Abhängigkeiten samt
   CI-/README-Verweisen bereinigen. Keine unnötigen Quellkopien aufheben.
3. Neues `check:all`, Desktop-E2E, Paketbau/-installation und Referenzrunner
   vollständig verdrahten. Den vorhandenen erforderlichen Checknamen behalten.
   Den Aggregator in isoliertem Testzustand mit Fehler und fehlendem Pflichtwert
   nachweislich rot machen; danach Normalzustand wiederherstellen.
4. Sämtliche M01–M09, Datei-/History-/Fehlerfälle und Ressourcenbudgets am finalen
   Release prüfen. Messwerte/Versionen/Fixture- und Pakethashes festhalten.
   Nach relevanter Korrektur betroffene Nachweise am neuen Head wiederholen.
5. Gebautes RPM in geeigneter Linuxumgebung installieren und die installierte
   Anwendung ohne Entwicklungsserver bedienen, einschließlich echter Dateidialoge.
6. Vier kanonische Dokumente auf den tatsächlichen neuen Stand bringen, diesen
   Plan als erledigt kennzeichnen und seine Arbeitsmatrix schließen. Keine
   ungeprüften Performanceversprechen in README/Status übernehmen.
7. Prüffähigen finalen Branch/PR integrieren, wenn die Repo-Gates bestehen.
   Finalen integrierten Stand und gültige Nachweise nennen. Bei nur äußerer
   Integrationsblockade den vollständigen prüfbaren Kandidaten erhalten.

**Gate:** sämtliche Kriterien in Abschnitt 8 sind erfüllt. Ein grüner Webbuild,
ein fertiger Prototyp oder erfolgreich gebaute, aber unbediente Pakete reichen nicht.

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
Generation und Präsentation des zugehörigen Compositorframes. Für Letzteres eine
Chromium-/Electron-Trace mit zuordenbaren Präsentations-/Framebeobachtungen nutzen;
Uhren und Sequenzen ausdrücklich abgleichen. Diese Messung endet bei der gemeldeten
Framepräsentation, nicht beim physikalischen Pixelumschlag des Monitors. Kann die
Umgebung nur Submission beobachten, diese als Proxy ausweisen und den
Sichtbarkeitsnachweis offen lassen. Screenshots außerhalb der Zeitmessung belegen
Inhalt, aber keine 50-ms-Präsentationslatenz. Früh in P0/P3 erproben.

### Verbindliche Szenarien

| ID  | Eingaben / Fixture                                                                        | Erforderlicher Nachweis                                                                                               |
| --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| M01 | Neue leere Ozeankarte, Raster an/aus; 30 Sekunden Wheel/Pan                               | Keine Autorenänderung und keine datenbankabhängige Kamerafreigabe; tatsächliche Kameraantwort und Frameverteilung     |
| M02 | Welt→Raum→Welt über alle Ansichten, am Ursprung sowie nahe ±90.000.000 Fuß                | Durchgehende Navigation, geringe aktive Arbeitsmenge, kein Koordinatenzittern; Position/Griffe/Picking stimmen        |
| M03 | Höhen/Boden/Landschaft, je kleine/große normale Pinsel; Haus- und Straßenpunktbewegung    | Eingabe bis exakter Live-Quellenstand und zugehörige Präsentation; zusätzlich Pointerup bis übernommener Aktionsstand |
| M04 | Graben/Lichtung/Haus fein; große Höhe/Walddichte ändern; zurück, Undo/Redo/Reopen         | D01/D02, erhaltene Details, begrenzte Quellzugriffe, echte Persistenz                                                 |
| M05 | Gleicher aktiver Ort bei 100.000 und 250.000 entfernten Häusern, zusätzliche Weltregionen | Keine lineare Weltiteration pro Frame/Interaktion; vorbereitete Übersichten und selektive Header-/Innenreads          |
| M06 | Navigation und unabhängige Bearbeitung während Save, Bebauungs- und Hydrologieauftrag     | UI-/Main-Thread bleibt frei; keine globale Freshness-Sperre; konsistente Ergebnisse und Save-Grenze                   |
| M07 | Schnelle Navigation A→B→A, Dokumentwechsel, verzögerte/abgebrochene Workerantworten       | Keine alten Quellen/Pixel/Commits in neuer Session; keine anwachsende Queue überholter Darstellungsjobs               |
| M08 | Zehn Minuten wiederholte Rundreise mit Zoom, Malen und Undo/Redo                          | Speicherplateau innerhalb der Budgets; Texturen/Buffer/Listeners/Workerinputs tatsächlich freigegeben                 |
| M09 | Save, vollständiger Programmneustart, Reopen; zusätzlich Fehler-/Abbruchdateien           | Identische Autoren/Fachobjekte, keine fälschliche Saved-Meldung, alte Zieldatei bleibt bei Fehler gültig              |

Fixtures sind deterministisch und verwenden das neue echte Schema. Entfernte
Innenräume und fein bearbeitete Ausschnitte tatsächlich speichern; bloße leere
Boundingboxes beweisen keine skalierbare Datenhaltung. Für lokale Lastfälle sowohl
leere als auch bebaute Küste mit Wasser/Flüssen und einem ausgearbeiteten Haus nutzen.

### Zeitziele und Messumfang

Die folgenden Werte sind **verbindliche Zielwerte, keine vorhandenen Ergebnisse**:

- Referenzviewport 1440×960 CSS-Pixel, DPR 1; zusätzlich Funktions-/Budgetproben
  bei 900×620 und 3840 Pixel Breite sowie DPR 2. Gleiche Fenster-/Displayeinstellung
  für vergleichende Zeitmessungen verwenden.
- M01/M02/M06 bei laufender Navigation: Ziel 60 Bilder/s auf einer festgehaltenen
  Referenzumgebung. p95 CPU-Arbeit für Eingabe und Framevorbereitung höchstens
  8 ms; p95 Frameintervall höchstens 20 ms bei 60-Hz-Betrieb; keine durch normale
  Kameraarbeit ausgelösten Pausen über 100 ms. VSync-Quantisierung dokumentieren.
- M03/M04 bei bereitliegenden Quellen: p95 Eingabe → Präsentation des exakt
  geänderten Kartenstands höchstens 50 ms. Modelländerung und Submission separat
  korrelieren. Während einer abbrechbaren Geste zählt der exakte rücknehmbare
  Quellenstand als Live-Ergebnis; Cursor, Pinselkreis und vereinfachte Näherung
  zählen nicht. Zusätzlich Pointerup → atomar übernommener und präsentierter
  Aktionsstand messen; für diese gewöhnlichen lokalen Aktionen ebenfalls p95
  höchstens 50 ms. Aufwendige Werkzeuge mit gesonderter Übernahme separat ausweisen.
- Kalte Details und große Generatoren separat messen. Sofortige Kamerabewegung
  mit gröberem Bild bleibt Pflicht; keine pauschale 50-ms-Zusage für das vollständige
  Laden unbekannter Daten oder die exakte Lösung eines großen Flussnetzes.
- Mindestens drei unabhängige Release-Läufe, bei Navigation je 30 Sekunden und
  bei lokalen Änderungen mindestens 100 zuordenbare Ereignisse pro Szenario.
  p50/p95/p99/Maximum und fehlende Samples angeben. Kalt/Warm getrennt halten;
  keine p95-Aussage aus drei Strichen und keine nachträgliche Ausreißerentfernung.
- Referenzprofil in P0/P3 mit tatsächlich verfügbarer Desktopumgebung erfassen:
  CPU, RAM, GPU/Grafikbackend, OS, Displayfrequenz, Electron/Chromium/Node/Pixi,
  Commit, Build-/Pakethash und Fixtures. Software-Rendering ausdrücklich benennen;
  es ist kein Nachweis hardwarebeschleunigter Leistung auf Aarons Gerät.
- Der Referenzrunner endet bei verfehltem Pflichtziel, fehlenden Samples oder
  fehlendem Szenario ungleich null. Maschinenabhängige Zeitziele gehören in die
  Referenzabnahme; CI prüft deterministische Struktur-/Budgetregeln zusätzlich.
  Fehlt eine geeignete native Referenz, bleibt die Zeitabnahme `blockiert`.

Frühe Teilprofile aus P3 enthalten ein ausdrückliches Teilmengenmanifest und
erfüllen nur das dortige Gate. Die endgültige Referenzabnahme verlangt alle
Szenarien und Unterfälle; fehlende spätere Werkzeuge dürfen darin nicht als
übersprungenes erfolgreiches Ergebnis erscheinen.

Die alte Vorher-/Nachher-Reihe mit drei Strichen und die vorhandenen
`targetsMet`-Berichte belegen diese Ziele nicht. Ein Vergleich mit V7 ist optional;
er darf kein Altformat und keine zweite Runtime zum dauerhaften Produkt machen.

### Testarten und Befehle

Bestehende Vitest-/Playwright-Infrastruktur weiterverwenden. Für Desktopintegration
die gebaute Electron-Anwendung einschließlich Preload, Store und echten Dateien
starten. Playwrights Electron-Anbindung früh mit der gewählten Version erproben.
Deterministische Dateitests dürfen ausschließlich die OS-Dialogantwort ersetzen;
der nachfolgende Produktpfad bleibt echt. Sichtbare native Dialoge ergänzend bedienen.

Die folgende Tabelle beschreibt **neu herzustellende endgültige Befehle**:

| Befehl                                             | Verbindlicher Inhalt                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                           | Reproduzierbare Installation einschließlich erforderlichem Electron-Native-Rebuild                                                 |
| `npm run desktop`                                  | Neuer regulärer Desktopeditor                                                                                                      |
| `npm run check:all`                                | Typen einschließlich Desktop/Worker, Fach-/Integrations-/Budgettests, Format, Produktionsbuild, Produkt-E2E und Desktopintegration |
| `npm run test:desktop`                             | Gebaute Electron-Anwendung mit echtem Preload, IPC, SQLite und Dateirundlauf                                                       |
| `npm run package`                                  | Auslieferbares Linux/RPM erzeugen; bei Forge intern `make`, nicht nur `package`                                                    |
| `npm run test:package`                             | RPM inspizieren, in geeigneter Umgebung installieren und installierten Einstieg mit Dateirundlauf prüfen                           |
| `npm run perf:atlas -- --reference <profile.json>` | M01–M09 mit Profil erfassen, Pflichtwerte bewerten und bei Nichtbestehen fehlschlagen                                              |

Während der Umstellung bestehende sinnvolle Checks weiter ausführen. Sobald der
Rustkern ersetzt ist, Rust-/Tauri-/Transportchecks durch entsprechende neue
Abdeckung ersetzen. Keine dauerhaft grünen Prüfungen gegen ungenutzte Software.
CI bleibt auf den exakten Kandidaten gebunden und prüft Paketbau. Installation
und Hardwaremessung können eigene Umgebungen benötigen; fehlende Abnahmen offen
ausweisen, nicht als erfolgreichen Teil der CI interpretieren.

## 7. Arbeits- und Abnahmematrix

Diese Tabelle am aktuellen Stand pflegen. `Nachweis` enthält später Commit und
konkreten Test-/Artefaktbezug, keine lange Chronik. Alle Implementierungspakete
sind bei Anlage dieses Plans offen.

| Paket | Pflichtumfang / Entscheidung                                    | Umsetzung | Nachweis am Stand | Status |
| ----- | --------------------------------------------------------------- | --------- | ----------------- | ------ |
| P0    | Reale Laufzeit, Pins, Start-/ABI-/SQLiteprobe                   | —         | —                 | offen  |
| P1    | Gemeinsamer Kern, A02–A06, D01/D02-Grundlage                    | —         | —                 | offen  |
| P2    | F19, A07, echte Projektdateien                                  | —         | —                 | offen  |
| P3    | F01–F04/F18-Basis, erstes Beispiel, M01 und Kernanteile M02–M04 | —         | —                 | offen  |
| P4    | F04–F07, D01/D02, komplette Flächenwerkzeuge                    | —         | —                 | offen  |
| P5    | F08–F12, D04, Straßen/Parzellen/Außenhäuser                     | —         | —                 | offen  |
| P6    | F02/F12–F14, lokale Innenräume                                  | —         | —                 | offen  |
| P7    | F09/F16/F17, D03, Flüsse/Seen/Nachführung                       | —         | —                 | offen  |
| P8    | F03/F15/F18, vollständige UI und Kartografie                    | —         | —                 | offen  |
| P9    | F01–F19 integriert, M01–M09, RPM, Altpfadabbau, Dokumentation   | —         | —                 | offen  |

## 8. Definition von „erledigt“

- [ ] F01–F19 vollständig auf dem neuen aktiven Pfad umgesetzt und geprüft;
      D01–D09 ausdrücklich im neuen Produktvertrag beschrieben.
- [ ] Welt→Raum→Welt, Grob-/Feinbearbeitung, Undo/Redo und Reopen funktionieren
      zusammen; die erste Demo wurde zum vollständigen Produkt ausgebaut.
- [ ] Kamerabewegung benötigt weder Quellenmutation noch synchronen Speicher-/
      Fachauftrag; normale lokale Werkzeuge erreichen den Zeitvertrag.
- [ ] Sparse-Daten, räumliche Auswahl, begrenzte aktive Darstellung und
      Speicher-/Jobbudgets auch bei großen gespeicherten Welten nachgewiesen.
- [ ] M01–M09 und alle erforderlichen Fach-/Fehler-/Dateifälle am endgültigen
      Stand verifiziert; Messfehler oder fehlende Werte führen zentral zu Fehler.
- [ ] Neue Desktopanwendung regulärer Einstieg; gebautes RPM installiert und
      ohne Entwicklungsserver bedient, echte Dateiabläufe und Dialoge geprüft.
- [ ] Ersetzte Tauri-/Rust-Dokument-/Canvas-/JSONL-Pfade und ihre ungenutzten
      Abhängigkeiten entfernt; keine dauerhafte Übergangsdoppelarchitektur.
- [ ] README, Architektur, Produktvertrag, aktueller Status und dieser Plan
      widersprechen sich nicht; Rohbelege bleiben außerhalb der Produktdokumente.
- [ ] Repo-Gates am aktuellen Kandidaten erfüllt und reguläre Integration abgeschlossen.

Eine externe Integrationsblockade lässt dieses letzte Kriterium sowie P9 und den
Gesamtauftrag offen beziehungsweise `blockiert`. Der Kandidat kann trotzdem als
vollständig implementiert und geprüft bezeichnet werden; der Gesamtauftrag ist
damit noch nicht erledigt.

Nicht erfüllte native beziehungsweise Zeitabnahme bedeutet `blockiert`, nicht
„fertig, nur noch manuell testen“. Nach bestandenen Kriterien abschließen;
keine weiteren optionalen Features oder Optimierungsrunden anhängen.

## 9. Quellen und Lesereihenfolge

### Repository

1. [AGENTS.md](../../AGENTS.md): Daten-/Kompatibilitäts- und Dokumentationsregeln.
2. [README](../../README.md): aktuelle Befehle und Auslieferung.
3. [Produktvertrag](../product-contract.md): aktuelles beobachtbares Verhalten.
4. [Architektur](../architecture.md): aktuelle Besitzer und ersetzte Pfade.
5. [Status](status.md): aktueller Prüfstand und nächste Übergabe.
6. [Unveränderlicher Ausgangsvertrag](https://github.com/ThonkTank/Salt-Marcher/blob/1bb3932fcffcb2d5fea47fae616c3b69489443bc/docs/product-contract.md): Inventar für F01–F19, auch nachdem die aktuellen Docs umgestellt wurden.

### Primärquellen für den Zielstack

Am 8. November 2026 geprüft; bei P0 die konkret verwendeten Versionen abgleichen.
Diese Quellen belegen Bibliotheksfunktionen, keine SaltMarcher-Latenzen.

- [PixiJS-Renderer](https://pixijs.com/8.x/guides/components/renderers) und
  [Culling](https://pixijs.com/8.x/guides/components/application/culler-plugin).
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
