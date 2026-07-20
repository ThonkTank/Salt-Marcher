Status: In Progress
Owner: Aaron
Last Reviewed: 2026-07-20
Source of Truth: Confirmed German owner answers from the Dungeon refactor needs-analysis conversation on 2026-07-20.

# Dungeon Needs Interview 2026-07-20

## Scope

Dieses Protokoll bewahrt die im Chat bereits bestätigten Entscheidungen für die
Dungeon-Bedürfnisanalyse. Es ist Evidenz, keine zweite Requirements- oder
Architektur-Spezifikation. Die repo-facing Requirements bleiben englisch und
werden erst nach bestätigter Interpretation zur kanonischen Produktwahrheit.

## Arbeitsauftrag und Zweck

Der Gesamtauftrag ist ein ergebnisoffener Review des kürzlichen Dungeon-
Refactors. Die relevanten Pull Requests sollen den Zustand vor dem Refactor und
den endgültigen Zustand nachvollziehbar machen. Bewertet werden soll, ob der
Refactor insgesamt ein Gewinn war und ob der heutige Stand als solide,
langfristige Zielarchitektur für das Dungeon-Feature und das Gesamtprojekt
ausreicht.

Der Review trennt vier logisch aufeinander aufbauende Ergebnisse:

1. Nutzerfähigkeiten sowie daraus folgende lösungsneutrale technische und
   qualitative Bedürfnisse werden unabhängig vom heutigen Code geklärt.
2. Aus dieser Bedarfsbaseline wird eine Greenfield-Zielarchitektur ohne Bindung
   an die heutige Struktur, Dokumentation oder Migrationskosten entworfen.
3. Vor-Refactor-Stand, heutiger Stand und Greenfield-Ziel werden anhand der
   Pull Requests und der realen Implementierung verglichen.
4. Erst danach wird geplant, welche weiteren Schritte zum Zielzustand sinnvoll
   sind.

**Aktueller Arbeitsstand:** Die erste Discovery-Scheibe zu Reise,
Darstellungen und Qualitätsgrenzen ist bestätigt und in vorläufige englische
Requirements überführt. Ergebnis 1 bleibt jedoch in Arbeit: Editor-Werkzeuge,
authored Dungeon-Inhalte, End-to-End-Workflows und ihre Wirkung am Spieltisch
sind noch nicht vollständig geklärt. Das Interview enthält weiterhin kein
Urteil über den Ist-Zustand und keinen Architekturentwurf.

## Vorgehen und Phasengrenze

### Wo soll die erste Phase enden?

**Bestätigte Antwort:** Bedarf ohne Ist-Urteil.

Die erste Phase fixiert Nutzerfähigkeiten und lösungsneutrale technische und
qualitative Bedürfnisse. Die Bewertung der aktuellen Struktur beginnt erst im
anschließenden Review.

### Wie sollen die während des Refactors entstandenen Dungeon-Requirements behandelt werden?

**Bestätigte Antwort:** Hypothesen plus Bestätigung.

Docs, Tests, UI und Altstand liefern Kandidaten. Nur nachvollziehbarer
Nutzerwert und Owner-Bestätigung machen sie zur Bedarfsbaseline.

### Wie soll die abgeschlossene Bedürfnissanalyse festgehalten werden?

**Bestätigte Antwort:** Bestehende Requirements schärfen.

Die vorhandenen Dungeon-Requirements werden als kanonische, lösungsneutrale
Grundlage aktualisiert. Es wird kein konkurrierendes Review-Wahrheitsdokument
angelegt.

## Nutzer, Umfang und Non-Goals

### Für welchen langfristigen Nutzungshorizont gilt die Bedarfsbaseline?

**Nachgeschärfte bestätigte Antwort:** Lokaler GM als einziger Bediener.

Die primäre Zielnutzung ist ein einzelner GM auf einem lokalen Desktop. Spieler
erhalten keinen eigenen Steuerungszugang wie in einem VTT; Remotezugriff und
Mehrbenutzerbearbeitung sind keine Anforderungen dieser Baseline.

Als niedrig priorisierte spätere Erweiterung soll eine passive Spieleransicht
auf einem zweiten Monitor möglich sein. Sie zeigt die Spielerperspektive mit
Fog of War, verborgenen Geheimnissen, Lichtsimulation und vergleichbaren
Sichtbarkeitsregeln, ohne das GM-only-Bedienmodell zu verändern.

### Welche langfristige Dungeon-Fähigkeit ist Produktbedarf?

**Bestätigte Antwort:** Vollständiges Authoring plus Reise.

Kartenverwaltung, Räume, Wände, Türen, Korridore, Treppen, Übergänge, Marker,
Beschreibungen, Inspektion und Party-Reise bilden den Kern. Vom GM authored
Fallen gehören ebenfalls zur langfristigen Dungeon-Wahrheit. Weitere
Objekttypen sollen auf Quellcode-Ebene leicht ergänzbar sein. Kartenimport und
prozedurale Dungeon-Erzeugung wurden nicht als Kernumfang gewählt.

### Was bedeutet „einfach erweiterbar“?

**Bestätigte Antwort:** Quellcode-Modularität.

Entwickler sollen Verhalten, Werkzeuge, Objekttypen und Integrationen lokal
ändern können. Ein Laufzeit-Plugin-System für Nutzer ist nicht erforderlich.

### Welche Ebene der heutigen Editor-Geometrieregeln ist dauerhafter Produktbedarf?

**Bestätigte Antwort:** Fachliche Ergebnisse bewahren.

Quadratische Zellen, mehrere Ebenen sowie editierbare Räume, Wände, Türen,
Korridore, Treppen und Übergänge bleiben. Konkrete Merge-, Routing-, Handle-
und Formalgorithmen dürfen später anders gelöst werden.

### Ist das heutige `RoomCluster`-Konzept ein Nutzerbedarf?

**Bestätigte Antwort:** Benennbare Bereiche, Modell offen.

Der GM braucht Räume und größere benennbare Bereiche oder Gruppen. Begriff,
interne Repräsentation und automatische Gruppierungslogik sind nicht
festgelegt.

## Darstellung und Dungeon-Key

### Welche Dungeon-Darstellungen braucht der Nutzer langfristig?

**Owner-Antwort, wörtlich:**

> Realisitische raster ansicht, abstrakter beziehungsgraph und eine textbasierte
> Raumliste ähnlich eines glossars oder klassischen dungeon supplement katalogs
> in welchem Räume als Liste hinter der tatsächlichen Karte stehen und per
> Nummer auf bestimmte karten Punkte verweisen.

### Wie sollen Rasterkarte, Beziehungsgraph und Raumliste zusammenarbeiten?

**Bestätigte Antwort:** Spezialisierte, bidirektional synchronisierte
Arbeitsflächen.

Auswahl und Navigation springen zwischen demselben Raum oder Bereich in allen
drei Darstellungen. Bearbeitungen erscheinen konsistent aus einer gemeinsamen
Dungeon-Wahrheit. Die Darstellungen haben dabei unterschiedliche Aufgaben.

Die Rasterkarte ist im Editor die maßgebliche Arbeitsfläche zum Zeichnen und
Bearbeiten von Geometrie, Kartenobjekten und räumlicher Platzierung. Im
Reise-Kontext wird sie dagegen passiv dargestellt. Dort wählt der GM Räume,
Objekte und andere Ziele aus, um deren Beschreibung im Detail-Pane zu öffnen;
Geometrie wird in dieser Ansicht nicht bearbeitet.

Der abstrakte Beziehungsgraph dient als Dungeon-Design- und Debug-Ansicht. Der
GM kann Räume und Raumgruppen schnell umsortieren und herausgezoomt den Flow,
die Verteilung von Entscheidungskomplexität, Reisezeiten zwischen wichtigen
Punkten sowie Inhalte wie Rätsel, Loot, Encounter und Curiosities überblicken
und planen. Räumliche Verschiebungen im Graphen werden so weit wie möglich in
die Rastergeometrie übertragen.

### Welche Wahrheit abstrahiert der Graph?

**Bestätigte Richtung:** Navigationsentscheidungen statt Rasterobjektliste.

Der Graph stellt die für die Party relevanten Navigationsentscheidungen durch
den Dungeon vereinfacht dar. Räume, Raumgruppen und relevante
Entscheidungspunkte können als Knoten erscheinen; begehbare oder potenzielle
Routen als Kanten. Bloße Nachbarschaft ohne authored Durchlass erzeugt keine
Verbindung.

Türen, Durchgänge, Korridore, Treppen und Übergänge beeinflussen die
Graphbeziehung. Eine aktuell nicht passierbare strukturelle Verbindung bleibt
sichtbar und wird über Zustand oder Darstellung unterschieden. Automatisch
erkannte Sprung-, Kletter- oder vergleichbare Sonderwege erscheinen als
erkennbare Kandidaten statt als gewöhnliche sichere Verbindung.

Der Graph muss Rasterdetails nicht eins zu eins spiegeln. Er darf Geometrie
zusammenfassen, solange echte Wahlmöglichkeiten, Verbindungsarten, Zustände und
Reiseauswirkungen verständlich erhalten bleiben.

### Welche externe Designmethode dient als primäre Graph-Inspiration?

**Bestätigte Antwort:** Stark reduzierte Melan-Diagramme nach The Alexandrian.

Primäre Referenz sind die Dungeon-Graphen aus The Alexandrians Reihe
»Xandering the Dungeon« und dem Addendum »How to Use a Melan Diagram«. Der
Graph reduziert einen Dungeon stark auf grundlegende Navigationsentscheidungen
und Flow:

- bedeutungslose Kurven und lange eindeutige Wegführungen werden begradigt
- Türen oder Zwischenräume ohne echte Routenwahl erzeugen keinen eigenen
  Entscheidungsknoten
- kurze, strukturell unbedeutende Sackgassen dürfen ausgeblendet werden
- echte Gabelungen, Schleifen, Geheimwege, ungewöhnliche Pfade und
  Ebenenverbindungen bleiben erkennbar
- falsche Schleifen, deren Zweige unmittelbar wieder am selben Punkt enden,
  werden nicht als echte Routenvielfalt gewertet
- Kantenlänge darf Reiseaufwand oder Weglänge grob widerspiegeln, ohne die
  Rasterkarte nachzuzeichnen

The Alexandrian beschreibt Melan-Diagramme primär als Analysewerkzeug.
SaltMarcher erweitert diese Form bewusst zu einer gleichwertigen
Authoring-Ansicht, deren strukturelle Änderungen in einen geschützten
Raster-Preview übersetzt werden.

### Wie stark ist die Graph-Abstraktion?

**Bestätigte Antwort:** Einstellbarer Detailgrad.

Der Graph besitzt keinen einzigen festen Abstraktionsgrad. Der GM kann zwischen
einer vollständigen Darstellung einzelner Türen, Räume und Verbindungen und
einer stark reduzierten Alexandrian-/Melan-Darstellung wechseln.

Mit zunehmender Reduktion werden eindeutige Wegabschnitte, einzelne Räume und
schließlich ganze Raumgruppen zu grundlegenden Routen und
Navigationsentscheidungen zusammengefasst. Flow-, Reisezeit- und
Content-Daten werden auf der jeweils sichtbaren Ebene aggregiert, ohne ihre
zugrunde liegenden authored Fakten zu verlieren.

### Bleibt der Graph auf allen Detailstufen editierbar?

**Bestätigte Antwort:** Ja, mit abstraktionsgerechten Operationen.

In der Detailansicht bearbeitet der GM einzelne Räume, Türen und Verbindungen.
Auf mittlerer Stufe kann er ganze Räume oder Raumgruppen als Einheit
verschieben, duplizieren, verbinden oder entfernen. In der stark reduzierten
Alexandrian-/Melan-Ansicht darf er grobe Routen und Gruppen umstrukturieren.

Eine neue Verbindung zwischen zusammengefassten Gruppen ist zunächst eine
Planungsabsicht. SaltMarcher erzeugt plausible konkrete Endpunkte und
Rohgeometrie, die der GM später im geschützten Raster-Preview prüft und
bereinigt. Mehrdeutige Edits werden nicht still auf eine willkürlich gewählte
konkrete Tür oder Zelle heruntergebrochen.

### Welche zusätzliche Debug-Wirkung soll der Graph haben?

**Korrigierte bestätigte Richtung:** Content-Heatmap auf Knoten und Routen.

Eine »Route« bezeichnet hier zunächst die Verbindung zwischen zwei
Graphknoten, nicht eine vollständige Start-Ziel-Reise durch mehrere Knoten.
Knoten und Routen werden durch Farben, Symbole oder vergleichbare
Debug-Darstellung nach ihren Content-Typen und deren Konzentration kodiert.
Der GM erkennt dadurch unmittelbar, wo sich besonders viel Gefahr, Belohnung,
Treasure, Encounter, Curiosities, Rätsel oder vergleichbarer Content
konzentriert und wie diese Verteilung über den gesamten Dungeon aussieht.

Ein späterer Vergleich vollständiger alternativer Start-Ziel-Wege darf auf
dieser Grundlage ergänzt werden, ist aber gegenüber der unmittelbaren
Content-Heatmap nachrangig. SaltMarcher liefert Diagnose und Vergleichsdaten,
schreibt jedoch keine einzig richtige Balance vor.

### Wie werden mehrere Content-Dimensionen dargestellt?

**Bestätigte Antwort:** Layer plus kombinierte Mehrfachkodierung.

Der GM kann einzelne Heatmap-Layer für Gefahr, Encounter, Treasure, sonstige
Belohnung, Curiosities, Rätsel, Geheimnisse und weitere Content-Typen
umschalten. Ein einzelner Layer verwendet eine klare Farbdichte auf Knoten und
Routen.

Eine kombinierte Übersicht zeigt mehrere Kategorien gleichzeitig durch kleine
Symbole, Balken oder eine vergleichbar unterscheidbare Mehrfachkodierung statt
durch eine schwer lesbare Mischfarbe. Der GM kann zwischen absoluter
Content-Menge und Konzentration relativ zu Reisezeit oder Routenumfang
wechseln. Beim Reduzieren des Graph-Detailgrads werden die Werte der
zusammengefassten Räume und Routen passend aggregiert.

Designreferenzen:

- https://thealexandrian.net/wordpress/13085/roleplaying-games/xandering-the-dungeon
- https://thealexandrian.net/wordpress/45711/roleplaying-games/xandering-the-dungeon-addendum-how-to-use-a-melan-diagram

### Wie werden Graph-Verschiebungen sicher in Rastergeometrie überführt?

**Bestätigte Antwort:** Geschützter Graph-Edit-Preview.

Graph-Verschiebungen werden zunächst als geschützter, noch nicht dauerhaft
bestätigter Bearbeitungsstand gehalten. Eine Rastervorschau erscheint nicht
innerhalb des Graphen, sondern erst wenn der GM zurück zur Rasterkarte
wechselt. Dort sieht er die übertragene Geometrie und mögliche Probleme, kann
sie mit den vorhandenen Raster-Editorwerkzeugen bereinigen und das
Gesamtergebnis anschließend endgültig annehmen.

Solange dieser Graph-Edit-Preview nicht final bestätigt wurde, kann der GM den
gesamten Dungeon auf den Zustand unmittelbar vor Beginn der Graph-Bearbeitung
zurücksetzen. Diese geschützte Rückkehr ist unabhängig von Tiefe und
Speichergrenzen der gewöhnlichen Sitzungs-Undo/Redo-Historie.

Die Raumliste beziehungsweise der Dungeon-Key dient der fokussierten
Bearbeitung von Beschreibungen und anderem überwiegend textförmigem Inhalt.
Große Bearbeitungsdialoge ermöglichen die schnelle Pflege einzelner Räume.
Raumbeschreibungen werden hybrid aus aktueller Geometrie und dauerhaft
GM-authored Beschreibungsattributen erzeugt.

### Welche Darstellungen sind gleichwertige Authoring-Einstiege?

**Bestätigte Antwort:** Graph und Raster gleichwertig, Dungeon-Key sekundär.

Ein neuer Dungeon kann gleichermaßen im abstrakten Beziehungsgraphen oder in
der Rasterkarte begonnen und weiterentwickelt werden. Beide sind echte
Authoring-Einstiege und beeinflussen dieselbe Dungeon-Struktur synchron in
beide Richtungen. Keine der beiden Darstellungen ist lediglich eine
nachgelagerte Analyse- oder Präsentationsansicht.

Der Dungeon-Key ist demgegenüber ein sekundäres Feinschliff-Werkzeug. Er dient
vor allem dazu, Beschreibungen und anderen textförmigen Inhalt nach der
strukturellen Arbeit fokussiert auszuarbeiten.

### Was entsteht im Raster, wenn der GM einen Raum im Graphen anlegt?

**Bestätigte Antwort:** Automatisch erzeugte provisorische Rohgeometrie.

Position und Beziehungen des neuen Graphknotens erzeugen einen einfachen
provisorischen Raum samt erster Verbindungen in der Rasterdarstellung. Der GM
kann im Graphen optional grobe Angaben wie Größe, Grundform oder Ebene setzen,
ohne dort konkrete Zellgeometrie zeichnen zu müssen.

Beim Wechsel zur Rasterkarte erscheint die Übertragung im geschützten
Graph-Edit-Preview. Der GM kann die Rohgeometrie mit den gewöhnlichen
Rasterwerkzeugen verfeinern, vollständig zurücksetzen oder anschließend
endgültig annehmen.

### Wie funktionieren die Nummern im klassischen Dungeon-Key?

**Bestätigte Antwort:** Stabil und editierbar.

SaltMarcher vergibt zunächst eindeutige Anzeigenummern. Der GM kann sie
umordnen oder ändern, ohne interne Identität oder Verknüpfungen zu verlieren.

### Welche Inhalte bündelt ein Raumlisten-Eintrag mindestens?

**Bestätigte Antwort:** Vollständiger GM-Key.

Ein Eintrag enthält Nummer, Name, Vorlesetext, GM-Notizen oder Beschreibung,
Ausgänge und Verbindungen sowie verknüpfte Akteure, Objekte, Encounter und
Ereignisse.

### Wie entstehen lesbare Raumbeschreibungen?

**Bestätigte Antwort:** Dynamische Komposition aus Geometriefakten und
GM-authored Attributen.

SaltMarcher setzt eine Raumbeschreibung bei der Anzeige aus zwei Arten von
Fakten zusammen. Geometrie, räumliche Beziehungen und relative Richtungen
werden dynamisch aus der aktuellen Karte und dem Heading der Party abgeleitet.
Begriffe wie »vor euch«, »links« und »rechts« beziehen sich damit auf die
tatsächliche Annäherungs- beziehungsweise Blickrichtung der Party.

Der GM authored davon unabhängige beschreibende Attribute, etwa hohe oder
runde Räume, graue Steinwände, feuchte und modrige Luft sowie schwere
verschlossene Eisentüren, offene dunkle Torbögen oder einfache Holztüren.
SaltMarcher komponiert beides zu einem lesbaren Gesamttext. Eine
Geometrieänderung aktualisiert die abgeleiteten Beziehungen, ohne die
GM-authored Eigenschaften zu überschreiben.

### Welche Richtungen verwendet eine Beschreibung ohne aktuelle Party?

**Bestätigte Antwort:** Stabile Kartenrichtungen plus Perspektivvorschau.

Im Dungeon-Key, Editor und Dokumentexport verwendet SaltMarcher ohne aktuelle
Party stabile Kartenrichtungen wie Norden oder Südwesten. Im Editor kann der GM
zusätzlich einen Eingang beziehungsweise ein Heading auswählen, um den
relativen Vorlesetext aus dieser Perspektive als Vorschau zu sehen. Während
einer laufenden Reise wird stattdessen das tatsächliche Heading der Party
verwendet.

### Soll der Dungeon-Key außerhalb der App ausgebbar sein?

**Bestätigte Antwort:** Ansicht plus Dokumentexport.

Der GM kann die synchronisierte Raumliste in der App nutzen und zusammen mit
Karte und Verweisen als druck- oder teilbares, menschenlesbares Dokument
exportieren.

### Wo befindet sich die Steuerung der Dungeon-Reise?

**Bestätigte Antwort:** Im unabhängigen Reisen-State-Tab.

Bewegungsgeschwindigkeiten, Übergangsauswahl, der Start längerer
Routenplanungen und weitere Reisebefehle befinden sich im Reisen-State-Tab.
Diese Steuerungsfläche ist unabhängig von der jeweils dargestellten
Reise-Kartenansicht. Die passive Reise-Rasterkarte dient Auswahl, Orientierung
und Detailanzeige, nicht als alleiniger Träger der Reisesteuerung.

## Bedienung und Editor-Verhalten

### Wie verbindlich sind heutige konkrete Bedienmuster?

**Bestätigte Antwort:** Ergebnis statt Gestendetail.

Gesichert werden schnelle und verständliche Auswahl, Vorschau, Bestätigung,
Abbruch, Undo und klare Ablehnung. LMB/RMB-Zuordnung, Dropdown-Verhalten,
Pixelbreiten und konkrete Buttonanordnung bleiben austauschbares UX-Design.

### Wann wird eine gültige Editor-Änderung dauerhaft?

**Bestätigte Antwort:** Pro bestätigter Aktion.

Jede abgeschlossene, validierte Bearbeitung wird unmittelbar gespeichert.
Vorschau und abgebrochene Gesten bleiben flüchtig. Ein globaler
Speichern-Button ist nicht erforderlich.

### Welchen Schutz braucht Authoring gegen Fehländerungen?

**Bestätigte Antwort:** Sitzungs-Undo plus sichere Daten.

Undo/Redo gilt für die laufende Editor-Sitzung. Gespeicherte Dungeons überleben
Neustarts und Updates zuverlässig mit Backup- und Migrationsschutz.

### Welche Mindesttiefe gilt für Undo/Redo?

**Bestätigte Antwort:** 200 kleine Änderungen.

Mindestens die letzten 200 üblichen bestätigten Änderungen bleiben
rücknehmbar. Sehr große Aktionen dürfen zusätzlich durch ein dokumentiertes
Speichergewicht begrenzt werden.

## Kartenumfang und Reaktionsqualität

### Welche Größenanforderung ist echter Nutzerbedarf?

**Bestätigte Antwort:** Sichtfenster-proportional.

Auch sehr große, sparse Dungeons sollen flüssig bleiben. 100.000 authored
Zellen dienen als konkrete Qualifikation, ohne als normales Kartenformat
behauptet zu werden. Die Arbeit soll vom sichtbaren oder berührten Ausschnitt
und nicht von unsichtbarem Karteninhalt abhängen.

### Welche messbare Interaktionsqualität gilt dabei?

**Bestätigte Antwort:** 16 ms Kamera, 50 ms Vorschau.

Kamera- und Hover-Arbeit bleibt im p95 innerhalb von 16 ms, Editorvorschau im
p95 unter 50 ms. Laden und Commit erhalten getrennte sichtbare Zustände.

## Kampagnenverknüpfungen und Laufzeitakteure

### Welche Verknüpfungen mit anderen SaltMarcher-Inhalten gehören zum Dungeon-Nutzen?

**Bestätigte Antwort:** Kampagnenobjekte verlinken.

Räume, Bereiche oder Marker können auf passende Orte, NPCs, Fraktionen,
Encounter, Items oder Szenen verweisen, ohne deren Wahrheit zu übernehmen.

### Wessen Position soll der Dungeon während des Spiels verwalten?

**Bestätigte Antwort:** Party plus relevante Akteure.

Neben der aktiven Party können ausgewählte NPCs, Gruppen oder bewegliche
Kampagnenobjekte räumlich verortet werden, ohne daraus eine taktische Battlemap
zu machen.

### Wie präzise sind diese Laufzeitpositionen?

**Korrigierte bestätigte Antwort:** Zellgenau während der Exploration.

Die frühere Antwort, Laufzeitpositionen nur einem Raum oder Bereich zuzuordnen,
ist verworfen. Während der Exploration besitzen Party, Gruppen und einzeln
bewegte Charaktere eine fachlich zellgenaue Position.

### Wie werden Party und einzelne Charaktere räumlich verwaltet?

**Bestätigte Antwort:** Party-Token aufteilen und neu gruppieren.

Einzelne Charaktere können aus dem gemeinsamen Party-Token herausgelöst,
einzeln bewegt oder zu separaten Gruppen zusammengefasst werden. Gruppen können
später wieder zusammengeführt werden. Die Exploration bleibt vom bereits
bestätigten Non-Goal einer vollständigen taktischen Battlemap abgegrenzt; der
genaue Umfang der Explorationsaktionen ist noch offen.

### Welche groben Navigationsorte braucht die zellgenaue Exploration trotzdem?

**Bestätigte Antwort:** Navigierbare Bereiche.

Räume sowie abgeleitete Korridorabschnitte, Kreuzungen, Treppenabsätze und
vergleichbare Entscheidungspunkte dürfen als navigierbare Bereiche dienen. Sie
strukturieren Reiseoptionen und Darstellung, ersetzen aber nicht die
zellgenaue Laufzeitposition.

### Wie bleibt Exploration von einer taktischen Battlemap abgegrenzt?

**Bestätigte Antwort:** Räumliche Exploration ohne Kampfaktionsökonomie.

Das Dungeon-Feature verwaltet zellgenaue Positionen, Heading, Gruppen, Wege,
Reisezeit, einfache Monsterbewegungen, Wahrnehmung, Spuren und ausgelöste
Ereignisse. Wenn ein Encounter, eine Falle oder eine andere offen aufzulösende
Situation eintritt, stoppt die Reise. Der GM löst sie am Spieltisch
beziehungsweise in einem dafür zuständigen anderen Feature.

Das Dungeon-Feature modelliert keine Angriffe, Zauber oder Kampfaktionen, keine
Trefferpunkte, Schäden oder Conditions als eigene Dungeon-Wahrheit, keine
taktische Initiative oder Sechs-Sekunden-Aktionsökonomie und keine
automatisierte Auflösung von Fallen, Encountern oder sonstigen freien
Handlungen. Spieler steuern ihre Charaktere nicht direkt.

## Reise, Zeit, Ereignisse und Protokoll

### Wie weit geht die Dungeon-Reisefähigkeit?

**Bestätigte Antwort:** Mit Zeit und Ereignissen.

Dungeon-Reise umfasst neben Positionsänderung auch Zeitfortschritt und
Ereigniskontext.

### Woher entstehen gültige Reiseoptionen?

**Nachgeschärfte bestätigte Antwort:** Aus Semantik und Geometrie.

Reise ist nicht auf vorher explizit angelegte Raumverbindungen beschränkt.
Türen, Korridore, Treppen und Übergänge liefern authored Semantik; zusätzlich
entstehen Optionen aus der tatsächlichen Geometrie. Dazu gehören lange oder
große Räume und Korridore, T-Kreuzungen, komplexe Pfadgabelungen sowie offene
vertikale Beziehungen.

Eine offene Galerie kann beispielsweise einen potenziellen Sprung über das
Geländer oder einen Kletterweg mit Enterhaken erlauben, auch wenn dafür kein
eigener Durchgang authored wurde.

### Wie werden potenzielle Sonderwege erkannt und bewertet?

**Bestätigte Antwort:** Geometrisch erkennen, vom GM bewerten lassen.

SaltMarcher erkennt potenzielle Sprung-, Kletter- und vergleichbare
Reisemöglichkeiten automatisch und rein aus der Geometrie. Charakterattribute
oder Ausrüstung bestimmen nicht, ob eine Möglichkeit als Kandidat sichtbar ist.
Der GM entscheidet vor der Reise, ob der konkrete Versuch machbar und
erfolgreich ist. Das Dungeon-Feature muss den Risikoversuch nicht selbst
auflösen; anschließend wird nur eine erfolgreiche Reise oder eine bewusste freie
Versetzung bestätigt.

### Wie weit reicht eine einzelne Navigation?

**Bestätigte Antwort:** Entscheidungspunkt plus geplante Autoroute.

Die normale Punkt-für-Punkt-Navigation endet am nächsten relevanten
Entscheidungspunkt. In der Gesamtkartenansicht kann der GM zusätzlich eine
vollständige Route zwischen zwei Punkten planen und automatisch durchlaufen
lassen.

Eine Autoroute schreibt jeden absolvierten Abschnitt bis zum nächsten
Entscheidungspunkt mit Position und Zeit atomar fest. Ein Ereignis, ein
inzwischen ungültiger Weg oder ein GM-Abbruch stoppt die Route; bereits
absolvierte Abschnitte bleiben erhalten.

### Wie verfolgt eine Autoroute ein bewegliches Ziel?

**Bestätigte Antwort:** Dynamische Verfolgung.

Der GM kann einen Charakter oder eine Gruppe zu einem anderen beweglichen
Akteur beziehungsweise einer anderen Gruppe reisen lassen. Die Autoroute wird
während der Reise an deren aktuelle Position angepasst. Sobald das Ziel
eingeholt ist, endet die Reise. SaltMarcher führt die Tokens nicht automatisch
zusammen; darüber entscheidet der GM.

### Nach welchen Regeln wird Reisezeit berechnet?

**Korrigierte bestätigte Antwort:** Feste D&D-5e-Regeln von 2014.

Die frühere rein geometrische Zeitannahme ist verworfen. Strecke, Terrain,
Klettern und weitere Bewegungsarten werden nach einem ausdrücklich
versionierten D&D-5e-Regelprofil von 2014 berechnet. Dafür werden die relevanten
Charakterattribute herangezogen; die Zeitberechnung benötigt keine freie
GM-Entscheidung. Die Erkennung eines potenziellen geometrischen Sonderwegs
bleibt davon getrennt.

### Wie wird diagonale und freie Weglänge auf dem Raster gemessen?

**Bestätigte Antwort:** Geometrisch genau.

SaltMarcher verwendet für diagonale und freie Wege die tatsächliche
geometrische Streckenlänge. Die vereinfachten Rastermethoden mit pauschal 5 Fuß
pro Diagonale oder abwechselnd 5 und 10 Fuß werden nicht verwendet. Die
weiteren Regeln des D&D-5e-2014-Profils, insbesondere Terrain-, Kletter- und
Bewegungsmodifikatoren, werden auf diese präzise Weglänge angewandt.

### Welche Zustände von Türen, Durchlässen und Terrain steuern Reiseoptionen?

**Bestätigte Antwort:** Explizite Passierbarkeit statt abgeleiteter
Entscheidungslogik.

SaltMarcher leitet aus Beschreibungen wie blockiert, verschlossen oder schwierig
keine eigene Entscheidung darüber ab, was die Gruppe tun darf. Eine Tür oder
ein Durchlass besitzt für die Wegfindung ausschließlich einen expliziten
binären Zustand: passierbar oder nicht passierbar. Beschreibende Merkmale
werden dem GM angezeigt und beeinflussen Formatierung und Platzierung in der
dynamisch erzeugten Raumbeschreibung, erzeugen aber keine zusätzlichen
Passierbarkeitsbedingungen.

Ein Schloss kann wie eine Falle als schlanker GM-authored Auslöser modelliert
werden. Beispielsweise öffnet SaltMarcher einen Dialog mit »Schloss,
Lockpicking DC 16«. Der GM handelt die Situation frei am Spieltisch ab und
schließt den Dialog anschließend, um die Reise fortzusetzen, oder bricht die
Reise ab. SaltMarcher simuliert weder den Versuch noch seinen Ausgang.

Schwieriges Terrain, Klettern und vergleichbare Bewegungsfaktoren verändern
regelkonform die Reisezeit. Diese Berechnung erfolgt während der Reise
unsichtbar im Hintergrund und verlangt keine zusätzliche Entscheidung des GM.

### Wie handeln getrennte Charaktere oder Gruppen in der Exploration?

**Bestätigte Richtung:** Vom GM geführte Explorationsinitiative mit
Akteurshandlungen.

Charaktere und getrennte Gruppen besitzen eigene Explorationshandlungen, aber
ausschließlich der GM bedient SaltMarcher. Spieler steuern ihre Charaktere
nicht selbst wie in einem VTT. Der GM setzt die am Spieltisch getroffenen
Spielerentscheidungen im Interface um.

Wenn der GM für einen Charakter oder eine abgetrennte Gruppe eine Reise startet,
werden deren folgende Runden automatisch mit Reise gefüllt, bis das Reiseziel
beziehungsweise die anderen Charaktere erreicht sind.

### Welche Geschwindigkeit gilt für ein zusammengefasstes Gruppentoken?

**Bestätigte Antwort:** Langsamstes Mitglied als überschreibbarer Standard.

Ein gemeinsames Gruppentoken bewegt sich standardmäßig mit der Geschwindigkeit
seines langsamsten berücksichtigten Mitglieds. Die Gruppe bleibt während dieser
Reise zusammen und alle Mitglieder erreichen das Ziel gleichzeitig.
Unterschiedliche interne Ankunftszeiten werden innerhalb eines
zusammengefassten Tokens nicht modelliert.

Im Reise-State-Tab kann der GM die berechnete Reisegeschwindigkeit der gesamten
Gruppe überschreiben. Er kann außerdem einzelne Mitglieder aus der Berechnung
ausschließen, beispielsweise wenn sie getragen werden, oder ihre für die Reise
verwendete Geschwindigkeit individuell überschreiben.

### Welchen Zeittakt verwendet die Explorationsinitiative?

**Bestätigte Antwort:** Vom GM gewählter fester Takt.

Der GM wählt für die Explorationsinitiative 1, 5, 10, 15 oder 30 Minuten pro
Runde oder gibt eine eigene Dauer ein. Außer Bewegung erhalten Handlungen keine
programmierten Arten oder Dauern. Sie werden am Spieltisch frei beschrieben und
aufgelöst, damit SaltMarcher weder die möglichen Handlungen einschränkt noch
eine umfassende Aktionsökonomie modellieren muss. Nur Bewegung verwendet die
nach dem bestätigten D&D-5e-2014-Regelprofil berechnete Dauer und belegt bei
längerer Reise automatisch folgende Runden.

### Wie läuft Zeit- und Ereignisfortschreibung ab?

**Bestätigte Antwort:** Automatisch fortschreiben.

Eine gültige, bestätigte Reise schreibt Position und Kalenderzeit automatisch
fort und aktiviert passende Ereignisse.

### Was darf automatisch passieren, ohne den Grundsatz „GM hat das letzte Wort“ zu verletzen?

**Bestätigte Antwort:** Zeit fortschreiben, Ereignis öffnen.

Eine bestätigte Bewegung aktualisiert Position und Zeit und aktiviert fällige
oder ermittelte Ereignisse. SaltMarcher entscheidet oder protokolliert deren
Ausgang nicht selbst; der GM löst, ändert oder verwirft den Ausgang.

### Welche Fehlersemantik gilt für Position, Zeit und Ereigniskontext?

**Bestätigte Antwort:** Position und Zeit pro Reiseabschnitt atomar.

Position und Zeit ändern sich gemeinsam oder gar nicht. Das anschließende
Öffnen eines Ereignisses darf separat wiederholbar fehlschlagen, ohne den
Reisezustand zu verfälschen. Bei einer Autoroute gilt diese Atomarität für jeden
bereits absolvierten Abschnitt bis zu einem Entscheidungspunkt, nicht für die
gesamte geplante Route.

### Welche Ereignisquellen dürfen automatisch aktiviert werden?

**Bestätigte Antwort:** Geplant plus kontextuell ermittelt.

Vorab geplante Ereignisse und vom GM konfigurierte, orts-, zeit- oder
akteursabhängige Ereignispools können fällig werden. SaltMarcher öffnet sie;
der GM entscheidet den Ausgang.

### Welche Ereignisse unterbrechen eine laufende Autoroute?

**Bestätigte Antwort:** Ausgelöste Gefahren und Begegnungen.

Neben einem ungültig gewordenen Weg und dem ausdrücklichen GM-Abbruch
unterbrechen insbesondere ausgelöste Fallen und Random Encounters die
automatische Reise. Auch eine Verfolgungsroute endet oder pausiert, wenn die
verfolgende Gruppe die Spur verliert. Eine Bestätigung in jeder gewöhnlichen
Explorationsrunde ist dafür nicht erforderlich.

### Wie werden Fallen behandelt?

**Bestätigte Antwort:** GM-authored Auslöser mit schlanker GM-Auflösung.

Fallen sind vom GM angelegte Dungeon-Features. Wenn eine Falle ausgelöst wird,
öffnet SaltMarcher einen Dialog mit ihrer Beschreibung. Der GM kann den Hinweis
schließen beziehungsweise die Falle als aufgelöst behandeln. SaltMarcher
entscheidet den Ausgang nicht selbst. Mehr Interaktion darf später ergänzt
werden, eine umfassende Fallensimulation ist aber kein Ziel, weil sie die
Entscheidungsfreiheit des GM einschränken würde.

### Welche langfristige Laufzeitfähigkeit brauchen Monstergruppen?

**Bestätigte Richtung, niedrige Priorität:** Bewegliche Gruppen mit einfachen
Tagesabläufen.

Monster können als bewegliche Gruppen auf der Dungeon-Karte eigene einfache
Tagesabläufe verfolgen. Ob eine Monstergruppe die Party bemerkt oder umgekehrt,
wird durch automatisierte Wahrnehmungsvergleiche ermittelt. In der Reiseansicht
kann der GM die passive Wahrnehmung eines Party-Mitglieds durch ein
eingetragenes Würfelergebnis ersetzen, wenn der Charakter aktiv Ausschau hält.
Ein ausgelöster Random Encounter unterbricht die Reise und wird dem GM zur
Auflösung geöffnet.

### Welche langfristige Verfolgungs- und Spurenfähigkeit wird erwartet?

**Bestätigte Richtung, niedrige Priorität:** Persistente Spuren und
probenbasierte Verfolgung.

Räume können Spuren enthalten. Party, NPCs und Gruppen können nach Spuren
Ausschau halten. Der GM trägt dafür ein Würfelergebnis ein; SaltMarcher speichert
es und vergleicht es mit vorhandenen Spuren. Wird eine Spur gefunden, erhält der
GM eine Benachrichtigung.

Bei einer laufenden Verfolgung bestimmen Überlebens- oder
Wahrnehmungsproben, ob die verfolgende Gruppe die Spur behält oder verliert.
Für NPCs können diese Prüfungen im Hintergrund automatisch erfolgen; für die
Party trägt der GM das Ergebnis ein. NPC-Gruppen dürfen im Rahmen ihrer
einfachen Routinen auch unbekannte Spuren, einschließlich Spuren der Party,
automatisch aufnehmen und verfolgen. Der GM wird darüber per Dialog
benachrichtigt.

Diese Monster-, Wahrnehmungs-, Verfolgungs- und Spurenfähigkeit hat geringe
Umsetzungspriorität. Sie muss nicht Teil der nächsten Lieferung sein. Die
langfristige Dungeon-Struktur soll ihre spätere Ergänzung ohne grundlegenden
Umbau ermöglichen.

### Welche Reisefakten werden automatisch protokolliert?

**Bestätigte Antwort:** Bestätigte Schritte protokollieren.

Bestätigte Ortswechsel, Zeitfortschritt, Übergänge und geöffnete Ereignisse
werden als nachvollziehbare Fakten protokolliert. Ereignisausgänge bleiben
GM-bestimmt.

### Wie funktioniert direkte Zielbewegung?

**Bestätigte Antwort:** Freie Versetzung.

Der GM kann die Position ohne Erreichbarkeitsprüfung auf ein Ziel setzen.

### Wie verhalten sich freie Versetzung und eigentliche Reise zueinander?

**Bestätigte Antwort:** Zwei getrennte Aktionen.

„Reisen“ nutzt die aus authored Semantik und Geometrie ermittelten gültigen Wege
und schreibt Zeit und Ereigniskontext fort. „Position setzen“ ist ein bewusster
GM-Override ohne automatische Zeit- oder Ereignisfortschreibung.

## Persistenz, Export und Import

### Welche langfristige Datenzusage braucht das Dungeon-Feature?

**Bestätigte Antwort:** Zusätzlich Export/Import.

Gespeicherte Dungeons bleiben über Neustarts und App-Updates erhalten;
Migrationen, Backup und Restore sind sicher. Zusätzlich gehört ein
versioniertes, portables Dungeon-Austauschformat zum Produktbedarf.

### Was enthält ein portabler Dungeon-Export?

**Bestätigte Antwort:** Dungeon plus Referenzen.

Der Export enthält vollständige authored Dungeon-Wahrheit und stabile Verweise
auf Kampagnenobjekte. Externe Ziele werden nicht ungefragt mitkopiert.

### Enthält der Export die laufende Spielsitzung?

**Bestätigte Antwort:** Nur authored Dungeon.

Party- und Akteurspositionen, Reiseprotokoll und Undo-Historie bleiben außerhalb
des Dungeon-Pakets.

### Wie behandelt ein Import Konflikte und fehlende Referenzen?

**Bestätigte Antwort:** Vorschau und Zuordnung.

Vor dem Import sieht der GM Identitätskonflikte und fehlende Ziele. Er kann neue
Identitäten erzeugen oder Referenzen zuordnen. Bestehende Inhalte werden nie
still überschrieben.

## Änderbarkeit als Qualitätsbedarf

### Woran wird „schnell und einfach anpassbar“ später geprüft?

**Bestätigte Antwort:** Drei Änderungsszenarien.

1. Eine neue authored Objekt- oder Editor-Werkzeugfamilie wird ergänzt.
2. Eine Reise-, Zeit- oder Ereignisregel wird geändert.
3. Ein UI- oder Persistenzadapter wird ausgetauscht oder entfernt.

Die Auswirkungen sollen lokal, explizit und ohne Änderungen an fachlich
unbeteiligten Features bleiben.

## Wiedereröffneter Discovery-Scope

Die bisherige Fragenliste war nicht vollständig. Sie klärte vor allem Reise,
Darstellungen, Persistenz und Qualitätsgrenzen, aber noch nicht ausreichend,
wie ein GM tatsächlich einen spielbaren Dungeon erstellt, überarbeitet und am
Tisch benutzt. Ergebnis 1 bleibt deshalb offen.

Die aktuellen Editor-Familien `Auswahl`, `Raum`, `Wand`, `Tür`,
`Korridor`, `Feature`, `Treppe` und `Übergang` sind nur Hypothesen aus
Code und Alt-Requirements. Auch bestehende Gesten, automatische
Geometrieentscheidungen, feste Formen und konkrete Routingregeln sind nicht
allein deshalb Produktbedarf.

### Noch produktseitig zu klärende Bereiche

1. **Authoring Journey**
   - Wie entsteht aus einer leeren Karte schrittweise ein spielbarer Dungeon?
   - Beginnt der GM typischerweise im Raster, im Graphen, mit einer Raumliste
     oder wechselt er bewusst zwischen diesen Arbeitsweisen?
   - Welche Arbeit muss bei Vorbereitung, Umbau und Improvisation schnell sein?

2. **Raster-Werkzeugkasten**
   - Welche Werkzeugfamilien braucht der GM wirklich?
   - Welche Formen erstellen, verändern, teilen, verbinden, gruppieren,
     duplizieren oder entfernen Räume und andere Geometrie?
   - Welche Automatik spart Arbeit, und welche würde dem GM unerwünscht
     Entscheidungen abnehmen?

3. **Auswahl und breite Bearbeitung**
   - Welche Einzel-, Mehrfach-, Bereichs-, Verschiebe-, Kopier- und
     Wiederholungsabläufe werden benötigt?
   - Wie werden überlagerte oder schwer treffbare Ziele verständlich ausgewählt?
   - Welche Batch-Änderungen sind für große Dungeons wesentlich?

4. **Räume, Bereiche und räumliche Semantik**
   - Welche Beziehung besteht zwischen Zellen, Räumen, Raumgruppen, Zonen und
     Ebenen?
   - Wie funktionieren unregelmäßige Formen, Löcher, offene Bereiche,
     Höhenunterschiede und ineinanderliegende Räume?
   - Welche Fakten werden authored und welche nur aus Geometrie abgeleitet?

5. **Wände, Öffnungen und Verbindungen**
   - Welche Arten von Wand, Tür, Tor, Bogen, Fenster, Durchlass, Korridor,
     Treppe, Leiter, Schacht, Rampe, Portal und Übergang sind relevant?
   - Wie werden Breite, Ausrichtung, Endpunkte, Verzweigungen, Einbahnigkeit und
     vertikale Beziehungen bearbeitet?
   - Wie reagiert der Editor auf Kollisionen und mehrdeutige Verbindungen?

6. **Dungeon-Inhalt**
   - Welche authored Fakten besitzen Räume, Türen, Fallen, Rätsel, Loot,
     Curiosities, Encounter, Objekte, Geheimnisse und Atmosphäre?
   - Was liegt an einer Zelle, was gehört zum Raum, was zu einer Raumgruppe und
     was verlinkt nur auf andere Campaign-Truth?
   - Welche Inhalte benötigen strukturierte Attribute, Freitext, Tabellen,
     Trigger oder einfache Zustände?

7. **Graph-Design-Erlebnis**
   - Welche Graph-Operationen verändern nur abstraktes Layout und welche sollen
     reale Rastergeometrie umordnen?
   - Wie werden Flow, Schleifen, Sackgassen, Entscheidungskomplexität,
     Reisezeiten und Content-Verteilung verständlich dargestellt?
   - Welche Hinweise helfen beim Design, ohne den Dungeon automatisch zu
     bewerten oder zu normieren?

8. **Dungeon-Key und Detailbearbeitung**
   - Welche Inhalte werden in großen Raumdialogen gemeinsam bearbeitet?
   - Wie werden generierte Beschreibung, authored Attribute, Vorlesetext,
     Geheimnisse und GM-Notizen getrennt oder kombiniert?
   - Welche schnellen Abläufe braucht der GM für viele ähnliche Räume?

9. **Spielvorbereitung und Live-Nutzung**
   - Welche Information muss während des Spiels auf einen Blick sichtbar sein?
   - Wie springt der GM zwischen Karte, Raumtext, Akteuren, Encounter, Loot und
     Ereignissen, ohne den Spielfluss zu verlieren?
   - Welche Editor-Arbeit muss auch während einer Sitzung sicher möglich sein?

10. **Priorität und Erlebniswirkung**
    - Welche Werkzeuge sind für einen brauchbaren ersten vollständigen
      Authoring-Flow unverzichtbar?
    - Welche Fähigkeiten sind Komfort, fortgeschrittenes Dungeon-Design oder
      bewusst spätere Erweiterung?
    - Welche Arbeitsweisen sollen gefördert werden, und welche Formen von
      Kleinarbeit, Überraschungsverlust oder Über-Simulation soll SaltMarcher
      vermeiden?

### Fortsetzungsreihenfolge

Die Befragung beginnt beim konkreten End-to-End-Authoring-Erlebnis und arbeitet
sich danach werkzeugweise durch Raster, Inhalt, Graph, Dungeon-Key und
Live-Nutzung. Erst wenn diese Produktfragen beantwortet sind, werden die
kanonischen Requirements wieder auf `Active` gesetzt und Ergebnis 1
abgeschlossen.
