# Gemeinsame End-to-End-Abnahmekriterien

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-29 (wiederherstellbarer lokaler Referenzeinstieg; historische und aktuelle Belege getrennt)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Aktueller wiederherstellbarer Referenzeinstieg

Der [gebundene Kernablaufstand vom 29.10.2026](../../reference/e2e-reference-round10-20261029/README.md)
führt die übertragbare lokale Kapsel, Wiederherstellungsaufrufe, vollständige
Pflichtfallmatrix und den praktischen Vergleich eines erfolgreichen Teilablaufs
sowie separat reproduzierter kontrollierter Speicherfehler. Er verwendet den vollständig archivierten
Dirty-Korrekturstand aus der nativen Runde 10; spätere Checkoutänderungen werden
ihm nicht zugerechnet. E2E-01 ist dort lokal technisch bestanden, E2E-02 bleibt
ein Teilnachweis, E2E-03/04 bleiben mit benannten fehlenden Gesamtstrecken offen.
Candidate/Main, Paket, Zielgerät und Owner werden separat qualifiziert. Die
nachstehenden früheren Berichte behalten ihre datierte Bindung und werden nicht
still zum neuen Ergebnis addiert.

## Technische Grundlage vom 11.10.2026

Die Nutzerorakel und datierten Fixtures bleiben bindend.
[ARCHITECTURE](../architecture/overview.md) entscheidet den neuen lokalen Store/Commandkern;
unten genannte frühere Sources, Payload-/File-/Journalformen sind historische
Anschlussbelege, keine vorgeschriebene API. Der Normalweg ist Autosave:
zusätzlich zur expliziten Saveprobe bestätigte Arbeit ohne Save → Close/Crash →
frischer Prozess. Bekannte Nativeformate werden über geprüfte Adapter verglichen,
nicht als zweite kanonische Wahrheit beschrieben. Neue Produktbelege benötigen
ihren tatsächlichen Build/Host/Store; historische PASSe werden nicht übertragen.

## Aussagegrenzen

Ein Gesamt-PASS benennt den Szenarienkatalog, die integrierte SHA, Fixture-/Buildhashes, ausgeführte Checks und tatsächliche Host-/Prozessbelege. Modelltests und einzelne Smokes bleiben entsprechend begrenzte Belege. Fachliche Abhängigkeiten unten bestimmen die Szenarien.

## Integrierter technischer E2E-01-Nachweis

Am 28.10.2026 bestand der reale `Candidate · exact-SHA aggregate` auf
`43a0cd501d9ef890df59067a39c9ad3d4b881596`, einschließlich aller 22 technischen
E2E-01-Pflichtfälle: [Candidate-Lauf mit nativen Evidenzartefakten](https://github.com/ThonkTank/Salt-Marcher/actions/runs/40747461372).
[PR #1431](https://github.com/ThonkTank/Salt-Marcher/pull/1431) integrierte diesen
Stand als `5c679da32dd9aee72cfbf29a509471ed524dbffd`; beide Commits besitzen denselben
Git-Tree `ef28f2630348b57469366a58bba311e8b34b28ed`. Auch der
[Exact-SHA-Wiederholungslauf auf Main](https://github.com/ThonkTank/Salt-Marcher/actions/runs/40750264882)
ist erfolgreich, einschließlich des vollständigen nativen technischen E2E-01-Katalogs.
Diese CI-Ergebnisse wurden bei der Übergabe direkt geprüft; der lokale
Integrationsbericht `.build/review7-integration/integration-result.json` hielt den
Main-Lauf noch als laufend fest und ist insoweit überholt.

Damit sind Candidate und integrierte technische Funktionsprüfung belegt.
Die automatisierten nativen CI-Läufe ersetzen keine Qualifikation auf dem
vereinbarten Zielgerät, Paket-/Installationsprüfung oder Ownerabnahme. Diese
Stufen sowie TW-G1–6 und E2E-02–04 bleiben offen. Die nachstehenden lokalen
Berichte bleiben zusätzliche datierte Belege; ihre Dirtystände werden nicht
nachträglich zu einem sauberen integrierten Quellstand erklärt. Die aktuellen
Dokumentationsänderungen selbst sind nicht Bestandteil der genannten CI-Commits.

## Datierter lokaler E2E-01-Nachweis

Der vorhandene lokale Ergebnisbericht vom 28.10.2026,
`.build/test-costs-native-e2e01-20261028/result.json`, belegt alle 22 unten definierten Pflichtfälle auf Basis
`1e7512f74b0dd7ea580a47067cbdb24731f8fd5b`, **dirty: true**,
Build 0.193.1 / Schema 55. Die SHA allein beschreibt diesen Lauf daher nicht:
`sourceHashes`, zwanzig Runtimehashes, Fixture und Prozessbelege im Bericht
binden die tatsächliche Arbeitskopie. Bericht-SHA256:
`86408b34d8a19fcf81a97e09a1a90039ec76412febb3ac45623e1526771fd659`.

Bedingungen: Linux x64, Kernel `7.2.11-200.fc44.x86_64`, Electron 44.7.0 /
Chromium 152.0.7977.130, X11, ausdrücklich ANGLE/SwiftShader, Browserzoom 100 %,
Fensterbilder 1400 × 980. Fixture `e2e01-desktop-v2`, Rezept-Hash
`0ce6b792462b2aaf7559472b5cf2455a58b0ee538b3e015e1dc313e18a1c7e21`,
Seed-Datenbankhash
`41438a8c85f4c22650f6667f48ba10caf208210a57ae5cdfc153e927fcbb3716`.
Jeder Pflichtfall trägt `passed`, dieselbe Build-/Fixturebindung und sichtbare
sowie unabhängige Speicherassertionen; das Complete-Inventar umfasst 199 lokale
Identitäten über 168 Tabellen. Reguläre Prozessenden und der ausdrücklich
bestätigte Crashfall sind getrennt protokolliert.

**Abgeschlossene Stufe:** automatisierter nativer technischer Funktionslauf des
gemeinsamen Katalogs unter diesen Bedingungen. Candidate und integrierter
technischer Lauf sind inzwischen [separat belegt](#integrierter-technischer-e2e-01-nachweis).
**Offene Stufen:** neuer Zielgerätlauf am integrierten Stand,
Paket-/Installationsqualifikation und ausdrückliche Ownerabnahme.
Es gibt hier keinen Gesamt-PASS des heutigen Checkouts, von TW-G1–6 oder von
E2E-02–04. Ein CI-Ergebnis allein wäre ebenfalls keine physische Bedienprüfung.
Der Rohbericht ist ein ignoriertes lokales Artefakt und außerhalb dieser
Arbeitskopie nicht gesichert abrufbar; seine Bindung und Grenzen bleiben hier
festgehalten. Bei dieser Dokumentationsübergabe wurde er gelesen, kein neuer
Produktlauf ausgeführt.

## Wiederverwendete Fachbelege

Die folgenden vorhandenen Rohberichte sind ebenfalls lokal und ignoriert;
ihre Pfade sind keine portablen Repositorylinks. Ihre Dirtybasis
ist jeweils `1cb69e33dca7eda6e56916c3cf6bc2cfba803c7d`, nicht der heutige Stand.
Sie schließen keine gemeinsame E2E-02-/03-Abnahme.

| Ablauf / Fachbesitzer | Gelesenes Ergebnis und Bedingungen | Grenze |
| --- | --- | --- |
| [Spielabendübergabe](../../runtime/contract/session-opening-and-resume.md#originaltext-vom-entwurf-bis-zum-nächsten-besuch) | Lokaler Bericht `.build/storage-types-completion/native-evening-final/result.json`, 27.10.2026 22:57 UTC (28.10. lokal), `complete: true`; Linux/X11, 100 %, 1280 × 852, vier normale Starts/Exits. Rückblick, Abbruch/erneute Vorbereitung und gespeicherter Planbesuch erhalten Bytes, IDs und Gruppenzeit. | Runtimehashes sind gebunden; GPU-/Renderergerät ist nicht ausgewiesen. `humanAcceptance` und `installedPackageAcceptance` sind ausdrücklich false. Kein durchgehender Preparation→Combat/Loot-Beleg. |
| [Reisecheckpoint](../../atlas/contract/hex-travel-3.md#checkpoint-und-wiederaufnahme-auf-der-aktuellen-atlasfläche) | Lokaler Bericht `.build/storage-cycles-completion/native-travel-final/result.json`, 27.10.2026 21:33 UTC; Linux/X11, 100 %, 1280 × 852, vier normale Starts/Exits; `checkpointWorkflowComplete` und `causalUndoRedoComplete` true. Pixel- und kanonische Datenprüfungen für Pause/Fresh, Ankunft, Rücknahme und Wiederholung. | Runtimehashes sind gebunden; GPU-/Renderergerät ist nicht ausgewiesen. Keine vollständige Wetter-/Shop-/Musik-/Autonomymatrix, Paket- oder Ownerabnahme. |

## Terrain-/Wasserbelege und Zielgerät

Der [Fachplan TW-G1–6](../../atlas/requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe)
besitzt den Lieferumfang, der [Flussvertrag](../../atlas/contract/terrain-routes.md#begrenzter-flussabschluss)
seinen zusätzlichen Teilabschluss. Die [Codeeinstiege](../../atlas/architecture/rendering.md#gelände-ändern)
und [Formpinsel](../../atlas/contract/landscape-tools.md#direkte-terrainformpinsel--27102026)
belegen implementierte Anschlüsse. Der Prüfstand lässt sich daraus nur wie folgt ableiten:

| Ziel | Vorhandener Nachweis | Offene Grenze |
| --- | --- | --- |
| TW-G1 Grundpinsel/Meer und Speicherfolge | Der enge lokale Recoverybericht `.build/atlas-terrain-stroke/1793178461012-357879/result.json` vom 28.10. auf `c10b9b559da343e3be1d51452ecb90cab971f5ec` hat Status PASS, keine aufgezeichneten Fehler, zwei normale Starts/Exits und Quell-/Runtimehashes: gehaltene Folgegeste, verlorene Antwort, geänderte Quelle, einmalige Fortsetzung und Fresh. X11, Electron 44.7.0, 100 %, 1920 × 980; tatsächlicher Renderer ANGLE/Mesa Intel UHD Graphics **TGL GT2**. | Kein vollständiger Grundpinsel-/Meer-/Parameter-/Abbruchnachweis. Absolute Feinhöhen und übrige G1-Fälle bleiben offen. Der Bericht nennt keinen Dirtywert; Quell-SHA allein ist keine vollständige Buildbindung. |
| TW-G2 Kamera, TW-G3 Formen, TW-G4 Darstellung | Die Fachpläne dokumentieren integrierte geländegebundene Kamera und direkte Formpinsel sowie begrenzte Funktionsprüfungen. Der [Terrainbeleg vom 20.10.](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-land-tools-20261020/README.md) bleibt historisch. | Für die aktuelle vollständige Maus-/Welt-bis-Raum-, Formbild-/Überlappungs- und LOD-Matrix liegt hier kein quellgebundener Ergebnisbericht vor. Ein ausführbares natives Skript oder numerischer Test allein schließt diese Stufe nicht. |
| Erweiterter Wasserumfang: Flussteilabschluss | Der [Fachvertrag berichtet am 28.10.](../../atlas/contract/terrain-routes.md#prüfanschluss) lokale Zyklus-2-Erfolge für Hang/Küste und 4-/12-m-Senke, Abweisung bei 8 m und Annahme nach 16 m Abtrag, Redo/Fresh und normale Exits. Der [portable Bericht vom 20.10.](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-routes-20261020/README.md) belegt den damaligen Umfang. | Die erneuerte 28.10.-Aussage nennt dort keinen direkten Rohbericht mit Quell-/Runtime-/Hostbindung; bei dieser Übergabe nicht unabhängig nachprüfbar. Der 20.10.-Bericht qualifiziert weder die späteren Senkenreparaturen noch den aktuellen Flussabschluss. Leistung, Paket und Ownerabnahme bleiben offen. |
| TW-G5 Leistung / TW-G6 Lieferung | Der [Messvertrag](../../atlas/requirements/terrain-relief.md#aktueller-lieferfokus-terrain-und-wasser) legt i5-8365U / Intel UHD 620, Wayland, 1920 × 1080, 100 % und vorab eingefrorene 30er-Versuchsgruppen fest. Die oben gelesenen Berichte erfüllen diese Bedingungen nicht. | Vollständige Funktions-/Leistungs- und Paketqualifikation an diesem Zielgerät ist **nicht belegt**, damit weder bestanden noch als fehlgeschlagen bewertet. Kein TW-G1–6-Gesamtabschluss, keine aktuelle Auslieferungs- oder Ownerbehauptung. |

Die historische visuelle R0-Abnahme bleibt auf ihren damaligen Prototyp begrenzt.
Der [Wonderdraft-Abgleich](../../atlas/verification/reference-comparison.md#lieferrelevante-offene-originalwirkungen)
trennt echte Originalbeobachtungen, fehlgeschlagene Versuche und offene
Vergleichswirkungen. Das Dokumentdatum überträgt keinen dieser Erfolge auf den
heutigen Atlas.

## E2E-01 – Kampagne und gemeinsamer Raum → Save/Restart

**Nutzerablauf:** Neu angelegte oder vollständig importierte Kampagne öffnen → World/Location auf derselben grenzenlosen Atlasfläche wählen → Hex/Ort/City/Haus/Dungeon/Raum-Key allein durch Navigation und Zoom bearbeiten → gemeinsame Undo/Redo-Folge → speichern → Anwendung vollständig beenden → frischer Prozess → dieselben IDs, Geometrie, Abschnittsreihenfolge, exakten Markdownbytes und Referenzen wiederfinden. Es gibt keine zweite Kamera, getrennte Karten-History oder automatischen LiveSession-Start.

**Harte Eingänge vor vollständigem PASS:** ausführbarer CampaignLifecycle/Context mit Schema-/CampaignRevision, World-/Location-Namespace und Campaign→Atlas-Navigation; bestätigte Hex-/City-/Dungeon-Payload- und Haus→Dungeon-Bindung; eingefrorene, versionierte `CatalogSource`-/`CatalogEntry`-/`Creature`-/`Item`-/`EncounterPlan`-Referenzen im gemeinsamen Fixture; eine gemeinsame Command-/History-/Commitgrenze für alle betroffenen Records; realer P02-Save/Reopen-Minimalpfad; für die verbindliche Import-Eingangsvariante P04 und genau ein echter Complete-Import mit Manifest, Checksums und vollständiger Remap-Closure. Party-/Preparation-/Initialize-Verträge sind hier eine **negative Grenze**: Eine gültige Campaign ohne LiveSession bleibt bedienbar, Atlasnavigation und Reopen starten keine Session. Der positive Preparation→LiveSession-Beweis gehört zu E2E-02; Salvage und vollständige Crash-/Backup-Recovery zu E2E-04. Ein früher Atlas/City/Dungeon-Smoke bleibt ausdrücklich Zwischenbeleg. Der [aktuelle Atlasanschluss](../../atlas/contract/spatial-runtime.md#größen-abfragen-und-umsetzung) und die [integrierten Stadtverträge](../../city/contract/city.md) dokumentieren die Fachanteile; der datierte lokale technische Gesamtbeleg steht [oben](#datierter-lokaler-e2e-01-nachweis), die integrierte technische CI-Stufe ist ebenfalls [belegt](#integrierter-technischer-e2e-01-nachweis); Zielgerät, Paket und Ownerabnahme bleiben offen.

**Orakel:** Normales Save/Reopen bewahrt CampaignId sowie alle World-/Location-/Placement-/City-/Building-/Dungeon-/Floor-/Room-/Route-/Section-IDs und Markdownbytes; Restore muss das in E2E-04 ebenfalls beweisen. Gelände, City und Dungeon teilen eine Undo/Redo- und Savegrenze; Room/Key hält stabile Katalog- und EncounterPlan-Referenzen ohne kopierte SRD-/Itempayloads. Nach Reopen lösen diese auf dieselbe Quelle, Entry- und Planidentität auf; aktuelle Definition und eingefrorene historische Verwendung bleiben getrennt. Fehlende, unbekannte, falsch revisionierte oder unavailable Quellen erscheinen sichtbar und werden weder per Name noch durch stale Einträge ersetzt. Der verifizierte Complete-Import erzeugt eine unabhängige Campaign und remappt sämtliche kampagnenlokalen IDs samt internen Referenzen über eine eingefrorene vollständige Old→New-Closure; Quelle, bestehende Campaigns und shared definitions bleiben unverändert. Globale CatalogSource-/Entry-Identitäten bleiben erhalten; kampagnenlokale EncounterPlan-IDs werden nur über diese dokumentierte Zuordnung neu zugeordnet. Normales Reopen remappt niemals still. A→B→A bindet Atlas-/Location-Projektionen aus der aktuellen CampaignRevision neu; Kamera, History, Auswahl und Writes lecken nicht zwischen Campaigns. Stale oder fremde CampaignContext-/World-/Location-Revisionen scheitern vor Mutation. Der unabhängige Complete-Import verliert weder Text noch Referenzen. Der sichtbare integrierte Hostablauf wird unabhängig geprüft; Fach- und Plattformbelege gelten nur für ihren jeweiligen Umfang.

### Ausführbarer E2E-01-Szenarienkatalog

Die Szenarien sind gemeinsam am selben Build zu prüfen. Der technische Kern wird
mit `node tools/test-desktop-e2e01.mjs` nach `npm run build:desktop` ausgeführt;
`QA_EVIDENCE_DIR` bestimmt das Ergebnisverzeichnis. `python3 tools/ui-session.py node tools/test-desktop-e2e01.mjs --software-gpu` ergänzt den äußeren Linux-Prozessbesitzer und den ausdrücklichen SwiftShader-Lauf. Die Probe verwendet ein isoliertes Profil und dieselbe Fixture für Atlasbearbeitung, A→B→A, Neustart, bestätigten Autosave/Prozessabbruch und Complete-Import. Die nativen Gegenfälle starten jeweils von derselben eingefrorenen SQLitebasis; lokale Browser-/Ansichtsspeicher und Atlas-Lesecaches werden vor dem nächsten Fall geräumt. Ein erfolgreiches
`result.json` qualifiziert ausschließlich die unten tatsächlich ausgeführten
Assertions. `tools/atlas-e2e01-scenarios.mjs` verlangt alle 22 Pflichtfälle mit derselben SHA, Build- und Fixturegrundlage, sichtbarer Oberfläche und unabhängigen Speicherassertionen. Fehlende, doppelte, übersprungene oder abweichende Fälle verhindern den technischen PASS; `tests/shared/desktop-e2e01-report.test.mjs` prüft diese Abweisung. `E2E01_ONLY_COUNTERCASE` dient gezielter Entwicklung und endet ausdrücklich ohne Gesamt-PASS. Candidate-CI, Zielgerät und Ownerabnahme bleiben gesonderte Aussagen.

| Szenario / Eingang | Tatsächliche Assertions und Prüfdateien | Verbleibende Grenze |
| --- | --- | --- |
| E01-01 · P01: gültige Campaign ohne Sitzung | Gemeinsame Fixture über `CampaignStore`-/Atlas-/City-/Key-/Encounter-/Medienwriter; unabhängige SQLite-Leser prüfen Stadt, Hausbindung, Geschosse, Räume, drei Markdownabschnitte samt Reihenfolge und Bytes. `tests/campaign/desktop-e2e01-fixture.test.mjs`; native Probe prüft fehlende `live_scene`/`live_state` nach allen Öffnungen. | Fixtureanlage ist fachlicher Writeraufbau; die native Neuanlage aller Objekte wird dadurch nicht behauptet. |
| E01-02 · P01: eine Atlasfläche und History | Native Probe bearbeitet Gelände mit sichtbarem Eigenschaftenpinsel, skaliert das Haus über den gemeinsamen Rauminspektor, bearbeitet Raum-Key und führt dieselbe Undo-/Redo-Folge über alle drei Änderungen aus. Unabhängige SQL-Orakel vergleichen die Geometrie, Keydaten und Gelände. | Suche navigiert im selben Atlas; die vollständige physische Welt→Ort→Stadt→Haus→Raum-Bedienung allein durch Zoom bleibt Zielgerätabnahme. |
| E01-03 · CampaignContext: A→B→A | Native Probe wechselt über Kampagnenkarten; B besitzt keine fremden Räume/Stadt/Gelände, keine fremde Suche und keine A-History; Rückkehr bewahrt A. Fixturetest weist alte und fremde Aktivierungstoken vor Mutation beider Campaigns ab. `tests/atlas/desktop-atlas-opening.test.mjs` sichert die Rücksetzung eines alten lokalen Atlasfehlers ausschließlich beim Tokenwechsel ab; aktuelle Fehler und fremde Pendingbesitzer bleiben erhalten. Die native Probe verlangt vor dem Abschluss eine bestätigte sichtbare Atlasanzeige. | Die nativen Pflichtfälle N01/N02/N03/N03b prüfen unterschiedliche Kameramittelpunkte und Maßstäbe, Auswahl, Fokus, Texte und Status. N03 prüft den normalen Write-Drain, N03b eine erst nach echtem Besitzerwechsel eintreffende Antwort über Testprozess-CDP-Instrumentierung. Eine Rendererfähigkeit wird dafür nicht ergänzt. |
| E01-04 · P02: Autosave, reguläres Ende, frischer Prozess | Native Probe wartet auf sichtbaren Savedzustand, schließt regulär, öffnet einen neuen Electronprozess und vergleicht ausgewählte persistente Tabellen einschließlich IDs, Revisionen, Geometrie, Abschnitten, Markdownbytes und Referenzen exakt. | Kein Stromausfall-, Installations- oder vollständiger Recoverynachweis. |
| E01-05 · P02: bestätigter Autosave nach Prozessabbruch | `native-session.mjs` besitzt ein ausdrücklich aktiviertes Crashprotokoll: Savedzustand plus SQL-Inventarhash vor absichtlichem Abbruch, neuer Prozess, identisches Inventar und anschließend reguläres Ende. `tests/shared/native-process.test.mjs` weist unknown/pending als Crashbestätigung ab und verlangt frischen normalen Abschluss. | Die native Probe hält zusätzlich eine echte Main-Commitantwort zurück und prüft den weiterhin unbestätigten UI-Zustand bis zur Freigabe. N05 verliert die tatsächliche Commitantwort, verlangt sichtbaren Fehler und Klärung derselben CommandId, genau eine Wirkung, unveränderte History/Receipts bei der Klärung und erfolgreiche Fortsetzung. Unbestätigte Zustände gelten niemals als dauerhaft bestätigt. E2E-04 behält seine weitergehende Matrix. |
| E01-06 · verbindliche P04-Variante: echter Complete-Import | Dieselbe native Probe exportiert über Main/Dateidialog und prüft Manifestdateiliste, Dateilängen, SHA-256 und echte PNG-Medien. Vor dem sichtbar bestätigten Import friert sie das vollständige kopierbare Quelleninventar einschließlich lokaler Referenzrollen ein. Die erwarteten Zuordnungen prüft sie unabhängig von der importerzeugten Mappingtabelle. Alle lokalen Identitäten, Abschnitte, Plan-/Itemzeilen und Referenzen müssen injektiv remappt sein. Fachrecords und History-Guards werden aus diesem Ausgangsinventar verglichen; globale Quellen-/Entry-IDs und gemeinsame Definitionen bleiben erhalten. Fehlende Zuordnungen und fremde lokale Referenzen haben eigene Gegenfälle. Quelle unverändert; Original und Import unabhängig bearbeiten und beide frisch öffnen. | Keine vollständige P04-/Salvage-/Trash-/Recovery- oder Zweithostabnahme. Archiveigenschaften allein ersetzen keine Ownerabnahme der Remapsemantik. |
| E01-07 · eingefrorene CatalogSource-/CatalogEntry-/Creature-/Item-/EncounterPlan-Referenzen | Die gemeinsame Fixture verwendet den produktiven engen `CatalogReference`-Vertrag mit Quellenkennung, Quellversion, SHA-256, globaler Entry-ID und Typ. `StoredEncounterPlan.sources` speichert Referenzen; geplante Items und Raum-Keyverweise tragen dieselbe Bindung. Die aufgelöste UI bleibt getrennt. Native Katalogansicht nach Fresh und Complete-Import prüft Guard, Bewertung und gebundenes Item ohne Write. N06 zeigt fehlende, unbekannte, falsch revisionierte und nicht verfügbare Itemquellen, verweigert Teilübernahmen und prüft unveränderte Daten/History/Receipts. Unbetroffene Terrainarbeit in B bleibt während des Quellenfehlers möglich. `tests/campaign/desktop-e2e01-fixture.test.mjs` prüft außerdem unveränderte historische Itemverwendung nach Definitionsänderung, Complete-Import und Neustart; `tests/catalog/desktop-catalog-xp.test.mjs` eingefrorene Gruppenfakten über Planänderung, Complete-Import und Neustart. | Die [datierte lokale technische Stufe](#datierter-lokaler-e2e-01-nachweis) ist bestanden. Candidate und integrierte technische CI-Stufe sind [belegt](#integrierter-technischer-e2e-01-nachweis); Zielgerät, Paket und Ownerabnahme bleiben gesondert offen. |
| E01-08 · negative Schreib-/Kontextgrenzen | N04 prüft fremde CampaignId, veraltete Campaignrevision, fremde und veraltete World-/Locationbindungen vor Mutation über den tatsächlichen Main-/Storeanschluss. Pro Fall wird der sichtbare Fehler mit unabhängigen Daten-/History-/Receiptassertionen verbunden. Neue veraltete Aufträge scheitern; das Originalreceipt bleibt nach späterer Campaignrevision idempotent. N02/N03/N03b/N05/N06 ergänzen späte Antworten, Antwortverlust und Quellenfehler. Die ergänzenden Archive-/Commit-/Fixturetests bleiben eigene Fachbelege. | Keine weitergehende E2E-04-, Plattform-, Installations- oder Ownerabnahme. |

`tools/atlas-e2e01-fixture.mjs`, Version `e2e01-desktop-v2`, besitzt den kleinen
Seed und den unabhängigen SQL-Leser. Die Datenbank erzeugt neue IDs über die
vorhandenen Writer; `fixture.json` friert das tatsächliche Sollinventar dieses
Laufs vor dem ersten Prozessstart ein. Versionskennung und unveränderte
Markdownbytes besitzen einen gepinnten Rezept-Hash im Fixturetest. Der zusätzliche
Archivraum hat drei Abschnitte; generierte Hausräume behalten ihre bestehenden
Abschnittsbindungen. Kein LiveSession- oder Preparationsstart wird simuliert.

`tools/test-desktop-room-groups.mjs` bleibt ein ergänzender Fachbeleg für native
Generierung, Gruppenskalierung, Split und Fresh; `tools/test-desktop-region-export.mjs`
für Gelände, Orte und Ausgabe; `tools/test-desktop-campaign-transfer-visit.mjs`
für echte Transferbedienung und unabhängige Notiz-/Raumbearbeitung. Ihre getrennten
Fixtures und früheren PASSe werden nicht zu einem gemeinsamen PASS addiert.

Der neue Lauf entfernt alte Erfolgsdaten vor Aufbau der Fixture. Sein Ergebnis
bindet Quell-SHA/Dirtyzustand, Buildmetadaten und zwanzig Runtimehashes,
Fixture-/Quellhashes, Host, Szenarien, Start-/Exit-/PID-Nachweise, Datenvergleiche,
Manifest, eingefrorenes vollständiges Transferinventar, nativen Gegenfallkatalog und Remapdatei; Fehler schreiben `failure.json` und eine frische Aufnahme.
Der Software-Prüfmodus verlangt weiterhin zwei neue Frames und protokolliert ihre Wartezeit; dafür gelten höchstens 15 Sekunden, für die gesamte Aufnahme vor Close höchstens 20 Sekunden. Dies sind Automationsdeadlines, keine Produktleistungszusagen. Linux mit Software-GPU belegt den ausgeführten automatisierten Funktionsumfang; ein lokaler Lauf ist kein GitHub-CI-Ergebnis und kein Zielgerätebeleg. Der reale `Candidate · exact-SHA aggregate` ist für den oben genannten
integrierten Stand belegt. Ein neuer nativer Zielgerätlauf auf genau diesem
Stand sowie Paketprüfung und gesonderte Ownerabnahme bleiben erforderlich. Alte Erfolgsdateien,
Software-GPU und Modelltests erbringen diese Aussagen nicht. E2E-02–04 bleiben
eigenständige Abschlüsse.

## E2E-02 – Vorbereitung → Live-Spiel → Abschluss

Die [Runde-9-Pflichtfallzuordnung und neue gemeinsame native Spielkette](../../reference/round9-e2e-20261028/README.md)
verbinden vorhandene Teilbelege über dieselbe Kampagne, eigenständige
SQLite-Orakel und einen neuen Electronprozess. Der ausführbare Katalog in
`tools/live-e2e02-scenarios.mjs` hält fehlende Eingänge ausdrücklich offen;
ein bestandener Teilablauf schließt E2E-02 nicht. Insbesondere fehlen dem
aktuellen Initialize noch der versionierte immutable PreparationSnapshot und
eine eigene LiveSession-Identität. E2E-03 und E2E-04 behalten ihre getrennten
Abschlüsse und dort konkret zugeordneten Restprüfungen.

**Nutzerablauf:** Ort, Party und Encounter vorbereiten → bestätigten immutable Preparation-Snapshot übernehmen → LiveSession ausdrücklich initialisieren → Party Split/Move/Rejoin, Primary-/SplitScene und Focus nutzen → Encounter/Chase/Combat/Loot ausführen → Session abschließen. Vorbereitung bleibt unverändert, solange kein eigener bestätigter Vorbereitungsbefehl sie ändert.

**Harte Eingänge:** CampaignId/Revision, PreparationId/Revision, SessionPlanId, immutable SourceProvenance, planning-only ExpectedParty, LocationRef und EncounterPlanRef; Character-/Party-/LiveSession-/PrimaryScene-/SplitScene-/Mask-IDs sowie Scene-/Assignment-/Focus-Revisionen. Der PreparationSnapshot ist eine tief kopierte, immutable Runtimeeingabe. Der versionierte EncounterPlan hält stabile Creature-/Item-/EncounterTable-Referenzen; eigene revisionierte Encounter-/Chase-/Combat-Laufzeitidentitäten, Participant- und Group-vs-individual-Zuordnung sowie ein atomarer Loot-/Reward-/Ledger-Ausgang besitzen eigene Identität und Revision. Planung, Runtime und Ledger haben getrennte Datenmodelle und denselben Receipt-/Savevertrag; Katalogreferenzen werden nicht als Fremdpayload kopiert. Der gepinnte D&D-2014-Vertrag bestimmt Bewertung und Kampf; es gibt keinen 2024-Modus, keine 2024-Budgets und keine Regelversionsauswahl. Music/Weather/Shops konsumieren nur bestätigte Focus-/Clock-/Location-Projektionen; ihre manuelle Steuerung und Fehlergrenzen bleiben eigene Bereichsgates.

**Orakel:** Vor ausdrücklichem Initialize existiert keine LiveScene. Im echten Host Creature und Item über stabile Katalogreferenzen wählen → immutable EncounterPlan/Preparation anzeigen → LiveSession mit neuen Runtime-/Scene-IDs initialisieren → Encounter mit gruppierten und individuellen Teilnehmern starten → Chase- und Combat-Eingang sichtbar unterscheiden → Initiative, Runde, HP und Zustand fortschreiben → Loot/Reward genau einmal ins Ledger übernehmen → frischer Prozess zeigt dieselben IDs, Revisionen, Runtimewerte und Ledgerwirkung. Planner und Preparation bleiben byte- und revisionsgleich; ein neuer bestätigter Start erzeugt eine unabhängige Runtimekopie statt Alias, Retry derselben CommandId bleibt idempotent. Failed Publish verändert Campaign und Preparation nicht. Split/Move/Rejoin ordnet jedes Party-Mitglied anhand seiner ID genau einmal active, inactive oder pending zu; Namen sind keine Identität. Rejoin und Clock-Beitrag bleiben bis zu derselben Publish-Grenze unveröffentlicht. Focus prüft active/none/pending/unavailable sowie missing, invalid, foreign, stale, inactive/retired und damaged sichtbar fail-closed; nur active liefert Scene-Fachdaten und startet Verbraucher. Restart/Retry verlieren keine Teilnehmer und mutieren den Planner nicht zurück. Unknown/unavailable/stale Katalogreferenzen blockieren Start/Publish sichtbar ohne Ersatzpayload oder Teilwirkung. DMG-2014-Goldenbewertung, Antwortverlust, Retry mit ursprünglicher CommandId und fehlgeschlagenes Publish sind verpflichtende Teilfälle desselben Gates. Ein durchgängiger ID-/Receipt-Trace bleibt erforderlich. Zeitfolgen im Spielabend erfüllen zusätzlich E2E-03.

## E2E-03 – Reise → Kalender/Clock → Weltreaktion

**Nutzerablauf:** Reise im gemeinsamen Atlas vorbereiten und bestätigen → Partyposition und Scene-Zeit fortschreiben → Kalenderereignisse, Wetter, Shopzustand und Musik-/Szenencues konsistent reagieren lassen → Reise unterbrechen, fortsetzen, rückgängig machen und nach Neustart wiederholen.

**Harte Eingänge:** bestätigte Travel-/Clock-/Calendar-/WorldEffects-Verträge, bestätigte Location-/Scene-/Focus-/Asset-IDs, kausale Ereignis- und genau-einmalige Receipt-Semantik sowie begrenzte Weather-/Shop-/Music-Consumerverträge. Das Fixture pinnt eine kampagnenweite ManualDecision mit ID/Revision/Ende, einen an seine Scene-Source gebundenen AmbienceOverride mit ID/Revision, reale lokale Music- und Ambience-Dateien mit stabiler AudioSourceId, Metadaten und Bytehash sowie je eine absichtlich fehlende und beschädigte Medienvariante. Ein Consumer besitzt keine Campaign- oder Clock-Wahrheit.

**Orakel:** Preview schreibt nichts; Confirm erzeugt genau eine fachliche Zeit-/Ortsfolge; Cancel, Crash, Providerfehler, Offline-Restart und Retry duplizieren weder Reise noch Restock, Wetter- oder Cue-Wirkung. Die kampagnenweite ManualDecision bleibt bis zu ihrem definierten Ende erhalten. Der Scene-AmbienceOverride bleibt an seine Source gebunden, wird bei Source-Retirement suspendiert, niemals auf ein Target übertragen und dort erst nach frischer bestätigter Projektion aktiviert. Nach Cancel, Source-Retirement oder Providerfehler gibt es keine stale oder verspätete Ausgabe; der manuelle Zustand bleibt unverändert. `none`, stale und unavailable bleiben für Consumer sicher; manuelle Overrides behalten ihre Priorität.

## E2E-04 – Portabilität, Recovery und sichere Anzeige

**Nutzerablauf:** Kampagne samt Assets, Runtime, Definitionen, Trash und unbekannten erhaltenen Daten als Complete oder offengelegtes Salvage exportieren → auf einem unabhängigen Host importieren oder aus Backup wiederherstellen → denselben fachlichen Zustand weiterführen. Während eines GM-Spielabends erhält ein isoliertes passives Display ausschließlich freigegebene Spielerprojektionen. Die Bedienung funktioniert per Tastatur, bei 100 % Skalierung und in kleinen Fenstern.

**Harte Eingänge:** reale P02-/P03-/P04-Implementierungen und unabhängige Belege; ein bestätigter SMR-10-Vertrag für PlayerProjection/Redaction, getrennt von der internen SMR-03-Focus-/LiveScene-Quelle; Host-/Capability-/Archiv-/Migrationverträge; ein zweiter isolierter Fensterprozess; vollständige Asset- und ID-Remap-Regeln; unterstützte OS-Builds. Bis zum bestätigten SMR-10-Vertrag bleibt der Player-Consumer absent/disabled. Die Qualifikation der Zielplattform benötigt P01–P04/C01 und die erforderlichen OS-Belege.

**Orakel:** E2E-04 vertieft den E2E-01-Minimalpfad um Copy mit unabhängiger Campaign und vollständigem ID-Remap, Complete-vs-disclosed-Salvage, Backup/Restore mit ID-Erhalt, unabhängigen Import mit vollständiger Remap-Closure, Assets/Trash/unknown-retained/Quarantäne und Crash-Recovery unter ursprünglicher CommandId und demselben Receipt. Vor Publish bleibt bestätigte Wahrheit unverändert, danach gilt nur Roll-forward; Source-Tokens sind Evidenz, nie Target-Autorität, und keine Ersatz-Campaign wird automatisch aktiviert. Complete enthält sämtliche Medienbytes, Identitäten und Metadaten unverändert; fehlende, beschädigte oder nicht verifizierbare Medien blockieren Complete. Nur ausdrücklich gewähltes Salvage darf sie unter Nennung ihrer Identität und Auswirkung auslassen. Beschädigte Kerndaten bleiben fail-closed und Survivor-/Quarantänebestand erhalten. Das passive Display ist read-only und erhält ausschließlich eine separate freigegebene PlayerProjection, niemals die interne Scenequelle direkt. GM-Keys, private Daten, Knowledge/Perception/Fog/Camera und nicht freigegebene Assets lecken weder in DOM, Pixel, Accessibility-Namen, Speicher, Logs noch Netzwerkanfragen; `none`/stale/unavailable und Fehler bleiben neutral. Zielhost-, OS-, physische Eingabe-, Accessibility- und Großweltbelege werden nicht aus einem Linux-/Obsidianlauf abgeleitet.

## Stadtbeitrag und native Fixture

Integriert sind CityDocument v1 mit stabilen Dokument-/Element-IDs und lokalen Metern, strikter Codec, genau eine CitySource in der gemeinsamen AtlasHistory, beginbasierter CityDraft/CityGesture mit Cancel ohne Write, lokale CityScene/Hit und CityRenderer ohne Kamera, Renderloop oder Persistenz. CityScene bezeichnet geometrische Darstellung, keine LiveScene.

Für die Stadtintegration gelten die HEX-04/05-Verträge: relative präzise Welt-/Meterabbildung; Draw vor dem gemeinsamen Render; gemeinsamer Treffer-/Capture-/Cancel-/Quellenlebenszyklus; Fit über Terrain und geladene Detailinhalte; City-/Placement-/Gebäuderecords in derselben Command-/Commit-/Recoverygrenze. Der HEX-03-Repositoryanschluss allein beweist keine native Citypersistenz. Der gewählte [Anschluss](../../city/contract/city.md#atlasanschluss) beschreibt das Ziel; datierte File-/Sourcebelege behalten ihren damaligen Scope und schreiben keine interne Ziel-API vor.

### Versioniertes synthetisches Fixture

Fixtureversion `city-e2e-v1`; feste CampaignId `00000000-0000-4000-8000-000000000001`. Geplante synthetische Prüfdaten:

| Stadtelement | Feste ID / Werte |
| --- | --- |
| CityDocument | `00000000-0000-4000-8000-000000000100`, Name `E2E-Stadt`, Version 1, Meter |
| Straßenknoten | `00000000-0000-4000-8000-000000000101` bei (-10,0), `00000000-0000-4000-8000-000000000102` bei (10,0) |
| Straße | `00000000-0000-4000-8000-000000000103`, die beiden Knoten, via [], Breite 4 m |
| Platz | `00000000-0000-4000-8000-000000000104`, Außenring (-4,-4),(4,-4),(4,4),(-4,4), keine Höfe |
| Haus A | `00000000-0000-4000-8000-000000000105`, Pose (-6,8), Drehung 0, Skalierung (1,1); Rechteck (0,0),(4,0),(4,6),(0,6) |
| Haus B | `00000000-0000-4000-8000-000000000106`, Pose (6,8), Drehung 0, Skalierung (1,1); Außenring (0,0),(8,0),(8,8),(0,8), Hof (2,2),(2,6),(6,6),(6,2) |

Districts/Plots zunächst leer. Haus A wird über den Atlasanschluss mit den festen Welt-/Location-/Placement- und Dungeon-/Room-/Key-IDs sowie den zugehörigen Markdownbytes verknüpft. Unbekannte/fehlende/stale Referenzen sind explizite Negativfälle. Der versionierte Testbestand legt kanonische Bytes und Hashes fest; geänderte fachliche Erwartungen benötigen eine neue Version. Erwartungsdateien werden niemals zur Reparatur eines fehlgeschlagenen Tests regeneriert.

## Stadtbeitrag und native Fixture — Gemeinsame Orakel und technische Umsetzung

| Gate | Stadtbeitrag und Pflichtorakel |
| --- | --- |
| E2E-01 : Kampagne → gemeinsamer Atlas/Stadt/Dungeon/Raum-Key → Save → frischer Prozess | **Harte Eingänge vor vollständiger Abnahme:** ausführbare Campaign→Atlas-Bridge, CampaignLifecycle/Context, Schema-/CampaignRevision und World-/Location-Namespace; realer P02-Minimalpfad Save/Reopen und genau eine verifizierte Complete-Import-Variante mit Manifest/Checksums, vollständiger Old→New-Remap-Closure und benanntem P04-Owner. Eine gültige Campaign **ohne LiveSession** muss City/Atlas/Dungeon/Save/Reopen positiv benutzen können. Party-/Preparation-/Initialize-Verträge sind hier ausschließlich negative Autostart-/Mutationsgrenzen: Navigation/Reopen startet keine Session und verändert keine Vorbereitung; kein positiver Initialize als E2E-01-Voraussetzung. Neuinstallation und Complete-Import prüfen; kein Salvage-/Gesamt-Recovery-PASS aus diesem Gate. Fehlt ein Eingang, sind räumliche Vorläufe nur Zwischenbelege, kein E2E-01-PASS. Straße, Platz, Häuser im einen Atlas bearbeiten; Haus A → Dungeon/Raum-Key allein durch Zoom. Ein gemeinsames Terrain-/City-/Placementpaket, Undo/Redo, Save, neuer Prozess. Gleiche IDs, lokale Meterwerte, Referenzen und fremde Keytexte; keine zweite Kamera/History/Savequeue. Copy erhält Quelle und remappt kampagnenlokale Bindungen konsistent. |
| E2E-02 : Preparation → ausdrückliches Initialize → Party/Split/Move/Rejoin → LiveSession/Scene/Focus → Encounter/Chase → Abschluss | **Positiver Preparation→Initialize→LiveSession-Nachweis ausschließlich hier**, mit bestätigtem immutable PreparationSnapshot und unabhängigen Runtime-/Scene-IDs aus den Campaign-/LiveScene-Verträgen; Vorbereitung bleibt unverändert. Derselbe Stadt-/Haus-/Raumbezug in immutable Location-/Sceneprojektionen; keine kopierten Party-/Encounterpayloads. City-Gesten Cancel/No-op/Stale schreiben nicht, erhalten Redo und fremde bestätigte Änderungen. Zeit-/Wetterwirkung nur aus bestätigten Consumerverträgen, kein Citytimer oder Clockbesitz. |
| E2E-03 : Reise → Kalender/Clock → Standort/Wetter/Shop/Musik/Weltreaktion | City liefert stabile Orts-/Hausreferenzen und geometrische Consumeransichten aus bestätigten immutable Projektionen; keine eigene Reise-/Zeitwahrheit. Preview/Confirm, Cancel, Retry und frischer Prozess müssen Standort, Zeit und Verbraucherfolgen konsistent und genau einmal erhalten; keine doppelte Wirkung bei wiederholtem Receipt. Fehlende/stale/retired Referenzen und Providerausfall bleiben explizit. Reise-/Clock-/Consumerowner implementieren ihre Payloads; City prüft eigene Referenz- und Änderungsgrenzen. |
| Schreib-Gates als Querschnitt und E2E-04 : Complete/Salvage/Restore/Import → unabhängiger Reimport → Fault-Recovery | Gemeinsames Fixture injiziert Cancel vor Publish, Crash zwischen City-/Placementwrites, fremde Bytes, verweigerten Write, wenig Speicher und published-pending-finalize. Ursprüngliche CommandId/Receipt auflösen: gesamter bestätigter Vorher-/Nachherstand, keine Teilwirkung oder Doppelwirkung. Complete-/Salvage-/Quarantänestatus sichtbar; Citybytes, IDs und opaque Fremdrefs im unabhängigen Import prüfen. Allgemeine Durability-/Archivimplementierung bleibt P02/P04. |
| E2E-04 : Portabilität und sicheres passives Display → Tastatur/100 % → Zielhost und Fault-Recovery | Im gewählten echten Host Straße/Haus/Key per Tastatur und bei 100 %/kleinem Fenster bedienen, denselben Atlas durchzoomen. Sichere Playerprojektion ausschließlich über den P03-Vertrag: keine GM-Keys, none/stale/unavailable fail-closed. Citybelege bestätigen nur eigene Projektion/Bedienung. |

Recovery-/Crash-/Receipt-Orakel gelten zusätzlich an jedem betroffenen Schreib-Gate, insbesondere Kampagne/Raum, Live-Spiel und Reise/Weltreaktion; sie werden nicht ausschließlich der vorläufigen Nummer E2E-04 zugeordnet. Das Portabilitäts-/Displaygate vertieft diese Beweise, ersetzt sie nicht.

Zusätzliche feste Geometrieorakel: Weltanker/Kameramitte 1e16, .01 m/px, lokales Delta (.01,.01) ergibt (1,1) px und lokale Rückabbildung; negative Koordinaten, Rotation, Resize, Höfe, konstante Bildschirmgriffe und Straßenbreiten; gemeinsames Fit für city-only, entferntes Cityplacement und leere Szene. Diese Testfakten verlangen die bestätigte relative Transformkomposition, keine neue Kamera.

Host-/OS-Matrix je Gate: exakte Kandidaten-SHA, Host-/Buildversion, OS, installierter Artefakthash, frischer Prozess und Capability-/Fault-Ergebnis. Linux ist kein Windows-/macOS-Beweis; nicht ausgeführte Plattformen bleiben not-run. Modelltests sind keine native Durability, physische Eingabe oder Bedienparität.

Der tatsächliche City-v1-Codec erzeugt die gespeicherte Cityfixture IDs100–106 in `tests/fixtures/atlas-e2e-v1/input/Städte/00000000-0000-4000-8000-000000000100.city`; identische `expected/`-Bytes sind ausschließlich das unveränderte Citybaseline-Orakel. `city-manifest.json` pinnt je Datei 2595 UTF-8-Bytes und SHA256 `c2dcd6cc4b3a220ed8e46d02c4e63a3336bda5f8ee7e6152cfab136124aa395c`. Der unveränderte Cityseed ist ein Komponentenorakel; vollständiger Import und realer Host-Reopen benötigen die gemeinsame Manifest-/Referenzclosure.

Eigene ausführbare Orakel in [city-e2e-fixture.test.ts (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/shared/core/city-e2e-fixture.test.ts): kanonischer Codecroundtrip, feste IDs/Meter/Geometrie/Hof/Straßenreferenzen, gepinnte Bytes/Hashes, immutable CitySource-Snapshot, Hausverschiebung und exaktes Undo/Redo in AtlasHistory, unabhängige Baselinequelle; fehlender Straßenknoten und erfundenes Dungeonfeld werden abgelehnt. Fremd-IDs Atlas10/Location11/12 bleiben ausschließlich Anschlussmetadaten. Haus105 besitzt keine erfundene City-v1-Bindung. Keine neue Kamera, History, Persistenz oder GUI. Diese Orakel sind Code-/Fixturebelege, kein realer frischer Hostprozess, Complete-Import oder E2E-PASS.

## Räumliche End-to-End-Kriterien

### Gemeinsame vertikale Lieferung

| Beitrag | Liefernde und benötigte Grenzen | Gemeinsamer sichtbarer Beweis |
| --- | --- | --- |
| E2E-01: nächster Orts-/Dungeonablauf | Campaign/Data: ausführbarer CampaignLifecycle/Context, Schema-/CampaignRevision und World-/Location-Namespace; P02: wirklicher minimaler Mehrbesitzer-Save/Reopen; P04: verifizierte Complete-Import-Variante; Hex: Campaign→Atlas-Navigation, Marker/Key, Worldplacement, Transform/Zoom/History; Dungeon: Raum/Key, persistenter Source-/Snapshot-/Commandadapter an den gemeinsamen History-/Transaction-Port | Neuinstallation **und Complete-Import** → gültige Campaign ohne LiveSession → Hex → Ort/Key → verorteter Dungeon/Raum/Key → herauszoomen → Undo/Redo → Save → neuer Prozess; normale Neuöffnung erhält IDs, Texte und Positionen; Copy/Import beweist dokumentiertes Remapping |
| E2E-01/02: Stadt im selben Raum | Stadt: CITY-01–04, erzeugbarer Plan/Häuser; Hex: Placement/Transform/Renderer/Hit und Atlas-Snapshot; Dungeon: Haus-Dungeon und genau-einmalige Commandprojektion in die bestätigte gemeinsame History-/Speichergrenze | Ort → Stadtplan → Haus → Dungeonraum allein durch Zoom, unmittelbar bearbeiten; gleiche Kamera/History |
| E2E-02: Vorbereitung/Party/LiveSession/Encounter/Chase | Campaign/Data: CampaignId/Revision, PreparationId/Revision, SessionPlanId und immutable SourceProvenance, planning-only ExpectedParty sowie LocationRef/EncounterPlanRef; SMR-03/Encounter: ausdrücklich bestätigtes Initialize und eigene Runtime-/Sceneidentitäten; Hex liefert stabile Location-/Roomreferenzen ohne kopierte Session-/Zeitwahrheit | Positiver Preparation→Initialize→LiveSession-Ablauf mit unabhängiger Runtimekopie; derselbe Fixture-/Receipt-Trace über Party/Split/Move/Rejoin, Scene/Focus, Encounter/Chase und Abschluss; Planner/Preparation bleiben unverändert |
| E2E-03: Reise/Clock/Weltreaktion | Clock/Travel/Verbraucher benötigen stabile Ortsreferenzen und bestätigte Projektionen; Hex liefert Orts-/Raumadressierung, keine Zeitautorität | Reise → Zeit/Kalender → Standort/Wetter/Shop/Musik/Weltreaktion; genau-einmalige Retry-/Restartwirkung |
| E2E-04: Recovery/Portabilität/Display/A11y/Zielhost | P02/P04: tatsächlicher Host-/Storagebesitz; P03/Display: sichere Projektion; Hex: eigene Text-/ID-/Koordinaten-/Recoveryorakel | Mehrbesitzer-Fault/Restart/Reimport; GM-Tastatur/100 %; private Orts-/Raum-Keys fehlen vollständig in Playerdaten |

### Campaign→Atlas-Grenze ohne Sitzungszwang

Der ausführbare CampaignContext, sein versionierter Namespace und der Atlas-Navigationsadapter müssen denselben validierten Kontext konsumieren. Die fachlichen Anforderungen sind im [Campaign-Datenvertrag](../../campaign/contract/archive.md) zusammengeführt.

- Eine gültige Campaign ohne Party-/Preparation-Ausführung oder LiveSession ist im Atlas vollständig bearbeitbar. Party, Preparation und Initialize sind für E2E-01 nur negative Grenzen: Navigation, Bearbeitung und Reopen starten keine Session und schreiben keine Party-/Scene-/Clockwahrheit. Der positive Sitzungsstart gehört ausschließlich zu E2E-02.
- Campaign/Data besitzt Lifecycle/Context, Schema-/CampaignRevision, Referenznamespace sowie Import-/Remappingwahrheit. Hex löst stabile World-/Location-/Room-/Sectionziele innerhalb des validierten aktiven Contexts auf; Dateiname oder Anzeigename ersetzt keine Identität. Stale, fremde, fehlende, mehrdeutige und retired Ziele scheitern sichtbar vor Mutation.
- A→B→A bindet dieselbe Atlasfläche an die jeweils aktuelle CampaignRevision neu. Kamera, History, Auswahl und Writes dürfen nicht in eine fremde Campaign gelangen; neue Bindung bedeutet keinen getrennten Bearbeitungsmodus. Ausstehende Key-/Gestenarbeit wird vor bestätigtem Wechsel erfolgreich gesichert oder sichtbar erhalten. Verspätete Loader-/Saveantworten dürfen den neuen Context nicht verändern.
- Reopen und Restore bewahren Campaign- und fachliche IDs. Campaign-Copy und Import erzeugen eine unabhängige Campaign mit vollständiger Old→New-Closure aller campaignlokalen IDs und internen Referenzen; Source, bestehende Campaigns und gemeinsame Definitionen bleiben unverändert. Unveränderte globale Definitionidentitäten bleiben erhalten; ausdrücklich gewählte Konfliktvarianten erhalten bei Bedarf neue IDs und vollständige Referenzumbindung. Normales Reopen remappt niemals still. Die bisherige Kartenkopie ist noch kein vollständiger Campaign-Copy-/Importbeweis.
- E2E-01 fordert echten P02-Save/Reopen und genau eine verifizierte Complete-Import-Variante mit Manifest/Checksums und vollständiger Remap-Closure. Salvage, Backup/Restore und die gesamte Crash-/Recoverymatrix sind zusätzliche E2E-04-Pflichten; vorhandene Atlas-Save/Copy/Discard/Recovery-Fachfälle bleiben verbindlich. P02/P04-Hostimplementierung wird durch den Campaign/Data-Vertragsbesitz oder diesen Hexplan nicht übernommen.
- E2E-02 erhält einen tief kopierten immutable PreparationSnapshot. Initialize erzeugt neue Runtime-/LiveSession-/Scene-IDs, niemals eine Planneraliasierung; vor dem Befehl existiert keine dadurch erzeugte LiveScene. Retry derselben CommandId ist idempotent, ein neuer bestätigter Start erzeugt eine unabhängige Runtimekopie. Fehlgeschlagenes Publish erhält Campaign und Preparation. Hex konsumiert daraus nur bestätigte Orts-/Raumreferenzen.

### Fester eigener Fixture-Anteil

[Manifest](../../../tests/fixtures/atlas-e2e-v1/manifest.json), Version1: fünf eigene Eingangsdateien und fünf exakte Erwartungsdateien mit SHA-256. World `00000000-0000-4000-8000-000000000010`; Locations `...0011`/`...0012`, Placements `...0013`/`...0014`, Abschnitte `...0015` bis `...0018`. Vollständige UUIDs stehen in den Dateien. Negative Terrainchunkgrenze, Ursprung `(0,0)`, pointy, drei Meilen Mittelpunktabstand, zwei feste Orte und genaue Markdownbytes. Änderungen: Town-Key/Abschnittsfolge, POI `(-4828.032,0)` → `(4828.032,0)`, Waldhex `(1,0)`.

Nur `input` wird in einen isolierten Testvault übernommen. `expected` ist das Dateiorakel und darf nicht als zweite live Dokumentmenge mit denselben IDs eingebunden werden. Ein Gate regeneriert diese Dateien/Hashes nicht; fachliche Änderungen verlangen eine explizite neue Version. Die tatsächliche Ortanlage wird zusätzlich in HEX-03 nativ geprüft; der gemeinsame feste Seed beginnt mit zwei bekannten gespeicherten Locations.

## Fachliche Reihenfolge

E2E-01 benötigt ausführbare Campaign-/Registry-/Publish-/Importanschlüsse und räumliche Bearbeitung; eine gültige Kampagne ohne LiveSession muss positiv nutzbar bleiben. Preparation→Initialize ist ausschließlich die positive E2E-02-Nutzung. Recovery-/Crash-/Receipt-Orakel gelten an jeder betroffenen Schreibgrenze; E2E-04 vertieft sie und ergänzt Plattform/Display. Die vier Szenarien ersetzen nicht SMR-00–11, CITY-00–09, HEX-00–28, Originalparität, Performance oder Barrierefreiheit.
