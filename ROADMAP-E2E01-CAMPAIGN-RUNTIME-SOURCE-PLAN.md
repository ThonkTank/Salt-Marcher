# E2E-01 Campaign Runtime Source and Picker – P01

Status: enger Plan-Kandidat zur unabhängigen Prüfung. Kein Host-, P02-, P04-
oder vollständiger E2E-01-PASS.

## Gepinnte Grundlage und Nutzerziel

- Einziger Integrationskandidat: PR #13, Exact-Head
  `3926fe4a7b7e352edc1462c9ead732d4b4a0f03a`.
- Campaign-Lifecycle, Context und Ownership-Verträge sind bereits implementiert
  und geprüft. Sie werden nicht neu entworfen.
- Hex besitzt `openNative`, AtlasView/Editor/Renderer/Repository, Kamera, History,
  Save und die tatsächliche Hostmontage. Campaign/Data liefert den von Hex in
  Issue #12 benannten Pick aus `AtlasCampaignNavigationPorts`:
  `currentContext`, `registry`, `inventory` und `activate`.

Der sichtbare Ablauf lautet: Der GM öffnet die Kampagnenauswahl, sieht gespeicherte
Kampagnen unter ihrem Namen, wählt eine Kampagne und öffnet damit den bestätigten
Atlas. Ein Wechsel von A nach B läuft ausschließlich über den sicheren
Navigator-Auftrag, damit `prepareLeave` gültige Keys, Gesten und den Entwurf vor
der Aktivierung sichert. Fehler lassen A bearbeitbar. A→B→A erzeugt einen neuen
Context und liest Registry sowie Inventar erneut. Eine extern geänderte aktive
Kampagne wird sofort an `contextChanged` gemeldet.

## Persistierte Quelle statt Testport

Ein versioniertes `CampaignRuntimeManifestV1` ist die produktive, lesende
Hostquelle. Es enthält genau:

- den validierten `CampaignSnapshotV1`;
- Registry-ID/-Revision und den kanonischen Digest der vollständigen
  `CampaignDomainOwnershipProjectionV1`;
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

Die erste Lieferung schreibt keine fremden Atlasbytes und erzeugt keine Registry
aus einem Dateiscan. Ein Manifest darf nur aus einer bereits bestätigten
Context-/Registry-/Inventory-Projektion angelegt oder ersetzt werden. Dafür erhält
der Store eine enge CAS-Operation; Erzeugung/Ersetzung ist nicht Teil von
Open/Switch und wird vom Host erst mit tatsächlichen Hex-Capture-Eingängen
angeboten. Das ist kein Mehrowner-Publish und kein P02-/P04-Ersatz.

## Laufzeitadapter und Wechselgrenze

`CampaignRuntimeSource` hält einen immutable Snapshot der gelesenen Manifestmenge
und eine monotone Sourcegeneration. Daraus entstehen drei schmale Adapter:

1. der vorhandene `CampaignLifecyclePort` liest Campaign-Snapshots; Create/Rename
   verwenden CAS auf genau dem betroffenen Manifest und erhalten CommandId/
   ReceiptId-Semantik des vorhandenen Lifecycle-Kerns;
2. `CampaignOwnerRegistryPort.read/verify` liefert ausschließlich die im Manifest
   gebundene, vollständig validierte Projektion und prüft Bytes, Sourcegeneration,
   Context sowie alle Registry-/Owner-/Policyrevisionen erneut;
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

## Bedienbarer Kampagneneinstieg

`CampaignEntry` ist eine kleine DOM-Komponente für das bestehende Plugin-Dock. Sie
zeigt Name und Status jeder validierten Campaign-ID, markiert die aktive Kampagne
und bietet Öffnen/Wechseln sowie Retry. Während eines Auftrags sind Mehrfachklicks
gesperrt. Ein fehlgeschlagener Auftrag zeigt seinen Grund und behält Auswahl,
aktiven Eintrag und vorhandenen Atlas. Ein Update oder `destroy()` widerruft alte
Callbacks; verspätete Ergebnisse schreiben nicht in neues DOM. Die Komponente
erhält nur immutable Einträge und `onOpen(campaignId, kind)`; sie besitzt keine
Kamera, History, Registrywahrheit oder Persistenz.

## Eigene Dateien und Integrationsgrenze

- neu `src/features/campaign/campaign-runtime-source.ts`: Manifestvalidator,
  immutable Sourcegeneration, Lifecycle-/Registry-/Inventory-Adapter;
- neu `src/vault-campaign-runtime-source.ts`: tatsächlicher Obsidian-Vaultadapter
  mit festem Root, stabiler Auflistung, Read/CAS und Change-Benachrichtigung;
- neu `src/ui/campaign-entry.ts`: bedienbare Auswahlkomponente;
- neu `tests/core/campaign-runtime-source.test.ts` und ein Include in
  `tests/core.test.ts`;
- neu `tests/campaign-entry-dom.test.mjs` sowie eigener Build-/Runnerhook;
- bestehende Hex-/Atlas-, City-, Dungeon- und M/W/S-Dateien bleiben unverändert.

Hex integriert nach unabhängigem PASS ausschließlich Konstruktion, sicheren
Open-/Switch-Callback, `contextChanged` und die Dockmontage. Änderungen an
`src/main.ts` oder `src/ui/atlas-view.ts` gehören deshalb nicht zu diesem Paket.

## Pflichtorakel

1. Zwei gespeicherte Kampagnen mit gleichem Namen bleiben über ihre IDs getrennt;
   Öffnen liefert den exakt gebundenen Context, Registry und Worldbestand.
2. A→B→A liest frisch, erzeugt neue Contexttoken und übernimmt keine A1-/B-
   Auswahl, Antwort oder Sourcegeneration.
3. Wechsel mit fehlerhaftem `prepareLeave`, fehlendem/stalem Manifest, fremdem
   Namespace, Registry-/Owner-/Policyrace, falschem Digest, doppelter ID oder
   unavailable/trashed Campaign lässt den aktuellen Atlas unverändert.
4. List/Read/Verify/Activate, Vaultänderung und DOM-Update werden jeweils während
   eines Pending-Auftrags verzögert; nur der neueste noch aktuelle Auftrag wirkt.
5. Manifestarrays und UI-Modelle sind defensiv kopiert und tief immutable;
   Mutation durch Caller ändert keinen Adapterausgang.
6. Der Adapter scannt keine Atlasdateien zur Autorisierung, startet keine Session
   und ruft keine Party-/Scene-/Travel-/Clock-/Music-Funktion auf.
7. CampaignEntry zeigt Laden, aktiv, unavailable, Fehler und Retry; Doppelklick,
   stale Antwort, Update und Destroy sind isoliert geprüft.
8. Typecheck, gesamte Testsuite und sauberer Build bestehen. Anschließend prüft
   Chronik den Exact-SHA unabhängig; Hex montiert nur einen bestandenen SHA und
   führt den gemeinsamen echten Hostlauf aus.

## Lieferfolge und verbleibende Gates

P01 wird auf dem gepinnten PR-13-Stand veröffentlicht und eng auf Providergrenze,
Stale-/Fehlerverhalten und Hex-Handoff geprüft. Nach PASS folgt I01 auf einem
separaten Implementierungsbranch, danach unabhängiger Code-/DOM-Review,
Pflichtreparaturen und getrenntes Cleanup. Vor Handoff wird der bestandene Code auf
den aktuellen PR-13-Head gebracht.

Auch nach diesem Paket bleiben Hex-Hostmontage und gemeinsamer Obsidian-Lauf,
P02-Save/Recovery, P04-Complete-Import, atomarer Mehrowner-Publish, installierter
Fresh-Process-Beleg und vollständige E2E-01-Abnahme offen.
