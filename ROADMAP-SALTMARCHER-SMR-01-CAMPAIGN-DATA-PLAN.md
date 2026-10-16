# SMR-01: Campaign, Datenlebenszyklus und gemeinsame Commands

Stand: 11.10.2026. Dieser Fachplan besitzt Campaign-/Context-, Transfer-,
Lösch- und Ownershipsemantik. [ARCHITECTURE](ARCHITECTURE.md) entscheidet Store
und gemeinsame Schreibstelle; [P02/P04](ROADMAP-SALTMARCHER-ADR-PROTOTYPES.md)
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

### Copy-/Complete-Import-Remap und Ownerlieferung

Der Desktop führt Remap und Veröffentlichung im [Campaign-Store](src/app/storage/campaign-data.ts) aus. Der ungenutzte alternative `stageCampaignRemap`-Modellpfad wurde entfernt; die folgenden Anforderungen bleiben verbindlich.

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
[Erasuregrundlage](ARCHITECTURE.md#speicherung-und-wiederherstellung).
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
[manuelle Planung](docs/plans/campaign/manual-session-planner.md) funktioniert
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
