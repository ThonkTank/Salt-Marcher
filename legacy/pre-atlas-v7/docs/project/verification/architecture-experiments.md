# ADR-P01–P04/C01: Qualifikation der technischen Grundlage

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-28 (historische Proben und heutige Qualifikationsrolle; kein neuer Probenlauf)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Historische Entscheidungsproben vom 11.10.2026 auf
`116c16af48b6a073216685c8d8e2cc74fada82c3`; ihre Ergebnisse bleiben auf diesen
Aufbau begrenzt. Technische Entscheidungen stehen in
[ARCHITECTURE](../architecture/overview.md) und [Plattform-ADR](../architecture/platform-decision.md).
Diese Datei besitzt Untersuchungsbefunde, anspruchsvolle Gegenproben und die
Qualifikationskriterien. Die heutige Implementation und nächsten
Lieferanschlüsse besitzt die [Roadmap](../delivery/roadmap.md); der gemeinsame
Prüfstand steht im [E2E-Katalog](end-to-end.md). Ein Planungsentscheid ist kein
Produkt-PASS. Alte P01–P04-Matrizen/Fixtures/Receipts behalten ihren datierten
Umfang; sie erzwingen weder Editorreuse noch das frühere Mehrdateiprotokoll.

## Isolierte Entscheidungsexperimente

### Speichervergleich am 11.10.2026

Ein außerhalb des Repositories ausgeführter Probeaufbau verwendete Node
22.22.0, better-sqlite3 13.0.3 / SQLite 3.53.4, WAL/FULL, 100.000 Records
mit ID/Revision und gleich großen Autorenpayloads. 30 gewöhnliche Einzeländerungen
wurden jeweils mit revisionsgebundenem Receipt/Undowert in einer DBtransaktion
gespeichert. Vergleich: dieselben Records als einzelnes vollständig
serialisiertes JSONaggregate, temporäre Datei, fsync, Rename und Verzeichnis-fsync.
Kein Vergleich gegen optimierte separate Recorddateien oder eine fertige UI.

| Messung | Ergebnis dieser Probe |
| --- | --- |
| JSONaggregat / SQLitegröße | 40.188.897 / 37.359.616 Bytes |
| p95 dauerhafter lokaler SQLitecommit | 42,4 ms |
| p95 Voll-JSONserialize/-write | 186,1 ms |
| p95 SQLread von 256 Records | 19,1 ms; deshalb keine SQLquery pro Pointermove, sondern gebundene Viewportqueries und lokale Projektion |
| Konsistenter DBbackup | 164,1 ms; unabhängig geöffnet, 100.000 Records und integrity_check=ok |
| SIGKILL vor / in / nach Transaktion | 3 betroffene Records und Receipt jeweils vollständig alt / alt / neu, danach integrity_check=ok |
| Stale Basisrevision | Abgelehnt ohne Record-/Receiptmutation |

Rohwerte und ausführbare Reproduktionsanleitung:
[Probe](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/technical-foundation-20261011/probe.md),
[Rohresultat](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/technical-foundation-20261011/storage-probe.json).
Die Probe stützt lokale Recordtransaktionen gegenüber Whole-Document-Writes;
sie beweist **keine** RP-R/RP-L-Runtime-, Renderer-, Plattform-, Stromausfall-
oder generelle Corruptionqualifikation. Datenprofile und Hardware werden in
späteren Produktmessungen explizit fixiert. Keine Zeitmessung allein entscheidet
den Store: bekannte fachliche Atomik und Gesamtaufwand sind die Hauptgründe.

### Einzelpayload-Corruption

Eine weitere isolierte Probe änderte direkt ein Bit innerhalb eines
gespeicherten JSONpayloads. Der Recordchecksum erkannte den Fehler; ein
unbetroffener, erst nach dem Backup geänderter Record blieb aktuell. Die
unabhängige beschädigte Unit wurde aus geprüftem Backup repariert, die
beschädigten Originalbytes blieben erhalten. [Resultat](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/technical-foundation-20261011/payload-probe.json).
Das stützt Payloadisolation und selektive Recovery. Strukturpage-/Index-/WAL-
fehler und gekoppelte Commandclosure sind ausdrücklich separate P02-Nachweise.

### Räumliche Modellgegenprobe

Feste Dungeonwürfel (1,524 m) unterstützen ihre bestätigten Grid-/Face-/Trigger-
regeln. Ein 3-m-Haussegment auf Faktor 1,1 skalieren muss dagegen genau 3,3 m
ergeben. Alles auf feste Würfel zu zwingen würde runden oder die physische
Zellgröße verändern; alles als freie 3D-CSG zu modellieren müsste einfache
Dungeonzellen neu simulieren. Daher ein gemeinsamer metrischer Raumvertrag
mit den beiden tatsächlich nötigen Autorenformen, ohne zweite Kamera/History.
Gemeinsame Transform-/Anchor-/Passagequeries und Reopen müssen diese Verbindung
beweisen; die Gegenprobe ist eine Ableitung aus Anforderungen, kein behaupteter
neuer Geometriebenchmark. Der [Runtimeplan](../../atlas/contract/spatial-runtime.md)
besitzt die genaue Wertsemantik.

## P01 – Editieren, History, Abfragen und Zielshell

Kleinster vertikaler Weg: aktuellen bekannten Dungeon/Atlas auf expliziten
Importvergleich öffnen → Room/Ort suchen → Kontur und exakten Keytext ändern →
gemeinsam Undo/Redo → ohne manuelles Save schließen → frischer Prozess.
IDs/Links/Whitespace, Metrik, sichtbare Geometrie und bestätigte Arbeit sind
erhalten. UIrenderer besitzt weder Node noch Datei-/SQLrechte. Bestehenden
Editorcode zu verwenden ist **kein** Abnahmekriterium.

Zusätzlich: benachbarte Meter/Zellen an großen positiven/negativen Ankern;
Viewport über Chunkgrenze; überlagerte Auswahl; IME/Textfokus und stale Callback;
Slicewechsel/temporäres Pan bei Geste; späte Generatorantwort nach A→B→A;
200 gewöhnliche Undos; große Operation mit offen gezeigtem Historybudget;
Roommove/Split/Merge ohne Textverlust. Views, UIaktivierung und Commit müssen
dieselbe Zielidentität besitzen. Reine bestehende Geometriebausteine werden
gegen diese Wirkung geprüft, nicht durch Implementationsspiegeltests.

## P02 – Dauerhaftigkeit, Fehlerisolation und Erasure

Eine gemeinsame Transaktion muss unter anderem Geometrie+Key+Relocation,
Party+Scene+Maskenfolge und Shopstock+Ledger+Historie abbilden. Recordrevisionen,
Rechte und aktueller Context werden an der Commitgrenze geprüft. Gleiche
Command-ID/Fingerprint liefert denselben Status, niemals zwei Wirkungen.
Cancel vor Commit verändert keine bestätigte Wahrheit; nach Commit führt
Status-/Projection-/Assetfinalisierung nur vorwärts. Timeout/unknown outcome
fordert Aufklärung desselben Commands, keinen automatischen Ersatzversuch.

Pflichtmatrix vor jeder Produktfreigabe:

- kill vor/in/nach Transaktion und vor UIack; normale Schließung, Stromverlust,
  denied write, ENOSPC, Read-only, fehlende Assets und verweigerte Synchronisierung;
- gleichzeitige Eingabe/Navigation, neue Änderung während Save, zwei UIblätter,
  Contextwechsel/Widerruf und externe Änderung am nicht aktiv beschreibbaren Store;
- beschädigte einzelne Payload/Checksum, Definition, Asset und opaque Unit:
  unbetroffene Units weiter nutzbar, Originalbytes behalten, eindeutige Recovery
  automatisch wählen, Ambiguität/Verlust offenlegen;
- beschädigte SQLitepage/Index/WAL: sichere neue DB aus geprüftem Backup,
  komplette verifizierbare neuere Commandclosures, kein halbes Outcome oder
  stiller Nullzustand; diese Probe ist eine eigene Voraussetzung des Zielstores;
- consistent Backup während Writes, fehlender WAL, beschädigter Backupsatz und
  selektive Wiederherstellung; Quelldaten nie für einen Versuch überschreiben;
- Trash/Restore und permanente Löschung bei aktivem, deaktiviertem und fehlendem
  Provider; Live/Trash/Staging/Temp/Undo/Receipts/WAL/Backups/Assets nach
  Crash/Restart/Export auf nichtrekonstruktive Erasure prüfen.

Messung: null Verlust als gespeichert bestätigter Arbeit bei Crash/Power Loss;
durable Ack p95 ≤1 s und 10-s-Timeout auf RP-R. Ein Receipt vor erfolgreichem
Commit ist kein Ack. Projektionen dürfen nach Commit pending sein, die UI
meldet den konkreten Bereich. Die vorhandene Linux-/proc-basierte
P02-Prototyplockmechanik ist kein OSportables Produktdesign und wird durch
den einen lokalen Writer ersetzt.

## P03 – Passive Anzeige und Erweiterungsrechte

Allowlistprojektion im privilegierten Dienst, eigener Renderer/Assetport.
Scenewechsel/Blank/Artoverride, Knowledgeunion fokussierter Charaktere und
aktuelle Perception getrennt prüfen. GMprosa, Mechanik, Secrets, verborgene
Geometrieänderung, unfreigegebene Assets, Dateipfade und sensitive Fehler dürfen
in keiner Spieler-Daten-/IPC-/DOM-/Log-/Cache-/Exportstrecke auftreten.
Playerupdate aus bestätigten Sicht-/Passagefakten p95 ≤100 ms im Dungeonprofil.

Extensions: ausdrückliche Installation, genauer Rechtedialog, Default-Deny,
Widerruf während aktivem Job, untrusted Parser, Absturz/Timeout, inkompatibles
Update und Entfernen. Jeder privilegierte Sink prüft aktuelles Recht. Disable
erhält opaque Daten und lässt andere Workflows/Campaignöffnung funktionieren.
Rights-/Contexttokens aus importierten Paketen sind niemals lokale Autorität.
Sandbox-/CSP-/ContextIsolation-/Senderprüfungen werden am Paketbuild untersucht,
nicht nur als konfigurierte Boolwerte abgehakt.

## P04 – Geschlossener Transfer und externe Formate

Versioniertes Manifest bindet IDs, Records/Versionen, Checksums, Ownership/
Referenzclosure, Definitionsvarianten, Karten-/Notizdaten, Assets/Audio,
Runtime/Queues/Knowledge/Charges/Countdown, Trash und opaque Capabilityunits.
Complete enthält alles; disclosed Salvage nennt jede bewusste Auslassung und
ist ein anderer Command. Import legt eine unabhängige Campaign an, Restore
erhält IDs. Sharedkonflikte zeigen Auswirkungen und ermöglichen ausdrücklich
Variante verwerfen oder beide unter unabhängigen IDs behalten. Alte lokale
Context-/Rechte-/Erasuretokens werden nicht übernommen.

Fälle: andere Installation ohne Quelldateien, Cross-OS, gleiche Namen mit
verschiedenen IDs, unplatzierter Dungeon, verknüpftes Template, fehlender Provider,
mehrere Scenes/Travelcheckpoints, getrashtes Shopownerhaus, portable Audioqueue,
defekter Inhalt, falscher Hash, Traversal, Symlink/externer Pfad, Übergröße/
Kompressionsbombe und Cancel bei jedem Stagingabschnitt. Streamingprüfung
achtet auf echte Eingabe-/Speicherreserve; Quelltestlimits sind keine Produktcaps.
Vor Veröffentlichung null sichtbare Zielcampaign; großer Import in kurzen unsichtbaren Stagingtransaktionen, dazwischen positive Livewrites/Reads nachweisen. Finaler Commit aktiviert nur die gesamte validierte Closure. Nach Commit idempotenter
Status und sichere Finalisierung. Kein allgemeiner Legacyimport nur wegen
historischer Codeexistenz; tatsächlich genutzte aktuelle Formate werden explizit
geschützt und über geprüfte Adapter übertragen.

Dungeon-authored Paket/Prefab ist ausdrücklich **nicht** Completecampaign:
keine Actorpositionen, Logs, Runtimeknowledge, aktuellen Charges oder Undo.
PNG/JPEG/SVG/JSON/GeoJSON/CSV/WEBP/VTT und weitere Originaldialekte bekommen
eigene versions-/profilgebundene Exportadapter. GM- und veröffentlichter
Spielerausschnitt unterscheiden Sichtbarkeit; Bildexport verändert nichts.

## C01 – Gegenprüfung über alle Produktbereiche

| Anspruchsvoller Ablauf | Zu prüfende zusammengesetzte Wirkung |
| --- | --- |
| Region → generierte Stadt → Taverne → zwei Geschosse → Dungeonpassage | Ein metrischer Atlas; geschützte Regeneration; genaue Hausmaße und 5-Fuß-Dungeonwerte; ein House-/Key-/Anchorkommit und Reopen |
| Volume teilen/mergen → Template ändern → Graphumbau verwerfen/annehmen | Identität/Prosa erhalten; Inhalt und Geometrie unabhängig; keine Vorschlagswahrheit im Autosave; ein atomarer angenommener Umbau |
| Party split → Reise → Wetter/Trap/Shop/Tagesplan → Rejoin/Undo | Scenezeiten getrennt; Worldfolgen genau einmal; Trapeffekt GMbestätigt; Zeitkonflikt sichtbar; spätere fremde Fakten bleiben erhalten |
| Preparation → Combatabschluss → XP/Loot → Shophandel → Definitionupdate | Plan aliasiert keine Runtime; Ledger/Stock/Fakten atomar; genaues 2014-Golden; aktueller Katalog ändert keine historischen Ergebnisse |
| Custombiom/-symbol löschen mit aktiver und getrashteter Campaign | Globale Referenzersetzung atomar, Tabellen/Autoreninhalte bleiben; unabhängiger Import und Restore zeigen denselben gültigen Stand |
| Provider fehlt → Completeimport → Restore → permanente Löschung | Opaque Bytes/Remapclosure erhalten, keine importierte Autorität; kein rekonstruktiver Rest in app-owned Stores/Backups |
| Manualmusic → Autoplay/Wetterlayer → Stop/Queueoverride → Neustart | Manuelle Priorität, portable Source-IDs/Cues, kein fremder Track als stiller Ersatz; tatsächliches Audio und Fehlerisolation |
| Suche/Referenzpreview → Keyboardcanvas/Inspector → Popup/Dialog → Tutorialupdate | Alle notizfähigen Inhalte aktuell suchbar; stabile Linkziele; Fokus/100 %/Screenreader/Kontrast; Skip verliert keine Arbeit |
| Focuswechsel/Knowledge → sichere Playergeometrie bei Secretänderung | Nur fokussierte Sceneunion; Erinnerung vs. aktuelle Wahrnehmung getrennt; keine verborgene GM-/Mechanik-/Assetwirkung |

Alle 36 Sourcebereiche sind in [SCOPE](../requirements/scope.md) der bestehenden SMR-/AC-
Folge zugeordnet; diese Gegenproben ersetzen ihre einzelnen Kriterien nicht.
Die TN-01–38-Entscheidungszuordnung steht in ARCHITECTURE. Quellkonflikte
werden dort und in SCOPE begründet entschieden, nicht gemittelt.

## Messprofile, Wiederverwendung und Freigabe

Exakte RP-H/RP-R/RP-L/RP-X-Profile, Populationen, OS/Build/Hardware, Cold/Warm,
Iterationenzahl, p95 und rohe Fehl-/Cancelwerte binden die Produktmessung.
Separat: Atlas 100k Hexes/5k Orte/50 Details, City 5k Gebäude und Dungeon
100k authored Cells mit ihren strengeren 16-/50-/500-ms-Teilbudgets.
Quelle: [Program Technical Needs](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/project/architecture/program-technical-needs.md).
75%-Memory-/120%-Tempreserven sind Test-/Schedulingbedingungen, keine Anzahlcaps.
TN-22-Cancel p95 ≤1 s; Cleanup spätestens 10 s mit markierten resumable
Artefakten. Livearbeit erhält Priorität vor Hintergrundjobs. Ein Datenbankread
oder Cachebenchmark ist kein Render-, Audio-, Power-Loss- oder Physikinputbeleg.

Übernehmen: qualifizierte Quellen/Attribution/Golddaten, geeignete reine Polygon-/
Volume-/Einheitenalgorithmen, Pixi nach Messung, nutzbare native Controls nach
Context-/Fokusprüfung. Vereinfachen: kleinteilige DTO-/Portzeremonie und doppelte
Statusinventare. Ersetzen: Whole-Document-Ownerhistory, gekoppelte Filejournale,
stateful Sessionwrapper als zweite Autorenwahrheit, Vollparse je Draw/Hit und
implizite Hostprivilegien. **Kein** Teil bleibt allein wegen vorhandener Tests.
Verhaltenstests bleiben verwendbar; neue Tests prüfen Invarianten/Faultfälle.

Cutover erfordert tatsächliche Installation und direkte positive/fault-/
OS-/A11y-/Datenbelege am gemeinsamen Build. `acceptance.json` bleibt einziges
Produktabnahmeregister. Historische Prototypmatrizen werden an ihre ursprüngliche
Gitplanrevision gebunden und nicht nachträglich als Beweise des neuen Kerns
umetikettiert. Weitere Optimierung nur aufgrund geänderter Anforderungen oder
gemessenen verfehlten Budgets.

Historische vollständige Prototypplanung: `116c16af48b6a073216685c8d8e2cc74fada82c3:ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md`.
