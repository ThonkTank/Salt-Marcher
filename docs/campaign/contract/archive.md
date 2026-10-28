# SMR-01: Campaign, Datenlebenszyklus und gemeinsame Commands

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: campaign
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 11.10.2026. Dieser Fachplan besitzt Campaign-/Context-, Transfer-,
Lösch- und Ownershipsemantik. [ARCHITECTURE](../../project/architecture/overview.md) entscheidet Store
und gemeinsame Schreibstelle; [P02/P04](../../project/verification/architecture-experiments.md)
prüfen Fehler/Portabilität. `acceptance.json` besitzt die datierten Produktbelege.

## Scope

Anlegen/Öffnen/Wechseln/Umbenennen, Autosave/Resume, unabhängige Kopie/Import,
Export/Restore, Trash/permanente Löschung und portable Daten. Eine Campaign
ohne Party, Plan, Karte oder LiveSession ist gültig. Es gibt keinen impliziten
Sessionstart und keine Placeholdercampaign, die einen fehlenden Context kaschiert.

## Hostneutraler Lifecycle-Vertrag

Fachmodule liefern validierte geplante Recordänderungen und Ownership-/
Referenzclosure. Der lokale Schreibdienst veröffentlicht **alle** beteiligten
Records und ein Commandreceipt in einer SQLite-Transaktion. Fachlicher Besitz
bedeutet Invariantenverantwortung, nicht ein separater physischer Writer pro
Fachbereich. Die alten Stage/Validate/Publish/Verify/Finalizebegriffe stehen
nur für Planung/Prüfung/Commit/Status/Projektion, kein internes verteiltes Protokoll.
Staging und nachlaufende Dateifinalisierung sind bei Import/Assets/Erase nötig,
nicht bei einer gewöhnlichen NPC-, Room- oder Partyänderung.

## Invarianten

- Identitäten gehören nicht zu Namen, Pfaden oder der aktuellen Ansicht.
- Aktuelle wiederverwendbare Definition, akzeptierte Autoreninstanz, unveränderlicher
  Vorschlagsrun, Running Scene, Maskenruntime, erklärende Historie, Trash und
  retained Capabilitypayload sind verschiedene Lebenszyklen.
- Current reads dürfen einer Shareddefinition folgen; abgeschlossene Facts
  behalten die bestätigte Erklärung und werden nicht neu berechnet.
- Bestätigte Änderung wird automatisch gesichert. Pending ist sichtbar;
  gespeicherte Bestätigung erfolgt erst nach durable Commit. Ein manueller
  Save/Reopen-Beleg ersetzt nicht den Normalbetrieb ohne Save.
- Complete, unabhängiger Import, Restore und disclosed Salvage sind verschiedene
  Commands. Originale werden nie für eine probeweise Migration überschrieben.
- Scope-/Recordrevision und gültige lokale Autorität werden an der Commitgrenze
  geprüft, nicht allein in einer UIvorprüfung.

## Campaign-Kontext

### Identität, Aktivierung und Wiederaufnahme

Der Store besitzt Campaign-ID, revisionierte Mitgliedschaft und aktiven
Campaign-/UIcontext. Jede neue Aktivierung erzeugt einen neuen Token, auch bei
A→B→A. Token ist lokale Autorität, keine exportierte Autoren-ID. Ein Readmodel
bindet Campaign, Aktivierung und Basisrevision; spät eintreffende Callback-/Job-
Resultate sind ohne aktuelle Prüfung nicht schreibfähig. Campaignwechsel
beendet gültige normale Texteingaben oder erhält deren Draft ausdrücklich;
er übernimmt keine Generator-/Graphvorschläge und löscht keine offene Arbeit.

Start zeigt Campaignauswahl und die letzte sicher gespeicherte Wiederaufnahme.
Nach ausdrücklichem Continue werden Fokus, Masken, Reise, Overrides und sichere
Queues rekonstruiert. Ein verfügbarer Resumezustand bedeutet keinen versteckten
automatischen Sessionstart. Beschädigung wählt die neueste eindeutig sichere
Recovery, legt Verlust offen; nur Ambiguität braucht eine Auswahl.

### Kampagnenauswahl und Papierkorb prüfen

Die Originalanforderung erlaubt gleiche Anzeigenamen. Auswahl, Umbenennung,
Papierkorb und Wiederherstellung müssen deshalb an der sichtbaren Kampagnenkennung
hängen. Wiederherstellen erhält Identität und Autoreninhalte, ändert weder den
aktiven Zeiger noch den Zeitpunkt der letzten Öffnung. Erst ausdrückliches Öffnen
oder Fortsetzen aktiviert die Kampagne; der nächste Appstart zeigt erneut die
Auswahl.

[Store-/DOM-Regressionsfälle (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/campaign/desktop-campaign-catalog.test.mjs) prüfen
Befehlsquittungen, unklare Antworten, lokale Auftragsvermerke und Kontextwechsel.
Die [native Dialogprobe](../../../tools/test-desktop-campaign-trash.mjs) ergänzt zwei
gleichnamige Kampagnen mit unterschiedlichen Raum-Keys: Namensentwurf abbrechen,
aktive Identität gezielt suchen und in den Papierkorb legen, falsche permanente
Löschbestätigung abweisen, wiederherstellen, andere Identität umbenennen und nach
Neustart den ursprünglichen Raum ausdrücklich wieder öffnen. Sie vergleicht die
vollständigen Raumzeilen und Öffnungszeitpunkte und verlangt reguläre Prozessenden.
Ausführen nach `npm run build:desktop` mit
`node tools/test-desktop-campaign-trash.mjs`; `QA_EVIDENCE_DIR` legt das Ziel für
Bilder und das Ergebnis mit Commit-/Artefaktbindung fest. Die Probe bestätigt weder
eine erfolgreiche permanente Löschung noch Paketinstallation oder Ownerabnahme.

Die [unabhängige Datenhaltungsprüfung vom 24. Oktober](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/independent-code-review-20261024/README.md)
ergänzt den Schutz offener Atlas-/Graphentwürfe, kopierte Triggerreisen und
identifiergleiche Importtexte. Ihre eigene native Probe führt außerdem eine
permanente Löschung mit privaten und gemeinsam verwendeten Bildern aus und
prüft die Bereinigung eines alten verwalteten Transfersnapshots beim Start.
Dateifehler bleiben zur Wiederaufnahme offen; schon historisch verlorene
Bildzuordnungen werden nicht durch pauschale Löschung geraten.

### Copy-/Complete-Import-Remap und Ownerlieferung

Die [Transferverträge bei den Fachmodellen](transfer-ownership.md) beschreiben die aktuelle Zuordnung aller Tabellen und Referenzen, die gemeinsame Vorprüfung und den Pflegeweg für neue Felder.

Ein SQLite-Snapshot ist noch kein `.kwcampaign`-Archiv. Der Dateiweg beginnt in
[`desktop/main.ts`](../../../desktop/main.ts): `captureCampaign` verbindet den validierten
Snapshot und die Medienliste aus
[`CampaignStore.campaignSnapshot`](../../../src/app/storage/store.ts) mit hashgebundenen
Audio-/Bild- und Katalogdateien. [`campaign-files.ts`](../../../desktop/campaign-files.ts)
besitzt Manifestbindung und ZIP-Ein-/Ausgabe. Die direkte Kopie nutzt denselben
Capture ohne ZIP.

[`acceptPreparedCampaign`](../../../desktop/campaign-accept.ts) prüft Medien und die aktuelle
Konfliktbasis unmittelbar vor dem synchronen Storecommit. ID-Remap und atomare
Veröffentlichung gehören weiterhin zu
[`campaign-data.ts`](../../../src/app/storage/campaign-data.ts); der Dateiadapter besitzt
keine zweite DB-Schreibgrenze.

Gemeinsame Definitionen werden bei Konfliktprüfung und Planung gestreamt; die
jeweiligen ID-Abfragen werden pro Tabelle einmal vorbereitet. Die Veröffentlichung
baut aus dem bestehenden Wiederverwendungsplan einen tabellenweisen ID-Index.
Gegenstandskopf und Versionszeilen können dieselbe ID besitzen und bleiben daher
getrennte Schlüsselräume. Unveränderte Definitionen benötigen keine wiederholte
lineare Suche in der gesamten Wiederverwendungsliste. Explizite Konfliktwahl,
historische Aliase, Quellbytes und atomarer Rollback bleiben verbindlich.
`tests/campaign/desktop-campaign-shared-definitions.test.mjs` prüft wiederholten Import,
alle drei Entscheidungen mit Autorenverweisen über Fresh und einen Fehler nach
begonnenem Definitionsersatz.

Die lokale instrumentierte Gegenprobe mit 600/1.200 zusätzlichen Definitionen
fand vor der Änderung 3.608.641/10.064.341 Vergleiche in der Wiederverwendungsliste;
danach entfällt diese Suche. Annahmezeiten lagen dort ungefähr bei
5,1/7,9 statt 1,5/1,6 Sekunden. Das ist kein allgemeiner Laufzeitgrenzwert:
Validierung, ID-Remap, viele Konfliktarchive, Snapshot und Medienarbeit brauchen
weiterhin eigene Skalierungsabnahmen. Der konsistente SQLite-Snapshot und die
Stagingkopie schützen vollständige Daten einschließlich opaker Capabilitybytes.
Gemeinsame Sammlungen bleiben geschlossene Kandidatenbestände für Generierung
und Musikautomatik; bloß unreferenzierte Definitionen werden nicht entfernt.


Unabhängige Campaignkopie/-import vergibt neue IDs für alle lokalen Objekte,
Scenes/Runtime, Checkpoints, Abschnitte und Referenzen. Quelle und bestehende
Campaigns bleiben unverändert; kein Merge in ein vorhandenes Ziel. Restore
behält IDs. Media-/Audio-Sourceidentität und Metadaten bleiben verständlich;
lokal notwendiges Rebind/remap aktualisiert alle Cue-/Scene-/Assetverweise atomar.
Identische unveränderliche Bytes dürfen intern dedupliziert sein, mutable
Autorenwerte bleiben unabhängig. Undo/UIhandles/ausführbare Source-Rechtetokens
sind keine portable Campaignwahrheit.

Shareddefinitionskonflikte zeigen vor Mutation Folgen für neue und bestehende
Campaigns. GM kann eine Variante verwerfen oder beide mit getrennten IDs
behalten; alle betroffenen Referenzen werden gemäß ausdrücklicher Auswahl
umgebunden. Gleicher Name allein ist weder Identität noch Mergegrund. Neue
fehlende Definitionen werden importiert, abgeschlossene Fakten bleiben erhalten.

## Ownership und gemeinsame Commands

Owner benennt Typen, Scope, Record-/Medien-/Referenzclosure und Lebenszyklus.
Diese Registry ist eine kleine versionierte Code-/Datenliste, kein allgemeines
Pluginframework. Für unavailable Capabilityunits versteht Core ein geschlossenes
Envelope mit Identitäts-/Referenzslots, Version/Hash und opaque Payloadbytes.
Eine unbekannte fehlende Besitzclosure darf Complete/Erase nicht still passieren.
Registryänderung, Rights-/Contextwiderruf oder Recordkonflikt wird bei Commit
geprüft. Read-only Enumeration besitzt selbst keine Publishautorität.

Command-ID und typisierter Fingerprint binden Input/erwartete Revisionen.
Statusabfrage liest dasselbe Receipt; unter gleicher ID anderer Inhalt scheitert.
Keine neue Ziel-ID oder stiller zweiter Command bei Retry/unknown outcome.
Nach Commit bleiben UI-/Such-/Audio-/Capabilityprojektionen bei Fehler pending
und werden aus bestätigter Wahrheit wiederhergestellt. Kein Owner darf
seine Teilwirkung unabhängig dauerhaft sichtbar machen.

### Complete und Salvage sind verschiedene Befehle

Complete validiert eine geschlossene, versionierte Manifest-/Hash-/Referenz-
menge einschließlich unverorteter Karten, Autorenprosa, Shareddefinitionen,
Assets/Audio, Runtimeknowledge/Charges/Countdowns, Trash und opaque Daten.
Archiveingabe wird gestreamt und als untrusted geprüft: keine Pfadtraversal,
Symlinks/externen Quellen, Netzauflösung, Ausführung, Kompressionsbombe oder
stille Weglassung. Quelltestbudgets sind keine künstlichen Produktcaps.

Salvage zeigt Survivor-/Omissionliste mit Grund und ausgeschlossenen Referenzen
vor Annahme. Es darf keine unbekannte Teilfolge als Complete ausgeben. Große Imports stagen geprüfte Records in kurzen Transaktionen unter einem unsichtbaren Operationsscope. Der abschließende kurze Commit prüft vollständige Closure/Basis/Rechte und aktiviert das Ziel samt Shareddefinitionsentscheidungen. Dadurch bleibt Livearbeit zwischen den Stagingschritten bedienbar; keine minutenlange offene Schreibtransaktion. Staging ist von bestätigter Wahrheit getrennt; erst der vollständige finale Commit macht das Ziel sichtbar. Cancel vor Commit hinterlässt keine sichtbare Zielcampaign; nach Commit
klärt derselbe Command den Ausgang und finalisiert nur vorwärts.

### Trash, Restore und permanente Löschung

Trash bewahrt volle Owner-/Runtime-/Beziehungsclosure, pausiert abhängige
Aktivität und kann kohärent restored werden. Ownerabhängige Shops/Positionen
und Beziehungen werden weder verwaist noch still gelöscht. Dungeontrash
enthält den geforderten 30-Tage-Wiederherstellungsweg; dauerhafte Sofortlöschung
bleibt eine getrennte ausdrücklich bezeichnete Aktion.

Permanente Löschung entfernt live/trash, reconstructive History-/Undo-/Receipt-
werte, Assets/Temp/Staging, retained Daten und app-managed Backups; siehe
[Erasuregrundlage](../../project/architecture/overview.md#speicherung-und-wiederherstellung).
Eine persistierte Erasureclosure dokumentiert Teilnehmer und tatsächlichen
Bereinigungsfortschritt. Bei unavailable Provider kann Core dessen gesamte
betroffene Unit gemäß Besitzclosure löschen/quarantinieren, ohne sie auszuführen.
Crash/Widerruf/fehlende Bytes erzeugen keine falsche erfolgreiche Vollendung.
Historie darf eine nichtrekonstruktive Erklärung/unknown Identity behalten.
Source-Erasure-/Rechtetokens werden beim Transfer nicht ausführbar importiert;
lokale Restore-/Rebindentscheidungen benötigen aktuelle lokale Autorität.

## Planung, World und fachliche Konfliktentscheidungen

Name-only-Campaignobjekte sind gültig; Locationtags sind optionale Metadaten.
World-Ort, Atlasmarker und Planort verwenden dieselbe ID. Neue freie metrische
Platzierung erlaubt mehrere Orte pro Hex, ohne implizit ein Terrainhex zu malen.

Pro Campaign ist genau ein Plan aktuell, dessen Name/Datum optional sind;
weitere gespeicherte Pläne dürfen unabhängig bestehen. Timeline-/Besuchsidentität
ist nicht Ortsidentität. Generatorrun ist immutable; GM wählt Ergebnisse
einzeln und überführt sie in editierbare authored Instanzen. Ganze Planersetzung
entfernt keine bereits akzeptierte Worldplatzierung. Generated Loot im
unveränderlichen Proposal bleibt immutable, akzeptierte Treasure-/Ledgerinstanz
ist ausdrücklich bearbeitbar. Ein immutable Draftvertrag verbietet nicht die
benötigte Instanzbearbeitung.

Preparation→Initialize erzeugt neue Runtime-/Scene-IDs aus einem kopierten
Snapshot. Liveänderung schreibt niemals in den Planner zurück. Die
[manuelle Planung](manual-session-planner.md) funktioniert
ohne Party/Generator/Locationport; optionale Ortsprojektion benötigt aktuelle
identitätsgebundene Readmodelquelle.

## Persistierte Quelle und Kampagneneinstieg

Istbefund auf `116c16af48b6a073216685c8d8e2cc74fada82c3`: Campaignsources,
Ownershipprojektion, Atlasadapter und #40/#41-Teilwege existieren mit begrenzten
Receipts. `ManualPlanner` ist ohne produktive Storeaktivierung memory-only;
Atlas `storage.changed()` persistiert Draft, nicht den autoritativen Autosave.
Diese Bausteine sind Prüf-/Übergangsreferenzen. Kein Bestandsschutz für ihre
Sources, fünfstufige Envelope-/Dateipläne oder öffentlichen internen APIs.

Zielanschluss: Campaign-/World-/Plan-/Runtime-/Atlasrecords im einen Store,
Readmodels aus aktuellen Revisionen, Autorität an der Commitgrenze. Alte
native Formate werden über explizite Adapter eingelesen/ausgegeben; es gibt
nach Cutover keine gleichzeitige kanonische Vault- und SQLitewahrheit.
Wortlaut/Links/IDs und bekannte externe Bindungen sind zu vergleichen.

## Acceptance-Reihenfolge

1. Leere Campaign → Anlegen/Öffnen/Rename/A→B→A mit alten Callbacks und Reopen.
2. Ort/Room/Plan bearbeiten → Undo/Autosave/Close/Crash, ohne LiveSessionzwang.
3. Gekoppeltes Geometrie-/Scene-/Party-/Ledgeroutcome mit Commit-/Cancel-/Retry-
   und unknown-outcome-Faultfällen; kein halb publizierter Owner.
4. Copy/Restore/Complete/Salvage getrennt; voller IDremap, Definitionkonflikte,
   unabhängiger Rechner, Runtime/Audio/Trash/opaque Daten.
5. Einzelpayload-/DB-/Asset-/Backupcorruption mit Isolation/Recovery/Verlustanzeige.
6. Trash/Restore/permanente Löschung, auch fehlender Provider und app-owned
   Backup-/WAL-/Temp-/Historyreste; externe GM-Pakete als nicht widerrufbar erklären.

Reale Store-/Zielhost-/P02-/P04-/OSnachweise stehen noch aus. Vergangene
Kern-/Hostbelege stehen unverändert in `acceptance.json`, `docs/reference/` und
`116c16af48b6a073216685c8d8e2cc74fada82c3:ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md`.
Sie erhalten ihren Scope, keinen neuen synthetischen PASS.

### Visible transfer entry and independent continuation

The campaign screen offers **Paket importieren…** directly, including before a
campaign is opened. The transfer manager names the open source for export and
local copy; those source actions are unavailable without an active campaign.
The import/copy preview names its source and shows drawing, room, knowledge and
other principal content counts before confirmation. Complete inventory, size
and producer version remain in the package details. Conflict decisions and the
stored-ticket recovery path are shared by both import entries. After acceptance,
the normal campaign activation restores its workspace view; transfer does not
replace that view with the Party area. The existing Atlas navigation button
also names the active campaign so source and copy remain identifiable while
working on maps.

`tools/test-desktop-campaign-transfer-visit.mjs` exercises export, direct import,
linked-note edits and room selection through Atlas search, confirmed room-key
edits, normal shutdown, fresh-process Atlas reopening and separate continuation
of source and import. Failed region states during activation fail this visit;
region readiness alone does not replace selecting and editing the room. It records
actual browser zoom,
owned process identities, bounded normal exits and fresh native window captures;
its disposable profile honors disk-backed `TMPDIR`. Native file selection is
instrumented; passive IPC metadata records request
identity and outcome without campaign payloads. `--fail-import-atlas` supplies
one narrow negative opening case after a confirmed import; it must fail the
same usability assertion without reimporting. The fault/recovery visit remains in
`tools/test-desktop-campaign-copy.mjs`; the clean visit does not replace it.
