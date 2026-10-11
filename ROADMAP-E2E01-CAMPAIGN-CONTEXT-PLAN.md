# E2E-01 Campaign Lifecycle and Context – P01

Status: Plan-Kandidat; unabhängiger Review erforderlich. Kein Produkt-, Host-, P02-, P04- oder E2E-01-PASS.

Basis ist `active/installed-phase1` auf `6bfb1f393722cd469dc4fd5f15d8dea12a154f6b` mit dem ratifizierten Gatekatalog aus PR #16. Die fachliche Ausgangsgrenze ist `ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md`, deren semantischer Stand `11e256309d43bcd1c14db66ffc41945c9360aec8` unabhängig geprüft wurde.

## Ziel und sichtbarer E2E-01-Beitrag

Der Lauf liefert den hostneutralen Campaign-Lifecycle- und Context-Kern, den Hex' dünner Campaign→Atlas-Adapter konsumieren kann. Eine Kampagne lässt sich anlegen, öffnen, umbenennen und wechseln. Wiederöffnen erhält die Campaign-ID; ein A→B→A-Wechsel erzeugt jeweils eine neue Context-Bindung, sodass Auswahl, History, Projektionen und Schreibbefehle aus einer früheren Aktivierung nicht in die aktuelle Kampagne gelangen. Für Copy und Complete-Import liefert der Lauf einen ownergebundenen Remap-Plan und einen Campaign/Data-Participant-Stage; erst ein späterer gemeinsamer Publish mit P02/P04 darf daraus eine sichtbare neue Kampagne machen.

Der Lauf startet keine LiveSession und erzeugt keine Party-, Preparation-, Scene-, Encounter-, Clock- oder Atlas-Fachpayloads. Er bietet ausschließlich IDs, Revisionen, Namespace und Context-Guards.

## Abgrenzung und Ownership

- Campaign/Data besitzt die Typen, Laufzeitvalidierung, immutable Projektionen, Lifecycle-/Command-Zustandsmaschine, Revision-/Context-Guards, die Abdeckungskoordination und das hostneutrale Import-Remap-Modell.
- Hex besitzt den dünnen Adapter von einer bestätigten `CampaignContextProjection` zum Atlas. Der Adapter verwirft auf Contextwechsel seine ephemeral Selection/Camera/History-Bindung und lädt Ownerdaten neu; dieser Lauf implementiert den Adapter nicht.
- Atlas/City/Dungeon, Katalog/Encounter, Music/Weather/Shops und alle weiteren tatsächlichen Domainowner behalten Payload-, Format-, History- und Snapshotbesitz. Dieser Lauf liest oder mutiert ihre internen Werte nicht. Jeder Owner liefert und bestätigt über seinen Port ein immutable Identitäts-/Referenzinventar, seine erwartete Owner-/Schema-/Snapshotrevision sowie Payload-Snapshots oder verifizierte Payloadbezüge; ein unbekannter oder unavailable Owner gilt nie als leer.
- Der gemeinsame History-/Transaction-Port sowie P02-Save/Reopen und P04-Archiv/Checksum/Hostimport bleiben fremde, offene Eingänge. Eine injizierte In-Memory-Portgrenze beweist keine Dateidauerhaftigkeit.
- Party/Preparation/Initialize ist in E2E-01 negativ: keine Methode dieses Kerns startet oder setzt Runtimezustand fort.

## Geplante Verträge

### Identität und Snapshot

`CampaignId`, `CampaignLocalId`, `CampaignRevision`, `CampaignContextToken`, `CampaignNamespace`, `CampaignCommandId` und `CampaignReceiptId` werden als validierte, opaque Werte modelliert. Context-Token und Command-ID sind verschieden: der Token identifiziert eine flüchtige Aktivierung, die Command-ID denselben logischen Auftrag bis zu seinem terminalen Ausgang. Anzeigenamen stiften keine Identität. Ein persistierbarer `CampaignSnapshotV1` enthält genau Schema, Campaign-ID, Revision, Name, Namespace und Lifecycle-Zustand. Zusätzliche fremde Payloads werden nicht in diesen Kern kopiert.

Jede bestätigte Mutation verlangt Campaign-ID plus erwartete Revision und erhöht die Revision genau einmal. Fehlende, fremde oder stale Revisionen scheitern vor Mutation. Rückgaben sind tief immutable; Eingabeobjekte werden defensiv kopiert.

### Context-Aktivierung

`open`/`switch` validiert einen Snapshot und erzeugt eine `CampaignContextProjection` aus Campaign-ID, aktueller Revision, Namespace und einem neuen Context-Token. Der Token ist eine Aktivierungsidentität, keine persistierte Campaign-Identität. A→B→A erzeugt drei verschiedene Tokens; ein Befehl muss ID, Revision, Namespace und Token der aktuellen Projektion treffen. Dadurch darf ein alter A- oder B-Befehl selbst bei gleicher CampaignRevision nicht schreiben. Jede Aktivierungsanfrage trägt zusätzlich eine Command-ID und eine monotone lokale Anforderungssequenz; ein verspätetes Open(A) oder sein Callback darf einen inzwischen bestätigten B-/A2-Context nicht ersetzen.

`reopen` liest denselben persistierten Snapshot, erhält Campaign-ID und Namespace und erzeugt nur einen neuen Context-Token. Normales Reopen remappt nie IDs. Contextwechsel veröffentlicht keinen Atlas-/Scene-/Sessionzustand und hat keinen Autostart-Hook.

### Lifecycle- und Command-Kern

Der Kern erhält ausschließlich injizierte Ports für Snapshot-Lesen, Commandstatus-Abfrage und compare-and-write-Veröffentlichen sowie injizierte ID-/Token-Fabriken. Geplant sind `create`, `open`, `rename`, `switch`, `planCopy` und `stageCompleteImport`. Jeder Auftrag friert unter einer stabilen `CampaignCommandId` den erwarteten CampaignContext, alle beteiligten Owner-/Schema-/Snapshotrevisionen und sämtliche vorab zugeordneten Ziel-IDs einschließlich Remap ein. Seine immutable Receipt-/Outcome-Projektion führt genau `staged`, `validated`, `published`, `verified`, `finalized`, `cancelled_before_publish`, `conflict` oder `outcome_unknown`.

Stage→Validate→Publish→Verify→Finalize läuft unter derselben Command-ID und demselben Receipt. Retry oder Statusabfrage derselben Command-ID verwendet dieselben Ziel-IDs und dasselbe Ergebnis; sie erzeugt weder Ersatzauftrag noch zweite Revision oder Wirkung. Gewinnt Cancel vor Publish, bleibt bestätigte Wahrheit unverändert und verspätete Teilnehmerantworten dürfen nicht publizieren. Hat Publish gewonnen, beendet Cancel nur lokales Warten: Verify/Finalize bleiben pending und laufen ausschließlich vorwärts; ein Cancellation-Erfolg ist dann falsch. Antwortverlust und `outcome_unknown` werden über die ursprüngliche Command-ID abgefragt. Contextprüfung unmittelbar vor Mutation verhindert Wirkung nach einem Switch. Die erste Implementierung modelliert diese Semantik deterministisch und hostneutral; dauerhafte Receipts, Prozesscrash und echter Mehrbesitzer-Publish bleiben P02/P04-/Integrationsbeweise.

### Copy-/Complete-Import-Remap und Ownerlieferung

Ein versionierter `CampaignOwnerInventoryV1` bindet Source-Campaign, Owner-ID, erwartete Owner-/Schema-/Snapshotrevision, vollständige Records und Referenzen sowie Payload-Snapshots oder verifizierte Payloadbezüge an denselben eingefrorenen Lieferstand. Campaign/Data koordiniert die Abdeckung, erfindet aber keine fremden Records. World/Location/Placement, City/Building, Dungeon/Floor/Room/Route/Section, campaignlokale EncounterPlan-Referenzen und alle weiteren tatsächlich vorhandenen lokalen Bestände müssen durch ihren Owner vertreten sein. Enthält die Campaign Medien, bestätigt deren Owner außerdem `AudioSourceId`, Source-Metadaten, manifestgebundenen Bytehash/Payloadbeleg und alle kampagnenlokalen Cue-/Scene-/Runtime-Referenzen. Ein nicht vorhandener Bestand benötigt einen bestätigten Leerzustand; absent, unknown oder unavailable ist kein Leerzustand.

Der aus allen bestätigten Inventaren gebildete `CampaignIdentityGraphV1` klassifiziert jede Identität explizit als `campaign-local` oder `shared`. Vor jeder Teilnehmer-Stage wird dreiphasig validiert:

1. Die erwartete Ownerliste wird gegen alle Inventare abgeglichen. Fehlende Owner, fehlende Records, ausgelassene unreferenzierte Records, stale Revisionen, unbekannte Owner/Referenzschemas und Inventar-/Graph-/Payloadabweichungen scheitern fail-closed.
2. Alle lokalen Definitionen werden auf eindeutige IDs und erlaubte Typen geprüft und vollständig auf neue IDs abgebildet. Campaign-ID und Namespace erhalten jeweils eine neue unabhängige Identität und erscheinen in der Closure.
3. Jede lokale Referenz muss in dieser Closure vorkommen; jede globale `CatalogSource`-/`CatalogEntry`-Identität bleibt bytegleich. Fremde, doppelte, fehlende oder nicht klassifizierte Referenzen brechen vor der ersten Participant-Stage ab.

Die Closure enthält die alte und neue Campaign-ID, den alten und neuen Namespace sowie sämtliche kampagnenlokalen Objekt- und Referenz-IDs. Campaign/Data validiert/erzeugt den Remap-Plan und staged nur seinen eigenen neuen Campaign-Snapshot. Jeder Payloadowner wendet exakt dieselbe immutable Closure an seiner eigenen Projektion an und liefert Validate-/Stage-/Publish-Belege über den noch offenen gemeinsamen Transaction-Port. Der Kern schreibt keine fremden Payloads um. Bis alle erwarteten Teilnehmer samt Payload-/Rebindbeleg validiert sind, darf keine Ziel-Campaign sichtbar werden; I01 liefert deshalb nie allein einen abgeschlossenen Copy-/Complete-Import-Erfolg.

Quelle, bestehende Kampagnen und shared definitions bleiben unverändert. Copy und Import dürfen nie in eine vorhandene Campaign mergen oder sie überschreiben. P04 validiert Archiv, Manifest, Checksums und Bytes; fehlende, beschädigte oder unverifizierbare erforderliche Medien verhindern Complete. Nur ein späterer, ausdrücklich gewählter Salvage-Pfad darf Auslassungen samt Identität und Auswirkung offenlegen. I01 akzeptiert nur das begrenzte ownergelieferte Identitäts-/Referenzmodell und behauptet weder Archivprüfung noch gemeinsamen Publish.

## Vorgesehene Dateien

- `src/features/campaign/campaign-contracts.ts`: opaque IDs, Laufzeitvalidierung und immutable Snapshot-/Context-/Command-/Inventory-/Graph-Typen.
- `src/features/campaign/campaign-lifecycle.ts`: hostneutraler Lifecycle-/Command-Kern, Receiptstatus sowie stale/foreign/late-result Guards.
- `src/features/campaign/campaign-remap.ts`: Ownerabdeckung, deterministische vollständige Old→New-Closure und Campaign/Data-Participant-Stage; keine fremde Payloadumschreibung.
- `tests/core/campaign-lifecycle.test.ts`: Create/Open/Rename/Switch/Reopen, Command-/Cancel-/Retry-Semantik, Revisionen, Immutabilität und negative Sessiongrenze.
- `tests/core/campaign-remap.test.ts`: Ownerinventare, Copy/Import-Closure, Participant-Stage, globale Identitäten, Atomizität und beschädigte Lieferungen.

## Pflicht-Testmatrix für I01

1. Create erzeugt eine eindeutige Campaign-ID, Revision 1 und eine immutable Projektion; gleicher Name bleibt erlaubt.
2. Rename mit korrekter Revision erhöht exakt einmal; stale, foreign oder falscher Namespace verändert keine Daten.
3. A→B→A erzeugt neue Context-Tokens. Befehle mit A1-, B- oder falschem Revisionstoken scheitern vor Portmutation.
4. Reopen erhält Campaign-ID, Namespace, Name und Revision bytegleich, erzeugt aber einen neuen Context-Token; keine ID wird remappt.
5. Kein Create/Open/Switch/Reopen ruft Party-, Preparation-, LiveSession- oder Atlas-Fachlogik auf; die API bietet dafür keinen Callback.
6. Wiederholung einer bestätigten Command-ID erzeugt keine zweite Revision, Wirkung, Ziel-ID oder Portpublikation. Antwortverlust wird per Statusabfrage unter demselben Receipt aufgelöst; `outcome_unknown` erzeugt keinen Ersatzauftrag.
7. Cancel vor Publish lässt bestätigte Wahrheit unverändert und blockiert verspätete Antworten. Cancel nach gewonnenem Publish meldet keinen falschen Erfolg, sondern führt Verify/Finalize unter derselben Identität vorwärts.
8. Verspätetes Open(A), ein A1-Auftrag oder anderer alter Callback überschreibt nach B/A2 weder den aktiven Context noch neue Daten.
9. Copy-/Import-Plan erzeugt neue Campaign-, Namespace- und lokale IDs, bewahrt shared Catalog-IDs und lässt Quelle, bestehende Campaigns und shared definitions unverändert.
10. Vollständiger Positivfall bindet alle bestätigten Ownerinventare, Records, Payloadbelege und lokalen Referenzen genau einmal an dieselbe immutable Closure; jeder Participant erhält exakt dieselbe Closure, Campaign/Data staged nur seinen eigenen Snapshot und keine Ziel-Campaign wird allein durch I01 sichtbar.
11. Fehlender ganzer Owner/Record, ausgelassener unreferenzierter Record, Inventar-/Graph-/Payloadabweichung, stale Ownerrevision, unknown/unavailable Owner, nicht unterstütztes Referenzschema, fehlender Payload-/Rebindbeleg, Missing Target, dangling local reference, duplicate ID, shared/local-Kollision, Fabrikduplikat oder ungültiges Schema bricht vor der ersten Portmutation ab.
12. Ein ablehnender Participant, fehlende Medienbytes oder fehlender gemeinsamer Transaction-/P04-Publish bewirkt null sichtbare Ziel-Campaign; Ownerprojektionen bleiben bytegleich.
13. Typecheck, gesamte Git-Testsuite und Build bestehen. Das ist nur Codebeleg; realer P02-Reopen, P04-Import, gemeinsamer Mehrbesitzer-Publish und Obsidian-/Zielhostlauf bleiben offen.

## Offene Gates nach diesem Paket

Auch ein bestandener I01-Lauf schließt E2E-01 nicht. Offen bleiben mindestens der Campaign→Atlas-Adapter, gemeinsame Atlas/City/Dungeon-History und Transaction, echter P02-Save/Reopen-Prozess, echter P04-Complete-Import mit Manifest/Checksums, House→Dungeon-Bindung, integriertes Fixture, installierter Hostlauf und unabhängige Atlas-QA-Abnahme. E2E-02 bis E2E-04 bleiben gesperrt.
