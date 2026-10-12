# SMR-01 Campaign Identity and Data Lifecycle

Abschnitte: [Scope](#scope) · [Campaign-Kontext](#campaign-kontext) · [Ownership und gemeinsame Commands](#ownership-und-gemeinsame-commands) · [Persistierte Quelle und Kampagneneinstieg](#persistierte-quelle-und-kampagneneinstieg)

Status: Entwurf; keine Implementierungsfreigabe.

## Scope

Der erste SMR-01-Lauf definiert nur die spätere Datenbesitz- und Acceptance-Grenze für Campaign-ID, Erstellen/Wechseln/Umbenennen, Trash/Restore/permanentes Löschen, Kopie, Import/Export, Autosave, Crash-Recovery und portable Daten. Er verlangt einen hostneutralen Lifecycle-Vertrag; keine UI, Datei-API oder gemeinsame Scene-/Zeit-/Atlas-API wird vorweggenommen.

## Hostneutraler Lifecycle-Vertrag

Jede kampagnenübergreifende Operation trägt eine stabile Operation-ID, die beteiligten Owner, erwartete Owner-Revisionen und ihren beabsichtigten Effekt. Der Vertrag führt genau die Stufen `Stage`, `Validate`, `Publish`, `Verify` und `Finalize`; jeder Owner publiziert ausschließlich seine eigene immutable Projektion oder sein eigenes Receipt. Ein unbekanntes Ergebnis wird über dieselbe Operation-ID idempotent abgefragt und je nach validiertem Receipt roll-forward oder rollback recovered. Kein Owner darf dazu fremde SQL-, Datei-, History- oder Runtime-Interna öffnen oder verändern.

Die Renderer-UI erhält nur validierte, enge Capability-Ports, immutable Projektionen und strukturierte Fehler; sie erhält keine Pfade, Handles oder Host-/Dateisystemrechte. Atlas und Dungeon nehmen ausschließlich über ihre jeweils ratifizierten, validierten Ports teil.

## Invarianten

- Jede Kampagne erhält eine stabile lokale Identität; Anzeigenamen sind nicht eindeutigkeitsstiftend.
- Mutationen sind atomar oder bleiben als klarer Recovery-Fall erhalten. Autosave bestätigt keinen unvollständigen Zustand.
- Trash ist wiederherstellbar; permanente Löschung benötigt eine explizite, nachvollziehbare Abschlussgrenze.
- Eine Kopie erhält neue Identitäten und vollständig unabhängige kampagneneigene Inhalte, Assets und Runtime-Zustände. Keine spätere Mutation darf in die Ausgangskampagne zurückwirken.
- Jeder Import erzeugt immer eine neue, unabhängige Kampagne und darf nie in eine vorhandene Kampagne mergen oder sie überschreiben. Er remappt jede Campaign-, Objekt- und Runtime-ID sowie jede interne Referenz vollständig auf die neue Identitätsmenge; Restore behält dagegen exakt die vorhandene Identität.
- Import/Export verwenden ein versioniertes, geschlossenes Manifest mit Prüfsummen für Campaign-Daten, Karten, Bilder, Audio, nötige wiederverwendbare Definitionen, Runtime, Recovery-Trash und retained unknown data. Es erlaubt eine quellrechnerunabhängige Wiederöffnung und behandelt jede Eingabe als untrusted: begrenzte Validierung, keine Ausführung, Netzauflösung, externen Pfade oder Traversal, keine unbeschränkte Dekompression, atomare Ablehnung und Cancellation sowie einen Cross-Platform-Roundtrip.
- Jedes Audio-Medium trägt eine stabile fachliche `AudioSourceId`, unveränderte Source-Metadaten und einen manifestgebundenen Bytebeleg. Beim Import bleiben diese fachlichen Angaben erhalten; erforderliches lokales ID-Remapping ist vollständig und atomar auf alle Cue-, Scene- und Runtime-Referenzen angewandt und als Rebind-Projektion sichtbar. Fehlende oder beschädigte Medien bleiben als identifizierte Referenz erhalten, liefern eine sichtbare Retry-/Rebind-Möglichkeit und werden nie still durch andere Medien ersetzt.
- Wiederverwendbare oder installationsweite Definitionen werden im Importpaket explizit als solche ausgewiesen. Identitäts- und Versionskonflikte zeigen vor jeder Mutation ihre Folgen; der GM verwirft eine Variante oder behält beide unter unabhängigen IDs. Die Entscheidung bleibt bis zur atomaren Veröffentlichung gestaged. Bis zur gemeinsamen Vertragsratifikation bleibt jeder nicht entschiedene Konflikt fail-closed; SMR-01 entscheidet weder still über Teilen noch über Duplizieren.
- Recovery erhält die aktive Kampagnenidentität sowie alle dauerhaft darstellbaren Zustände für fokussierte Running Scene, Encounter und Travel. Der Host folgt dabei der bestehenden expliziten Campaign-Continue-Grenze: kein verdecktes automatisches Session-Resume, aber eine sichere, vollständige Wiederaufnahme nach ausdrücklicher GM-Aktion.
- Beschädigung wird mindestens pro unabhängig adressierbarem kampagneneigenem Record, Asset, wiederverwendbarer Definition oder Runtime-Kontext erkannt, isoliert und offengelegt. Unbetroffene Kampagnendaten bleiben verwendbar; Originalbytes bleiben bis zu expliziter Recovery/Löschung erhalten. Vollständiger Export und offengelegter Salvage-Export sind getrennte Ergebnisse; nur Letzterer nennt jede Auslassung.
- Permanentes Löschen entfernt nach bestätigtem Abschluss Live-, Trash-, Staging-, Temp- und app-managed Recovery-Payloads der Kampagne. Frühere, vom GM selbst exportierte Pakete sind externe Kopien und nicht widerrufbar.
- Bestehende Dungeon-/Atlasdateien erhalten ihren Formatbesitz; SMR-01 besitzt keinen stillen Formatwechsel.

## Gemeinsame offene Verträge

Campaign-ID↔LiveScene-ID, Campaign-History, Scene-Zeit, Running-Scene-/Encounter-/Travel-Recovery, Atlas-/Dungeon-Mehrdatei-Commit, Revisiontoken, beteiligte Lifecycle-Owner und Recovery über mehrere Besitzer werden mit den betroffenen Peers ratifiziert. Die Teilungs- und Konfliktregeln installationsweiter Definitionen, Manifest-Format, Host-Port-Verträge, stabile Audio-Source-IDs/Rebind und Delete-Retention werden ebenfalls gemeinsam ratifiziert. Bis dahin konsumiert SMR-01 nur stabile IDs und immutable Projektionen.

## Acceptance-Reihenfolge

1. A/B/A: anlegen, wechseln, umbenennen und Neustart ohne Identitätsverwechslung.
2. Trash, Restore, Kopie und endgültiges Löschen mit jeweils nachweisbarer Besitzgrenze.
3. Kopie mit semantischem Vergleich: kampagneneigene Inhalte, Assets und Runtime sind vollständig unabhängig; Änderungen an einer Seite verändern die andere nie.
4. Autosave-Crash vor/während/nach jeder Lifecycle-Stufe und frische idempotente Recovery ohne stillen Datenverlust; unbekanntes Ergebnis führt ausschließlich zu validiertem Roll-forward oder Rollback. Aktive Campaign, fokussierte Running Scene sowie sicher persistierbare Encounter-/Travel-Zustände sind nach explizitem Continue wiederherstellbar.
5. Vollständiger Export/Import erzeugt ausschließlich eine neue Kampagne und beweist das vollständige ID-/Referenz-Remapping. Ein versioniertes, prüfsummengeschütztes Paket enthält alle geschlossenen Bestandteile einschließlich retained unknown data und öffnet plattformübergreifend auf einem unabhängigen Rechner wieder.
6. Untrusted-Paketmatrix: Traversal, externe Pfade, Netzreferenzen, Ausführung, ungültige Prüfsummen, unbeschränkte Dekompression und Cancellation werden vor atomarer Veröffentlichung abgewiesen; die UI sieht keine Pfade oder Handles.
7. Konflikte wiederverwendbarer Definitionen zeigen vor Mutation ihre Folgen; der GM verwirft eine Variante oder behält beide unter unabhängigen IDs. Beide Wege bleiben bis zum atomaren Publish recoverbar.
8. Audio-Roundtrip: Source-ID, Metadaten und manifestgebundene Bytes bleiben über Export, Import und Wiederöffnung erhalten. Ein erforderliches lokales Remapping rebindet jede Cue-, Scene- und Runtime-Referenz vollständig und sichtbar; fehlende oder beschädigte Medien zeigen Retry/Rebind statt eines stillen Ersatzes.
9. Ein gezielt beschädigter Einzelrecord, Asset, reusable definition oder Runtime-Kontext wird identifiziert und isoliert; übrige Kampagnendaten bleiben nutzbar. Vollständiger Export und offengelegter Salvage-Export sind getrennt, letzterer benennt jede Auslassung—einschließlich nicht wiederherstellbarer Audio-Medien.
10. Permanentes Löschen entfernt nach bestätigtem Lifecycle-Abschluss Live-, Trash-, Staging-, Temp- und app-managed Recovery-Payloads; frühere GM-Exporte bleiben ausdrücklich nicht widerrufbar.
11. Mit tatsächlich bestätigten Fachverträgen: Mehrdatei-Commit, History, Scene-/Zeitbeziehungen, Host-Ports, Audio-Rebind, Delete-Retention und gemeinsame Definitionsteilung.

## Gates

Ein unabhängiger Peer- und Architekturreview prüft Lifecycle-Stufen/Receipts, fremde Owner-Grenzen, vollständiges Remapping einschließlich Audio-Rebind, Manifest- und Paketattacken, Konfliktfolgen, Löschretention, Fehlerisolation und fehlende Renderer-Privilegien. Implementierung, Host- und Acceptance-Freigabe folgen erst nach ratifiziertem Vertragscommit.

## Campaign-Kontext

Status: Plan-Kandidat; unabhängiger Review erforderlich. Kein Produkt-, Host-, P02-, P04- oder E2E-01-PASS.

Basis ist `active/installed-phase1` auf `6bfb1f393722cd469dc4fd5f15d8dea12a154f6b` mit dem ratifizierten Gatekatalog aus PR #16. Die fachliche Ausgangsgrenze ist `ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md`, deren semantischer Stand `11e256309d43bcd1c14db66ffc41945c9360aec8` unabhängig geprüft wurde.

## Campaign-Kontext — Ziel und sichtbarer E2E-01-Beitrag

Der Lauf liefert den hostneutralen Campaign-Lifecycle- und Context-Kern, den Hex' dünner Campaign→Atlas-Adapter konsumieren kann. Eine Kampagne lässt sich anlegen, öffnen, umbenennen und wechseln. Wiederöffnen erhält die Campaign-ID; ein A→B→A-Wechsel erzeugt jeweils eine neue Context-Bindung, sodass Auswahl, History, Projektionen und Schreibbefehle aus einer früheren Aktivierung nicht in die aktuelle Kampagne gelangen. Für Copy und Complete-Import liefert der Lauf einen ownergebundenen Remap-Plan und einen Campaign/Data-Participant-Stage; erst ein späterer gemeinsamer Publish mit P02/P04 darf daraus eine sichtbare neue Kampagne machen.

Der Lauf startet keine LiveSession und erzeugt keine Party-, Preparation-, Scene-, Encounter-, Clock- oder Atlas-Fachpayloads. Er bietet ausschließlich IDs, Revisionen, Namespace und Context-Guards.

## Campaign-Kontext — Abgrenzung und Ownership

- Campaign/Data besitzt die Typen, Laufzeitvalidierung, immutable Projektionen, Lifecycle-/Command-Zustandsmaschine, Revision-/Context-Guards, die Abdeckungskoordination und das hostneutrale Import-Remap-Modell.
- Hex besitzt den dünnen Adapter von einer bestätigten `CampaignContextProjection` zum Atlas. Der Adapter verwirft auf Contextwechsel seine ephemeral Selection/Camera/History-Bindung und lädt Ownerdaten neu; dieser Lauf implementiert den Adapter nicht.
- Atlas/City/Dungeon, Katalog/Encounter, Music/Weather/Shops und alle weiteren tatsächlichen Domainowner behalten Payload-, Format-, History- und Snapshotbesitz. Dieser Lauf liest oder mutiert ihre internen Werte nicht. Jeder Owner liefert und bestätigt über seinen Port ein immutable Identitäts-/Referenzinventar, seine erwartete Owner-/Schema-/Snapshotrevision sowie Payload-Snapshots oder verifizierte Payloadbezüge; ein unbekannter oder unavailable Owner gilt nie als leer.
- Der gemeinsame History-/Transaction-Port sowie P02-Save/Reopen und P04-Archiv/Checksum/Hostimport bleiben fremde, offene Eingänge. Eine injizierte In-Memory-Portgrenze beweist keine Dateidauerhaftigkeit.
- Party/Preparation/Initialize ist in E2E-01 negativ: keine Methode dieses Kerns startet oder setzt Runtimezustand fort.

## Campaign-Kontext — Geplante Verträge

### Campaign-Kontext — Identität und Snapshot

`CampaignId`, `CampaignLocalId`, `CampaignRevision`, `CampaignContextToken`, `CampaignNamespace`, `CampaignCommandId` und `CampaignReceiptId` werden als validierte, opaque Werte modelliert. Context-Token und Command-ID sind verschieden: der Token identifiziert eine flüchtige Aktivierung, die Command-ID denselben logischen Auftrag bis zu seinem terminalen Ausgang. Anzeigenamen stiften keine Identität. Ein persistierbarer `CampaignSnapshotV1` enthält genau Schema, Campaign-ID, Revision, Name, Namespace und Lifecycle-Zustand. Zusätzliche fremde Payloads werden nicht in diesen Kern kopiert.

Jede bestätigte Mutation verlangt Campaign-ID plus erwartete Revision und erhöht die Revision genau einmal. Fehlende, fremde oder stale Revisionen scheitern vor Mutation. Rückgaben sind tief immutable; Eingabeobjekte werden defensiv kopiert.

### Campaign-Kontext — Context-Aktivierung

`open`/`switch` validiert einen Snapshot und erzeugt eine `CampaignContextProjection` aus Campaign-ID, aktueller Revision, Namespace und einem neuen Context-Token. Der Token ist eine Aktivierungsidentität, keine persistierte Campaign-Identität. A→B→A erzeugt drei verschiedene Tokens; ein Befehl muss ID, Revision, Namespace und Token der aktuellen Projektion treffen. Dadurch darf ein alter A- oder B-Befehl selbst bei gleicher CampaignRevision nicht schreiben. Jede Aktivierungsanfrage trägt zusätzlich eine Command-ID und eine monotone lokale Anforderungssequenz; ein verspätetes Open(A) oder sein Callback darf einen inzwischen bestätigten B-/A2-Context nicht ersetzen.

`reopen` liest denselben persistierten Snapshot, erhält Campaign-ID und Namespace und erzeugt nur einen neuen Context-Token. Normales Reopen remappt nie IDs. Contextwechsel veröffentlicht keinen Atlas-/Scene-/Sessionzustand und hat keinen Autostart-Hook.

### Campaign-Kontext — Lifecycle- und Command-Kern

Der Kern erhält ausschließlich injizierte Ports für Snapshot-Lesen, Commandstatus-Abfrage und compare-and-write-Veröffentlichen sowie injizierte ID-/Token-Fabriken. Geplant sind `create`, `open`, `rename`, `switch`, `planCopy` und `stageCompleteImport`. Jeder Auftrag friert unter einer stabilen `CampaignCommandId` den erwarteten CampaignContext, alle beteiligten Owner-/Schema-/Snapshotrevisionen und sämtliche vorab zugeordneten Ziel-IDs einschließlich Remap ein. Seine immutable Receipt-/Outcome-Projektion führt genau `staged`, `validated`, `published`, `verified`, `finalized`, `cancelled_before_publish`, `conflict` oder `outcome_unknown`.

Stage→Validate→Publish→Verify→Finalize läuft unter derselben Command-ID und demselben Receipt. Retry oder Statusabfrage derselben Command-ID verwendet dieselben Ziel-IDs und dasselbe Ergebnis; sie erzeugt weder Ersatzauftrag noch zweite Revision oder Wirkung. Gewinnt Cancel vor Publish, bleibt bestätigte Wahrheit unverändert und verspätete Teilnehmerantworten dürfen nicht publizieren. Hat Publish gewonnen, beendet Cancel nur lokales Warten: Verify/Finalize bleiben pending und laufen ausschließlich vorwärts; ein Cancellation-Erfolg ist dann falsch. Antwortverlust und `outcome_unknown` werden über die ursprüngliche Command-ID abgefragt. Contextprüfung unmittelbar vor Mutation verhindert Wirkung nach einem Switch. Die erste Implementierung modelliert diese Semantik deterministisch und hostneutral; dauerhafte Receipts, Prozesscrash und echter Mehrbesitzer-Publish bleiben P02/P04-/Integrationsbeweise.

### Campaign-Kontext — Copy-/Complete-Import-Remap und Ownerlieferung

Ein versionierter `CampaignOwnerInventoryV1` bindet Source-Campaign, Owner-ID, erwartete Owner-/Schema-/Snapshotrevision, vollständige Records und Referenzen sowie Payload-Snapshots oder verifizierte Payloadbezüge an denselben eingefrorenen Lieferstand. Campaign/Data koordiniert die Abdeckung, erfindet aber keine fremden Records. World/Location/Placement, City/Building, Dungeon/Floor/Room/Route/Section, campaignlokale EncounterPlan-Referenzen und alle weiteren tatsächlich vorhandenen lokalen Bestände müssen durch ihren Owner vertreten sein. Enthält die Campaign Medien, bestätigt deren Owner außerdem `AudioSourceId`, Source-Metadaten, manifestgebundenen Bytehash/Payloadbeleg und alle kampagnenlokalen Cue-/Scene-/Runtime-Referenzen. Ein nicht vorhandener Bestand benötigt einen bestätigten Leerzustand; absent, unknown oder unavailable ist kein Leerzustand.

Der aus allen bestätigten Inventaren gebildete `CampaignIdentityGraphV1` klassifiziert jede Identität explizit als `campaign-local` oder `shared`. Vor jeder Teilnehmer-Stage wird dreiphasig validiert:

1. Die erwartete Ownerliste wird gegen alle Inventare abgeglichen. Fehlende Owner, fehlende Records, ausgelassene unreferenzierte Records, stale Revisionen, unbekannte Owner/Referenzschemas und Inventar-/Graph-/Payloadabweichungen scheitern fail-closed.
2. Alle lokalen Definitionen werden auf eindeutige IDs und erlaubte Typen geprüft und vollständig auf neue IDs abgebildet. Campaign-ID und Namespace erhalten jeweils eine neue unabhängige Identität und erscheinen in der Closure.
3. Jede lokale Referenz muss in dieser Closure vorkommen; jede globale `CatalogSource`-/`CatalogEntry`-Identität bleibt bytegleich. Fremde, doppelte, fehlende oder nicht klassifizierte Referenzen brechen vor der ersten Participant-Stage ab.

Die Closure enthält die alte und neue Campaign-ID, den alten und neuen Namespace sowie sämtliche kampagnenlokalen Objekt- und Referenz-IDs. Campaign/Data validiert/erzeugt den Remap-Plan und staged nur seinen eigenen neuen Campaign-Snapshot. Jeder Payloadowner wendet exakt dieselbe immutable Closure an seiner eigenen Projektion an und liefert Validate-/Stage-/Publish-Belege über den noch offenen gemeinsamen Transaction-Port. Der Kern schreibt keine fremden Payloads um. Bis alle erwarteten Teilnehmer samt Payload-/Rebindbeleg validiert sind, darf keine Ziel-Campaign sichtbar werden; I01 liefert deshalb nie allein einen abgeschlossenen Copy-/Complete-Import-Erfolg.

Quelle, bestehende Kampagnen und shared definitions bleiben unverändert. Copy und Import dürfen nie in eine vorhandene Campaign mergen oder sie überschreiben. P04 validiert Archiv, Manifest, Checksums und Bytes; fehlende, beschädigte oder unverifizierbare erforderliche Medien verhindern Complete. Nur ein späterer, ausdrücklich gewählter Salvage-Pfad darf Auslassungen samt Identität und Auswirkung offenlegen. I01 akzeptiert nur das begrenzte ownergelieferte Identitäts-/Referenzmodell und behauptet weder Archivprüfung noch gemeinsamen Publish.

## Campaign-Kontext — Vorgesehene Dateien

- `src/features/campaign/campaign-contracts.ts`: opaque IDs, Laufzeitvalidierung und immutable Snapshot-/Context-/Command-/Inventory-/Graph-Typen.
- `src/features/campaign/campaign-lifecycle.ts`: hostneutraler Lifecycle-/Command-Kern, Receiptstatus sowie stale/foreign/late-result Guards.
- `src/features/campaign/campaign-remap.ts`: Ownerabdeckung, deterministische vollständige Old→New-Closure und Campaign/Data-Participant-Stage; keine fremde Payloadumschreibung.
- `tests/core/campaign-lifecycle.test.ts`: Create/Open/Rename/Switch/Reopen, Command-/Cancel-/Retry-Semantik, Revisionen, Immutabilität und negative Sessiongrenze.
- `tests/core/campaign-remap.test.ts`: Ownerinventare, Copy/Import-Closure, Participant-Stage, globale Identitäten, Atomizität und beschädigte Lieferungen.

## Campaign-Kontext — Pflicht-Testmatrix für I01

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

## Campaign-Kontext — Offene Gates nach diesem Paket

Auch ein bestandener I01-Lauf schließt E2E-01 nicht. Offen bleiben mindestens der Campaign→Atlas-Adapter, gemeinsame Atlas/City/Dungeon-History und Transaction, echter P02-Save/Reopen-Prozess, echter P04-Complete-Import mit Manifest/Checksums, House→Dungeon-Bindung, integriertes Fixture, installierter Hostlauf und unabhängige Atlas-QA-Abnahme. E2E-02 bis E2E-04 bleiben gesperrt.

## Ownership und gemeinsame Commands

Status: Plan-Kandidat; unabhängiger Exact-SHA-Review erforderlich. Kein Produkt-,
Host-, P02-, P04-, Complete-Import- oder E2E-01-PASS.

## Ownership und gemeinsame Commands — Gepinnte Grundlage

- Einziger Integrationskandidat: PR #13, Exact-Head
  `e5a19a93ce417b4e48fa86512d1c7f1be4d41eea`.
- Sichtbarer räumlicher Produktstand: `88babcd2eee05f8d99a914129fd176b264bdcb26`
  mit 484/484 Tests, Build und isoliertem Save-/Fresh-Process-Beleg.
- Geprüfter Campaign/Data-Kern:
  `06ac0ae059702331ad4b8b2650122dba87382398`.
- Tatsächliche Worldowner-Projektion: `AtlasRepository.spatialGraph.world()`;
  `spatialState()` sowie `detail(kind,id)`/`ensureDetail(kind,id)` liefern die
  dazugehörigen tatsächlichen Sources derselben History und Repositorygeneration.
- Verbindlicher Medieninput aus Issue #12/6092021476: AudioSource-ID↔Typ,
  Availability/Leerheit, Owner-/Schema-/Snapshotrevision, Metadaten- und
  manifestgebundener Bytehashbeleg sowie vollständige kampagnenlokale
  Cue-/Scene-/Runtime-Referenzen.

Diese Grundlage bleibt als gepinnte fachliche Quelle erhalten. Die aktive Fixture
`e2e01-spatial-v2`, ihre sieben nativen Dateien und frühere Bereichsbelege bleiben
bytegleich.

## Ownership und gemeinsame Commands — Ziel und begrenzter E2E-01-Beitrag

Der Lauf spezifiziert die fehlende hostneutrale Grenze zwischen einem bestätigten
`CampaignContextProjection`, einer autoritativen vollständigen Ownership-Registry
und einem einzigen Mehrowner-Command/Receipt. Er ermöglicht Hex' späterem I01c,
vor jeder Wirkung zu beweisen, dass Campaign, Namespace, Aktivierung, Registry und
alle Ownerstände noch exakt dieselben sind wie beim Stage.

Campaign/Data koordiniert und validiert diese Wahrheit. Es besitzt weder World-,
City-, Dungeon-, Medien- noch andere Fremdpayloads, rekonstruiert sie nicht aus
Dateinamen oder Deliveries und vergibt keine fremden Revisionen. Der Vault-
Kennungslookup und `Session.revision` sind ausdrücklich keine Registryautorität.

## Ownership und gemeinsame Commands — Vertragsgrenzen und Verantwortungen

- Der vorhandene `CampaignLifecyclePort` bleibt allein für Campaign-Snapshot,
  Create/Rename und Statusauflösung zuständig. Er wird nicht zum Mehrzweckstorage.
- Ein neuer `CampaignOwnerRegistryPort` ist getrennt, read-only und injiziert. Sein
  produktiver Adapter muss eine persistierte Registryidentität mit tatsächlichen
  ownerseitigen Revisionen und Projektionen lesen. Der Hostkern darf sie nicht aus
  einer Import-/Copy-Lieferung oder aus der Menge aktuell geladener Dateien ableiten.
- Der Worldowner liefert World-/Location-/City-/Building-/Dungeon-/Floor-/Room-/
  Route-/Section-Identitäten aus der tatsächlichen `SpatialGraph.world()`-Closure
  und den nativen Sources. Campaign/Data speichert davon nur die bestätigte
  Identitäts-/Revisions-/Digestprojektion, keine fremden Dokumentbytes.
- Der Medienowner liefert seine AudioSource-/Cue-/Scene-/Runtime-Closure samt
  Metadaten-/Bytebelegen. Manuelle Music-/Ambience-Entscheidungen werden weder
  umgedeutet noch als entbehrliche Medien behandelt.
- P02 besitzt später Haltbarkeit, Journal und Recovery; P04 besitzt später Archiv,
  Manifest, Checksums und unabhängigen Import. Dieser Lauf definiert nur deren
  erforderlichen Domainvertrag und implementiert keinen dieser Adapter.

## Ownership und gemeinsame Commands — Versionierte Ownershipprojektion

`CampaignDomainOwnershipProjectionV1` ist eine tief immutable Projektion mit:

1. `version: 1`, `registryId`, `registryRevision` und einer eindeutigen
   `projectionDigest` über die kanonische Projektion;
2. vollständigem `CampaignContextProjection`: `campaignId`, `revision`,
   `namespace`, `lifecycle` und flüchtigem `contextToken`;
3. einer sortierten, duplikatfreien Ownerliste. Jeder Owner trägt `ownerId`,
   `ownerRevision`, `schemaRevision`, `snapshotRevision`, `availability`,
   `emptyConfirmed`, unterstützte Referenzschemas und seine direkt gebundenen
   `{id, recordType}`-Identitäten;
4. pro Record die ownerbestätigten lokalen/shared Referenzen und einen
   `payloadDigest` oder einen verifizierten Payloadbezug;
5. für Medienrecords zusätzlich Source-Metadatendigest und manifestgebundenen
   Bytehash sowie die vollständigen lokalen Cue-/Scene-/Runtime-Referenzen;
6. einer Owner-Quellenbindung, die den tatsächlichen Adaptertyp und dessen
   gelesene Generation bezeichnet, ohne einen Pfad als Identität zu verwenden.

`availability: unknown|unavailable` ist niemals ein leerer Owner.
`emptyConfirmed: true` ist nur bei `availability: confirmed`, null Records, null
Payloadbelegen und einer echten Owner-/Snapshotrevision zulässig. Ein bestätigter
nichtleerer Owner muss Recordanzahl, ID↔Typ, Referenzen und Payloadbelege vollständig
decken. Zusätzliche, fehlende, doppelte oder zwischen Ownern kollidierende lokale
Identitäten sind Fehler.

Für den Worldowner bindet der Adapter dieselbe gelesene Repositorygeneration an
`SpatialGraph.world()`, `spatialState()` und alle durch `detail/ensureDetail`
erreichten nativen Sources. Ein teilweise geladener Graph, mehrere Dateitreffer
oder eine Generation, die sich während des Reads ändert, liefert keine Projektion.

## Ownership und gemeinsame Commands — Read-only Registryport

Der geplante Port hat nur beobachtende Operationen:

- `read(expectedContext)` liefert genau eine Projektion oder den expliziten Zustand
  `unknown|unavailable`; null/leer ist kein Ersatz.
- `verify(expectedProjection)` liest die autoritative Quelle erneut und liefert
  nur `current`, `stale` oder `unknown|unavailable`. Es gibt kein best-effort und
  keine automatische Aktualisierung eines bereits gestagten Commands.

Jeder Rückgabewert wird an der Grenze strukturell und semantisch validiert und tief
eingefroren. `read` muss CampaignId, Revision, Namespace und ContextToken treffen.
`verify` vergleicht Registry-ID/-Revision, Projection-Digest und jede Owner-/Schema-/
Snapshotrevision. Die Portimplementierung darf keine Schreibmethode, kein Lazy-
Repair und keine Receiptallokation besitzen.

`verify` ist nur ein früher schreibfreier Abbruchpunkt und niemals die
Linearization-Grenze. Zwischen seinem Ergebnis und Publish darf sich Zustand ändern.
Darum werden dieselben erwarteten Context-/Registry-/Ownerwerte zusätzlich als
Compare-Preconditions an die unten beschriebene dauerhafte Publishgrenze getragen.

## Ownership und gemeinsame Commands — Mehrowner-Command- und Receipt-Envelope

`CampaignMultiOwnerCommandEnvelopeV1` friert vor der ersten Mutation ein:

- die ursprüngliche `CampaignCommandId` und `CampaignReceiptId`;
- Commandart und einen kanonischen Command-Fingerprint;
- die vollständige erwartete CampaignContextProjection;
- Registry-ID/-Revision und Projection-Digest;
- jeden Teilnehmer mit Owner-/Schema-/Snapshotrevision und dem Digest seines
  geplanten Before-/After- oder unveränderten Beitrags;
- dieselbe vollständige lokale ID-/Referenzclosure, die Copy/Import verwendet;
- eine eindeutige Ziel-Campaign/-Namespace-Zuordnung, falls der Auftrag eine neue
  Campaign vorbereitet.

Stage, Preflight, Publish, Verify, Finalize, Status und Retry verwenden dieselbe
CommandId/ReceiptId und denselben Fingerprint. Ein Retry allokiert weder neue IDs
noch eine zweite Wirkung. Derselbe Command mit anderem Envelope ist ein Konflikt.
Ein verlorener Publish-Ausgang wird nur über `status(commandId, receiptId)` am
ursprünglichen Receipt aufgelöst. `outcome_unknown` darf weder Finalize noch einen
zweiten Publish erlauben.

Vor Publish ruft der Coordinator `verify` auf und prüft zusätzlich den aktuellen
Campaigncontext. Jede dort erkannte Abweichung beendet den Auftrag früh, aber ein
grünes `verify` erteilt noch keine Schreibfreigabe.

Der Envelope wird unverändert Bestandteil eines
`CampaignMultiOwnerPublishRequestV1`. Dieser Request trägt die erwartete vollständige
Contextprojektion, Registry-ID/-Revision und Projection-Digest, alle Owner-/Schema-/
Snapshotrevisionen sowie jeden Participant-Before-Digest als Compare-Bedingungen bis
an **dieselbe dauerhafte Publish-/Linearization-Grenze**. Der spätere gemeinsame
P02/P04-Port muss dort atomar genau eines tun:

1. alle Preconditions gegen die autoritativen aktuellen Zustände vergleichen und
   genau eine Wirkung unter der ursprünglichen CommandId/ReceiptId publizieren;
2. ohne sichtbare Teilwirkung `conflict` ablehnen; oder
3. nach erreichter dauerhafter Linearization ausschließlich einen belegten
   Recoveryzustand hinterlassen, der mit derselben CommandId/ReceiptId und demselben
   Fingerprint nur vorwärts aufgelöst werden kann.

Es gibt keinen Zustand, in dem einzelne Owner sichtbar sind, andere fehlen und ein
neuer Publish erlaubt ist. Ein verspätetes `verify`- oder Participant-Ergebnis kann
die Compare-Bedingungen nicht aktualisieren. Nach einem bestätigten oder dauerhaft
linearisierten Publish darf Cancel nicht zurückrollen; Status/Recovery/Finalize
verwenden das ursprüngliche Receipt. Der I01-Vertragslauf liefert Requesttyp,
Precondition-Validator und ein ausführbares atomisches Port-Testdouble, aber keinen
produktiven P02/P04-Adapter.

## Ownership und gemeinsame Commands — Complete und Salvage sind verschiedene Befehle

Der Envelope ist eine diskriminierte Union:

- `complete-copy`/`complete-import` erlauben keine Auslassung. Jeder registrierte
  Owner muss `confirmed`, aktuell und vollständig sein. Fehlende, beschädigte oder
  unverifizierbare Medien, Payloads oder Referenzen blockieren vor Publish.
- `salvage-import` benötigt eine eigene ausdrückliche `SalvageDecisionId` und eine
  immutable Liste aller ausgelassenen Identitäten mit Owner, Recordtyp, stabiler
  Source-ID, Grund und sichtbarer Auswirkung. Die Liste wird Teil von Command-
  Fingerprint und Receipt. Salvage darf niemals in Complete umetikettiert werden.

Ein unbekannter oder nicht erreichbarer Owner kann weder Complete noch einen stillen
Salvage auslösen. Salvage benötigt weiterhin eine lesbare Registry; nur explizit
aufgeführte beschädigte/fehlende Payloads dürfen ausgelassen werden. Shared
Definitionen, erhaltene opaque Daten und manuelle Medienentscheidungen bleiben
unverändert.

Zusätzlich enthält jeder Salvage-Envelope eine aus der vollständigen Registryclosure
abgeleitete `CampaignSalvageProjectionV1` mit drei disjunkten Mengen:

- **survivors:** erhaltene Records samt vollständig rebindbarer lokaler Referenzen;
- **omissions:** ausdrücklich ausgelassene Records mit Identität, Grund und
  Auswirkung;
- **quarantine:** unverändert erhaltene, nicht sicher interpretier- oder
  rebindbare opaque/unknown-retained Bytes samt Owner, stabiler Identität,
  Originaldigest, Quarantänegrund und Referenzbezug.

Die Survivorprojektion ist referenziell geschlossen: Jede lokale Referenz eines
Survivors zielt auf einen Survivor beziehungsweise dessen geplantes Remap-Ziel.
Verweist ein Cue-, Scene- oder Runtime-Record auf eine ausgelassene AudioSource,
muss der abhängige Record entweder nachweislich unabhängig/rebindbar bleiben,
ebenfalls mit Identität und Auswirkung ausgelassen oder mitsamt unveränderten Bytes
quarantänisiert werden. Ein dangling Survivor, eine nur teilweise erklärte
Abhängigkeitsclosure, verlorene opaque/unknown-retained Bytes oder ein fehlender
Quarantänebeleg blockiert Salvage vor Publish. Survivor-, Omission- und
Quarantänedigests werden Teil von Command-Fingerprint, Receipt und atomaren
Publish-Preconditions.

## Ownership und gemeinsame Commands — Fail-closed-Orakel und geplante Negativfälle

Der I01-Vertragslauf muss mindestens beweisen:

1. falsche CampaignId, Revision, Namespace oder ContextToken;
2. A→B→A mit altem A-Token sowie verspätete Read-/Verify-Antwort;
3. falsche Registry-ID/-Revision oder Projection-Digest;
4. fehlender, zusätzlicher, doppelter oder unbekannter Owner;
5. stale Owner-/Schema-/Snapshotrevision oder wechselnde Repositorygeneration;
6. Record-ID↔Typ-Swap, lokale ID-Kollision und reservierter Typ;
7. unvollständige World-/Location-/City-/Building-/Dungeon-/Floor-/Room-/Route-/
   Section-Closure oder mehrere native Dateitreffer;
8. fehlender Payload-/Referenzschemabeleg oder dangling lokale Referenz;
9. Medienowner unknown/unavailable, falscher Leerzustand, fehlender Metadaten-/
   Bytehashbeleg oder ausgelassene Cue-/Scene-/Runtime-Referenz;
10. Complete mit Auslassung sowie Salvage ohne DecisionId, Grund oder Auswirkung;
11. gleiche CommandId mit geändertem Envelope, neue ReceiptId beim Retry und
    `outcome_unknown` gefolgt von unerlaubtem zweitem Publish;
12. Context-, Registry- und Ownerwechsel jeweils nach grünem `verify`, aber vor
    oder an Publish; verspätete Verify-/Participant-Antwort; jeweils null sichtbare
    Teilwirkung oder ausschließlich ein vorwärts auflösbares ursprüngliches Receipt;
13. beschädigte AudioSource mit nicht vollständig erklärter Cue-/Scene-/Runtime-
    Abhängigkeit, dangling Survivor, verlorene Quarantänebytes oder verlorener
    unknown-retained Beleg;
14. Mutation eines zurückgegebenen Snapshots oder der enthaltenen Arrays/Records.

Der positive Test verwendet die tatsächlichen stabilen IDs der aktiven räumlichen
Fixture und einen nichtleeren AudioSource-Fall. Er darf fremde Payloadbytes nur als
ownerbestätigte Digest-/Referenzbelege behandeln. Testdoubles müssen klar als solche
markiert sein und sind kein produktiver Registrybeleg.

## Ownership und gemeinsame Commands — Explizit offen

Offen bleiben produktiver Registryprovider, Campaign→Atlas-Adapter,
Mehrowner-Publish/Journal/Recovery, P02-Haltbarkeit, P04-Archivprüfung und echter
CompleteImport, Dungeon-Geometrieport, installierter Hostlauf, unabhängiger
integrierter Review und der vollständige E2E-01-PASS. E2E-02 bis E2E-04 werden
nicht vorgezogen.

## Persistierte Quelle und Kampagneneinstieg

Vertrags-/Entwurfsstand P01; die unten gepinnte Grundlage ist historisch. Runtime-Source/Picker sind inzwischen über PR #13 auf Shared integriert (begrenzte Entscheidung in [#39](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/39#issuecomment-6100834444)). Aktuelle Weiterarbeit: [#40](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40) und [#41](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/41), nicht erneutes P01/I01. Kein P02-, P04- oder vollständiger E2E-01-PASS aus diesem Plan.

## Persistierte Quelle und Kampagneneinstieg — Gepinnte Grundlage und Nutzerziel

- Einziger Integrationskandidat: PR #13, Exact-Head
  `3926fe4a7b7e352edc1462c9ead732d4b4a0f03a`.
- Campaign-Lifecycle, Context und Ownership-Verträge sind bereits implementiert
  und geprüft. Sie werden nicht neu entworfen.
- Hex besitzt `openNative`, AtlasView/Editor/Renderer/Repository, Kamera, History,
  Save und die tatsächliche Hostmontage. Campaign/Data liefert den im Atlasvertrag benannten Pick aus `AtlasCampaignNavigationPorts`:
  `currentContext`, `registry`, `inventory` und `activate`.

Der sichtbare Ablauf lautet: Der GM öffnet die Kampagnenauswahl, sieht gespeicherte
Kampagnen unter ihrem Namen, wählt eine Kampagne und öffnet damit den bestätigten
Atlas. Ein Wechsel von A nach B läuft ausschließlich über den sicheren
Navigator-Auftrag, damit `prepareLeave` gültige Keys, Gesten und den Entwurf vor
der Aktivierung sichert. Fehler vor Aktivierung lassen A bearbeitbar; nach einer
bereits angewandten B-Aktivierung bleibt B current/unavailable. A→B→A erzeugt einen neuen
Context und liest Registry sowie Inventar erneut. Eine extern geänderte aktive
Kampagne wird sofort an `contextChanged` gemeldet.

## Persistierte Quelle und Kampagneneinstieg — Persistierte Quelle statt Testport

Ein versioniertes `CampaignRuntimeManifestV1` ist die produktive, lesende
Hostquelle. Es enthält genau:

- den validierten `CampaignSnapshotV1`;
- eine vollständige durable `CampaignRuntimeRegistryV1` mit Registry-ID/-Revision,
  Campaign-ID/-Revision/-Namespace, allen Owner-/Schema-/Snapshot-/Policywerten,
  Sources, Records, Referenzen, Payload-/Medienbelegen und ihrem kanonischen
  `registryContentDigest`;
- die bestätigte Atlas-World-ID;
- die vollständige Liste nativer World-/Terrain-/Location-/City-/Dungeon-Dateien
  mit stabiler Record-ID, Typ, Pfad und gespeichertem Byte-Digest;
- die vollständigen navigierbaren Records mit Owner, Typ und Availability.

Der Manifestpfad ist nicht die Identität. Dateiname, Anzeigename, zuletzt
geöffnete Datei, geladene Sources und `Session.revision` dürfen weder Campaign,
Registry noch Inventar autorisieren. Der Vaultadapter listet ausschließlich
Manifestdateien unter einem festen app-eigenen Root, liest ihre Bytes über die
vorhandene Vaultgrenze und validiert jede Datei vollständig. Doppelte Campaign-ID,
doppelte Registrybindung, Pfadtraversal, unbekannte Felder/Versionen, falsche
Digests oder ein fremder Namespace machen den betroffenen Eintrag sichtbar
nicht verfügbar; sie werden nicht still übersprungen oder repariert.

Die durable Registry enthält ausdrücklich keinen `contextToken` und keinen daraus
berechneten `projectionDigest`: ein A1-Token darf nie persistiert und später als
A2-Autorität verwendet werden. Beim Open/Switch validiert der Adapter zuerst die
durable Registry gegen den gelesenen CampaignSnapshot, injiziert danach genau den
aktiven frischen Context und berechnet daraus mit dem vorhandenen kanonischen
Digestvertrag eine neue `CampaignDomainOwnershipProjectionV1`. Das Inventar bindet
durable Registry-ID/-Revision/-Contentdigest; erst der Runtimeadapter bindet es an
den neu berechneten Projection-Digest. `verify` wiederholt dieselbe Ableitung aus
frischen Manifestbytes und vergleicht anschließend die vollständige Projektion.

Die erste Lieferung schreibt keine fremden Atlasbytes und erzeugt keine Registry
aus einem Dateiscan. Sie besitzt **kein Create/Rename/Bootstrap**: Das wäre ohne
bereits bestätigte Owner-/Atlasprojektion zirkulär und ein leerer Bootstrap wäre
keine benutzbare Atlas-Campaign. I01 konsumiert ausschließlich bereits dauerhaft
bereitgestellte, vollständige Manifeste; deren spätere atomare Erzeugung/Änderung
gehört zum gemeinsamen P02-/Hosteingang. Der produktive Adapter implementiert für
den vorhandenen `CampaignLifecyclePort` deshalb `read`; `publish/status` lehnen
Create/Rename ausdrücklich als nicht verfügbar ab und die UI bietet sie nicht an.
Das ist kein Mehrowner-Publish und kein P02-/P04-Ersatz.

## Persistierte Quelle und Kampagneneinstieg — Laufzeitadapter und Wechselgrenze

`CampaignRuntimeSource` hält einen immutable Snapshot der gelesenen Manifestmenge
und eine monotone Sourcegeneration. Daraus entstehen drei schmale Adapter:

1. der vorhandene `CampaignLifecyclePort` liest Campaign-Snapshots; Create/Rename
   bleiben ausdrücklich unavailable und besitzen in diesem Slice keinen UI-Weg;
2. `CampaignOwnerRegistryPort.read/verify` leitet aus vollständiger durable
   Registry plus dem jeweils frischen Context eine vollständig validierte
   Runtimeprojektion ab und prüft Bytes, Sourcegeneration, Context sowie alle
   Registry-/Owner-/Policyrevisionen erneut;
3. `AtlasInventoryPort.read` liefert ausschließlich das zur gleichen Projektion
   gehörende bestätigte native Inventar. Zusätzliche oder fehlende Files/Records,
   ein Worldwechsel oder ein anderer Projection-Digest ist `unavailable`, nie ein
   teilweise bestätigter Bestand.

Der Hostadapter exponiert `currentContext`, `registry`, `inventory` und
`activate`. `activate` bleibt die vorhandene `CampaignLifecycle.activate`-
Semantik; der UI-Callback ruft bei einem bestehenden Mount immer zuerst Hex'
sicheren Switchpfad auf. Die Picker-Komponente kennt keinen Lifecycle-Port und
kann diese Reihenfolge daher nicht umgehen. Nach jeder erfolgreichen Aktivierung
und bei externer Sourceänderung benachrichtigt der Host den Navigator synchron.
Verspätete List-/Read-/Verify-/Activate-Antworten sind an Requesttoken und
Sourcegeneration gebunden und dürfen weder Auswahl noch aktuellen Mount ersetzen.

Die Fehlergrenze folgt der tatsächlichen Linearization: Scheitern Listing,
Manifest-/Registry-/Inventoryprüfung oder `prepareLeave` **vor** einer angewandten
Aktivierung, bleibt A current und bearbeitbar. Sobald `activate` B mit
`applied=true` bestätigt hat, ist B current. Scheitern danach Inventoryread,
`openNative` oder Mount, bleibt B sichtbar `current/unavailable`, A bleibt
suspendiert und es gibt keinen automatischen Rückwechsel oder wieder schreibenden
A-Mount. Der Picker markiert B als aktiv mit konkretem Fehler und bietet Retry für
B; er behauptet nie, A sei weiterhin aktiv. Ein verspäteter Fehler oder Erfolg
eines überholten Auftrags verändert weder B noch einen neueren Mount.

## Persistierte Quelle und Kampagneneinstieg — Bedienbarer Kampagneneinstieg

`CampaignEntry` ist eine kleine DOM-Komponente für das bestehende Plugin-Dock. Sie
zeigt Name und Status jeder validierten Campaign-ID, markiert die aktive Kampagne
und bietet Öffnen/Wechseln sowie Retry. Während eines Auftrags sind Mehrfachklicks
gesperrt. Ein vor Aktivierung fehlgeschlagener Auftrag zeigt seinen Grund und
behält A samt vorhandenem Atlas. Ein Fehler nach angewandter B-Aktivierung markiert
B als current/unavailable und zeigt Retry, ohne A wieder zu aktivieren. Ein Update
oder `destroy()` widerruft alte
Callbacks; verspätete Ergebnisse schreiben nicht in neues DOM. Die Komponente
erhält nur immutable Einträge und `onOpen(campaignId, kind)`; sie besitzt keine
Kamera, History, Registrywahrheit oder Persistenz.

## Persistierte Quelle und Kampagneneinstieg — Eigene Dateien und Integrationsgrenze

- neu `src/features/campaign/campaign-runtime-source.ts`: Manifest- und durable
  Registryvalidator, contextgebundene Runtimeprojektion, immutable
  Sourcegeneration sowie Lifecycle-/Registry-/Inventory-Adapter;
- neu `src/vault-campaign-runtime-source.ts`: tatsächlicher Obsidian-Vaultadapter
  mit festem Root, stabiler Auflistung, Read und Change-Benachrichtigung;
- neu `src/ui/campaign-entry.ts`: bedienbare Auswahlkomponente;
- neu `tests/core/campaign-runtime-source.test.ts` und ein Include in
  `tests/core.test.ts`;
- neu `tests/campaign-entry-dom.test.mjs` sowie eigener Build-/Runnerhook;
- bestehende Hex-/Atlas-, City-, Dungeon- und M/W/S-Dateien bleiben unverändert.

Hex integriert nach unabhängigem PASS ausschließlich Konstruktion, sicheren
Open-/Switch-Callback, `contextChanged` und die Dockmontage. Änderungen an
`src/main.ts` oder `src/ui/atlas-view.ts` gehören deshalb nicht zu diesem Paket.

## Persistierte Quelle und Kampagneneinstieg — Pflichtorakel

1. Zwei gespeicherte Kampagnen mit gleichem Namen bleiben über ihre IDs getrennt;
   Öffnen liefert den exakt gebundenen Context, Registry und Worldbestand.
2. A→B→A liest frisch, erzeugt neue Contexttoken und übernimmt keine A1-/B-
   Auswahl, Antwort oder Sourcegeneration.
3. Wechsel mit fehlerhaftem `prepareLeave`, fehlendem/stalem Manifest, fremdem
   Namespace, Registry-/Owner-/Policyrace, falschem Digest, doppelter ID oder
   unavailable/trashed Campaign **vor Aktivierung** lässt den aktuellen Atlas
   unverändert. Fehler nach `applied=true` zeigen B current/unavailable, halten A
   suspendiert und rollen den Context nicht zurück.
4. List/Read/Verify/Activate, Vaultänderung und DOM-Update werden jeweils während
   eines Pending-Auftrags verzögert; nur der neueste noch aktuelle Auftrag wirkt.
5. Manifestarrays und UI-Modelle sind defensiv kopiert und tief immutable;
   Mutation durch Caller ändert keinen Adapterausgang.
6. Durable Registry enthält keinen ContextToken/Projection-Digest. Zwei Opens
   desselben Manifests erzeugen verschiedene gültige Runtimeprojektionen; A1 wird
   unter A2 abgewiesen. Fehlende vollständige Registrypayload wird rejected.
7. Create/Rename/Bootstrap sind in Port und UI unavailable und schreiben nichts.
   Der Adapter scannt keine Atlasdateien zur Autorisierung, startet keine Session
   und ruft keine Party-/Scene-/Travel-/Clock-/Music-Funktion auf.
8. CampaignEntry zeigt Laden, aktiv, unavailable, Fehler und Retry; Doppelklick,
   stale Antwort, Update und Destroy sind isoliert geprüft.
9. Typecheck, gesamte Testsuite und sauberer Build bestehen. Anschließend prüft
   ein unabhängiger Review den Exact-SHA; der Atlasanschluss verwendet den geprüften Stand für den gemeinsamen echten Hostlauf.

## Persistierte Quelle und Kampagneneinstieg — Lieferfolge und verbleibende Gates

Den gelieferten Runtime-Source/Picker im bestehenden Produktpaket weiterverwenden.
#40 verbindet neue Location-/Section-/Worldplacement-Bestände mit Navigation und
atomarem Save bis zum frischen Wiederöffnen; #41 liefert die produktiven
Save-/Importadapter. Campaign/Data behält Provider-/Autoritätsverträge, Hex den
Atlasconsumer. Fehlende Anschlüsse im selben Ergebnispaket umsetzen und direkt
prüfen; Nachbesserung und Bereinigung gehören zur Lieferung. Unabhängiger
Daten-/Code-/Hostreview bleibt risikogerecht, ohne zusätzliche Cleanup-Phase.

Auch nach diesem Paket bleiben Hex-Hostmontage und gemeinsamer Obsidian-Lauf,
P02-Save/Recovery, P04-Complete-Import, atomarer Mehrowner-Publish, installierter
Fresh-Process-Beleg und vollständige E2E-01-Abnahme offen.
