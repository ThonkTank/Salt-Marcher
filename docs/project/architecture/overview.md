# Technische Grundlage des Gesamtprodukts

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Entscheidungsstand: **11. Oktober 2026**. Untersucht wurde das Zielrepository auf
`116c16af48b6a073216685c8d8e2cc74fada82c3`. Alle 36 Anforderungsdateien und die
beiden ergänzenden Primärquellen aus [scope-sources.json](../requirements/sources.json)
wurden gegen die dort gebundenen SHA-256-Werte geprüft. Der historische
Umfangsabgleich bleibt erhalten. Diese Seite entscheidet die technische
Richtung; sie behauptet weder Implementation noch Produktabnahme.

## Zweck und Entscheidungsmaßstab

Der vollständige Auftrag steht in [SCOPE](../requirements/scope.md), die Nutzerabläufe und
Atlasoberfläche im [Atlasplan](../../atlas/requirements/atlas.md). Das Produkt verbindet
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

### Code nach Zuständigkeit finden

Der aktive Desktopcode liegt unter `desktop/` und `src/app/`. Die App ist nach
fachlichen Arbeitsbereichen gegliedert; Dateien werden nach ihren Verbrauchern
und Aufgaben zugeordnet, nicht nach ihrer Größe:

| Verzeichnis unter `src/app/` | Zuständigkeit |
| --- | --- |
| `workspace/` | Renderer-Einstieg, Navigation, Tutorial, Updates und Erweiterungsoberfläche |
| `atlas/` | Karte, Gelände, Bewuchs, Stadt- und Raumgeometrie, räumliche Werkzeuge und Ausgabe |
| `campaign/` | Kampagnenverwaltung, Vorbereitung, Notizen, Raumtexte, NPCs und Generierung |
| `runtime/` | Live-Spiel, Party, Kampf, Reise, Kalender, Musik und Spieleranzeige |
| `catalog/` | Kataloge, Referenzsuche, Gegenstandsdefinitionen und Encounter-Zusammenstellung |
| `shared/` | Gemeinsame Verträge, Editor-Lebenszyklus und wiederverwendete Bedienelemente |
| `storage/` | Kanonischer SQLite-Speicher und fachliche Speicheroperationen |
| `transfer/` | Kopier-/Archivmodelle, Transferprüfung und erzeugte Vertragsbeschreibungen |

Die aktiven Node-Tests spiegeln die sechs Fachbereiche unter `tests/`. Der
bestehende gebündelte TypeScript-Testbestand liegt unter `tests/shared/core/`;
sein Einstieg bleibt Bestandteil derselben Standardsuite. `tests/adr-prototypes/`
hat weiterhin seine ausdrückliche Auswahl. `tests/native-reference/` wird nicht
von der Standardsuche erfasst. [Gezielte Testläufe](../verification/testing.md)
bereiten die gemeinsamen Artefakte automatisch vor.

Ausschließlich historische Obsidian-Einstiege und Adapter liegen unter
`src/legacy/obsidian/`. Der historische Pluginbuild verwendet diesen Einstieg.
Reine wiederverwendete Fachlogik unter `src/features/` sowie Modell und Berechnung
bleiben erhalten; sie sind nicht allein wegen ihrer Herkunft Legacy-Adapter.
Die Desktop-Bundlepfade für Worker, Lazy-Module, Assets und Spieleranzeige bleiben
unverändert. Diese Gliederung ändert weder IPC-Verträge noch Archive oder Schema.


### Zusammensetzen und fachliche Eigentümer

`workspace/renderer.ts` verbindet Start, Kampagnenaktivierung, Navigation und
Fachoberflächen. `atlas/room-editor-ui.ts` besitzt Raumeingaben, Konturvorschau,
Autosave, gespeicherte Rohentwürfe, Speicherklärung und Raumhistory. Die
Kampagnendialoge samt Importticket liegen bei `campaign/campaign-manager-ui.ts`.
Beide erhalten einen ausdrücklichen Hostvertrag; sie importieren den Renderer nicht.

Die Atlas-Verantwortlichen für Bearbeitung, Regionen, Reise und Ausgabe bleiben
erhalten. Ihre Zusammenarbeit verwendet fachliche Schnittstellen aus
`atlas/atlas-workbench-types.ts`. Die Zeichnung konsumiert Leseansichten; die
Ausgabe entscheidet selbst über ihre Zeigerereignisse und den Auswahlrahmen.
Ein anderer Verantwortlicher schreibt nicht in ihren Export-Drag.

Der Store hält Verbindungen, aktive Tokens, Graphvorschau-Verbindungen,
Transaktionskoordination und die Weiterleitung zu Fachmodulen. Atlasoperationen,
Regionprojektionen, Reise, Fortschritt, Weltfolgen und Kampagnenmutationen liegen
in ihren Speichermodulen. Raumänderungen verwenden die bestehenden geprüften
Records in `storage/stored-records.ts`; `storage/preparation.ts` bündelt die zuvor
im Store verteilte Vorbereitung. Fachübergreifende Aufträge erhalten benannte,
typisierte Funktionen ihrer bestehenden Eigentümer. Verschachtelte Transaktionen,
Receipt-Auswertung und Recovery bleiben Teil derselben Schreiboperation.

`tools/check-module-boundaries.mjs` ist Bestandteil von `check:repo`. Es verfolgt
Imports, Re-Exports, Typ-Imports und dynamische Modulpfade auch indirekt:
Renderer dürfen weder Speicherimplementierungen noch privilegierte Hostmodule
importieren, gemeinsame Fachlogik keine Oberfläche, aktiver Desktopcode keine
historischen Obsidian-Adapter. Die ausdrücklich benannten gemeinsamen
Bedienelemente bleiben Präsentationscode. Diese Prüfungen ergänzen den
Browser-Bundlecheck; IPC-Verträge und Datenformate werden dadurch nicht erweitert.

### Atlas

Der [Atlasplan](../../atlas/architecture/unified-spatial-atlas.md) beschreibt den vollständigen
GPU-Umstieg und die technische Bereinigung. Die frühere M0–M8-Technikpflicht ist
aufgehoben. [Zuständigkeiten und Prüfwege](../../atlas/architecture/rendering.md)
stehen an einem Ort; der [Store-Worker](canonical-store-worker.md) besitzt die
kanonische SQLite-Schreibgrenze. Main vermittelt ausschließlich privilegierte Host-Aufrufe.

Ein ebener Meterraum, gemeinsame Kamera und History sowie eindeutige Objekt-
identitäten verbinden die Werkzeuge. Die lokale Offline-Anwendung bleibt auf
gewöhnliche Laptops mit 16 GiB RAM ausgerichtet; größere Entwicklungsrechner
ersetzen deren Qualifikation nicht. Begrenzte Leseprodukte und Caches sind
ableitbar. Raumtexte, Geometrie und Metadaten besitzen gezielte Lesezugänge;
keiner davon wird zu einer zweiten Schreibautorität.

Die [gemeinsame Editor-Sitzung](editor-lifecycle.md) bündelt Kontextgeneration,
angenommene Aufträge und Abmeldung. Die zentrale Registrierung unterscheidet
Checkpoint, Navigation, Kampagnenwechsel und Schließen; Fachmodule behalten
Validierung, Rohentwürfe und Receipt-Auswertung.

### Prozesse und Verantwortlichkeiten

**Ein modularer TypeScript-Kern in einer eigenständigen Electron-Anwendung,
ein lokaler SQLite-Schreibdienst, eine Atlasoberfläche.** Die
[Plattformentscheidung](platform-decision.md) begründet Alternativen
und Übergang; der [Prototypplan](../verification/architecture-experiments.md) führt
die noch erforderlichen Implementationsbeweise.

| Teil | Zuständigkeit | Prüfbare Grenze |
| --- | --- | --- |
| Fachmodule | Werttypen, Invarianten, reine Berechnungen, Commandplanung | Kein Electron/Obsidian, SQL, Dateisystem, DOM oder Netz; reproduzierbare Resultate auf identischen Inputs |
| Anwendung | Aktivierung, Zugriffsprüfung, Command, betroffene Records, Konflikt/Cancel, Projektionen | Eine Änderung kann mehrere Fachmodule betreffen, besitzt aber eine gemeinsame Commitentscheidung |
| Electron-Main | Fenster, Dialoge, Rechteprüfung, Ressourcenfreigabe und geordnetes Schließen | Enger Preload-Vertrag; typisierter asynchroner Store-Client statt SQLite-Zugriff |
| Lokaler Schreibdienst im Node-Worker | SQLite, Validierung an der Schreibgrenze, Revisionen, Receipts, Assets, Recovery und Migration | Ausschließlich dieser Dienst schreibt Produktdaten; UI und Extensions erhalten keine DB-Verbindung |
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
| Räumliches Objekt | Dungeon, Stadt, Gebäude, Raum, Passage/Path; jeweilige authored Geometrie und Inhalt | Ein Haus besitzt Außen-/Innengeometrie gemeinsam. Room-ID ist unabhängig von der aktuell zugeordneten Geometrie. Fachvertrag: [räumlicher Anschluss](../../atlas/contract/spatial-runtime.md). |
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
[Große Welt und verbleibende Commitlast](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/atlas-backup-worker-20261021/README.md).

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

Für die in [`CommitFamily`](../../../src/app/shared/commit-receipt.ts) gebundenen Writes führt
die Diagnose über drei bestehende Besitzer:

| Frage | Einstieg |
| --- | --- |
| Ist derselbe Command noch ungeklärt? | [`commit-confirmation.ts`](../../../src/app/shared/commit-confirmation.ts): `writeConfirmed` sichert die Referenz vor dem Senden; `hasPendingCommit` sperrt weitere Buchungen. `checkPendingCommit` bedient den vorhandenen Statusknopf. |
| Läuft der Aufruf noch oder existiert schon ein Receipt? | [`CommitTracker`](../../../desktop/commit-tracker.ts), angeschlossen in [`desktop/main.ts`](../../../desktop/main.ts) an `campaign:commit-status`: ergänzt den gespeicherten Status um laufende Aufrufe. Ein fehlender DB-Beleg allein bedeutet währenddessen noch nicht „nicht gebucht“. |
| Gehört der gespeicherte Beleg zu diesem Auftrag? | [`CampaignStore.commitStatus`](../../../src/app/storage/store.ts) prüft den Aktivierungskontext; [`storage/commit-receipt.ts`](../../../src/app/storage/commit-receipt.ts) prüft Campaign, Fingerprint, Prüfsumme und Fachbezug. |

`checkPendingCommit` meldet einen bestätigten Beleg über `onCommitResolved` an
den Fachbesitzer, beim Kampf `recoveredCombat` aus [`combat.ts`](../../../src/app/runtime/combat.ts).

#### Modale Buchungen

[`BookingDialog`](../../../src/app/shared/booking-dialog.ts) verbindet Beuteverteilung und
Kampfverstärkung mit der bestehenden `writeConfirmed`-/Receiptgrenze.
[`CombatAreaPanel`](../../../src/app/runtime/combat-area-ui.ts) führt seinen eigenen `busy`-Zustand.
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
nach der Klärung, etwa [Flächenschaden](../../runtime/contract/combat-recovery.md#flächenschaden-eine-gebundene-entscheidung).
Gezielte Gegenproben: [Öffnung und Replyverlust](../../../tests/shared/desktop-editor-transition.test.mjs),
[Schadensdialog](../../../tests/runtime/desktop-combat-area.test.mjs),
[gemeinsame Bestätigung](../../../tests/runtime/desktop-chase-switch.test.mjs).

### Gemeinsame Editor- und Dialogübergänge

[`editor-transition.ts`](../../../src/app/shared/editor-transition.ts) bindet asynchrone Antworten
an die ursprüngliche Aktivierung/Ansicht. `acknowledgeFields` übernimmt die
bestätigte Basis und erhält ausschließlich ausdrücklich benannte editierbare
Skalarfelder, die seit dem Senden verändert wurden. Planname/Besuchstexte und
Rückblick/Übergabe verwenden diesen Weg; Identität, Revision und Reihenfolge
bleiben Teil des Fachvertrags. Rohentwurfsspeicher und Konfliktentscheidung
bleiben bei ihren bestehenden Besitzern.

[Gegenproben](../../../tests/shared/desktop-editor-transition.test.mjs) prüfen spätere Eingaben
und neue Öffnungen; für modale Writes gilt der [Buchungsvertrag](overview.md#modale-buchungen).

## Runtime und gemeinsame Weltfolgen

Der [Scene-Fachvertrag](../../runtime/contract/smr03-live-scene-contract.md) besitzt
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


Weitere Fachabschnitte: [Teil 2](overview-2.md)
