Status: Draft
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

**Aktueller Arbeitsstand:** Nur Ergebnis 1 ist in Arbeit. Dieses Interview
sichert die Owner-Antworten. Es enthält noch kein Urteil über den Ist-Zustand und
noch keinen Architekturentwurf.

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

**Bestätigte Antwort:** Lokaler GM allein.

Die Zielnutzung ist ein einzelner GM auf einem lokalen Desktop. Spieleransicht,
Remotezugriff und Mehrbenutzerbetrieb sind keine langfristigen Anforderungen
dieser Baseline.

### Welche langfristige Dungeon-Fähigkeit ist Produktbedarf?

**Bestätigte Antwort:** Vollständiges Authoring plus Reise.

Kartenverwaltung, Räume, Wände, Türen, Korridore, Treppen, Übergänge, Marker,
Beschreibungen, Inspektion und Party-Reise bilden den Kern. Weitere
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

**Bestätigte Antwort:** Bidirektional synchron.

Auswahl und Navigation springen zwischen demselben Raum oder Bereich in allen
drei Darstellungen. Bearbeitungen erscheinen konsistent aus einer gemeinsamen
Dungeon-Wahrheit.

### Wie funktionieren die Nummern im klassischen Dungeon-Key?

**Bestätigte Antwort:** Stabil und editierbar.

SaltMarcher vergibt zunächst eindeutige Anzeigenummern. Der GM kann sie
umordnen oder ändern, ohne interne Identität oder Verknüpfungen zu verlieren.

### Welche Inhalte bündelt ein Raumlisten-Eintrag mindestens?

**Bestätigte Antwort:** Vollständiger GM-Key.

Ein Eintrag enthält Nummer, Name, Vorlesetext, GM-Notizen oder Beschreibung,
Ausgänge und Verbindungen sowie verknüpfte Akteure, Objekte, Encounter und
Ereignisse.

### Soll der Dungeon-Key außerhalb der App ausgebbar sein?

**Bestätigte Antwort:** Ansicht plus Dokumentexport.

Der GM kann die synchronisierte Raumliste in der App nutzen und zusammen mit
Karte und Verweisen als druck- oder teilbares, menschenlesbares Dokument
exportieren.

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

### Nach welchen Regeln wird Reisezeit berechnet?

**Korrigierte bestätigte Antwort:** Feste D&D-5e-Regeln von 2014.

Die frühere rein geometrische Zeitannahme ist verworfen. Strecke, Terrain,
Klettern und weitere Bewegungsarten werden nach einem ausdrücklich
versionierten D&D-5e-Regelprofil von 2014 berechnet. Dafür werden die relevanten
Charakterattribute herangezogen; die Zeitberechnung benötigt keine freie
GM-Entscheidung. Die Erkennung eines potenziellen geometrischen Sonderwegs
bleibt davon getrennt.

### Wie handeln getrennte Charaktere oder Gruppen in der Exploration?

**Bestätigte Richtung:** Explorationsinitiative mit Charakteraktionen.

Charaktere erhalten eigene Explorationshandlungen. Wenn ein Charakter oder eine
abgetrennte Gruppe reist, werden ihre folgenden Runden automatisch mit Reise
gefüllt, bis das Reiseziel beziehungsweise die anderen Charaktere erreicht
ist. Das Verhalten beim Einholen beweglicher Ziele ist noch nicht abschließend
entschieden.

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

## Remote-Fortsetzung und noch zu klären

Ein fortsetzender Agent soll zuerst dieses Interview und danach die bestehenden
Dungeon-Requirements als Hypothesen lesen. Neue Bedürfnisse werden nicht aus dem
heutigen Code abgeleitet und noch nicht gegen die heutige Architektur bewertet.
Nach jeder Owner-Antwort ist dieses Protokoll zu aktualisieren; erst die
abschließend bestätigte Interpretation wird in die kanonischen englischen
Requirements überführt.

Die nächsten bereits vorbereiteten Fragen sind:

1. Wie verhalten sich eine laufende Autoroute und ein bewegliches Ziel, wenn ein
   Charakter eine andere Gruppe einholt?
2. Welche Unterbrechungen außer Ereignis, ungültigem Weg und GM-Abbruch stoppen
   automatische Reise?
3. Welche D&D-5e-2014-Bewegungsdetails gehören verbindlich zum Regelprofil,
   insbesondere Diagonalen, schwieriges Terrain, Klettern, Springen und
   unterschiedliche Bewegungsraten?

Danach sind mindestens folgende Bedarfsfragen offen:

- Wie verhalten sich eine laufende Autoroute und ein bewegliches Ziel, wenn ein
  Charakter eine andere Gruppe einholt?
- Welche Unterbrechungen außer Ereignis, ungültigem Weg und GM-Abbruch stoppen
  automatische Reise?
- Welche D&D-5e-2014-Bewegungsdetails gehören verbindlich zum Regelprofil,
  insbesondere Diagonalen, schwieriges Terrain, Klettern, Springen und
  unterschiedliche Bewegungsraten?
- Welche Zustände von Türen, Durchlässen und Terrain beeinflussen sichtbare oder
  ausführbare Reiseoptionen?
- Welche Bearbeitungen müssen direkt in Rasterkarte, Beziehungsgraph und
  Raumliste möglich sein, statt dort nur synchron sichtbar zu werden?
- Wie bleibt die zellgenaue Exploration klar von einer vollständigen
  taktischen Battlemap und Encounter-Aktionsökonomie abgegrenzt?

Ergebnis 1 ist erst abgeschlossen, wenn diese Entscheidungen sowie daraus
abgeleitete lösungsneutrale technische und qualitative Bedürfnisse vom Owner
bestätigt und in den kanonischen Requirements verankert sind.
