# Technische Grundlage des Gesamtprodukts

Entscheidungsstand: **11. Oktober 2026**. Untersucht wurde das Zielrepository auf
`116c16af48b6a073216685c8d8e2cc74fada82c3`. Alle 36 Anforderungsdateien und die
beiden ergänzenden Primärquellen aus [scope-sources.json](docs/scope-sources.json)
wurden gegen die dort gebundenen SHA-256-Werte geprüft. Der historische
Umfangsabgleich bleibt erhalten. Diese Seite entscheidet die technische
Richtung; sie behauptet weder Implementation noch Produktabnahme.

## Zweck und Entscheidungsmaßstab

Der vollständige Auftrag steht in [SCOPE](docs/SCOPE.md), die Nutzerabläufe und
Atlasoberfläche im [Atlasplan](ROADMAP-HEX-ATLAS.md). Das Produkt verbindet
Vorbereitung, Kartenzeichnung und Spielabend offline für einen lokalen GM.
Es umfasst auch Katalog, World Planner, Party/Scenes, Encounter/Loot, Reise,
Zeit, Shops, Wetter, Musik, Autonomie, Spieleranzeige, Datenlebenszyklus und
Extensions. Vier E2E-Gates ersetzen keine dieser Fachabnahmen.

**Der aktuelle Code besitzt keinen Bestandsschutz.** Auch frühere technische
Pläne sind Vorschläge. Übernommen wird nur, was die gewählte Lösung vereinfacht
und ihre Anforderungen erfüllt. Geschützt sind Nutzerinhalte, Identitäten,
bekannte externe Formatbindungen, Quellen/Lizenzen und bestätigtes Verhalten.
Importzahlen, bereits investierte Arbeit und grüne Tests begründen allein
keine Übernahme einer Architektur.

Entschieden wird nach Gesamtaufwand, Verständlichkeit, Bedienbarkeit,
Datenintegrität, Leistung und Änderbarkeit. KISS heißt ein lokaler Prozessverbund,
eine kanonische Schreibgrenze und wenige explizite Fachmodelle. YAGNI verschiebt
unbenötigte Detailoptionen; es verschiebt keine schwer umkehrbaren Entscheidungen
über Identität, Besitz, Geometrie, dauerhafte Speicherung oder Rechte.

## Gewählte Grundstruktur

### Vorläufiges Atlasziel und überprüfbare Alternativen (16.10.2026)

Der beauftragte Atlasumbau konkretisiert diese Grundlage; Lieferstand,
Migrationsschritte und direkte Abnahmen stehen ausschließlich im
[Runtimeplan](ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md#umstellung-auf-das-vorläufige-atlaszielsystem).
Produktregeln bleiben verbindlich: ein wachsender ebener Meterraum, gemeinsame
Kamera/Auswahl/History, geschützte grobe/feine Bearbeitung, stabile Identitäten
und Texte, lokale Offline-Nutzung, sichere passive Anzeige und unabhängiger
Kampagnentransfer. Referenzziel sind gewöhnliche 16-GiB-Laptops; Speicherlimits
auf größeren Rechnern ersetzen deren physische Qualifikation nicht.

Die folgenden Technikentscheidungen sind ausdrücklich vorläufig. Ein Wechsel
erhält die Fachregeln und benötigt einen passenden Vergleich, keine neue
allgemeine Freigabeschranke. Reihenfolge: Korrektheit/Inhaltsschutz, Fähigkeiten,
Reaktionszeit/Speicher, Gesamtaufwand. Bei gleich geeigneten Lösungen die
einfachere behalten; fehlende Nachweise als offen führen.

| ID | Arbeitsrichtung | Weiter betrachtete Alternative / Wechselnachweis |
| --- | --- | --- |
| B01 | Atlas: Canvas2D-Draufsicht und orthografische Three.js-Geländeansicht | [Darstellungs-, Auswahl- und Ausgabevertrag](docs/development/atlas-rendering.md). Für die Draufsicht: Pixi/WebGL bei belegten Zeichen-/Kompositionsgrenzen; OffscreenCanvas-Worker bei belegter UI-Blockade. Hardware-/Präsentationsqualifikation bleibt offen. |
| B02 | SQLite-Rtree für Raum-/Stadtgeometrie und Landschaftsobjekte; kanonische Bounds-Btrees für Terrain | Bestehender Btree, Suchraster/Quadtree, BVH für genaue Tests; Grenzen, Dichte, lange Geometrie und Änderungskosten messen. Exakte Geometrie bleibt getrennt. |
| B03 | Exakte 1000-m-Bereichsadresse plus lokaler Offset, versionierter Codec | Andere Bereichsgröße/lokales Festkomma nur mit Präzisions- und Transfernachweis; kein vorzeitiges globales Double. |
| B04 | Wirksame Landschaft vor maßstabsabhängiger Zusammenfassung bestimmen | Raster-/Vektorkacheln, vereinfachte Konturen und Kombination; Landschaftserhalt, Ränder und lokale Invalidierung entscheiden. |
| B05 | Austauschbare feste Ladeeinheiten und getrennte Bytecaches | Adaptive Bereiche/statisch-dynamische Indizes nach Dichtemessung. Cachevergleich 64/128/256 MiB je Klasse; kleinste geeignete Variante wählen. |
| B06 | Hashadressierte Assetdateien gemäß Speicherziel | Bestehende SQLite-BLOBs und begründete Mischform bis zum Medien-/Backup-/Transfervergleich erhalten. Kein bloßer Dateiformatwechsel ohne Gesamtnutzen. |
| B07 | Begrenzte Worker, genau ein Writer; abbrechbare Raumtextscans je Suchoberfläche | DBthread/isolierter Medienprozess; WASM nur für gemessene Kerne. Kopien, Speicher, Cancel und Fehlerisolation entscheiden. |
| B08 | Dungeon-Zellvolumes und metrische Gebäudeprismen | Intervall-/Chunkrepräsentation und spezialisierte Geometriekerne optimierbar; keine zweite physische Wahrheit oder freie universelle CSGpflicht. |
| B09 | Transaktionen, Deltas und Receipts weiterführen | Kompaktere Patches/Checkpoints nach Langzeitmessung. Alte History muss weiter lesbar und kausal rücknehmbar bleiben. |
| B10 | Lokale/regionale Navigation mit gemeinsamen Übergängen und Zeit | Navmesh/hierarchischer Graph/Kostenfelder nach echten Aufgaben; keine vorsorgliche Dauersimulation. |
| B11 | Electron/TypeScript/SQLite | Andere WebView/native2D erst bei belegtem unerfüllbarem Speicher-/Grafik-/OS-/Installationsziel. |

[Bereichsworker und Quellinvalidierung](ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md#bereichsworker-und-quellinvalidierung)
sowie [Darstellungs- und Cachebudgets](ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md#darstellungsbudgets-und-caches)
stehen im Runtimeplan. [Framefreigabe](docs/development/atlas-rendering.md#welcher-frame-darf-eingaben-annehmen)
und [Wiederverwendung beim Pan](docs/development/atlas-rendering.md#was-bleibt-bei-rasterwechsel-und-pan-erhalten)
stehen im Darstellungsvertrag.

[Prüfwege und offene Qualifikation](docs/development/atlas-rendering.md#prüfwege-und-offene-qualifikation)
trennen native Laufzeitbelege von Hardware-/Präsentationsabnahme und weiteren
Architekturentscheidungen.

Die Raumlesegrenze unterscheidet kleine Aktivierungsdaten, Metadaten,
Darstellungsgeometrie und vollständigen ausgewählten Autoreninhalt. Diese
Projektionen sind keine zweite Schreibautorität. Die aktuelle Volltextsuche
scannt unveränderliche Quelldaten im Worker; ein abgeleiteter Volltextindex
bleibt eine messungsabhängige Alternative. Persistente Text-/Geometrietrennung
und Byte-/Geometriebudgets bleiben offen; reine Metadatenseiten schließen die
Speicherqualifikation nicht ab.

Kugelprojektion, Serverpflicht, allgemeines Multiuser-Editing und freie
3D-Meshmodellierung werden derzeit nicht verfolgt; ein veränderter Produktauftrag
kann sie wieder relevant machen. Beobachtung der Technik ist keine Erlaubnis,
Atlasumfang oder externe Datenbindungen zu verkleinern.

### Prozesse und Verantwortlichkeiten

**Ein modularer TypeScript-Kern in einer eigenständigen Electron-Anwendung,
ein lokaler SQLite-Schreibdienst, eine Atlasoberfläche.** Die
[Plattformentscheidung](ROADMAP-SALTMARCHER-PLATFORM-ADR.md) begründet Alternativen
und Übergang; der [Prototypplan](ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md) führt
die noch erforderlichen Implementationsbeweise.

| Teil | Zuständigkeit | Prüfbare Grenze |
| --- | --- | --- |
| Fachmodule | Werttypen, Invarianten, reine Berechnungen, Commandplanung | Kein Electron/Obsidian, SQL, Dateisystem, DOM oder Netz; reproduzierbare Resultate auf identischen Inputs |
| Anwendung | Aktivierung, Zugriffsprüfung, Command, betroffene Records, Konflikt/Cancel, Projektionen | Eine Änderung kann mehrere Fachmodule betreffen, besitzt aber eine gemeinsame Commitentscheidung |
| Lokaler Schreibdienst | SQLite, Validierung an der Schreibgrenze, Revisionen, Receipts, Assets, Recovery und Migration | Ausschließlich dieser Dienst schreibt Produktdaten; UI und Extensions erhalten keine DB-Verbindung |
| GM-Oberfläche | Native DOM-Controls, Auswahl/Inspector/Text, gemeinsame Kamera/Werkzeuge, Canvas2D-Draufsicht und abgeleitete Three.js-Geländeansicht | Eingabe und Vorschau ohne Autorenmutation; keine Geschäftslogik in Popup/Dialog/Meter |
| Hintergrundjobs | Abbrechbare Geometrie, Generatoren, Suche/Export, Medienprüfung | Unveränderlicher Input, gebundene Basisrevision und Aktivierung; Resultate erhalten keine eigene Schreibberechtigung |
| Passive Anzeige / Extensions | Redigierte Anzeige bzw. ausdrücklich erlaubte Fähigkeiten | Getrennte Prozesse und enge DTOs; keine versteckten GM-Daten oder ungeprüften privilegierten Aufrufe |

Das sind Zuständigkeiten, keine sechs Frameworks oder ein Zwang zu sechs
Packages. Kleine Module im selben Repository reichen. Kein ORM, universeller
Eventbus, ECS, CRDT, Event Sourcing, Microserviceverbund oder allgemeiner
Mehrspielermodus. Ein neuer Port entsteht an einer tatsächlichen Host- oder
Schutzgrenze, nicht für jede Hilfsfunktion. Ein Hintergrundworker wird erst
für nachweislich blockierende Arbeit eingerichtet.

**Warum diese Lösung:** Der gesamte Pflichtumfang verlangt kontrollierte
Fenster, portable lokale Medien, native Persistenz, Prozessisolation und
widerrufbare Erweiterungsrechte. Electron und TypeScript halten Renderer,
Domäne und Werkzeuge in einer Sprache. Die Shell ist klein; bestehende
Obsidian-Editoren werden nicht in eine neue Shell hineingezwungen. Pixi und
geeignete reine Geometriefunktionen sind Übernahmekandidaten, kein unveränderlicher
Renderkern. Ein alternatives Renderbackend benötigt erst einen gemessenen Grund.

## Fachliche Grenzen und Identitäten

| Wahrheit | Besitzer und Verbindung | Grund / Orakel |
| --- | --- | --- |
| Installation | Quellen-/Regeldefinitionen, Biome, Symbole, Generatorpresets, Rechte und Medienbibliothek | Shared bedeutet ausdrücklich geteilt. Definitionänderung erreicht aktuelle Verbraucher, berechnet abgeschlossene Fakten niemals neu. |
| Campaign | Mitgliedschaft, ein Atlas, Autoreninhalte, Planung, Runtime, Historie und Trash | Eine Campaign ohne LiveSession ist gültig. Unverortete Inhalte gehören ebenfalls zur Copy-/Transferclosure. |
| World | PCs/NPCs, Orte, Fraktionen, Quests, Gerüchte, Besitz/Beziehungen | Kartenmarker, Stadtbewohner, Shops und Planung referenzieren dieselben Identitäten; keine zweite NPC-/Ortstabelle pro Oberfläche. |
| Atlas | Ursprung/Ausrichtung, sparsame Landschaftseigenschaften, freie Wege/Flächen, räumliche Instanzen und Referenzbilder | Kamera/Zoom legt keine Daten an. Eine räumliche Instanz hat einen Ort im Atlas; zusätzliche unabhängige Instanzen entstehen durch ausdrücklich bezeichnete Kopie. |
| Räumliches Objekt | Dungeon, Stadt, Gebäude, Raum, Passage/Path; jeweilige authored Geometrie und Inhalt | Ein Haus besitzt Außen-/Innengeometrie gemeinsam. Room-ID ist unabhängig von der aktuell zugeordneten Geometrie. Fachvertrag: [räumlicher Anschluss](ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md). |
| Preparation | Manuelle Timeline und angenommene Planinhalte; unveröffentlichte Vorschläge separat | Ersetzen eines Plans entfernt keine bereits akzeptierte World-Platzierung. Initialize kopiert einen unveränderlichen Preparationstand in neue Runtime-IDs. |
| Party/LiveSession | Roster, aktuelle Party, Primary/Split-Scenes, Fokus, Teilnehmer und Masken | Ein aktiver PC ist genau einer Running Scene zugeordnet. Planungsparty bleibt getrennt. Scene beenden ist keine Charakterlöschung. |
| Encounter/Loot | Planreferenzen vs. Kampfzustand, Ergebnisse, XP und Charakterledger | Combatabschluss und gekoppelte Rewards einmal atomar; keine automatische Münzabbuchung beim Shophandel. |
| Zeit/Weltfolgen | Scenezeiten und Kalender; idempotente zeit-/ortsbezogene Folgen | Kein unabhängiger Shop-, Stadt-, Trap- oder Autonomieuhrstand. Rejoin und Rückdatierung löschen keine etablierte Worldwahrheit. |
| Knowledge/Perception | Dauerhaftes Wissen pro Charakter, aktuelle Wahrnehmung, explizite Freigabe | Historische bekannte Erscheinung und aktuell verborgene Änderung unterscheiden; passive Anzeige konsumiert nur zulässige Projektion. |

Stabile typisierte IDs und fachlicher Scope adressieren Records. Namen, Pfade,
Roomnummern, Kamerakoordinaten und Listenpositionen sind keine Identität.
Import erhält bestehende IDs, soweit der Importfall Identitätserhalt verlangt;
unabhängige Campaignkopie/-import remappt alle lokalen IDs und internen Verweise.
Bestehende lokal eindeutige Altkennungen bleiben über ihren dokumentierten Scope
adressierbar; ein neues UUIDformat erzwingt keine Textlinkänderung. Neue
Identitäten verwenden UUIDs; abgeleitete Tiles, Bounds, Navflächen und Suchtreffer
erhalten keine Autoren-UUID.

Jeder persistierte Record besitzt Typ/Version, Scope, ID und monotone Revision.
Referenzen sind typisiert und unterscheiden auflösbar, trash, unavailable und
endgültig unbekannt. Eine kaputte Referenz verschwindet nicht still. Aktuelle
Definitionreferenz und eingefrorener Ergebnis-/Erklärungsstand sind verschiedene
Felder mit verschiedenen Lebenszyklen. Modelle bleiben fachlich typisiert;
kein beliebig tiefes JSONobjekt als universelle Geschäftsdatenbank.

## Speicherung und Wiederherstellung

**Eine lokale SQLite-Datenbank pro Installation** umfasst Shareddefinitionen und
Campaignrecords. Damit bleiben unter anderem biom-/symbolweite Ersetzung in
aktiven und getrashten Campaigns, Definitionkonflikte sowie gekoppelte
Scene-/Geometrie-/Ledgeränderungen in einer Transaktion. Pro Campaign eigene
Datenbanken würden bekannte installationsweite Änderungen wieder zu
Mehrdateitransaktionen machen. Der Nutzer exportiert einzelne Campaigns und
kann den Datenordner sichern; eine Datenbank pro Installation bedeutet keine
Pflicht zu einem einzigen unteilbaren Export.

SQLite speichert kleinere fachliche Records und Geometriechunks. Beziehungen,
Scopes, Versionen, IDs und benötigte Such-/Raumindizes sind explizit; typisierte
Payloads dürfen versioniertes JSON sein. Keine vollständige Dungeonserialisierung
für Hover, einen Keytastendruck oder eine lokale Wandänderung. SQLindizes werden
aus tatsächlichen Querypfaden abgeleitet. Pro Datenordner gibt es genau einen aktiven App-Schreibprozess; zweiter Appstart aktiviert die bestehende Instanz oder bleibt lesend. Die OSübergreifende Lebensdauer-/Lockprüfung wird in P02 direkt geprüft, nicht aus einem Linux-/proc-Prototyp übernommen. Ein einzelner Writer verwendet WAL,
Foreign Keys und `synchronous=FULL`; kurze Leser, gebundene Limits/Paging und
kontrollierte Checkpoints verhindern lange Lesetransaktionen und unbegrenztes
WALwachstum. Daten liegen auf lokalem Dateisystem, nicht in einem gleichzeitig
beschriebenen Netzwerk-/Cloudsyncordner.

Die [SQLite-WAL-Dokumentation](https://www.sqlite.org/wal.html) beschreibt die
Ein-Writer-Grenze und das notwendige Synchronisieren für Power-Loss-Dauerhaftigkeit.
Die gebündelte SQLite-Version muss einen aktuellen geprüften Wartungsstand
einschließlich WAL-Reset-Fix besitzen; die isolierte Probe verwendete 3.53.4.
Die Versionsprüfung gehört zum Buildnachweis, nicht zu einem optionalen Hinweis.

**Assets sind unveränderliche, hashadressierte Dateien.** Austausch erzeugt neue
Bytes und ändert die Referenz im DBcommit. Vor Veröffentlichung werden Bytes,
Hash und Dateisystemhaltbarkeit geprüft; die DBtransaktion referenziert nur
fertige lokale Medien. Abbruch hinterlässt höchstens unreferenzierte, markierte
Stagingdateien. Wiederverwendung identischer Bytes ist keine geteilte
Autorenidentität. GC betrachtet Live, Trash, retained Payloads, Staging und
app-managed Backups; sie entfernt nie eine fremde Datei auf Verdacht.

Die automatische Wiederherstellungskopie prüft ihren privaten Kandidaten in einem
Readonly-Worker (`desktop/backup-validation.ts`). Die gemeinsame vollständige
Prüfung liegt in `src/app/storage/snapshot-validation.ts`, zustandsfreie
Payloadleser in `stored-records.ts`. Der Store besitzt Kopie, Epochenschutz,
Synchronisierung und Veröffentlichung; er wartet auf das tatsächliche Workerende.
Beim Schließen wird eine laufende Prüfung beendet und ihr Kandidat verworfen.
[Große Welt und verbleibende Commitlast](docs/reference/atlas-backup-worker-20261021/README.md).

Backup nutzt einen konsistenten DBsnapshot über die
[SQLite-Backup-API](https://www.sqlite.org/backup.html) sowie ein hashgebundenes
Medienmanifest. Einfaches Kopieren einer offenen `.sqlite` ohne WAL ist kein
Backup. Versionierte Backups und record-/payloadbezogene Prüfsummen ermöglichen
gezielte Erkennung und sichere Wiederherstellung. Beschädigte Nutzpayloads
werden isoliert; unbetroffene Records bleiben bearbeitbar. Bei beschädigter
DBstruktur wird zuerst in eine neue lokale DB aus dem neuesten eindeutig sicheren
Snapshot wiederhergestellt, dann werden verifizierbar intakte neuere Einheiten
mit vollständiger Commandclosure übernommen. Niemals einzelne Teile eines
gekoppelten Outcomes aus unterschiedlichen Revisionen zusammensetzen.
Nicht beweisbare neuere Arbeit wird als Verlust/Quarantäne offengelegt; die
Originalbytes bleiben erhalten. Mehrere gleich plausible Recoverystände
erfordern eine GM-Auswahl. Diese breitere Fehlermatrix bleibt P02-Produktnachweis;
die Einzeländerungsprobe behauptet keine allgemeine Medienfehlerbehebung.

Trash pausiert abhängige Runtime, bewahrt den vollständigen Zustand und erlaubt
kohärentes Restore. Dungeon-Trash hält mindestens die geforderten 30 Tage und
hat eine getrennte ausdrückliche Sofortlöschung. Permanente Löschung besitzt
eine persistierte, wiederaufnehmbare Erasureclosure: Live/Trash, Undo, Cache,
Receipts mit rekonstruktiven Payloads, opaque Capabilitydaten, Temp, Assets,
SQLitefreie Seiten/WAL und app-managed Backups werden bereinigt bzw. mit
geprüften Survivorständen ersetzt. SQLite Secure Delete/Checkpoint/Vacuum allein
ist kein Beleg für diese gesamte Closure. Bis zur belegten Bereinigung heißt
der Ausgang pending, nicht endgültig gelöscht. Nur nichtrekonstruktive
Erklärungsfakten dürfen bleiben. Selbst exportierte GM-Pakete sind externe
Kopien und nicht widerrufbar. Deaktivierte Extensions dürfen Erasure nicht
blockieren oder Daten aus der Closure verstecken.

**Abgewogen:** Dateien mit eigenem Mehrdateijournal sind für kleine einzelne
Zeichnungen verständlich, verlangen im Gesamtprodukt aber eigene Recovery-,
Revisions-, Index- und installationsweite Commitmechanik. Ein einziges
Campaign-JSON ersetzt diese Komplexität durch Vollkopien, große Historywerte
und schlechte lokale Fehlerisolierung. SQLite bringt geprüfte Transaktionen,
Indizes und Backupwerkzeuge; Schema-/Recoveryarbeit bleibt erforderlich. Die
isolierte Probe mit 100.000 Records bestätigt diese lokale Änderungsgrenze,
nicht RP-L, Rendererleistung oder Stromausfallsicherheit.

## Bearbeitung und History

Ein Command trägt Command-ID, aktuellen Aktivierungstoken, betroffene
Identitäten, erwartete Recordrevisionen und seinen typisierten Effekt.
Die Anwendung plant und validiert die vollständige Änderung; der Schreibdienst
prüft Berechtigung, Revisionen und Invarianten erneut **in derselben
DBtransaktion**, die Records, revisionsgebundene Undo-Deltas, fachliche Folgen
und das Receipt schreibt. Bei gleichem Command und Fingerprint wird nur dessen
Status gelesen; anderer Inhalt unter gleicher ID wird abgelehnt. Unbekannter
Ausgang sperrt einen Ersatzversuch, bis derselbe Command aufgeklärt ist.

Keine verteilten Prepare-/Publish-/Finalizeprotokolle für interne Fachmodule.
Die alte fünfstufige Folge bezeichnet nur noch Planung, Prüfung, atomaren
DBcommit und nachlaufende Projektion. Nach Commit dürfen Render-/Such-/Audiofehler
keine halbe fachliche Wahrheit oder zweite Mutation erzeugen. Große Imports werden in kurzen Transaktionen unter einem unsichtbaren Operationsscope gestaged. Erst der kurze finale Commit validiert Closure/Basis/Rechte und aktiviert den vollständigen Campaign-/Definitionstand samt Receipt; Leser sehen keine halbe Zielcampaign. Sharedkonflikte werden vorab geplant und gebundene Definitionsrevisionen erst an dieser Grenze aktiviert. Es gibt keinen zweiten kanonischen Store und keine minutenlange offene Importtransaktion, die Livewrites sperrt. Import und irreversible Assetbereinigung brauchen eigenes Staging/Finalize, weil dort
tatsächlich Dateien beteiligt sind. Ihr Commitstatus bleibt im selben Store.

Text/Geste/Vorschlag sind Entwürfe an ihrer ursprünglichen Ziel-ID/Basis.
Sie verändern bis zur Annahme keine bestätigte Wahrheit. Ein Textabschluss
oder Pointer-Up übernimmt den gültigen Edit automatisch dauerhaft; normales
Save ist kein erforderlicher Zwischenschritt. `pending`, `gespeichert`,
`Konflikt` und `Fehler` unterscheiden den tatsächlichen Stand. Eine ausstehende
Änderung darf schnell sichtbar sein, bleibt aber als unsicher bezeichnet.
Wechsel/Schließen schließt gültige Eingaben ab oder erhält sie ausdrücklich als
Entwurf; es übernimmt keinen Generator-/Graphvorschlag nebenbei. A→B→A verwendet
eine neue Aktivierung. Späte Callbacks/Worker verlieren ihren alten Schreibzugang.

Gemeinsame Atlas-Undo/Redo umfasst mindestens 200 gewöhnliche Änderungen in
der laufenden Bearbeitungssitzung. Gespeicherte Deltas enthalten nur betroffene
Records/Chunks, keine Grafiken oder ganzen Campaigns. Große Operationen zeigen
ein gemessenes Historybudget vorher; kein künstliches Inhaltslimit.
Undo ist ein neuer atomarer inverser Command mit geprüfter Basis; es setzt
keine globalen alten Snapshots ein. Runtimegeometriekorrektur und erforderliche
Actorrelocation gehören zum selben Command. Reiseundo hat eigene kausale
Checkpoints und darf später etablierte fremde Folgen nicht zurückrollen.
Campaignhistorie sind dauerhafte erklärende Fakten, kein Undoersatz.

### Buchungsantworten klären

Für die in [`CommitFamily`](src/app/commit-receipt.ts) gebundenen Writes führt
die Diagnose über drei bestehende Besitzer:

| Frage | Einstieg |
| --- | --- |
| Ist derselbe Command noch ungeklärt? | [`commit-confirmation.ts`](src/app/commit-confirmation.ts): `writeConfirmed` sichert die Referenz vor dem Senden; `hasPendingCommit` sperrt weitere Buchungen. `checkPendingCommit` bedient den vorhandenen Statusknopf. |
| Läuft der Aufruf noch oder existiert schon ein Receipt? | [`CommitTracker`](desktop/commit-tracker.ts), angeschlossen in [`desktop/main.ts`](desktop/main.ts) an `campaign:commit-status`: ergänzt den gespeicherten Status um laufende Aufrufe. Ein fehlender DB-Beleg allein bedeutet währenddessen noch nicht „nicht gebucht“. |
| Gehört der gespeicherte Beleg zu diesem Auftrag? | [`CampaignStore.commitStatus`](src/app/storage/store.ts) prüft den Aktivierungskontext; [`storage/commit-receipt.ts`](src/app/storage/commit-receipt.ts) prüft Campaign, Fingerprint, Prüfsumme und Fachbezug. |

`checkPendingCommit` meldet einen bestätigten Beleg über `onCommitResolved` an
den Fachbesitzer, beim Kampf `recoveredCombat` aus [`combat.ts`](src/app/combat.ts).

#### Modale Buchungen

[`BookingDialog`](src/app/booking-dialog.ts) verbindet Beuteverteilung und
Kampfverstärkung mit der bestehenden `writeConfirmed`-/Receiptgrenze.
[`CombatAreaPanel`](src/app/combat-area-ui.ts) führt seinen eigenen `busy`-Zustand.
Für beide Anschlüsse gilt:

- Ein laufender Aufruf sperrt Schließen und Escape; pro Öffnung läuft nur ein Write.
- Endet der Aufruf ohne Bestätigung, bleiben Fehler und Eingaben im Dialog.
  Schließen und Escape geben den gemeinsamen Statusknopf frei. Sie löschen weder
  Belegreferenz noch Buchungssperre und wiederholen keinen Command. Solange das
  Receipt ungeklärt ist, bleibt erneutes Buchen gesperrt.
- Ein bestätigtes Receipt entscheidet die Buchung; nachfolgende Lesefehler sind
  Anzeigefehler und kein Anlass, den Auftrag erneut zu senden.

Neue Öffnung oder Ownerwechsel entwerten alte Antworten; deren Fehler und
`finally` dürfen keine neuere Ansicht entsperren. Der Dialog besitzt keine zweite
Buchungswahrheit. Fachpläne ergänzen nur Eingabe-/Zielbindung und die Anzeige
nach der Klärung, etwa [Flächenschaden](docs/plans/runtime/combat-recovery.md#flächenschaden-eine-gebundene-entscheidung).
Gezielte Gegenproben: [Öffnung und Replyverlust](tests/desktop-editor-transition.test.mjs),
[Schadensdialog](tests/desktop-combat-area.test.mjs),
[gemeinsame Bestätigung](tests/desktop-chase-switch.test.mjs).

### Gemeinsame Editor- und Dialogübergänge

[`editor-transition.ts`](src/app/editor-transition.ts) bindet asynchrone Antworten
an die ursprüngliche Aktivierung/Ansicht. `acknowledgeFields` übernimmt die
bestätigte Basis und erhält ausschließlich ausdrücklich benannte editierbare
Skalarfelder, die seit dem Senden verändert wurden. Planname/Besuchstexte und
Rückblick/Übergabe verwenden diesen Weg; Identität, Revision und Reihenfolge
bleiben Teil des Fachvertrags. Rohentwurfsspeicher und Konfliktentscheidung
bleiben bei ihren bestehenden Besitzern.

[Gegenproben](tests/desktop-editor-transition.test.mjs) prüfen spätere Eingaben
und neue Öffnungen; für modale Writes gilt der [Buchungsvertrag](#modale-buchungen).

## Runtime und gemeinsame Weltfolgen

Der [Scene-Fachvertrag](docs/plans/runtime/smr03-live-scene-contract.md) besitzt
Party, Focus, Masken und Reconciliation. Die Quellenanforderung einer verfügbaren
Primary gilt **innerhalb initialisierter LiveSession**; sie erzeugt beim
Campaignöffnen keine heimliche Session. Partyänderung wird sofort autoritativ,
nur tatsächlich betroffene Masken dürfen pending sein. Alle unverwandten
Workflows bleiben verwendbar.

Scenezeit ist autoritativ für Reise/Encounter. Kalender definiert die Umrechnung;
Ein WorldInstant ist eine epochgebundene ganzzahlige Millisekundenzeit; Kalenderregeln sind versionierte Interpretation, keine zweite Uhr. Exakte Dauer-/Rundungsregeln werden mit ihren goldengebundenen Reise-/Regelcommands geprüft. Bestätigter Zeitfortschritt plant Worldfolgen nach Ort/Zeit und schreibt genau
einmal pro Event-/Owner-/Zeitcheckpoint. Scene-Rejoin zeigt Zeitkonflikte und
benötigt die ausdrückliche gewählte Lösung. Wetter, Restock, Trapreset,
Bewohnertagespläne und Autonomie konsumieren denselben Zeitport; Catch-up
arbeitet in begrenzten, checkpointgebundenen Schritten. Kein Ticker kann heimlich
Partygefahr oder Worldzeit vorantreiben. Autonomie bleibt Opt-in und pausiert
vor Partywirkung. Wetter ist ein reproduzierbares zeit-/ortsabhängiges Modell
mit versionierten Regeln, Seed, Klimaregionen und GM-Overrides; keine globale
Simulation sämtlicher unbeobachteter Hexes. Modellparameter werden mit SMR-08
gegen dessen Kontinuitäts-/Effektanforderungen festgelegt.

Regeln bleiben D&D 2014. Reproduzierbare Generatoren binden Input, Quellhashes,
Presetrevision, Algorithmusversion, Seed und Rundung. Ein unmögliches Ergebnis
wird erklärt, keine Vorgabe still gelockert. Kein generischer Multisystemkern.
Combat-, XP- und Lootgoldens sowie Full-S01-Itemquellen bleiben Fachnachweise.
Manuelle Planung und manuelle Musik brauchen weder vollständige Generierung
noch Reise. Musik liest fokussierte Scene/Umwelt als Vorschlag; manuelle
Stop-/Queue-/Loopwahl hat Vorrang. Physische Audiohandles sind nicht portabel;
Quell-IDs, Queue/Cues und sichere Positionen sind portable Runtimewerte.

## Darstellung, Suche und Spieleranzeige

Kamera, Werkzeugauswahl und Objektauswahl führen die Atlasdetails getrennt vom Layoutzustand. `AtlasWorkspaceLayout` ordnet bestehende Controls einer festen Befehlsleiste, der linken Symbolleiste, ihrer unabhängig klappbaren Einstellungsleiste und dem optionalen rechten Kontext zu; fachliche Ereignisse und Speichergrenzen bleiben bei ihren bisherigen Eigentümern. Größenänderungen der Kartenfläche erhalten Mittelpunkt und Meter pro CSS-Pixel ohne Ansichtsverlauf. Die Spielleitungssteuerung bleibt außerhalb des Editors. Das Atlas-Menü stellt den vorhandenen `workspace-navigation`-Knoten bereit; dessen ursprüngliche Handler prüfen offene Eingaben und wechseln innerhalb derselben Kampagne. Beim Verlassen des Editors wird der Knoten zurückgestellt. Kampagnenwechsel und Arbeitsbereichswechsel bleiben verschiedene Aktionen. Zoom ändert
Darstellung und Abfragetiefe, keine Autorenwerte und keinen Pflichtmodus.
Der [Darstellungs-, Auswahl- und Ausgabevertrag](docs/development/atlas-rendering.md)
besitzt Zeichenwege, Quellen-/Framebindung, Raster-/Autorenebene, Budgets,
Fehlerwiederaufnahme und die Trennung von GM-Ausgabe und öffentlicher Freigabe.

Native DOM-Controls tragen Text, Suche, Menüs/Dialoge und Inspector. Der Canvas
hat eine passende zugängliche Objektliste mit denselben Aktionen; Tastatur,
Fokusrückgabe, 200 %, Kontrast und nicht allein farbliche Signale werden mit
jedem Feature gebaut. Lokalisierbare UIlabels und Autorenwortlaut sind getrennt.
Tutorials sind versionierte Capabilityinhalte mit Skip/Dismiss, keine gekoppelte
Geschäftslogik. Such-/Referenzgraphindizes sind rebuildbare Projektionen aller notizfähigen Records. Gewöhnliche Textänderungen aktualisieren den Volltextindex in derselben DBtransaktion; die nächste Suche sieht den neuen Text. Abgeleitete Reference-/Viewcaches werden revisioniert invalidiert. Ein ausgefallener Index darf rebuildbar sein, aber keine stale Ergebnisse als aktuell ausgeben. Volltextindex/SQLpaging zuerst;
keine eigene Suchserverplattform. Mehrdeutige Begriffstreffer bleiben wählbar. Nützlicher Campaignview-/Masken-/Kamerazustand wird gesondert checkpointed und wieder aufgenommen; Hover, Pointercapture und offene Popups sind flüchtig und gehören nicht in Autorenhistory.

Passive Anzeige erhält im privilegierten Prozess erzeugte Allowlist-DTOs und
ausschließlich freigegebene Assetbytes. Kein CSSverstecken von GMtexten im
gleichen Datenmodell. Liveanzeige folgt fokussierter Scene und Knowledgeunion
der dortigen Charaktere, trennt Wissen von aktueller Perception und enthält
keine Mechanik/GMprosa. Statischer Spielerexport verwendet ein ausdrücklich
gewähltes Veröffentlichungsprofil und ist kein Live-Knowledgesnapshot.
Leakprüfung umfasst DTO, IPC, Assets, DOM, Fehler, Protokolle und Neustart.

### Kippbare Geländeansicht

[Gemeinsame Daten, Draufsicht und Geländeprojektion](docs/development/atlas-rendering.md#draufsicht-und-geländeprojektion)
benennen Besitzer und Grenzen. Die [Relief-Roadmap](docs/plans/maps/terrain-relief.md)
besitzt Fachlieferungen und R7-Abnahme.

### Atlasoberfläche ändern

Die [Atlas-Zuständigkeiten](docs/development/atlas-rendering.md#zuständigkeiten-und-datenfluss)
trennen Bereichsladen, Autorenaktionen, Zeichnung, Reisen und Ausgabe sowie
Pinsel, Trassen und Landschaftsinspector. `CampaignAtlasWorkbench` und
`LandscapeWorkbench` verbinden diese Besitzer mit der vorhandenen Oberfläche;
die externen Einstiegsmethoden und die kanonische Speichergrenze bleiben erhalten.

| Änderung | Zuständiger Einstieg |
| --- | --- |
| Bereiche, Gruppen und Werkzeugrouten | [atlas-tool-catalog.ts](src/app/atlas-tool-catalog.ts) ordnet vorhandene Controls und Operationswerte zu. Die globale Auswahl verwendet im Dungeon das bestehende Zeichen-Auswahlwerkzeug, damit Raum- und Pfadgriffe erreichbar bleiben. Nicht verfügbare Werkzeuge und leere Gruppen bleiben ausgeblendet. |
| Leisten, umgehängte Controls, Kontextpanel | [AtlasWorkspaceLayout](src/app/atlas-workspace-layout.ts); Originalcontrols mit ihren Handlern verschieben, nicht kopieren. |
| Breiten, Anordnung, responsive Darstellung | [atlas-workspace.css](src/app/atlas-workspace.css); der [Desktopbuild](tools/build-desktop.mjs) hängt sie an `app.css` an. |
| Werkzeug-/Navigationswechsel und offene Eingaben | [CampaignAtlasWorkbench](src/app/campaign-atlas-ui.ts): `new AtlasWorkspaceLayout` verbindet `prepare`/`tool`/`navigation` mit Flush und `setFamily`. Layout ruft diese Fachgrenze auf; Operationswerte ändern sich erst nach erfolgreicher Entwurfsprüfung. |
| Kartenfläche nach Paneländerung | [AtlasCanvas.resizeViewport](src/app/atlas-canvas.ts) erhält Weltmittelpunkt und Meter pro CSS-Pixel ohne Historyeintrag. |

Prüfweg: [Gruppen- und Werkzeugregressionen](tests/desktop-atlas-tool-hierarchy.test.mjs) für Vollständigkeit, Gruppen-/Werkzeugspeicher, abgelehnte und überlappende Wechsel; [Kameraregressionen](tests/desktop-atlas-canvas.test.mjs) für Größenwechsel;
[Layoutprobe](tools/test-desktop-atlas-layout.mjs) für den nativen Editorablauf
mit synthetischem Profil, Close und frischem Öffnen. Letztere nach
`npm run desktop:runtime` und `npm run build:desktop` mit
`node tools/test-desktop-atlas-layout.mjs` starten. Ein Lauf belegt seine
geprüften Fälle; Bedienqualität und Produktabnahme bleiben gesondert.

## Erweiterungen, externe Anbindungen und Auslieferung

Interne Fachmodule sind normale versionierte Komponenten. Neue Content-/Masken-
oder Generatorarten registrieren explizite Typen und Applicationactions; kein
universeller Metaeditor. Drittanbieter laufen in einem eigenen sandboxed Electron-Renderer mit deaktiviertem NodeIntegration, isolierter Session, ohne GMassets und ohne direkten Datei-/Netz-/IPCzugang. Navigation, neue Fenster und direkte Resource-/Netzanfragen werden gesperrt; Zugriff erfolgt ausschließlich über den geprüften Broker. Ein gewöhnlicher Nodeworker/Subprozess ist **keine** Schutzgrenze für untrusted Erweiterungscode. Kein `eval` im GM- oder privilegierten Prozess. Ein versioniertes Manifest deklariert angeforderte
Campaign-, Datei-, Netz- und Präsentationsrechte. Default-Deny; Zustimmung und
Widerruf werden an **jedem privilegierten Sink** geprüft, auch bei bereits
laufendem Job. Prozesslimits/Timeout und Disable isolieren Fehler.
Install/Remove/Update kann Campaigns nicht unlesbar machen.

Unbekannte Capabilitypayloads bleiben opaque und hashgebunden. Core versteht
ihr versioniertes Besitz-/Identitäts-/Referenzenvelope, nicht ihre Semantik.
Alle campaignlokalen Identitäten und Verweise gehören in die vom Core verstandenen Slots; der opaque semantische Body referenziert diese Slots und darf keine versteckten kanonischen Campaign-IDs besitzen. Damit sind Copy, Transfer, Restore, Trash und Erasure ohne laufenden Provider möglich. Fehlt eine vollständige Remapclosure, wird unabhängiger Complete-Import
blockiert; disclosed Salvage ist eine andere ausdrückliche Aktion. Unbekannte
**Core**schemafelder werden nicht durch einen losen JSONparser weggeschrieben.
Rechte/Context-/Erasuretokens sind lokale Autorität und werden beim Import
nicht als ausführbare Sourceberechtigung übernommen.

Core funktioniert offline; keine versteckte Telemetrie und kein implizites
Nachladen. Bestehende Markdownlinks behalten Wortlaut und einen expliziten Source-Namespace-/IDresolver; externe Dateibearbeitung wird als geprüfter Importvergleich übernommen, nicht als stiller Dualwrite. Explizite Netzwerkimporte/Downloads laufen über den privilegierten
Dienst mit Quell-/Lizenzbeleg, begrenztem Staging, Cancellation und Validierung.
Untrusted SVG, Pakete und Medien werden mit begrenzten isolierten Parsern
verarbeitet. Customsymbols erfüllen den bestätigten Ein-Pfad-Vertrag; das
frühere pauschale „kein SVGimport“ gilt nicht für diesen expliziten Featureumfang.

Electron verwendet getrennte GM-/Spielerrenderer mit Sandbox,
ContextIsolation, ausgeschaltetem NodeIntegration, enger Preload-API,
Sender-/Payloadprüfung und einer CSP ohne beliebige Remoteausführung.
[Offizielle Sicherheitsgrundlage](https://www.electronjs.org/docs/latest/tutorial/security).
Kein ungefilterter Shell-, Datei-, DB- oder beliebiger IPCport.
Linux/Windows/macOS erhalten reproduzierbare selbständige Pakete und Smoke-
Nachweise. Updates prüfen Herkunft, sichern/migrieren eine Kopie der Daten und
aktivieren die neue Version erst nach Prüfung; Rollback verwendet einen
kompatiblen gesicherten Store, keinen rückwärts beschriebenen neuen Schemafund.
Packagingbibliothek und OSspezifische Signierung werden beim ersten lieferbaren
Shellpaket konkret festgelegt; OSnachweise dürfen nicht ans Ende verschoben werden.

## Übergang und Lieferung

1. **Work – Daten und erster Nutzerweg:** Bekannte aktuelle Nutzerformate und
   Verlinkungen inventarisieren; Originale sichern und rein lesende Adapter
   bauen. Neuer kleiner Kern/Store/Shell im selben Produktrepository. Ein
   expliziter Import erzeugt einen geprüften unabhängigen Zielstand; kein
   Dualwrite und keine automatische Überschreibung von Vaultdateien.
   Ort/Raum finden → Geometrie/Key ändern → Undo → automatische Speicherung →
   frischer Prozess ist der erste vollständige Pfad.
2. **Work – Fähigkeitsweise anschließen:** Atlas Work 2/3/4, manuelle World-
   und Planung, Katalog/Party/Scenes, dann die tatsächlich abhängigen Runtime-
   consumer. Reine geeignete Algorithmen/Artefakte selektiv übernehmen; zustands-
   und dateigebundene Editor-/History-/Repositoryteile ersetzen. Die
   [Gesamtroadmap](docs/ROADMAP.md) führt alle SMR-Folgen, keine neue Parallelroadmap.
3. **Efficient:** Gemessene Engpässe in lokalem Commit, Query, Render, Worker-
   Scheduling und wiederholter Bedienung gezielt verbessern. Unbelegte
   Spezialindizes, GPUeffekte und allgemeine Frameworks kommen nicht vorher.
4. **Beautiful / Cutover:** Lesbarkeit und Karten-/Ausgabegestaltung verfeinern;
   frühere Nutzbarkeit/A11y bleibt Pflicht. Den alten Host erst ablösen, wenn
   seine tatsächlich benötigten Nutzerabläufe, Daten und Formatbindungen im
   Zielprodukt qualifiziert sind. Keine Pflicht, seine internen APIs oder
   Testarchitektur mitzunehmen. Übergangsdauer richtet sich nach belegter
   Fähigkeit; es entstehen keine zwei fortzuführenden Produkte.

## Vollständigkeitsprüfung und spätere Details

| Bedarf | Technische Entscheidung / zuständige Detailquelle |
| --- | --- |
| TN-01–06 | Typisierte IDs, Ownership/Lifecycle, Definition vs. historische Fakten, geschlossene Erasure/Transfer; Campaignfachplan |
| TN-07–14 | Atomare Commands, getrennte Scenezeiten, kausale Checkpoints und GM-Overrides; Scene/Campaign-/CE-Fachpläne |
| TN-15–19 | Ein Writer, SQLitecommit/Receipt, Backup, Payloadisolation, vollständiger Transfer; P02/P04 |
| TN-20–23 | Records/Chunks, sichtbare Abfragen, Priorität/Cancel und getrennte Lastprofile; Runtimeplan/P01/C01 |
| TN-24–26 | Gemeinsame räumliche Fakten, Allowlistanzeige, versioniertes Wetter und portable Medien; SMR-04/08/10 |
| TN-27–30 | Versionierte interne Module, isolierte Extensions, retained Envelopes, Sinkrechte und OSbuilds; P03/P04/SMR-10/11 |
| TN-31–32 | Lokalisierbare native Controls, Objektliste, Fokus und A11y je vertikalem Pfad; Feature-/GM-Abnahmen |
| TN-33–38 | D&D-2014-Goldens, explizite Initialize/XP-Hinweise, umfassende Notizsuche, genaue Tabellengewichte und Tutorialversionen; CE/Scene/SMR-11 |

Konkrete SQLspalten, Payloadcodecversionen, Chunkkanten, Navheuristik, Wetter-
parameter, Rendereroptimierung und Signierungswerkzeuge werden beim jeweiligen
ersten Nutzerweg entschieden und gemessen. Besitz, Einheit, atomare Wirkung,
Identität, Rechte und Remapsemantik sind bereits hier entschieden; diese
Details sind keine Ausrede für einen offenen Grundvertrag.

Am 11.10.2026 erfolgten nach dem Entwurf eine erneute vollständige Quellen-/
Fachplanprüfung und Gegenproben über Atlasbearbeitung, House-/Room-Lifecycle,
Split-Reise-Weltfolgen, Party-/Combat-/Shopabschluss, Definitionlöschung,
Transfer/Erasure, unavailable Extensions und Anzeigeprivacy. Konkrete Orakel und
Grenzen stehen im [Prototypplan](ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md).
Unbekannte Original-Unteroptionen und reale OS-/Power-Loss-/RP-L-Produktbeweise
bleiben dort benannte Liefernachweise, keine behaupteten Ergebnisse dieser
Planungsarbeit. Frühere Architektur-/Codemessungen sind im Gitstand
`116c16af48b6a073216685c8d8e2cc74fada82c3:ARCHITECTURE.md` historisch verfügbar;
sie besitzen keinen eigenständigen normativen Vorrang.

## Signierte Linux-Updates (19.10.2026)

Der [Updatepfad](docs/project/delivery/github-updates.md) verwendet den bestehenden
Linux-Ordnerbuild, unveränderliche Versionsordner und einen atomaren `current`-Link.
Main besitzt den GitHub-Zugriff; der gebündelte Helfer besitzt Installation,
Profilsicherung und Recovery unter Kernel-Sperren. Ed25519 bindet Produktlinie,
Releaseversion, Commit, Plattform, Archiv und Dateiverzeichnis. Datenmigrationen
werden vor Aktivierung mit dem neuen Store auf einer vollständigen Profilkopie
geprüft. Der neue Prozess bleibt bis zur dauerhaften Erststartfreigabe unsichtbar;
nach dieser Freigabe gibt es kein automatisches Datenrollback. Der bisherige
Kampagnenarchivvertrag und der Datenordner CampaignWorkbench bleiben bestehen.
