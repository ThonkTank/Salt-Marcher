---
area: city
owner: Stadt
issue: 92
status: active
checkpoint: cityExecution
---
# Gebäudenamen im gemeinsamen Atlas bearbeiten

Nutzerweg: vorhandenes Haus auswählen → Namen exakt bearbeiten → gemeinsames
Undo/Redo → Save → frischer Prozess erhält Namen und Hausgeometrie.
[#92](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92)
gehört zur individuellen Hauskorrektur in CITY-01/CITY-04. Volle Stadtparität und
bessere Bedienung bleiben der Gesamtumfang; dieser Weg ist keine Gesamtfreigabe.

## Arbeitsstand #92

Inspector und Fachaktion sind über [PR93](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/93)
integriert; [PR98](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/98)
behebt den direkten Save eines noch offenen Namens. [PR101](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/101)
enthält den unabhängig geprüften H02-Hostprüfer und portable Rohbelege. Kein
weiterer Inspector-, Save- oder H02-Reviewauftrag steht aus.

Der aktuelle gemeinsame Produktstand ist über den Sharedbranch erreichbar.
H01 bleibt an Produkt0315b13/Builda12b609 gebunden; H02 an Produkt73bfe22/Build1afac1d.
Beide Receipts und sämtliche Originale bleiben unverändert. H02 belegt den
kontrollierten nativen Citywrite-/Manifestfehler, vollständigen Rollback,
sichtbaren Retry ohne weitere Historywirkung und echten frischen Prozess.
Es ist kein Nachweis für Hex' später integrierte N03-Scrollkorrektur.

**Jetzt fehlender Anschluss:** [freier Cloud-GM-Test](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92#issuecomment-6104519136)
unter bestehendem Claim GM-CITY-HOUSE-NAME-CLOUD-UI-RETEST-20261011-01. Eine
uneindeutige Zuordnung von CDP-Ziel und sichtbarem Display blockierte den
Nutzerlauf vor Cityeingabe. Cloud-GM klärt/repariert seinen eigenen isolierten
Host; keine fremden Fenster schließen oder den Nutzervault verwenden.
Danach einmal auf tatsächlich gebautem aktuellem Shared: Haus auffinden,
Namen ändern, gemeinsames Undo/Redo, direkt speichern und wiederverwenden;
[City und N03-Feldauffindbarkeit gemeinsam prüfen](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92#issuecomment-6104526231).
Stadt konsumiert den konkreten Citybefund, Hex erhält dessen #80-Konsequenz.
Keine zweite parallel laufende Atlas-/GM-Probe.

**Offen:** freie GM-Abnahme, physische Bedienung und breite Recovery-/Gesamtparität.
Der Markerüberlappungsbefund beim Einstiegszoom bleibt ein konkreter
Auffindbarkeitseingang; Producerzoom ist keine freie GM-Abnahme. Bei unverändertem
Hostblock nur kompatible unabhängige Arbeit, keine erneuten Receipt-/Reviewpakete.

## Inspector- und Fachaktionsbelege

Branch city/building-name-inspector auf Shared ca29032. Erste Fachaktion
`set-building-name` in CityEdit ist umgesetzt. Bestehender Citycodec prüft den
vollständigen Endzustand; Namensbytes werden weder getrimmt noch normalisiert.
IDs, Grundriss samt Hof, Pose, Plotreferenz und andere Elemente bleiben erhalten.
Der vorhandene CitySource/cityDocumentChange-Anschluss verwendet AtlasHistory;
kein zusätzlicher Store, Snapshot-, Kamera- oder Publishvertrag.

Zwei direkte Gegenproben FAIL vor/PASS nach Implementierung: exakte Namensänderung
mit unveränderten übrigen Daten und Undo/Redo; ungültiger Name, fehlendes/fremdes
Element, doppeltes Schreibziel, Getter ohne Aufruf und stale Beforebasis ohne
Teilpublikation. 576 gebaute Kerntests PASS. Typprüfung/Build/Repositoryprüfung PASS. Unabhängiger Fachbefehlreview
[CITY-BUILDING-NAME-R01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/93#pullrequestreview-5481404923) PASS auf 793a68e; dieser Befund betrifft noch nicht den neuen Inspector.

Der sichtbare Consumer ist im vorhandenen AtlasEditor umgesetzt und mit Hex
abgeglichen (#92/6103962651): CityHit liefert Owner/Building-ID; ein Hausklick
öffnet ein Namenstextfeld in derselben Keyseitenleiste. Der bestehende CityDraft
bindet die Eingabe an ihre Basis und dieselbe AtlasHistory. Apply, Escape,
Zur Karte, Auswahlwechsel, Undo/Redo und Save nutzen applyKeys; ungültige und
stale Eingaben bleiben sichtbar. Zurück zur Karte übernimmt zuerst und gibt
anschließend den Fokus zurück. Alte Feldcallbacks nach Hauswechsel sowie
History-ABA und widerrufener Context können keine neue Eingabe veröffentlichen.

Ein Textarea erhält auch vorhandene Zeilenumbrüche, Tabs und Leerzeichen ohne
Normalisierung. Interne Navigation darf unter ihrer vorübergehenden UI-Sperre
geprüft flushen; direkte Feldaktionen bleiben während der Sperre blockiert.
Die Cacheidentität berücksichtigt den tatsächlichen CitySource. Explizites
Verwerfen validiert die neue Basis, bevor der alte Entwurf abgelöst wird.

Schlussprüfung: vollständige Suite 1000 PASS / 0 FAIL / ein bestehender Skip;
Typprüfung, Produktbuild, Repositoryprüfung und Diffprüfung PASS.
Drei neue Managed-DOM-/Repositoryfälle PASS: synthetisch gepinnter CityHit am
Rendereranschluss durch den tatsächlichen Pointerrouter; exakter Hausname,
eine Leiste und unveränderte Kamera/Context/History; Undo/Redo, nativer Save und
neuer Hostmodellmount mit vollständiger Citygeometrie; ungültiger Name blockiert
Escape/Navigation, IME und Eingabesperre erhalten den Entwurf; alte Feldcallbacks,
History-ABA und queued Escape nach Contextwiderruf schreiben nicht. Fremde
Native-Dateien bleiben bytegleich; der eigene temporäre Atlasdraft wird gemäß
bestehendem Savevertrag entfernt. GPU-Initialisierung ist im DOM-Harness
ersetzt; Picking und echter Prozess-Neustart sind damit nicht qualifiziert.

## Verbleibende Umsetzung und Abnahme

1. Cloud-GM schließt den konkreten Hostblock und prüft den oben beschriebenen gemeinsamen Nutzerweg.
2. Stadt behebt neue tatsächliche Citybefunde im bestehenden Paket.
3. Physische und breite Recoveryabnahme nach dem Fachvertrag bleiben eigenständige offene Grenzen.

DOM-/Repository-/Modellreopen-Belege sind keine GPU-, native GUI-/Prozess-,
Gesamt-E2E- oder Paritätsfreigabe. Kein Eingriff in #80-H01-Belege.

## Tatsächliche Hostprobe

`tools/host/city-building-name.cjs` ergänzt den bestehenden isolierten Harness
über `node tools/host-test.cjs --city-building-name` und separat `--restart`.
Eigenes `DUNGEON_QA_ROOT`, eigener Debugport und synthetischer Source-Vault;
Produktstand 0315b13, kein Nutzervault. Fixture-Entry/Citynavigation sind Bootstrap,
Hausklick läuft anschließend ohne gepinnten Hit durch tatsächliche Szene/Picking.
Haus B wird außerhalb seines Hofs selektiert. Invalider Name + Escape bleibt
sichtbar, korrigierter Unicode-/LF-/Tabtext + Escape wird genau übernommen;
Undo/Redo, cached Rückkehr/Zur Karte, Save mit vollständiger City-/Fremdbyteprüfung.
Zweiter Prozess prüft gespeicherte Hashes, echte Hausauswahl, Namensfeld, alle
Citydaten und leere frische History. Der bestehende Harness protokolliert Build,
Screenshots und normales Quit; physische und unabhängige GM-Abnahme bleiben offen.

Enger unabhängiger Inspector-R02 auf0315b13 ist PASS; Exact-SHA-CI38100640175
SUCCESS. Kein Pflichtbefund im UI-Diff. Atlas-QA hat seinen gleichzeitigen Scope
zugunsten des bestehenden Reviewers zurückgegeben, keine doppelte Abschlussrunde.
Erster tatsächlicher Versuch scheiterte vor Mutation: Bei Cityentry1m/px lag
der Hauspunkt(7,9) im Ortsmarkergriff; Orts-Key statt Haus-Key. FehlerPNG und
Lifecycle unter eigenem QA-Root erhalten, Prozess normal beendet/Exit0, keine
Zwangs-PIDs. Prüfer ergänzt sichtbaren Ctrl+Wheel-Zoom0.1m/px vor Picking.
Neue konkrete Hex-Slotfreigabe konsumiert: korrigierte tatsächliche Editprobe
3/3 PASS, separater frischer Obsidianprozess1/1 PASS. Produktcode bytegleich0315b13;
Tatsächliche saubere Buildsource laut beiden Original-build.json:
`a12b609d688a51c5139cfbe1b8073829a3254f02`. `8d1d804` bleibt die frühere äquivalente
Prüferimplementierung; zwischen beiden Quellen nur eigene Checkpoint-/Acceptanceänderungen. Exakter Unicode-/LF-/Tabname, InvalidEscape, tatsächliches
Picking, cached Hausrückkehr/Zur Karte, gleiche History/Repository/Kamera/Context,
Undo/Redo und native Savebytes mit erhaltenen fremden Fixturebytes geprüft.
Frischer Prozess erhält sichtbaren Namen und vollständige Citydaten bei History0.
Beide requestedNormalQuit/normalExitObserved=true, forcedTerminationPids=[] und
AppdiensteExit0. Slot ausdrücklich anHex zurückgegeben, keine GUI mehr aktiv.

[H01-Receipt](../../reference/city-building-name-h01/receipt.json) bindet Rohresultate,
Buildtripel, Lifecycle, gespeicherte Baseline und Screenshots mit SHA-256. Auch
FehlerPNG/Resultat/Lifecycle des ersten Versuchs bleiben versioniert. Das ist eine
enge native Producerqualifikation mit synthetischer Eingabe; unabhängige GM-,
physische-, Recovery- und Gesamtparitätsfreigabe bleiben offen.

S01-01 korrigiert die Buildquellenangabe anhand der unveränderten Originale.
PR93 ist separat auf Shared `5c09e96` integriert; dies schließt keine offene
GM-/Recovery-/physische Abnahme. Rohdateien, ihre Hashbindungen und Produktcode
bleiben unverändert.

## Direkter Save und City-Rollback (#92)

Ein noch offener Hausname plus direkter sichtbarer Save scheiterte bereits vor
Publish mit „Native Atlas-Erfassung ist veraltet“. Die Namensübernahme startet
asynchron die bestehende Entwurfssicherung; Save erfasste parallel deren sich
ändernden Repositoryepoch. Der gemeinsame Saveconsumer wartet jetzt nach
Keyübernahme auf diese Sicherung und prüft anschließend den Context erneut.
Keine neue Queue, History oder Persistenz und kein automatischer Retry.

Neue gezielte DOM-/Vaultadapterregression: nach gelungenem Citywrite injizierter
Campaignmanifest-CAS-Fehler; ursprüngliche native Bytes vollständig zurückgerollt,
exakter Name/Geometrie/IDs und eine Historywirkung im selben Repository/Context
für Retry erhalten. Zweiter sichtbarer Save speichert ohne zusätzliche History;
frisches Hostmodell öffnet die exakten Citybytes mit History0. Vor Fix FAIL,
danach PASS. Das erweitert den früheren H01-Beleg nicht auf diesen neuen Saveweg.
Unabhängiger Save-R03 ist PASS (PR98/6104396047); der unveränderte
Kandidat ist auf Shared73bfe22 unabhängig integriert. Die folgende H02-Probe qualifiziert den
kontrollierten nativen direkten Save-/Fehlerweg; freie GM-, physische und breite Recoveryabnahme bleiben erhalten.
S01-01 ist auf Shared0bebb85 unabhängig integriert und geschlossen.

Der vorhandene isolierte Hostprüfer bietet dafür `--city-building-name-rollback`
und separat denselben Schalter mit `--restart`. Er tippt den exakten Namen
ins sichtbare Feld und klickt direkt Save; erst nach dem tatsächlichen Citywrite
wird einmal der Campaignmanifest-CAS im Testvault abgewiesen. Alle ursprünglichen
Nativebytes und Journalbereinigung, genau eine erhaltene Historywirkung, Kamera,
Context und sichtbarer Text werden geprüft. Der sichtbare Retry speichert die
exakten Citydaten, der zweite Prozess verwendet deren Hashbaseline. Die
Faultinjektion wird auch bei Prüferfehler zurückgenommen. H01 bleibt unverändert.
Neue konkrete Hex-Slotantwort konsumiert: Edit2/Fresh1 PASS auf sauberer
Prüfer-/Buildquelle1afac1d, Produktcode bytegleich Shared73bfe22. Beide Prozesse
normal beendet (Exit0), keine erzwungenen PIDs; Slot ausdrücklich zurückgegeben.
[H02-Rohquittung](../../reference/city-building-name-h02/receipt.json) bindet
Originalresultate, Builds, Lifecycle, Fehlzustand/Retry/Freshbilder und ganze
Citybaseline. Sichtbarer Fehltext und exakter Name sind in den Bildern erkennbar.
Enger unabhängiger [H02-R01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/101#issuecomment-6104511968) ist PASS und [Stewardintegration](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/101#issuecomment-6104557821) abgeschlossen; kein physischer oder
breiter Recoverypass. Cloud-GM repariert seinen Host vor dem freien gemeinsamen
#92-/N03-Ablauf; Hex bleibt Owner der #80-Konsequenzen.
