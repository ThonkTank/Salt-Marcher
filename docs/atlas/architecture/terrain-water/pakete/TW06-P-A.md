# TW06-P-A — Begrenzter Anschluss der Autorenbänder an den Pinselstand

Status: Gestartet 26.10.2026 21:27 UTC; feste Producerfolge positiv, globaler Checkpoint-/Sourceprefixanschluss offen. Keine Produktumsetzung freigegeben.
Owner: bisheriger P-Implementierer tw06_boundary_implementation, gpt-6.1-sol/high.
Last Reviewed: 2026-10-26
Source of Truth: Einmaliger begrenzter Producerauftrag vor Freigabe der P-Repräsentation und Probeetats.

## Ergebnis und Entscheidungsfrage

Ein konkreter begrenzter Datenanschluss lässt den lokalen kumulativen Pinselstand
dieselbe **bandweise** Sättigung wie die kanonische Bearbeitung verwenden. Er
umfasst sofortige Folgegesten mit Radius-/Bandwechsel und benötigte
Interpolationsnachbarn. Formfunktionen und kanonische Speicherwahrheit bleiben
maßgeblich. Kein Gesamtground-Clamp, keine stille Ablehnung gültiger Pinselzüge
und kein bloßer Transport-Reject als Ersatz.

Entscheidung: Kann ein vollständig begrenzter lokaler Autorenstand oder ein
gleichwertiger konkreter Anschluss die vorhandenen Werkzeuge tragen, ohne
pro Pointerevent einen Main-Roundtrip zu benötigen? Welcher zusätzliche
Payload und welche tatsächlichen Besitzer sind dafür erforderlich? Keine
neue allgemeine Terrainarchitektur oder weitere 12-B-Arithmetikvariante.

## Eingaben und Schreibbereich

[P-Vertrag](TW06-P.md) und dessen eingefrorener Ausgangsstand:
`.build/terrain-water-p/tw06-p-contract-20261026/manifest.json`, SHA256
`bde89c35bcaa25aae1909b42fbda062f6687f68ca118c0a96aba255d1703702f`.
Die unabhängige Nachprüfung im offenen Review
`01a179b3-ced4-7dd2-bd61-16dd07fd0bc5` bestätigt kanonisch konservativ ±50e6 m
aus 49 additiven Bändern à ±1e6 plus absoluter Basis; lokale Folge-Drafts
übernehmen diese Hülle derzeit nicht. Der permissive Float32-Transportbereich
ist keine eigenständige Nutzeranforderung.

Gezielt vorhandenen Daten-/Kontrollfluss verfolgen: `terrain-height.ts`
(`editHeight`, Bandwahl und Interpolation), `terrain-brush.ts`,
`terrain-brush-draft.ts`, `atlas-surface-draft.ts`, `terrain-stroke-queue.ts`,
`landscape-brush-session.ts`, bestehender Main-/kanonischer Worker-/Tilequery-
Anschluss und dessen tatsächliche Nachrichtentypen. Nur benötigte direkte
Quellen lesen; keine gesamte Projekt- oder Abnahmeregisterlektüre.
Zusätzlich gebundene Fundstelle: `landscape-brush-session.ts`, SHA256
`6ed05924e1879013252d0f7a8e2a1f584878c81acfdb5e30f63eb3596920a03d`.

Jetzt erlaubt: lesende Diagnose, eine isolierte deterministische CPU-Vorlage
unter eigenem `.build/terrain-water-p/`-Ordner und Ergebnis direkt in diesem
Paket. Keine Produkt-, Bibliotheks-, Main-/Preload-/Storageänderung, kein
Produktbuild, keine native Probe. Gemeinsame Plan-/TW06-/P-Dokumente besitzt
Root. Eine parallel freigegebene K3-Korrektur wird nicht diagnostiziert oder
überschrieben; P-A benötigt deren laufenden Field-/Surfacecode nicht als
änderbares Untersuchungsobjekt.

## Konkreter Auftrag

1. Bestimme die tatsächliche kanonische Bandwahl/Sättigung und den heutigen
   Draft-/Folggestenanschluss. Ein einzelner Band+Rest-Kanal genügt nicht als
   unbewiesene Annahme bei lokalem Radiuswechsel.
2. Lege genau eine konkrete Nachricht samt Besitzer fest: notwendige
   Autorenknoten, Bandidentitäten, Auflösung, räumliche Grenzen einschließlich
   Interpolationsnachbarn, Quelle/Epoche/Revision und tatsächlicher Inhalt.
   Vollständigkeit, Nachladegrenze und Verhalten bei Radius-/Bandwechsel
   müssen definiert sein. Kein unbeschränktes vollständiges Weltmodell.
3. Definiere lokales kumulatives Bearbeiten und Capture/Transport/Bestätigung/
   Freigabe, einschließlich unmittelbar folgender Geste, ausstehender
   kanonischer Antwort, Escape und Undo. Autorenänderungen genau einmal;
   neuere kumulative Darstellung darf ältere unbestätigte Bilder ersetzen.
4. Binde die zusätzliche Produzentenhülle und nötige konsistente Gates an
   diesen tatsächlichen Anschluss. Kein beliebiger neuer Gesamt-Höhencap
   nur für grüne Tests, keine behauptete universelle Legacy-Float32-Qualität.
5. Zähle zusätzlich nötige ganze Backingstores und Transferkopien, Capture-
   und Restorepeaks sowie maximale Ein-/Ausgaben. Auf dem Draht nur Zahlen,
   IDs und tatsächlich benötigte Daten: kein `retained:unknown`-Objektgraph.
   Schätze die Arbeit pro Initialisierung/Radiuswechsel/Draft konkret aus
   Knoten-/Datenmengen; ein Main-Pointerroundtrip braucht eine explizite
   Latenzrechnung und ist kein stiller Standardweg.

## Kleinste entscheidende Evidenz

Genau die feste Folge: ein Autorenband nahe seiner Sättigung bearbeiten →
sofort folgende Geste → Radius und damit Band wechseln. Prüfe gegen den
kanonischen `editHeight`-Pfad, dass sämtliche lokalen Änderungen erhalten
bleiben und die bandweise Sättigung übereinstimmt. Benötigte grobe/feine
Interpolationsnachbarn einschließen. Die isolierte Vorlage verwendet reale
Produktregeln; keine erfundene Ersatzsättigung und keine Bild-/GPUbehauptung.
Sie verändert keine echten Kampagnendaten und startet keine vollständige Suite.

Positiv nur mit konkret begrenztem vollständigem Anschluss, gebundener
Nachricht/Quelle, nachvollziehbarem lokalen Zustand, bestandener fester Folge
und vollständiger zusätzlicher Payload-/Lebensdauerrechnung. Negativ oder zu
groß: sofort Rootentscheid mit konkretem Hindernis; keine offene Anschluss-
oder weitere Repräsentationsserie. Fehlende Evidenz nicht durch abstrakte
Typnamen oder pauschale Cacheannahmen ersetzen.

## Aufwand, Übergabe und Folgeschritt

Aufwandshypothese 30–60 aktive Minuten; erster Kalenderrahmen 60 Minuten ab
Beauftragung für Ergebnis oder konkreten Rootentscheid. Begründung: eng
bekannter Fehler und feste Folge, aber noch ungeklärte begrenzte Autoren-
Nachbarschaft. Nach 30 Minuten Zwischenstand mit tatsächlichem Anschluss oder
Blocker. Keine automatische Verlängerung und keine erneute breite Recherche.

Übergabe: Ergebnis in diesem Paket, genaue Quell-/Belegbindung und isolierter
Manifeststand, konkrete Änderungsliste/Schnittstellen für spätere Umsetzung.
Root und offenes Review prüfen gezielt. Erst daraus werden der P-Vertrag,
56/24-Repräsentation, endgültiger Payload und Etats entschieden. Der P-Start
26.10.20:26 UTC und Kontrolle 27.10.00:26 UTC einschließlich aller Wartezeit
bleiben unverändert; dieser Teilauftrag setzt die Problemgeschichte nicht zurück.
Ursprünglicher TW06-Start und frühere Hauptkontrollgrenze gelten zusätzlich.

## Reviewentscheidung und nächster Einstieg

Der enge Producerbeleg ist unabhängig bestätigt. Der vollständige Anschluss
bleibt offen; [P-B](TW06-P-B.md) plant genau den reduzierten Checkpointbeleg.
Die folgende49-Band-/Legacy-Vollgleichheit und ihre46,9-MB-/1,486-GB-Zählung
sind eine verworfene Erweiterung gegenüber der vorhandenen begrenzten Preview,
keine aktuelle Daten-/Etatvorgabe. Die Wirevorlage beweist Clone/Detach,
aber wegen falscher Seiten-IDs/Offsets/Version und leerer Coverage noch keinen
decodierbaren Payload; P-B repariert diesen konkreten Beleg.

## Ergebnis des einen Anschlusses

P-A startete am 26.10.2026 um **21:27 UTC**. Ergebnis: feste Producerfolge
positiv; der vollständige begrenzte Anschluss bleibt wegen Checkpoint-/
Sourceprefixregel offen. Keine Produkt-, Main-/Preload-/Storage- oder
Bibliotheksänderung, kein Produktbuild und kein nativer Lauf. Die drei negativen
12-B-Arithmetikvorlagen bleiben unverändert; P-A prüft keine vierte Variante.

### Tatsächliche Regel und kleinster Beleg

`terrain-height.ts:277` (`editHeight`) wählt ein Autorenband über
`version,x,y,pixel`. Additive fehlende Knoten beginnen bei0, vorhandene Knoten
behalten ihren Bandwert; **je Bandknoten** wird bei ±1e6 gesättigt. Es werden
höchstens25664²-Seiten je Zug bearbeitet. `terrain-brush.ts:40` wählt
`pixel=max(2^-24,2^floor(log2(radius/32)))`; `applyTerrainBrush:96` benutzt
Formfunktionen/Dosis und ruft `editHeight(...,2)` auf. Der kanonische
`storage/terrain-scale.ts:128` liest nur benötigte Bänder; Smooth/Level benötigen
gröbere Additivbänder und die gefilterte absolute Legacybasis aus
`TerrainScalePyramid`. Diese Basis kann nicht aus einem Gesamthöhenraster
rückgewonnen werden.

Der jetzige `TerrainBrushDraft` kopiert Gesamteditingground und addiert die
Werkzeugwirkung (`terrain-brush-draft.ts:55`); die Bandidentität fehlt.
`AtlasSurfaceDraft` startet Folgegesten bereits vom vorherigen lokalen Ergebnis.
`landscape-brush-session.ts:116` schließt lokale Eingabe synchron, während die
Schreibqueue weiterläuft. Diese sofortige Folge ist zu erhalten.

Isolierte Vorlage `probe.mjs` benutzt reale `applyTerrainBrush→editHeight`,
`heightRecord/decodeHeights`, `TerrainSampler` und den heutigen
`TerrainBrushDraft`. Ein vollständiger Referenzweltstand wird mit einem lokalen
Seed aus acht feinen/groben Seiten verglichen; eine zusätzliche Legacybasis
bleibt im kanonischen Ground erhalten. Negative Tilekoordinaten, NaN-Regel und
beide Seiten der feinen/groben Interpolationsnachbarschaft bleiben echt.

| Feste Folge | Pixel | Band1 am Ursprung | Band2 am Ursprung |
| --- | ---: | ---: | ---: |
| A: Raise nahe Sättigung, Radius32 | 1 | 1.000.000 | 999.999,5 |
| B: unmittelbare Folgegeste Lower, Radius32 | 1 | 999.999,5 | 999.999,5 |
| C: Raise, Radius64/Bandwechsel | 2 | 999.999,5 | 1.000.000 |

Je Phase **4.231 Groundpunkte**, insgesamt **12.693**, stimmen im festen Fall
**exakt** mit dem vollen Referenzstand überein; auch sämtliche lokalen Bandbytes
stimmen. Alle Groundpunkte liegen über1e6: Ein Gesamtground-Clamp wäre falsch.
Wiederholung des kumulativen Captures vom Gestureanfang verdoppelt nichts;
Escape von C stellt exakt die Bandbytes nach B wieder her. Dies simuliert
keine verlorene native Antwort oder produktive Screenbestätigung.

Konkreter Istfehler: nach A liefert der heutige Gesamthöhen-Draft am Ursprung
**1.750.001 m**, kanonisch bandweise gesättigt sind es **1.749.999,5 m**.
Fehlender Seitenseed, fälschlich als abwesend behandelt, ergibt am selben
Bandknoten **2 statt1.000.000**. Vollständigkeit/Abwesenheit ist deshalb Teil
der Quellbindung, keine Cacheannahme. Der Fall beweist den endlichen lokalen
Datenbedarf dieser Folge, nicht bereits sämtliche Werkzeuge oder räumliche
Nachladung. Die protokollierten CPU-Zeiten enthalten Referenz, Replay und
Oracleprüfungen; sie sind keine Produktlatenz und kein100-ms-Pass.

### Genau ein vorgeschlagener Datenanschluss

Seitenbasierter lokaler Autorenstand im **bestehenden Darstellungsworker**;
Main bleibt kanonischer Writer. Ein neuer begrenzter Readjob im bestehenden
kanonischen Atlasworker liefert Autorenknoten, keine zweite Weltkopie:

```ts
type AuthorWindowRead = {
  kind:'terrain-author-window'; epoch:number; job:number; operation:number;
  token:string; fence:string; revision:number; sourceEpoch:string;
  editSeries:number; throughOperation:number; activePixel:number;
  editBounds:{x:number;y:number;width:number;height:number}; needsScale:boolean;
  lattices:readonly {id:number;x:number;y:number;dx:number;dy:number;
                      columns:65;rows:65}[];
};
type AuthorWindowResult = {
  epoch:number; job:number; operation:number; token:string; fence:string;
  revision:number; sourceEpoch:string; editSeries:number;
  throughOperation:number; complete:boolean;
  // 64B/band: exponent, tile bounds, existing/absent counts, complete.
  coverage:Float64Array;
  // 64B/page: id,version,exponent,x,y,bufferId,offset,length.
  pages:Float64Array; values:readonly Float32Array[];
  filteredBasePages:Float64Array; filteredBase:readonly Float32Array[];
  latticeDescriptors:Float64Array; originalGround:readonly Float64Array[];
};
```

Werte haben je Seite4096Knoten, einschließlich NaN für fehlende additive Knoten;
eine vollständig fehlende Seite wird durch die **vollständig gelesene**
Bandabdeckung bewiesen. Seiten erhalten eine eigene16.384-B-Backingstore, Offset0;
kein riesiger gepackter Buffer, von dem eine einzelne Seite später alles pinnt.
Der Codec bindet sämtliche IDs an Quelle und Seitenversion. Die separate
CPU-Drahtvorlage prüft drei unabhängige Kopien, anschließenden Transfer nur des
Rendererpakets und unveränderte ursprüngliche Seiten. Es gibt keinen
`retained:unknown`-Graphen auf dem Draht.

Anschlussstellen sind konkret: `AtlasRegionAPI`/`desktop/preload.ts`, ein Read-
Handler analog `desktop/main.ts:484`, `AtlasJob/AtlasJobResults` in
`desktop/atlas-worker-contract.ts`, die bestehende `AtlasRegionService`-Queue
und `desktop/atlas-region-worker.ts` mit denselben Vor-/Nachprüfungen der Fence
und gepinntem SQLite-Readsnapshot. Heute existiert dieser Renderer-Read nicht:
`terrain-stroke` liefert `PreparedTerrainStroke` ausschließlich intern zum
Commit, `atlasTerrainTile` liefert bereits zusammengesetzte Raster. Region-
Visualrecords sind kein vollständiger Autorenbandseed. Hier wurde nichts an
Main, Bridge oder Storage implementiert.

Das Fenster enthält aktives Band und alle gröberen Additivbänder (höchstens49),
bei Bedarf die vorhandene gefilterte Legacybasis am aktiven Pixel. Für die
Darstellung enthält es ungequantisierten kanonischen Doubleground an den
höchstens32×65² eingefrorenen Quellknoten. Ein Band kann nicht durch Gesamtground
ersetzt werden. Ground wird aus Originalground plus den Änderungen seiner
getrennten Bänder rekonstruiert. Quellen und Seiten bleiben snapshotgebunden;
keine Bandänderung doppelt durch erneutes Commitanwenden.

Vier Autorenknoten Halo außerhalb des veränderten Knotenrechtecks decken
veränderten Einfluss (zwei Zellen) **und** dessen4×4-Hermite-Nachbarn ab.
Für Smooth kommen die existierenden radius/2-Quellgrenzen, gröbere Bandstützen
und gefilterte Legacywerte hinzu. Maßgeblich sind vollständig gelesene
Seitengrenzen, nicht nur eine nominale Pinselbox. Gleiches/gröberes Band ist im
Seed, soweit sein benötigtes Rechteck abgedeckt ist; feinerer Radius oder
verlassene Abdeckung benötigt einen zusätzlichen Seed. Die feste Folge A/B/C
braucht keinen zweiten Mainread. Für unbekannte Seiten niemals NaN/0 erfinden.

Innerhalb vollständiger Abdeckung erfolgen Pointerupdates lokal im Worker:
Originalbandseiten halten, pro Geste Copy-on-write, kumulativen Werkzeugstand
vom Gestureanfang mit unveränderten Produktregeln vorbereiten. Eine neue Geste
nutzt den letzten lokalen Bandstand auch bei ausstehendem Commit. Latest
überspringt nur Bilder. Renderer hält sein Authorcheckpoint A für Escape;
bestätigte/pending Seitenversionen haben eindeutige IDs. Der Worker benötigt
für kumulative Berechnung ebenfalls die **höchstens256 abweichenden
Autorenanfangsseiten**; das ist ein zusätzlicher tatsächlicher Besitzer, kein
versteckter Alias des Renderer-only-A-Feld-/Materialstands.

### Endliche Fenster-, Gesten- und Restorekosten

`counts.json` rechnet ganze Backingstores und zusätzliche Transportkopien.
Konservatives Fenster: bei `nx*ny≤256` aktiven Editseiten zählen wir am aktiven
Pixel `(nx+2)*(ny+2)` Seiten, gröber
`(ceil(nx/2^k)+3)*(ceil(ny/2^k)+3)`. Maximum über49Stufen:
**2.530 Seiten**, davon höchstens774 am aktiven Pixel; 10.362.880Floatwerte.
Hinzu kommen höchstens256 gefilterte Basisseiten bei einem kanonisch zulässigen
Smooth/Level-Fenster, 135.200Doublegroundwerte,64-B-Deskriptoren sowie tatsächliche
Bindungsbytes. Bestehende kanonische256-Seiten-/8-MiB-Read-/Arbeitsgrenzen werden
nicht als neue Previewablehnung erweitert; der vorgeschlagene Seedread zählt
seine eigene konkrete Antwort.

| Posten | Endliche Größe |
| --- | ---: |
| maximaler Seed dieses Fensters, inkl. Deskriptoren/Beispielbindung | 46.911.131 B |
| tatsächlicher Seed der festen Folge | 168.803 B Draht /168.584 B Backingstores |
| drei echte Seedkopien der festen Drahtvorlage | 505.752 B Backingstores |
| höchstens256 neue Bandseiten je Geste/Capture | 4.194.304 B +16.384 B Deskriptoren |
| höchstens20.000 gepackte `(x,y,t)`-Samples | 480.000 B je Original/Capture |
| ein32×65²-Doubleground-Checkpoint | 1.081.600 B |
| bedingtes P-Resultat mit neuen Seiten/Manifest, Beispiel K=8.448 | 158.901.792 B |

Der Seed passt **nicht** in den bisherigen40-MiB-Eingabeetat; separater
64-MiB-Seedauftrag wäre für dieses Fenster nötig. Der obige Beispielresultatwert
liegt unter160MiB, ist wegen des noch unbeschränkten Manifest-K kein globaler
Resultatpass. Seiten, Opcode-/Samplepayload und zusätzliche Groundwerte werden
nicht still zum bisherigen37.273.984-B-Rawtileinput addiert und als passend
behauptet. Welche alten Rawtile-/Authorbuffer die spätere Umsetzung tatsächlich
entfernt, ist separat zu belegen; hier wird nichts davon abgezogen.

Gleichzeitige zusätzliche Seitenbesitzer mit K gehaltenen geänderten Seiten,
W nicht schon darin enthaltenen Readonlyfensterseiten und D≤256:
Worker-Seed `K+W`, Worker-current `K`, Gestureanfang `D`, pending `D`,
Renderer-A `K`, davon abweichendes confirmed `D`, pending/Transport `D`.
Das sind **`(3K+W+4D)*16.384 B`**. Unveränderte Seiten teilen nur bei wirklich
identischem Buffer/Version ihre Referenz; die Drahtkopie des Workers ist immer
unabhängig. Eine dauerhafte Worker-A-Feld-/Materialkopie wird nicht erfunden.

Weitere gezählte Besitzer: zwei gefilterte Basen, sieben Groundstände/-kopien,
zwei zusätzliche Seed-IPC-Kopien (kanonischer Worker→Main→Renderer; danach
Transfer zum Darstellungsworker), reale Recordadapter-Decodes und Editworking-
Buffer, Samples und fünf Seitenmanifeste. Der bestehende kanonische Worker
benutzt heute `parentPort.postMessage({value})` **ohne Transfer**; eine künftige
Transferersparnis ist hier nicht abgezogen. Bei Nutzung des bestehenden
base64-Recordadapters kommen außerdem bis **72.926.624 B** temporärer UTF16-
Strings plus Objekt-/Map-/Aktionsqueueheap hinzu; diese sind kein Backingstore-
Alias und müssen im späteren RSS/Heap gemessen werden.

Nur als Größenillustration, **nicht garantierte Hülle**: K=8.448, W=2.530,
D=256 ergeben zusätzliche **614.260.342 B**; mit dem revidierten P-Basismodell
824.353.788 B insgesamt **1.438.614.130 B** vor Restore. Schon dieses Beispiel
passt nicht in896MiB; es ist weder ein neuer Etatvorschlag noch ein Maximum.
Der tatsächliche kleine Fall hält je Phase196.608/262.144/262.144 B eindeutige
lokale Seitenbackings in Seed/Anfang/Aktuell; Main-/Rendererkopien kommen dazu.

Escape: laufendes C invalidieren, dessen Ende/Verwerfen nicht als A-Bestätigung
werten. Der gesunde Worker hält die Authoranfangsseiten für kumulatives Rechnen;
Authorrestore benötigt deshalb nur IDs. Sollte dieser Besitzer vorzeitig
abgebaut sein, sind bis256fehlende Seiten (4.194.304B) zusätzlich rückzukopieren,
nicht ein theoretisch geteilter voller A-Stand. Renderer-A-Feld und fünf
Material-/Höhenprodukte bleiben eigenständig. Konservativer Restore zur
Synchronisation mit dem Worker:34.095.232B Produkte +7.214.208B gepacktes24-B-
Feld +1.081.600B Ground +4.194.304B fehlende Authorseiten +540.672B Manifest
im obigen K-Beispiel = **47.126.016 B** zusätzlich. C kann währenddessen noch
synchron rechnen; diesen Überlappungspeak nicht durch vorzeitige Freigabe
kleinrechnen. P-basierend plus obiger Illustration und Restore:
**1.485.740.146 B**. Gesunder Same-worker-Authorrestore ohne Seitenkopie ist
im konkreten Kontrollfluss zu beweisen, kein stiller Abzug.

### Rechen-/Nachladegrenze und offener Blocker

Initialisierung pro maximalem Fenster bis10.362.880Bandknoten lesen/dekodieren;
256 kalte gefilterte Legacybasisseiten benötigen bis **16.777.216** vorhandene
4×4-Quellsamples. Ein maximal gültiger Werkzeugaufruf folgt weiter der
vorhandenen60-Millionen-Arbeitsgrenze. Rekonstruktion eines Banddeltas an allen
135.200Darstellungsknoten braucht bis4.326.400Knotenlesungen für alten/neuen
4×4-Patch; weitere berührte Bänder oder Caches müssen konkret gezählt werden.
Das sind Arbeitsmengen, keine behaupteten Millisekunden auf dem Zielgerät.

Seedmiss-Latenz gehört vollständig zur sichtbaren Pinselwirkung:
Renderer→Main, Sourceprüfung, kanonische Workerqueue/SQL/optionales Pyramidwarm,
Worker→Mainclone, Main→Rendererclone, Transfer zum Darstellungsworker,
Berechnung, Rücktransport/Upload und bestätigter Screen. Zwei volle Clones des
Maximalpakets bewegen bereits93.822.262B; nur für diese Kopien wäre bei sonst
kostenlosem100-ms-Pfad effektiv>938MB/s nötig. Tatsächliche übrige Zeiten sind
unbekannt. Kein zusätzlicher Worker, keine pro Pointer übliche IPC-Schleife;
innerhalb gültiger Abdeckung ist keine nötig. Beim Überschreiten/Finerstellen
muss Eingabe bis zum vollständigen Seed kumulativ gehalten werden; beliebige
schnelle Sprünge können trotzdem einen Miss je Event erzeugen. Eine allgemeine
roundtripfreie oder100-ms-Zusage folgt aus diesem Fensteranschluss nicht.

**Fehlender Checkpoint-/Sourceprefixentscheid:**32 pending Schreibzüge begrenzen
nicht alle lokalen Bandzustände seit dem eingefrorenen Bild. Viele Antworten
können eintreffen, während weitere Gesten die kanonische Bildübernahme
verschieben. K=33×256 ist daher ausdrücklich **kein** bewiesener Gesamt-Cap.
Das Behalten aller ursprünglichen/veränderten Seiten würde mit der Historie
wachsen. Freigabe bestätigter Seiten braucht einen tatsächlichen kanonischen
Checkpoint und einen präzisen bestätigten Operationenpräfix.

Ein späterer Seed kann nicht einfach alte Fence/Revision lesen: bestehende
Main-/Worker-Reads prüfen die aktuelle Snapshotrevision. Neuer Seed aus einer
neueren Quelle kann bereits eigene Commitänderungen enthalten; bloßes Overlay
würde sie doppelt anwenden. `TerrainStrokeQueue.confirmedSource` und sein
`accepted`-Callback sind vorhandene Anknüpfungen, aber noch keine ausgeführte
Sourceprefix-/Checkpointregel. Verlorene/verspätete Antworten, Preview-
Näherung/kanonische Routenkopplung und externe Quellenänderungen verbieten eine
unbelegte Gleichsetzung. Undo invalidiert Quelle/Serie und braucht neuen Seed;
keine fremden Seiten oder bestätigten Commitakte aus alten Serien übernehmen.

Hier stoppt der Auftrag. Root/Review müssen genau diesen Checkpoint-/Prefix-
und Eviktionsentscheid sowie Seedmiss-/Etatsfolge begrenzen, bevor P-Code
freigegeben wird. Es wird keine neue Rebasearchitektur oder zweite lokale
Anschlussvariante ergänzt. Bandweise Sättigung und die tatsächliche kanonische
±50e6-Hülle sind ein tragfähiger Produceransatz, sobald der Anschluss vollständig
gebunden ist; ein allgemeiner Legacy-Float32-Sichtbarkeitsanspruch ist kein
Nutzerziel. Die feste positive Folge und der aktuelle Istfehler bleiben belegt,
auch wenn der globale Anschluss noch nicht freigegeben werden kann.

Gebundene Übergabe: `.build/terrain-water-p/tw06-p-a-20261026/manifest.json`.
Vorbereitung abgeschlossen 26.10.2026 21:53:48 UTC; P-A stoppt hier mit dem
benannten Checkpoint-/Sourceprefixblocker. Kein automatischer Fortsetzungsauftrag.
