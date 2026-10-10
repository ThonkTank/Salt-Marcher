# E2E-01 Campaign Ownership and Multi-Owner Command – P01

Status: Plan-Kandidat; unabhängiger Exact-SHA-Review erforderlich. Kein Produkt-,
Host-, P02-, P04-, Complete-Import- oder E2E-01-PASS.

## Gepinnte Grundlage

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

Diese Grundlage wird im Planlauf nicht umgeschrieben. Die aktive Fixture
`e2e01-spatial-v2`, ihre sieben nativen Dateien und frühere Bereichsbelege bleiben
bytegleich.

## Ziel und begrenzter E2E-01-Beitrag

Der Lauf spezifiziert die fehlende hostneutrale Grenze zwischen einem bestätigten
`CampaignContextProjection`, einer autoritativen vollständigen Ownership-Registry
und einem einzigen Mehrowner-Command/Receipt. Er ermöglicht Hex' späterem I01c,
vor jeder Wirkung zu beweisen, dass Campaign, Namespace, Aktivierung, Registry und
alle Ownerstände noch exakt dieselben sind wie beim Stage.

Campaign/Data koordiniert und validiert diese Wahrheit. Es besitzt weder World-,
City-, Dungeon-, Medien- noch andere Fremdpayloads, rekonstruiert sie nicht aus
Dateinamen oder Deliveries und vergibt keine fremden Revisionen. Der Vault-
Kennungslookup und `Session.revision` sind ausdrücklich keine Registryautorität.

## Vertragsgrenzen und Verantwortungen

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

## Versionierte Ownershipprojektion

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

## Read-only Registryport

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

## Mehrowner-Command- und Receipt-Envelope

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

## Complete und Salvage sind verschiedene Befehle

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

## Fail-closed-Orakel und geplante Negativfälle

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

## Getrennte Läufe und Prüfungen

1. **P01 (dieser Lauf):** Plan, Scope, Contracts, Orakel und Übergaben; keine
   Produktimplementierung.
2. **R01:** unabhängiger read-only Exact-SHA-Planreview. Pflichtbefunde werden in
   einem eigenen N-Lauf repariert und erneut geprüft.
3. **I01:** erst nach Plan-PASS; hostneutrale Contracttypen, Validator,
   read-only Portgrenze, Envelope-/Fingerprint-/Preflightlogik, atomare
   Publish-Precondition-Grenze als Testport sowie Survivor-/Quarantäneprojektion und
   fokussierte positive/negative Tests. Kein produktiver Vault-, P02- oder
   P04-Adapter.
4. **R02/N01:** unabhängiger Code-/Contract-Review und getrennte Reparatur.
5. **C01:** ausschließlich reviewte Scope-/Metadatenbereinigung. Der geprüfte
   Exact-SHA geht als Source-Handoff an den einen PR-#13-Steward; kein Selbstmerge.

Plan- und Implementierungskandidat führen jeweils `npm run check`, `npm test`,
`npm run build`, JSON-Parse und `git diff --check` aus. Ein reiner Plan-PASS ist
keine Implementierungs- oder Hostfreigabe.

## Explizit offen

Offen bleiben produktiver Registryprovider, Campaign→Atlas-Adapter,
Mehrowner-Publish/Journal/Recovery, P02-Haltbarkeit, P04-Archivprüfung und echter
CompleteImport, Dungeon-Geometrieport, installierter Hostlauf, unabhängiger
integrierter Review und der vollständige E2E-01-PASS. E2E-02 bis E2E-04 werden
nicht vorgezogen.
