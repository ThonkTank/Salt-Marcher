# E2E-01 Campaign Lifecycle and Context – P01

Status: Plan-Kandidat; unabhängiger Review erforderlich. Kein Produkt-, Host-, P02-, P04- oder E2E-01-PASS.

Basis ist `active/installed-phase1` auf `6bfb1f393722cd469dc4fd5f15d8dea12a154f6b` mit dem ratifizierten Gatekatalog aus PR #16. Die fachliche Ausgangsgrenze ist `ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md`, deren semantischer Stand `11e256309d43bcd1c14db66ffc41945c9360aec8` unabhängig geprüft wurde.

## Ziel und sichtbarer E2E-01-Beitrag

Der Lauf liefert den hostneutralen Campaign-Lifecycle- und Context-Kern, den Hex' dünner Campaign→Atlas-Adapter konsumieren kann. Eine Kampagne lässt sich anlegen, öffnen, umbenennen und wechseln. Wiederöffnen erhält die Campaign-ID; ein A→B→A-Wechsel erzeugt jeweils eine neue Context-Bindung, sodass Auswahl, History, Projektionen und Schreibbefehle aus einer früheren Aktivierung nicht in die aktuelle Kampagne gelangen. Copy und Complete-Import erzeugen dagegen neue unabhängige Campaign- und kampagnenlokale IDs über eine vollständige, explizite Old→New-Closure.

Der Lauf startet keine LiveSession und erzeugt keine Party-, Preparation-, Scene-, Encounter-, Clock- oder Atlas-Fachpayloads. Er bietet ausschließlich IDs, Revisionen, Namespace und Context-Guards.

## Abgrenzung und Ownership

- Campaign/Data besitzt die Typen, Laufzeitvalidierung, immutable Projektionen, Lifecycle-Zustandsmaschine, Revision-/Context-Guards und das hostneutrale Import-Remap-Modell.
- Hex besitzt den dünnen Adapter von einer bestätigten `CampaignContextProjection` zum Atlas. Der Adapter verwirft auf Contextwechsel seine ephemeral Selection/Camera/History-Bindung und lädt Ownerdaten neu; dieser Lauf implementiert den Adapter nicht.
- Atlas/City/Dungeon behalten Payload-, Format-, History- und Snapshotbesitz. Dieser Lauf liest oder mutiert ihre internen Werte nicht.
- Der gemeinsame History-/Transaction-Port sowie P02-Save/Reopen und P04-Archiv/Checksum/Hostimport bleiben fremde, offene Eingänge. Eine injizierte In-Memory-Portgrenze beweist keine Dateidauerhaftigkeit.
- Party/Preparation/Initialize ist in E2E-01 negativ: keine Methode dieses Kerns startet oder setzt Runtimezustand fort.

## Geplante Verträge

### Identität und Snapshot

`CampaignId`, `CampaignLocalId`, `CampaignRevision`, `CampaignContextToken` und `CampaignNamespace` werden als validierte, opaque Werte modelliert. Anzeigenamen stiften keine Identität. Ein persistierbarer `CampaignSnapshotV1` enthält genau Schema, Campaign-ID, Revision, Name, Namespace und Lifecycle-Zustand. Zusätzliche fremde Payloads werden nicht in diesen Kern kopiert.

Jede bestätigte Mutation verlangt Campaign-ID plus erwartete Revision und erhöht die Revision genau einmal. Fehlende, fremde oder stale Revisionen scheitern vor Mutation. Rückgaben sind tief immutable; Eingabeobjekte werden defensiv kopiert.

### Context-Aktivierung

`open`/`switch` validiert einen Snapshot und erzeugt eine `CampaignContextProjection` aus Campaign-ID, aktueller Revision, Namespace und einem neuen Context-Token. Der Token ist eine Aktivierungsidentität, keine persistierte Campaign-Identität. A→B→A erzeugt drei verschiedene Tokens; ein Befehl muss ID, Revision, Namespace und Token der aktuellen Projektion treffen. Dadurch darf ein alter A- oder B-Befehl selbst bei gleicher CampaignRevision nicht schreiben.

`reopen` liest denselben persistierten Snapshot, erhält Campaign-ID und Namespace und erzeugt nur einen neuen Context-Token. Normales Reopen remappt nie IDs. Contextwechsel veröffentlicht keinen Atlas-/Scene-/Sessionzustand und hat keinen Autostart-Hook.

### Lifecycle-Kern

Der Kern erhält ausschließlich injizierte Ports für Snapshot-Lesen und compare-and-write-Veröffentlichen sowie injizierte ID-/Token-Fabriken. Geplant sind `create`, `open`, `rename`, `switch`, `copy` und `importComplete`. Die Portantwort unterscheidet bestätigt, Konflikt und unbekanntes Ergebnis; ein unbekanntes Ergebnis wird nicht blind mit einer neuen Operation oder ID wiederholt. Die erste Implementierung darf nur die bestätigte/in-memory Semantik ausführen und muss unbekannte Ergebnisse fail-closed weiterreichen, bis P02/P04 ihre Receipt-Grenze liefern.

### Copy und Complete-Import

Ein `CampaignIdentityGraphV1` klassifiziert jede Identität explizit als `campaign-local` oder `shared`. Vor jeder Veröffentlichung wird zweiphasig validiert:

1. Alle lokalen Definitionen werden gesammelt, auf eindeutige IDs und erlaubte Typen geprüft und vollständig auf neue IDs abgebildet.
2. Jede lokale Referenz muss in dieser Closure vorkommen und wird ersetzt; jede globale `CatalogSource`-/`CatalogEntry`-Identität bleibt bytegleich. Fremde, doppelte, fehlende oder nicht klassifizierte Referenzen brechen atomar vor Veröffentlichung ab.

Die Closure enthält die alte und neue Campaign-ID sowie sämtliche kampagnenlokalen Objekt- und Referenz-IDs. Quelle und bestehende Kampagnen bleiben unverändert. Copy und Import dürfen nie in eine vorhandene Campaign mergen oder sie überschreiben. Ein vollständiger Import benötigt vom P04-Port bereits validierte Manifest-/Checksumbytes; dieser Lauf akzeptiert nur das begrenzte, hostneutrale Identitätsgraph-Modell und behauptet keine Archivprüfung.

## Vorgesehene Dateien

- `src/features/campaign/campaign-contracts.ts`: opaque IDs, Laufzeitvalidierung und immutable Snapshot-/Context-/Graph-Typen.
- `src/features/campaign/campaign-lifecycle.ts`: hostneutraler Lifecycle-Kern und stale/foreign Guards.
- `src/features/campaign/campaign-remap.ts`: deterministische vollständige Old→New-Closure und Referenzneubindung.
- `tests/core/campaign-lifecycle.test.ts`: Create/Open/Rename/Switch/Reopen, Revisionen, Immutabilität und negative Sessiongrenze.
- `tests/core/campaign-remap.test.ts`: Copy/Import-Closure, globale Identitäten, Atomizität und beschädigte Graphen.
- `checkpoint.json`: nur belegter Plan-/Review-/Implementierungsstand und nächste Übergabe.

## Pflicht-Testmatrix für I01

1. Create erzeugt eine eindeutige Campaign-ID, Revision 1 und eine immutable Projektion; gleicher Name bleibt erlaubt.
2. Rename mit korrekter Revision erhöht exakt einmal; stale, foreign oder falscher Namespace verändert keine Daten.
3. A→B→A erzeugt neue Context-Tokens. Befehle mit A1-, B- oder falschem Revisionstoken scheitern vor Portmutation.
4. Reopen erhält Campaign-ID, Namespace, Name und Revision bytegleich, erzeugt aber einen neuen Context-Token; keine ID wird remappt.
5. Kein Create/Open/Switch/Reopen ruft Party-, Preparation-, LiveSession- oder Atlas-Fachlogik auf; die API bietet dafür keinen Callback.
6. Copy erzeugt neue Campaign- und lokale IDs, bewahrt shared Catalog-IDs und lässt die Quelle nach Mutationen am Ergebnis semantisch und referenziell unverändert.
7. Complete-Import remappt jede lokale Definition und interne Referenz genau einmal; die veröffentlichte Closure ist vollständig und immutable.
8. Missing target, dangling local reference, duplicate ID, unklassifizierte Identität, shared/local-Kollision, Fabrikduplikat und ungültiges Schema brechen vor der ersten Portmutation ab.
9. Ein Publish-Konflikt oder `outcome_unknown` erzeugt weder Ersatz-ID noch zweite Veröffentlichung und wird strukturiert fail-closed zurückgegeben.
10. Typecheck, gesamte Git-Testsuite und Build bestehen. Das ist nur Codebeleg; realer P02-Reopen, P04-Import und Obsidian-/Zielhostlauf bleiben offen.

## Laufreihenfolge und Übergaben

1. P01: diesen konkreten Plan veröffentlichen und unabhängig auf Gatekatalog, Hex-Adaptergrenze, P02/P04-Ehrlichkeit und vollständige Remap-Closure prüfen lassen.
2. I01: nur nach Plan-PASS die genannten Produktquellen und fokussierten Tests implementieren; Basisprüfungen ausführen, committen und pushen.
3. R01: unabhängiger Code-/Contract-Review auf exaktem Kandidaten-SHA. Pflichtbefunde werden in N01 repariert und erneut geprüft.
4. C01: nach bestandenem Review ausschließlich Scope-/Metadatenbereinigung; keine Selbstintegration. Exakten Kandidaten-SHA, Testreceipt und Contractübersicht an Hex als E2E-01-Steward übergeben.
5. Hex integriert erst zusammen mit eigenem Adapter und den separat belegten History/Transaction-, P02- und P04-Eingängen in genau einen E2E-01-Kandidaten. Atlas-QA führt anschließend die unabhängige echte Hostprüfung aus.

## Offene Gates nach diesem Paket

Auch ein bestandener I01-Lauf schließt E2E-01 nicht. Offen bleiben mindestens der Campaign→Atlas-Adapter, gemeinsame Atlas/City/Dungeon-History und Transaction, echter P02-Save/Reopen-Prozess, echter P04-Complete-Import mit Manifest/Checksums, House→Dungeon-Bindung, integriertes Fixture, installierter Hostlauf und unabhängige Atlas-QA-Abnahme. E2E-02 bis E2E-04 bleiben gesperrt.
