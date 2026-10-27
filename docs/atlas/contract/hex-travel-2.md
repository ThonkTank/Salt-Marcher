# Getrennte Live-Mitte und Reisekonsole (0.141)

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Getrennte Live-Mitte und Reisekonsole (0.141)

Die Live-Mitte besitzt jetzt eine ausdrückliche Auswahl Szene/Karte. Reise öffnet
die Hexkonsole im Referenzbereich neben der bestehenden Mitte und erhält deren
Inhalt. Nur Karte öffnen, Ziel-/Wegpunktwahl, Platzierung oder der Kartentab
wählen die Karte ausdrücklich. Bei schmalem Viewport bleiben beide Bereiche
in der bestehenden einspaltigen Anordnung erreichbar. Die rechte Konsole kann
unabhängig scrollen. Die Kartenfläche selbst enthält dort keine Werkzeugleiste
oder Statuszeile und füllt ihre Zeile; Kameraaktionen bleiben in der Konsole.

`live-hex-surface.ts` verschiebt ausschließlich vorhandene DOM-Knoten zwischen
Atlas und Live. Karte, Kartenwahl, Ziel-/Routenbedienung und Transport existieren
jeweils einmal. `world-ui.ts` bleibt Besitzer von SceneWorld-Frame, Mapentwurf,
Cursor/Wegpunkten, Utilityauswertung und Journeyplayback. Beim Rückwechsel
werden dieselben Knoten an ihre vorhandenen Plätze zurückgegeben. Die
Szenen-/Kartentabs haben keine Worldcommands und erzeugen keine zweite Position.

Die Konsole zeigt Standort, gewählte Hexkoordinate, Terrain und Utilitykosten.
Jede Aktivierung im Wegpunktmodus fügt einen geordneten Eintrag hinzu; gleiche
aufeinanderfolgende Ziele bleiben im Entwurf sichtbar, ohne zusätzliche
Bewegungskosten zu erfinden. Löschen entfernt Entwurf und Auswertung.
Die gemeinsame dreiteilige Auswertung erscheint in Live inline. Erst deren
angenommener startbarer Stand aktiviert Reise starten; im Atlas bleibt die
vorhandene Vorschau mit ausdrücklicher Bestätigung erhalten. Vor Start gewählte
1/2/5/10× fließen unverändert in den vorhandenen Journeycommand. Der Hauptknopf
startet oder setzt fort; Pause und Stoppen verwenden weiterhin die kanonischen
Zustandsbefehle. Timer, Fortsetzen-Knopf und dessen Auftrag verlangen dieselbe
ausgewählte Reisekarte. Eine andere Ansicht aktiviert keine pausierte Reise.
Angekommene und abgebrochene Reisen zeigen finalen Status/Position ohne
Routengeometrie.

Ladeabsichten binden sich an Workspace, Fokus und aktuelle Readgeneration.
Eine verspätete Weltantwort übernimmt keine alte Fokusgruppe. Eine nicht im
aktuellen Providerstand enthaltene Gruppenkarte bleibt ausdrücklich fehlend;
Retry liest den echten Welt- und Sceneprovider neu, statt die alte Karte oder
einen Ersatz für gültig auszugeben. Bestehende Guards verhindern die Annahme
alter Routenauswertungen nach Fokus-, Karten-, Membership- oder Zeitänderung.

Gezielte Store-/DOMfälle prüfen die geteilte Oberfläche, unabhängige Mitte,
Tastaturwegpunkte, inline Start und Geschwindigkeitsübergabe, fehlende Karte und
mutationsfreien Providerretry. Native Belege umfassen zwei Gruppen auf zwei
Karten, Fokuswechsel mit offener Auswertung, Löschen, Start/Pause/Fortsetzen/
Abbruch/Ankunft und Neustart. Kein Ersatz für vollständige200%-/Latenz-/
Großroutenqualifikation. Direktes Party-Tokenziehen folgt in 0.143 (unten). Weitere Session-Center-
Anbieter und die genannten weitergehenden Abnahmen bleiben offen.

## Direktes Party-Tokenziehen (0.143)

Der eine vorhandene Party-Token ist direkt greifbar, sowohl im Atlas als auch
auf der gemeinsamen Livekarte. Die Geste gewinnt am Token vor Kartenpan und
Geländepinsel. Hintergrundgesten bleiben beim bestehenden passiven Canvas.
Der Token rastet visuell auf das Zielhex ein und wird bis zur Bestätigung
transparent und gestrichelt dargestellt; Position und Karte werden während der
Bewegung nicht geschrieben. Loslassen auf einem beschriebenen Hex bestätigt
administrative Platzierung ohne Reisezeit. Auch geerbte Beschreibung aus einer
gröberen Ebene zählt als beschrieben. Die Tastaturalternative benutzt denselben
Platzierungsweg und behält die bestehende freie Platzierung auf kontinuierlicher,
ungezeichneter Landschaft.

`hex-party-drag.ts` besitzt ausschließlich die vorläufige Zeigergeste. Der
bestehende Hexadopter interpretiert native Canvas-Hits und CTM, Terrainbeschreibung
und lokale Koordinaten. Scene, Mitglieder, Position, Karte, Ebene und Livefokus
binden die Geste. Escape, Pointerabbruch, Fensterfokusverlust, Kameraaktionen oder
ein neu gezeichneter Kartenstand entfernen die Vorschau. Außerhalb der Karte
oder auf einem unbeschriebenen Ziel wird nichts gebucht. Ein Klick ohne Ziehen
und eine Rückkehr zum bisherigen Standort erzeugen keine neue Platzierung.

`placePartyAt` führt Drag und Tastatur zum bestehenden `place-scene`-Writer.
Der Auftrag bindet zusätzlich die aktuelle Karten- und Membershiprevision und
bei Drag die beschriebene Zielzelle. Der Writer prüft diese Fakten innerhalb
seiner bisherigen Transaktion. Bestehende Ortsmarker werden über dieselbe
Ortsbindung übernommen. Laufende Präsentation stoppt vor der Geste; ein bereits
buchender Reiseabschnitt muss zunächst abschließen. Die administrative Position
kann eine vorhandene Reisebasis veralten lassen; die vorhandene ausdrückliche
Restwegbewertung bleibt dafür zuständig. Kein zweiter Token, keine zweite
Position, keine neue Uhr und kein Schema.

Gezielte Fälle prüfen vorläufiges Ziehen, genau einen Releaseauftrag, Abbruch,
Ownerwechsel und atomare Ablehnung veralteter Karten-/Gruppenbasis. Ein bestehender
Provider-Ausfallfall wählt jetzt ein tatsächlich anderes Cursorhex, damit er
weiterhin einen wartenden Platzierungsauftrag statt eines wirkungslosen Klicks
prüft. Native Prüfung umfasst Atlas mit und ohne aktiven Pinsel, Livekarte,
Tastaturalternative, ungültiges Ziel, Escape, Gruppenwechsel und Neustart.
Vollständige Plattform-, 200%- und Langroutenqualifikation bleiben offen.

## Ausdrückliche Passierbarkeit und Reisevoraussetzungen (0.147)

Hexe besitzen optional `access`: eine ausdrückliche Sperre mit Begründung oder
benannte Voraussetzung wie „Boot“. Fehlende Vorgabe bedeutet passierbar; auch
ungezeichnetes Gelände bleibt Ebene. Reisevorgaben bleiben vom kontinuierlichen Gelände getrennt; Landschaftspinsel
ändern diese Vorgaben nicht. Gröbere Reisevorgaben werden wie andere Reisefakten
geerbt. Frei passierbar entfernt die lokale Vorgabe.

Der GM markiert für eine konkrete Reise vorhandene Voraussetzungen. Diese
Angabe ist keine Inventarprüfung und verändert kein Ledger. Die Auswahl gehört
zur angezeigten Campaign/Scene/Karte/Reise. Akzeptierte Angaben werden in
`Journey.supplies` und dem bestehenden Verlaufsbeleg gespeichert. Leere Auswahl
benötigt kein neues Feld; es gibt keine neue Tabelle oder Schemafassung.

`findRoute` umgeht gesperrte und ohne Voraussetzung nicht betretbare Hexe;
ein solches Ziel beziehungsweise ein solcher ausdrücklicher Wegpunkt wird
verständlich abgewiesen. Restwegprüfung prüft jeden verbliebenen Abschnitt.
Straßen und feste Enddauer heben keine Sperre auf. Start vergleicht weiterhin
die vollständige aktuelle Vorschau; Schritte prüfen die bestätigte Kartenbasis
und den Zugang vor Position/Zeit/Weltfolgen. Eine geänderte Karte verlangt
Neubewertung und kann keinen alten Reiseauftrag nachträglich autorisieren.
Administrative Platzierung bleibt eine ausdrücklich andere, zeitlose GM-Aktion.

Die GM-Karte markiert Sperren mit × und Voraussetzungen mit !, ergänzt Titel
und Inspektor. In der passiven Wissensansicht werden diese GM-Marker unterdrückt.
Die angenommene Reise zeigt ihre Angaben auch nach Neustart; die bestehende
Wiedergabe startet weiterhin nur ausdrücklich.

Gezielt geprüft: sparse Umwege, Straße versus Sperre, fehlender Transport trotz
Enddauer, Start-/Step-/Restweg-Ablehnung bei Kartenänderung, unveränderte Bytes
bei Ablehnung, Fresh und unabhängiger Campaigntransfer. Vollständige Transport-,
Inventar-, Fraktions- oder biologische Bewegungsregeln entstehen dadurch nicht.

## Feldbeschriftungen in dichten Ausschnitten

`world-ui.renderMapScene` misst die dargestellten Feldnamen mit der aktuellen
Schrift und prüft ihre Rechtecke vor dem Veröffentlichen des gemeinsamen
Scene-Roots. Bei Kollision bleibt das ausgewählte Hex beziehungsweise der
Reisecursor bevorzugt sichtbar; weitere Texte folgen stabil der Hexreihenfolge.
Der Abstand unter dem Hexzentrum folgt der Textgröße, damit ein lesbarer Name
bei kleiner Darstellung nicht die benachbarte Hexmitte überdeckt. Mehr Platz
durch Zoom oder geänderte Auswahl berechnet dieselbe Projektion neu.

Ausgeblendete Feldnamen bleiben vollständig im Hex-Tooltip und Inspektor.
Karte, Auswahlbefehle und Reiseautorität bleiben beim bisherigen Owner; keine
Migration, Schreiboperation oder gespeicherte Labelposition. Die ausdrücklich
bearbeitbare Ortsmarkerpräsentation bleibt eigenständig. Die DOM-Probe prüft
Auswahlpriorität, Rückkehr nach Zoom/Reset und unveränderte gespeicherte Werte;
`test-desktop-travel-target.mjs` prüft echte native Textrechtecke, Label- und
Nachbarhexklicks neben dem bestehenden Reise-/Neustartpfad. Das ist keine
Abnahme beliebiger Markerkrümmungen, aller Schriften, großer Karten oder200%.

## Reisekontext im gemeinsamen Atlas

`CampaignAtlasWorkbench` bietet die lokale Reisekonsole unter **Erkunden**.
Ein erneutes `campaignAtlas`-Lesen entwertet ihre nicht angenommene Vorschau
sofort, stoppt automatische Wiedergabe und sperrt lokale Reise-, Eingangs- und
Platzierungsaktionen. Die letzte bestätigte Geometrie bleibt sichtbar; der
Reisestatus nennt Laden beziehungsweise den Lesefehler. **Reisekontext erneut
laden** liest denselben Workspace erneut. Eine erfolgreiche Antwort ersetzt
keine Reiseentscheidung: Das Ziel bleibt erhalten, eine neue Vorschau und ein
neuer ausdrücklicher Start sind nötig. Ohne Fokusgruppe bleiben Aktionen gesperrt.

Eine verspätete Vorschau darf nur an denselben Workspace, dieselbe gelesene
Atlasinstanz und ihre aktuelle Anfragegeneration gebunden werden. Antwort-Scene
und aktueller Fokus müssen übereinstimmen. Verlassen der Atlasfläche und
Aktivieren einer Kampagne entwerten offene Vorschauen ebenfalls. Alte Lesefehler
überschreiben keine neuere bestätigte Antwort. SQLite-Writer und Receipts bleiben
allein für Position, Zeit, Revisionen und Wiederholbarkeit zuständig; kein Schema
und keine Migration für diesen transienten Zustand.

Sieben Controller-/DOM-Gegenfälle verwenden reale Storeprojektionen. Der native
Desktoplauf prüft tatsächliche Schaltflächen, gehaltene Antworten, Fehler/Retry
und Fokuswechsel: Statusklärung verändert keine DBbytes; eine alte Antwort wird
verworfen, erst ein neuer ausdrücklicher Start/Schritt bewegt die neue Gruppe.
Normaler Exit und frischer Store bestätigen Fokus, getrennte Uhren und lokalen
Laufstand. Das ist keine vollständige native Neustart-/Indoor-/200%-Abnahme. Beim ersten Lauf scheiterten sämtliche51
`desktop-travel-target-dom`-Fälle bereits am Anlegen einer zweiten Karte. Das
Fixture verwendet jetzt die tatsächliche Atlaswurzel samt Revision, den realen
Atlaswriter für authored Worldbefehle und die DOM-eigenen Eventkonstruktoren.
Vorhandene Verzögerungs-/Fehlerports beobachten weiterhin denselben Worldauftrag.
Sechs frühere Mehrkartenfälle werden ausdrücklich ersetzt: unbekannte Karten-ID
nach abgewiesenem Save, neuere ungültige Auswahl und Kampagnenwechsel während
Save, fehlende Rootkarte im Providerread mit Retry, gesperrte Fortsetzung bei
fehlendem Provider (Schaltfläche und direkter Callback) und getrennte Reisen
zweier Scenes auf derselben Rootkarte. Die übrigen Bedienassertions bleiben erhalten;
kein Fall wird übersprungen. Das ist keine Mehrkartenfreigabe oder vollständige
Abnahme der neuen Workbench.

## Dieselbe Atlasfläche im Live-Spiel

Live zeigt beim ausdrücklichen Öffnen des Kartentabs dieselbe
`CampaignAtlasWorkbench` mit demselben SVG, derselben Kamera und demselben
Renderprovider wie die Atlasbearbeitung. `LiveAtlasPortal` verschiebt die
bestehenden DOM-Knoten und echten Kameracontrols; es kopiert weder Karte noch
Position noch Reise. Beim Wechsel zurück stehen diese Knoten wieder an ihrem
vorherigen Platz. Kamera und Ansichtshistorie bleiben erhalten. Die alte
Hexcanvas-Projektion bleibt für isolierte Fachfälle bestehen, ist in der
zusammengesetzten Produktoberfläche verborgen. Städte, Landschaft und Dungeons
werden über den gemeinsamen Atlasprovider dargestellt.

Reise allein erhält die Szenenmitte; Karte öffnen, Kartentab und bewusste
Routenaktionen wählen die Karte. Weltreise bleibt bei der bestehenden Hexkonsole
im Referenzbereich. Echte Atlas-Kameracontrols werden ebenfalls dort bedient.
Lokale Wege und Innenräume verwenden unter dem gleichnamigen aufklappbaren
Bereich die vorhandene Atlas-Reisekonsole und deren lokale/Dungeonwriter.
Geordnete Wegpunktwahl auf dem gemeinsamen Canvas erhält ausdrücklich gewählten
Wegpunktmodus. Keyboardplatzierung und Koordinatenfelder bleiben erreichbar.

Runtimeereignisse entwerten bei sichtbarer Livekarte offene Atlasreads und lokale
Vorschauen sofort vor dem verzögerten Refresh. Weltvorschauen werden nur für
passende Scene-/Map-IDs gezeichnet. Nur aktive, pausierte und unterbrochene
Weltreisen sowie aktive/pausierte lokale Wege zeigen Routengeometrie. Bei einer
Weltreise beginnt die Restlinie am letzten bestätigten Hex. Ankunft und Abbruch
behalten Laufstand und Fakten, aber keine aktive Linie. Ein bestätigter lokaler
Reiseauftrag aktualisiert anschließend den bestehenden Worldprovider; ein
Lesefehler macht den bereits bestätigten Auftrag nicht ungeschehen.

Controller-/DOMprüfungen verwenden echte Storeprojektionen; der Portaltest prüft
Identität, Kamera, echte Controlhandler und wiederholte Rückkehr. Native Belege
prüfen die tatsächliche gemeinsame Fläche, geordnete
Wegpunkte, Auswertung, Start/Pause/Fortsetzung, Ankunft/Abbruch und vollständigen
Neustart. Der ergänzte lokale Schritt prüft dieselbe Position/Uhr nach einer
Weltreise. Store-, Native-, vollständige CI- und Mainnachweise bleiben getrennte
Behauptungen. Vollständige Indoor-/Eingangs-/Fokuswechsel-, physische
200%-/OS-/Großroutenabnahme sowie eine weiter vereinfachte kontextübergreifende
Konsole bleiben offen; zusätzliche versteckte Runtimestores sind kein Lösungsweg.

## Übergabe zwischen Innenraum, lokalem Weg und Hexreise

Alle drei Reisewege schreiben dieselbe ScenePosition und Gruppenuhr. Eine
Hexvorschau darf deshalb nicht an der erhaltenen übergeordneten Hexkoordinate
einer noch im Dungeon befindlichen Gruppe beginnen: zuerst den verbundenen
Eingang ausdrücklich verlassen. Eine aktive oder pausierte lokale Reise muss
vor der Weltreise abgeschlossen oder ausdrücklich beendet werden. Das gilt
auch beim Annehmen einer früher erstellten Weltvorschau; der lokale Start
allein verändert noch keine Positions- oder Uhrrevision.

`storage/world.hexTravelContext` prüft den vorhandenen Dungeonstand und den
kanonischen `atlasLocalJourney`-Read bei Vorschau, Startneuberechnung,
Fortsetzung und Checkpoint. Die Gegenrichtung verwendet in
`storage/atlas-travel.localTravelContext` dieselben bisherigen Außenraum- und
Weltreiseregeln nun auch beim lokalen Fortsetzen. Eine abgeschlossene oder
beendete lokale Reise lässt sich nicht wieder aktivieren. Administrative
Platzierung bleibt eine andere ausdrücklich zeitlose GM-Aktion.

Bestehende überlappende Laufstände bleiben lesbar. Der GM kann den ungewollten
Reiseweg ausdrücklich beenden und den anderen fortsetzen; die Prüfung beendet
keine Reise heimlich und schreibt weder Zeit noch Position um. Originalreceipts
bleiben auch bei später geändertem Reisekontext abrufbar. Keine Schemaänderung,
Migration oder neue Positions-/Reisewahrheit.

Echte Storefälle prüfen Innenraum mit regulärem Eingang, aktive/pausierte lokale
Reise, veraltete Weltvorschau, terminales lokales Fortsetzen sowie einen gültigen
Altbestand mit überlappenden Reisen nach Fresh: Ablehnung ohne DBänderung,
Originalreceipt und ausdrückliche Erholung bis zum nächsten gemeinsamen
Positions-/Zeitcheckpoint. Eine native Linuxprobe bedient dieselbe Livekonsole:
Innenraumvorschau abweisen, echten Eingang verlassen, Weltreise bis zum
Checkpoint; in einer zweiten Kampagne lokale Reise als Sperre sehen,
ausdrücklich beenden und Weltreise annehmen/pausieren. Fresh-Reads nach vier
normalen App-Exits bestätigen die Position-/Zeitfakten und erhaltene Raumprosa.
Die vollständige Indoor-/Plattform- und Langroutenqualifikation bleibt
eigenständig offen.
