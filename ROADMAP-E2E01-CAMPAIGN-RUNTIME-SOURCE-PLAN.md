# E2E-01 Campaign Runtime Source and Picker – P01

Vertrags-/Entwurfsstand P01; die unten gepinnte Grundlage ist historisch. Runtime-Source/Picker sind inzwischen über PR #13 auf Shared integriert (begrenzte Entscheidung in [#39](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/39#issuecomment-6100834444)). Aktuelle Weiterarbeit: [#40](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/40) und [#41](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/41), nicht erneutes P01/I01. Kein P02-, P04- oder vollständiger E2E-01-PASS aus diesem Plan.

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
der Aktivierung sichert. Fehler vor Aktivierung lassen A bearbeitbar; nach einer
bereits angewandten B-Aktivierung bleibt B current/unavailable. A→B→A erzeugt einen neuen
Context und liest Registry sowie Inventar erneut. Eine extern geänderte aktive
Kampagne wird sofort an `contextChanged` gemeldet.

## Persistierte Quelle statt Testport

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

## Laufzeitadapter und Wechselgrenze

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

## Bedienbarer Kampagneneinstieg

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

## Eigene Dateien und Integrationsgrenze

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

## Pflichtorakel

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
   Chronik den Exact-SHA unabhängig; Hex montiert nur einen bestandenen SHA und
   führt den gemeinsamen echten Hostlauf aus.

## Lieferfolge und verbleibende Gates

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
