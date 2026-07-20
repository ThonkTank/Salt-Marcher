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

### Was ist ein Dungeon als räumliche Einheit?

**Bestätigte Antwort:** Eine einzige zusammenhängende Dungeon-Gesamtheit.

Ein Dungeon umfasst die Gesamtheit aller zu ihm gehörenden Räume, Flächen,
Ebenen und räumlichen Inhalte. Er wird nicht in mehrere interne Dungeon-Karten
aufgeteilt, zwischen denen der GM wechseln muss. Auch weit auseinanderliegende
oder vertikal getrennte Abschnitte bleiben im selben Dungeon und in derselben
räumlichen Wahrheit.

Die Rasterkarte ist eine Darstellung dieses einen Dungeons, kein eigener
fachlicher Inhaltscontainer. Ein echter Übergang aus dieser Gesamtheit heraus
kann zu einem anderen Dungeon oder einem externen Ort führen.

### Welche räumliche Grundform besitzt der Dungeon?

**Bestätigte Richtung:** Ein durchgehendes voxelartiges 3D-Grid.

Der Dungeon wird als ein zusammenhängendes dreidimensionales Raster gedacht,
vergleichbar mit einer vereinfachten Minecraft-Welt. Die horizontale
Grundfläche arbeitet mit 5 x 5 Fuß. Vertikale Rastereinheiten bilden Höhe,
übereinanderliegende Flächen und Zwischenebenen im selben räumlichen Modell ab.

Der normale Raum- oder Flächen-Authoring-Flow verwendet 5 x 5 Fuß
horizontale Zellen und eine vertikale Auflösung von 5 Fuß. Neue begehbare
Flächen erhalten automatisch 10 Fuß lichte Standardhöhe. Boden, begehbares
Volumen und Standarddecke entstehen gemeinsam; der GM muss die vertikalen
Schichten nicht einzeln zeichnen.

Die Höhe kann später in 5-Fuß-Schritten verändert werden. Ein 5 Fuß hoher
Abschnitt kann bewusst einen niedrigen Tunnel, Kriechgang oder engen
Zwischenraum bilden; 15, 20 oder mehr Fuß hohe Räume bleiben ebenso möglich.
Übereinanderliegende Räume und kleine Höhenversätze existieren im selben
Dungeon-Raster.

Ebenen sind Ansichten oder Schnitte durch dieses gemeinsame 3D-Raster, keine
getrennten Inhaltscontainer. Wände, die für eine spätere realistischere
Darstellung frei oder nicht exakt auf dem Grid liegen, sind eine
niedrig priorisierte Erweiterung; das grundlegende Authoring darf zunächst
gridgebunden bleiben.

### Wie unterscheiden sich Volumen und Raum?

**Korrigierte bestätigte Antwort:** Geometrisches Volumen und semantischer Raum
sind gekoppelt, aber nicht identisch.

Ein Volumen ist reine Geometrie: ein durch feste Grenzen wie Wände, Türen,
Boden und Decke umschlossener, begehbarer Innenbereich. Kammern, Korridore,
Treppenräume und vergleichbare Formen können solche Volumen bilden. Für Reise
besteht zwischen diesen geometrischen Formen kein grundsätzlich anderes
Bewegungsmodell.

Ein Raum ist dagegen eine stabile GM-authored Inhaltsidentität, die einem
Volumen zugeordnet ist. Er trägt Namen, Beschreibungen, Features, Referenzen und
vergleichbare investierte GM-Arbeit. Verschiebt sich das zugeordnete Volumen,
bleibt es derselbe Raum.

Das zugeordnete Volumen darf in mehrere Navigationsbereiche zerlegt werden.
Diese strukturieren die für die Party relevanten Entscheidungen. Bei einem
verzweigten Korridor kann beispielsweise jeder Ast beziehungsweise die
Verzweigung einen eigenen Navigationsbereich bilden.

### Was geschieht mit authored Inhalten, wenn sich ihre Geometrie auflöst?

**Bestätigte Antwort:** Erhalten und nach Möglichkeit neu zuordnen.

Wird ein Volumen entfernt, geteilt oder so stark verändert, dass seine bisherige
Zuordnung nicht mehr eindeutig ist, versucht SaltMarcher den Raum nach
Möglichkeit einem passenden resultierenden Volumen wieder zuzuordnen. Gelingt
das nicht zuverlässig, bleibt der Raum mitsamt allen authored Inhalten ohne
Geometriezuordnung erhalten und kann später einem anderen Volumen zugewiesen
werden.

Dasselbe Schutzziel gilt für andere GM-authored Inhalte jenseits reiner
Geometrie. Türgeometrie und Türidentität sind eng verbunden, aber nicht
dasselbe. Wird die Geometrie einer beschriebenen Tür gelöscht, bleibt ihre
Inhaltsidentität mit Beschreibung und weiteren authored Fakten erhalten, bis
der GM sie erneut zuordnet oder ausdrücklich als Inhalt löscht.

Diese Aussage beschreibt ein gewünschtes Nutzererlebnis und eine
Verlustschutz-Garantie. Sie legt keinen technischen Speicheraufbau oder
Zuordnungsalgorithmus fest.

### Wie viele Räume und Volumen dürfen einander gleichzeitig zugeordnet sein?

**Bestätigte Antwort:** Höchstens eins zu eins, mit unzugeordneten Zwischenständen.

Ein Raum ist gleichzeitig höchstens einem Volumen zugeordnet und ein Volumen
höchstens einem Raum. Sowohl reine, noch unbeschriebene Volumen als auch
erhaltene Räume ohne aktuelle Geometriezuordnung sind zulässig.
Navigationsbereiche unterteilen ein Volumen; Raumgruppen fassen mehrere Räume
beziehungsweise Volumen zusammen.

### Dürfen authored Inhalte wiederverwendet werden?

**Bestätigte Richtung:** Ganze Inhalte oder ausgewählte Bestandteile kopieren
und neu zuweisen.

Der GM soll Räume, Raumbeschreibungen, Teile davon, Türen und vergleichbare
authored Inhalte kopieren und einer anderen passenden Geometrie zuweisen können.
So können beispielsweise zwei geometrisch getrennte Türen dieselben
Ausgangsinhalte erhalten. Die Eins-zu-eins-Zuordnung einer Inhaltsidentität zu
Geometrie verhindert nicht, daraus weitere Inhaltsidentitäten zu erzeugen.

Eine Beschreibung oder ein anderer unterstützter authored Inhalt kann einer
weiteren Geometrie erneut zugewiesen werden. Diese normale Wiederverwendung ist
standardmäßig entkoppelt: Die neue Instanz kann unabhängig verändert werden.

Alternativ kann der GM aus dem Inhalt ausdrücklich eine Vorlage machen und diese
mehrfach zuweisen. Solche Instanzen bleiben mit der Vorlage gekoppelt.
Änderungen an der Vorlage werden automatisch auf alle noch gekoppelten
Instanzen übertragen. Der GM kann eine einzelne Instanz bewusst entkoppeln und
anschließend individuell bearbeiten.

Als gute Startannahme darf eine Vorlage frei ausgewählte authored Bausteine
enthalten, beispielsweise eine vollständige Beschreibung, einzelne
Textabschnitte, Attribute, Zustände oder Features. Geometrie, geometrische
Zuordnung und stabile Objektidentität gehören nicht zur Vorlage. Nur die
ausgewählten Bausteine bleiben gekoppelt; andere Instanzinhalte bleiben
individuell bearbeitbar. Ein gekoppelter Baustein muss vor individueller
Bearbeitung entkoppelt werden.

Diese Granularität ist ausdrücklich eine überprüfbare Startannahme und soll nach
praktischen Nutzungstests angepasst werden dürfen.

### Können Wände, Böden und Decken eigene Inhaltsidentitäten tragen?

**Bestätigte Antwort:** Ja, für ausdrücklich beschriebene Flächenbereiche.

Ein Raum kann Standardattribute für sein gesamtes zugeordnetes Volumen
enthalten, beispielsweise »Wände aus grauem Stein«. Der GM darf
zusammenhängende Wand-, Boden- oder Deckenbereiche auswählen und ihnen
abweichende Beschreibungen, Attribute oder Vorlagen zuweisen. Diese lokalen
Angaben überschreiben die Raumstandards für den betroffenen Bereich.

Ein ausdrücklich beschriebener Flächenbereich erhält denselben Verlustschutz
wie Räume und Türen. Wird seine Geometrie entfernt oder unkenntlich, bleiben die
authored Inhalte unzugeordnet erhalten. Reine, unbeschriebene Geometrie benötigt
dagegen nicht automatisch für jede einzelne Rasterfläche eine eigene
Inhaltsidentität. Durchlässe bleiben aufgrund ihrer Reisebedeutung
eigenständige Objekte.

### Wie werden Dungeon-Features räumlich verankert?

**Bestätigte Antwort:** Exakte Voxelposition innerhalb eines Volumens.

Encounter, Fallen, Loot, Curiosities und andere Dungeon-Features werden zunächst
jeweils einer bestimmten dreidimensionalen Voxelposition zugeordnet. Der Anker
gehört zum umgebenden Volumen. Wird dieses verschoben oder verformt, bewegt sich
das Feature passend mit.

Kann ein Anker nach einer destruktiven Geometrieänderung nicht mehr zuverlässig
abgebildet werden, gilt dasselbe Verlustschutzziel wie für andere authored
Inhalte: Das Feature bleibt erhalten und kann neu zugeordnet werden.

Encounter sind zunächst ebenfalls ortsfest authored. Eine optionale spätere
Fähigkeit macht ausgewählte Encounter beziehungsweise ihre beteiligten Gruppen
mobil.

### Welche Features aktivieren sich automatisch durch räumliche Annäherung?

**Bestätigte Antwort:** Nur Fallen und Encounter.

Loot und Curiosities öffnen nicht allein aufgrund räumlicher Nähe automatisch
ein Pop-up. Fallen dürfen zusätzlich zu ihrem eigenen Voxelanker optionale
separate Triggerfelder besitzen. Betritt die Party ein solches Feld, kann die
Falle angezeigt und Reise unterbrochen werden. Ohne Triggerfeld bleibt die
Falle manuell durch den GM behandelbar.

Für Encounter ist als überprüfbare Startannahme ein aus den Monsterwerten
abgeleiteter Erkennungsradius vorgesehen. Die genaue spätere
Wahrnehmungsberechnung bleibt noch zu klären und muss mit den bereits
vorgesehenen automatisierten Perception-Vergleichen zusammenpassen.

### Welche geometrische Form besitzen Fallen-Triggerfelder?

**Bestätigte Antwort:** Null bis mehrere frei markierbare Voxelbereiche.

Eine Falle kann kein, ein oder mehrere Triggerfelder besitzen. Jedes Feld ist
eine frei markierbare Menge von Voxeln und muss keinen Kreis oder festen Radius
bilden. Die Voxel bleiben an ihre jeweiligen Volumen gekoppelt und folgen deren
Verschiebung oder Verformung. Eine Türfalle kann dadurch beispielsweise
Triggerfelder auf beiden Seiten des Durchlasses besitzen.

Triggerfelder erzeugen ausschließlich Benachrichtigung und gegebenenfalls eine
Reiseunterbrechung. Sie verändern keine Passierbarkeit und entscheiden weder
Auslösungserfolg noch Folgen der Falle.

### Welche wiederholbare Aktivierung darf eine Falle besitzen?

**Bestätigte Antwort:** Optionale Charges und Reset Duration.

Eine Falle darf eine Anzahl von Charges besitzen. Diese beschreibt, wie oft sie
hintereinander tatsächlich ausgelöst werden kann. Zusätzlich darf sie eine
Reset Duration besitzen, die angibt, wie lange die Wiederherstellung ihrer
Charges dauert.

In einer deutlich späteren Erweiterung darf auch ein manueller Reset der Falle
als Handlung innerhalb eines einfachen Monster-Tagesablaufs vorkommen. Diese
Automatisierung hat sehr geringe Priorität und ändert nichts daran, dass
SaltMarcher die konkrete Wirkung der Falle nicht adjudiziert.

Eine Charge wird erst verbraucht, wenn der GM eine tatsächliche Auslösung
bestätigt, nicht bereits beim Betreten eines Triggerfelds. Die Falle besitzt
maximale und aktuelle Charges. Bei null Charges kann sie nicht erneut
automatisch auslösen.

Nach Ablauf der Reset Duration werden alle Charges gemeinsam vollständig
wiederhergestellt. Der GM wählt pro Falle, ob der Countdown erst bei null
Charges oder bereits beginnt, sobald die aktuellen Charges unter dem Maximum
liegen. Wird während eines laufenden Countdowns eine weitere Charge verbraucht,
läuft der bestehende Countdown weiter und beginnt nicht erneut. Nach Ablauf
werden unabhängig vom zwischenzeitlichen Verbrauch alle Charges aufgefüllt.
Aktuelle Charges und Reset dürfen jederzeit manuell korrigiert werden.

### Woher stammen Monster und Werte eines Dungeon-Encounters?

**Bestätigte Antwort:** Primär aus dem bereits vorhandenen Encounter-Feature.

Beim Platzieren verwendet der GM hauptsächlich einen bereits in SaltMarcher
angelegten Encounter beziehungsweise dessen Monstergruppe. Der Dungeon baut
Monsterzusammensetzung und Stat-Werte nicht als zweite Inhaltswahrheit nach.

Die Dungeon-Platzierung ergänzt den exakten Voxelanker sowie lokale
Dungeon-Hinweise, Erkennungsverhalten und später gegebenenfalls einen
Tagesablauf. Die zugrunde liegende Encounter-Zusammensetzung und Monsterwerte
bleiben mit dem vorhandenen Encounter-Feature verbunden.

Ein konkreter Encounter beziehungsweise eine konkrete Monstergruppe darf nur
eine aktuelle Dungeon-Platzierung besitzen. Soll dieselbe Zusammenstellung
mehrfach vorkommen, kopiert der GM den Encounter und erhält unabhängige Gruppen.
Spätere Mobilität verändert den Voxelanker derselben Gruppe, statt zusätzliche
Platzierungen zu erzeugen.

### Woher stammen die Inhalte eines Dungeon-Loot-Features?

**Bestätigte Antwort:** Aus demselben gemeinsamen Loot-Objekt wie in anderen
Produktbereichen.

Der Dungeon soll Währungen, Gegenstände und Magic Items nicht als eigene zweite
Loot-Wahrheit nachbauen. Er verwendet vorhandene Loot-Inhalte beziehungsweise
verweist auf das spätere gemeinsame Loot-Feature. Sobald Encounter und Session
Generation ebenfalls dieses gemeinsame Modell verwenden, beziehen sich alle
drei Bereiche auf dasselbe Loot-Objekt.

Die Dungeon-Platzierung ergänzt den exakten Voxelanker und lokalen
Dungeon-Kontext. Die fachlichen Loot-Inhalte bleiben im gemeinsamen
Loot-Feature.

Ein konkretes Loot-Objekt besitzt höchstens einen aktuellen Dungeon-Anker.
Encounter und Session Generation dürfen dasselbe Objekt referenzieren, ohne
weitere räumliche Exemplare zu erzeugen. Soll gleichartiger Loot an mehreren
Orten existieren, erstellt der GM unabhängige Kopien. Eine spätere Bewegung
ändert den vorhandenen Anker.

### Ist ein Rätsel eine eigene Dungeon-Feature-Art?

**Bestätigte Antwort:** Nein, sondern eine klassifizierte Curiosity.

Curiosity bleibt das gemeinsame Inhaltsmodell für interaktive Besonderheiten.
»Rätsel« ist eine eingebaute Kategorie beziehungsweise Kennzeichnung; weitere
frei definierbare Tags dürfen hinzukommen. Die Heatmap kann dadurch sowohl alle
Curiosities zählen als auch die Rätsel-Teilmenge gesondert darstellen.
Curiosities werden weiterhin nicht qualitativ bewertet.

### Wie stark ist eine Curiosity zunächst strukturiert?

**Bestätigte Antwort:** Wenige klar getrennte Freitextbereiche.

Eine Curiosity besitzt zunächst einen Namen, eine spielerlesbare beziehungsweise
vorlesbare Beschreibung, GM-Notizen zur Funktionsweise, Lösung oder möglichen
Reaktionen sowie Kategorien und Tags. Sie besitzt keine programmierten
Lösungsschritte, Erfolgsbedingungen oder automatischen Folgen.

Spätere optionale Verknüpfungen wie »Tür entsperren« dürfen auf diesem Inhalt
aufbauen, ersetzen aber weder den Freitext noch die Entscheidungsfreiheit des
GM.

### Wie werden beschreibende Attribute erfasst und vererbt?

**Bestätigte Antwort:** Freie Werte in einer hierarchischen Attributstruktur.

Häufige Kategorien wie Material, Zustand, Licht, Temperatur, Feuchtigkeit,
Geruch, Geräusch und Atmosphäre bieten Ordnung, ohne den GM auf vorgegebene
Werte zu beschränken. Zusätzlich darf er eigene Attribute benennen und
besondere Formulierungen als Freitext ergänzen. Attribute erzeugen niemals
stillschweigend Regeln, Passierbarkeit oder Effekte.

Die Vererbungshierarchie lautet Dungeon, optionale Ebene, optionale Gruppe,
Raum und schließlich ausdrücklich beschriebene Teilfläche. Eine Ebene umfasst
eine vom GM bestimmte Menge von Z-Leveln im gemeinsamen 3D-Dungeon; sie ist
keine getrennte Karte. Jede Vererbungszuordnung besitzt einen eindeutigen
Elternpfad.

Konkretere Ebenen überschreiben geerbte Werte für ihren Geltungsbereich. Aus
»alle Wände sind standardmäßig aus Ziegeln« kann so in einer Raumgruppe »mit
Holz vertäfelt« und in einem einzelnen Raum »rot tapeziert« werden.
Zusätzliche überlappende Sammlungen oder Tags dürfen Filter und Heatmaps
unterstützen, vererben jedoch keine Attribute.

Ein Raum wird ausdrücklich höchstens einer fachlichen Ebene zugeordnet.
SaltMarcher darf anhand der Lage seines Volumens eine Ebene vorschlagen,
erzwingt die Zuordnung jedoch nicht. Ein hoher Saal, Treppenraum oder anderes
mehrere Z-Level überspannendes Volumen darf der konzeptionell passenden Ebene
zugeordnet werden oder die Ebenenstufe überspringen und direkt unter dem
Dungeon liegen. Seine Geometrie wird dafür weder geteilt noch verändert.

Die Z-Level-Mengen fachlicher Ebenen überlappen sich für die Vererbung nicht.

Die zulässigen fachlichen Elternpfade sind Dungeon zu Raum, Dungeon zu Gruppe
zu Raum, Dungeon zu Ebene zu Raum sowie Dungeon zu Ebene zu Gruppe zu Raum.
Eine Gruppe direkt unter dem Dungeon darf Räume über mehrere Z-Level hinweg
zusammenfassen. Eine Gruppe unter einer Ebene bleibt auf deren fachlichen
Bereich beschränkt. Weitere verschachtelte Gruppenstufen sind zunächst nicht
vorgesehen.

Unterschiedliche Attribute werden gemeinsam geerbt. So können beispielsweise
»Grundmaterial: Ziegel« und »Oberflächenverkleidung: Holz« gleichzeitig wirken.
Setzt eine konkretere Ebene denselben Attributschlüssel erneut, ersetzt sie nur
diesen Wert. Ein Raum kann dadurch die geerbte Holzverkleidung mit roter Tapete
überschreiben und das Grundmaterial weiterhin erben. Der GM darf einen geerbten
Wert außerdem ausdrücklich unterdrücken oder leeren. SaltMarcher zeigt den
wirksamen Wert und seine Herkunft.

### Wie setzt sich die GM-kontrollierte Raumbeschreibung zusammen?

**Bestätigte Antwort:** Aus geordneten authored und dynamischen Blöcken.

Eine Raumbeschreibung kann frei authored Vorlesetext, geometrisch erzeugte
Fakten, geerbte und lokale Attribute, Ausgänge und sichtbare Durchlässe sowie
weitere freie Textblöcke enthalten. Der GM darf diese Blöcke umsortieren,
einzelne automatisch erzeugte Fakten ausblenden und eigene Übergangstexte
einfügen.

Geometrieänderungen aktualisieren ausschließlich die betroffenen abgeleiteten
Fakten. GM-authored Text bleibt unverändert. SaltMarcher zeigt eine Vorschau für
eine vom GM gewählte Blick- beziehungsweise Eintrittsrichtung.

### Wie werden Geheimnisse in Beschreibungen behandelt?

**Bestätigte Antwort:** Authored Sichtbarkeit plus getrennte Entdeckung.

Beschreibungsblöcke und relevante Objekte dürfen als normal sichtbar, nur für
den GM oder bis zur Entdeckung verborgen markiert werden. Eine unentdeckte
Geheimtür erscheint weder im Vorlesetext noch als sichtbarer Ausgang.

»Geheim« bleibt eine authored Eigenschaft. »Von dieser Party entdeckt« ist
davon getrennte Laufzeitinformation. Der GM kann eine Beschreibung im
unentdeckten und im entdeckten Zustand voranzeigen. Das Verbergen verändert
keine explizite Passierbarkeit.

Verborgenes Material darf optional eine Suchart wie Wahrnehmung oder
Nachforschungen, einen DC, privaten GM-Text zur Entdeckung sowie den danach
sichtbaren Text beziehungsweise die sichtbaren Fakten enthalten. SaltMarcher
darf passive Werte oder ein vom GM eingegebenes aktives Wurfergebnis vergleichen
und den GM privat benachrichtigen. Enthüllt wird das Geheimnis erst nach
GM-Bestätigung. Manuelles Enthüllen und erneutes Verbergen bleiben möglich.

### Welche grundlegenden Formen räumlichen Authorings gibt es?

**Bestätigte Antwort:** Fest gezeichnete Flächen und dynamisch erzeugte Pfade.

Eine Fläche besitzt direkt gezeichnete, verankerte Geometrie. Sie bleibt in
dieser Form bestehen, bis der GM sie ausdrücklich verändert oder entfernt.

Ein Pfad wird dynamisch zwischen zwei oder mehreren End- beziehungsweise
Wegpunkten erzeugt. Korridore und Treppen sind typische Pfad-Authoring-Formen.
Der erzeugte Pfad materialisiert ein begrenztes, begehbares Volumen. Dieses
kann wie andere Volumen einem Raum zugeordnet und für Beschreibung, Navigation
und Reise verwendet werden.

Fläche und Pfad bezeichnen damit primär unterschiedliche
Erzeugungs- und Bearbeitungsweisen, nicht zwei inkompatible Arten von Raum, in
denen andere Reiseregeln gelten.

### Sind Korridore und Treppen unterschiedliche Pfadmodelle?

**Bestätigte Antwort:** Ein einheitlicher dreidimensionaler Verbindungspfad.

Korridore und Treppen werden nicht als getrennte grundlegende Inhaltsmodelle
behandelt. Der GM verbindet zwei oder mehrere Punkte beziehungsweise Räume im
gemeinsamen 3D-Dungeon. Der daraus erzeugte Pfad darf horizontalen Gang,
Höhenwechsel und Treppenabschnitte in einer zusammenhängenden Verbindung
kombinieren.

Eine Verbindung zwischen Raum A auf einer Höhe und Raum B auf einer anderen
Höhe kann damit automatisch die erforderlichen Gänge und Treppen enthalten.
Die einzelnen Segmente behalten sichtbare Form und beschreibbare Eigenschaften,
gehören aber zu demselben parametrischen Pfad und demselben
Generierungs- und Bearbeitungsmodell.

Dasselbe Pfadmodell umfasst außerdem Rampen, Leitern, Schächte und vergleichbare
Verbindungsformen. Der Pfad speichert Endpunkte, optionale Wegpunkte, Breite,
Höhe und bei Bedarf abschnittsweise eine authored Verbindungsform wie Gang,
Treppe, Rampe, Leiter oder Schacht. SaltMarcher darf dafür passende
Segmentformen und deren Verlauf vorschlagen; der GM kann bestimmte Formen oder
Positionen erzwingen. Diese Segmente sind Eigenschaften desselben Pfades, keine
eigenen grundlegenden Inhaltsmodelle.

Der akzeptierte Pfad bleibt durch Endpunkte, optionale Wegpunkte, Breite und
weitere Pfadparameter definiert; seine konkrete Voxelgeometrie wird daraus
abgeleitet. Verschiebt sich ein verbundener Raum oder Endpunkt, zeigt
SaltMarcher eine neu berechnete Führung als Preview. Der GM bearbeitet den Pfad
normalerweise über Punkte und Parameter.

Für vollständig individuelle Geometrie kann der GM einen Pfad bewusst in eine
feste Fläche umwandeln. Die aktuelle Form wird dadurch direkt authored und
anschließend nicht mehr automatisch geroutet.

### Woran sind die Endpunkte eines Pfades befestigt?

**Bestätigte Antwort:** Navigationsbereich plus exakter 3D-Grenzanker.

Jeder Pfadendpunkt gehört semantisch zu einem bestimmten Navigationsbereich
eines Raums und besitzt zusätzlich einen exakten dreidimensionalen Anker an
dessen Grenze. Dadurch bewahrt der Graph die fachliche Verbindung, während die
Rasteransicht den konkreten räumlichen Anschluss kennt.

Der GM darf zunächst lediglich die zu verbindenden Räume beziehungsweise
Navigationsbereiche bestimmen. SaltMarcher schlägt dafür geeignete Grenzanker
vor. Der GM kann diese Anker anschließend verschieben oder fixieren.

### Gehören Türen und Öffnungen zum Pfad?

**Bestätigte Antwort:** Eigenständige Durchlässe in der Raumgrenze.

Ein Pfad endet an einem eigenen Durchlassobjekt in der jeweiligen
Volumengrenze.
Der Durchlass kann ein offener Durchgang, eine Tür, Luke, Geheimtür oder eine
vergleichbare Form sein. Er besitzt seine Beschreibung und den expliziten
binären Passierbarkeitszustand.

Der Pfad selbst besitzt dagegen Verlauf und Reiseeigenschaften. Beim Erzeugen
eines Pfades darf SaltMarcher zunächst passende offene Durchlässe anlegen. Der
GM kann sie anschließend in Türen oder andere Durchlassformen ändern.

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

### Woher stammen die Content-Fakten der Heatmap?

**Bestätigte Antwort:** Ausschließlich aus authored Dungeon-Features.

Encounter, Fallen, Loot und Curiosities sind eigene Dungeon-Feature-Arten.
Heatmap und Pacing-Auswertung zählen oder bewerten keine frei aus
Raumbeschreibungen erratenen Inhalte, sondern verwenden ausschließlich diese
explizit authored Features.

Curiosities organisieren Rätsel und andere interaktive Dungeon-Features.
Zunächst bestehen sie im Wesentlichen aus Freitext. Später dürfen optionale
Verknüpfungen oder einfache Folgen ergänzt werden, beispielsweise »wenn X
passiert, gehen alle Lichter im Raum aus« oder »Tür Z wird entsperrt«.
Curiosities werden für die Heatmap nicht qualitativ bewertet, sondern nur
gezählt.

### Soll SaltMarcher Unter- und Überfüllung anzeigen?

**Bestätigte Richtung:** Beratende Pacing-Hinweise.

Neben der neutralen Heatmap soll die Auswertung Stellen markieren können, an
denen wahrscheinlich zu wenig oder zu viel Content konzentriert ist. Diese
Hinweise bleiben beratend und blockieren Authoring nicht.

The Alexandrians »Game Structure: Sector Crawl« nennt für klassischen
Raum-für-Raum-Dungeoncrawl als groben Richtwert, dass wahrscheinlich mindestens
etwa die Hälfte der Räume interessanten Inhalt benötigt, damit das Pacing nicht
in einer Folge leerer Räume zusammenbricht. Seine Dungeon-Typologie
unterscheidet außerdem featured und scenic rooms. Diese Aussagen sind
Referenzhypothesen für Profile und Warnungen, keine universellen
Qualitätsgesetze. Eine allgemeine feste Obergrenze ist daraus nicht bestätigt.

### Wie werden Gefahr, Loot und Curiosities konkret ausgewertet?

**Bestätigte Antwort:** Vorhandene DMG-Budgets plus lokale Curiosity-Dichte.

Für Gefahr und Loot verwendet SaltMarcher die bereits im Programm modellierten
DMG-basierten Richtlinien. Der GM legt fest, für welches Charakterlevel und wie
viele Spielsitzungen ein Dungeon, eine Ebene oder ein Bereich ausgelegt ist.
Dagegen werden die aus authored Dungeon-Features ermittelten XP-, Gold- und
Magic-Item-Budgets ausgewertet.

Curiosities werden nicht nach Qualität oder vermeintlicher Bedeutung gewichtet.
Ihre Auswertung verwendet ausschließlich Anzahl und lokale Dichte. Allgemeine
Feature-Dichte und Alexandrian-Hinweise können ergänzend auf unter- oder
überfüllte Abschnitte hinweisen, ersetzen aber für Gefahr und Loot nicht die
vorhandenen regelbasierten Budgets.

### Wie vererben sich Ziellevel und Sitzungsbudgets?

**Bestätigte Antwort:** Level vererben, Sitzungen explizit verteilen.

Der Dungeon definiert ein Standard-Charakterlevel. Ebenen und Bereiche erben
dieses Level, solange der GM dort kein eigenes Ziellevel setzt.

Die geplante Sitzungszahl des gesamten Dungeons wird nicht automatisch
vollständig auf jede Untereinheit vererbt. Der GM verteilt Sitzungsanteile
explizit auf Ebenen oder Bereiche; nicht zugewiesene Anteile bleiben sichtbar.
Teilbudgets und tatsächlicher Feature-Content werden in übergeordneten
Auswertungen ohne Doppelzählung zusammengeführt.

Ein Bereich ohne eigene Sitzungszuweisung erhält weiterhin neutrale
Content-Heatmaps, Curiosity-Dichte und allgemeine Verteilungshinweise, aber
keine irreführende XP-, Gold- oder Magic-Item-Budgetwarnung.

Zusätzliche Designreferenzen:

- https://thealexandrian.net/wordpress/45878/roleplaying-games/game-structure-sector-crawl
- https://thealexandrian.net/wordpress/49606/roleplaying-games/types-of-dungeons

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

### Korrigierte Fortsetzungsreihenfolge

Die Werkzeug- und Workflow-Fragen werden zurückgestellt, bis die fachliche Form
der bearbeiteten Dungeon-Inhalte geklärt ist. Die Discovery arbeitet nun in
dieser Reihenfolge:

1. topologische Hierarchie aus Dungeon, Karten, Ebenen, Bereichen und Räumen
2. räumliche Grundformen, Grenzen, Öffnungen und Verbindungen
3. authored gegenüber abgeleiteten Fakten je Inhaltsart
4. Dungeon-Features, ihre Verankerung, Attribute und Beziehungen
5. Zustände, Trigger und klare Grenze zu freier GM-Auflösung
6. Identität, Gruppierung, Verschachtelung, Kopieren und Lebenszyklus
7. erst daraus abgeleitete Raster-, Graph- und Dungeon-Key-Werkzeuge
8. End-to-End-Authoring und Live-Nutzung

»Was wird bearbeitet?« wird damit vor »Wie wird es bearbeitet?« beantwortet.
Interne Tabellen-, Klassen- oder Speicherentscheidungen bleiben technische
Systemverantwortung; das Interview klärt die fachlich dauerhaften authored und
abgeleiteten Fakten.

Erst wenn diese Produktfragen beantwortet sind, werden die kanonischen
Requirements wieder auf `Active` gesetzt und Ergebnis 1 abgeschlossen.
