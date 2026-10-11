# Gebäudenamen im gemeinsamen Atlas bearbeiten

Nutzerweg: vorhandenes Haus auswählen → Namen exakt bearbeiten → gemeinsames
Undo/Redo → Save → frischer Prozess erhält Namen und Hausgeometrie.
[#92](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92)
gehört zur individuellen Hauskorrektur in CITY-01/CITY-04. Volle Stadtparität und
bessere Bedienung bleiben der Gesamtumfang; dieser Weg ist keine Gesamtfreigabe.

## Arbeitsstand #92

Der Hausnamen-Inspector ist im Sharedbranch `active/installed-phase1` integriert:
[PR93](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/93),
direkter Save [PR98](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/98),
Notify-Reparatur [PR106](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/106)
und Fokuskorrektur [PR117](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/117).
Kein weiterer allgemeiner Inspector-, Save-, History- oder DOMreview steht aus.

**Tatsächlicher Nutzerweg:** [Cloud-GM6105037427](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92#issuecomment-6105037427)
bestand auf installiertem `a4f20a5`: zweimal Übernehmen → Undo/Redo bei offenem
Inspector → direkter Save → Zur Karte → Torheim öffnen → Namen wiederfinden.
Das schließt den nach In-App-Reload reproduzierten Save-Kollisionsbefund im
getesteten Weg. Der Notifyfix pinnt Empfänger vor dem Render; ein neu erzeugter
Draft erhält nicht rückwirkend das abgeschlossene Ereignis. Fünf gezielte
Regressionsfälle sind geprüft; frühere Befunde bleiben unten nachvollziehbar.

**Fresh-Process und Tastatur:** [Cloud-GM6105664357](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92#issuecomment-6105664357)
belegt nach Schließen des alten Obsidianprozesses einen neuen Prozess auf
`eaf6bd95564ab398eabe9b2c0ac046feec079f0f`: gespeicherten Namen suchen,
Haus öffnen, erneut bearbeiten und über die Toolbar dauerhaft speichern.
Der getrennte Tastaturlauf auf `a4c2cb39aafdfb7abf5469e575a82e630ef41313`
zeigt Übernehmen/Verwerfen per Enter, Fokus am neu gerenderten jeweiligen Button
und nächstes Tab zum Inspector-Save. Verwerfen erhält den übernommenen Namen.
Hier wurde nicht gespeichert; Cloud-Eingaben sind synthetisch.

[Dauerhafte Bilder und Manifeste aus PR120](../../reference/gm-city-postsave-reopen-20261011/README.md)
auf Beleghead `1262cbf7f4994626fc6ccc459550ea6e7aceb209`: Stadt hat alle acht
SHA-256-Bindungen und Bilder selbst geprüft. Cityfixturehash stimmt. Der Tester
meldet allein `buildings[1].name` verändert, IDs/Geometrie samt Hof und fremde
räumliche Dateien erhalten, Campaignrevision/Digests aktualisiert.
Volle After-Save-Payloads fehlen im Paket; deren semantischer Vergleich bleibt
Testerbeleg. Kein Launcher-Exitcode belegt. PR120/PR121 sind regulär integriert.

**Erhaltene technische Belege:** [Fokus-R01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/117#issuecomment-6105537557)
PASS auf `14729dc`; [Integration](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/117#issuecomment-6105543027)
auf `a4c2cb3`, Exact-CI38112395045/Shared-Struktur38112524672 SUCCESS.
Drei Managed-DOM-Fokusgegenproben FAIL vor/PASS nach Fix, 1016PASS/0FAIL/1Skip;
Typ/Build/Repo/Diff PASS. H01 bleibt an Produkt0315b13/Builda12b609 gebunden,
H02 an Produkt73bfe22/Build1afac1d. Originalreceipts bleiben unverändert.

**Aktueller IME-Save-Befund:** Strg/Cmd+S während laufender Textkomposition
veröffentlichte den noch unbestätigten Gebäudenamen. Der City-Shortcut prüft jetzt
wie Escape `isComposing`, ohne die IME-Taste umzulenken. Zwei tatsächliche
Managed-/Vaultadaptergegenfälle FAIL vor/PASS nach Fix: Nameingabe bleibt am selben
Feld, keine History-/Dateiänderung; derselbe Shortcut nach Kompositionsende speichert
den Namen mit genau einer Historywirkung. Nur City-Inspector geändert, kein neuer
Save-/Historyvertrag. Typ/Build/Repo/Diff PASS; Vollsuite1019PASS/0FAIL/1bestehenderSkip.
PR124 ist nach engem unabhängigen Review integriert (Shared `10defd5`).
Ein nativer IME-Nachtest ist damit noch nicht belegt.

**Nächste Arbeit und Grenzen:** Nur direkter Save mit fokussiertem Namenfeld
hat noch keinen sichtbaren nativen Fokusnachtest; Managed-DOM ist geprüft.
Fresh-Process und Apply/Discard brauchen keine unveränderte Wiederholung.
Weitere konkrete Citybedarfe oder unabhängige Projektarbeit können fortgesetzt
werden. Physische Bedienung, breite Recovery und volle Stadtparität bleiben offen;
dieser Weg ersetzt keine Gesamt-E2E-/Originalabnahme.

## Arbeitsstand #127

Stadt liefert den sichtbaren Consumer zum vorhandenen `set-building-pose`:
Haus im gemeinsamen Atlas auswählen → 90° links/rechts drehen → Undo/Redo →
nativer Save → neue Modellinstanz erhält Pose. CITY01/03-Hauskorrektur;
kein neuer Kamera-, History-, City- oder Persistenzvertrag.
[Issue127](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/127).
Hex bestätigt keinen kollidierenden City-Claim; seine Orts-/Raumarbeit bleibt
eigenständig. PR128 ist unabhängig geprüft und auf Shared25e6155 integriert.
Der automatisierte native H01 auf Sourceee9c70d/Build94461124 zeigt Auswahl,
Dirty-Name-Grenze, Links/Rechts/UndoRedo/Save und separaten frischen Prozess;
beide Prozesse normal beendet. [PR130](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/130)
bindet die Originalbelege. Dieser Lauf fand zugleich den UX-Fehler: Der Zahlenanker
blieb gleich, aber das Hofhaus wanderte beim Vierteldrehen um 8m/80px. Kein freier
GM-PASS; dessen Cloud-Start scheiterte vor UI an vollem Docker-Speicher.

**Aktuelle Reparatur:** Branch `city/building-center-rotation-20261011` auf
Sharedb12b3a9 erhält die Grundrissmitte in Stadtmetern. Inspector und bestehendes
Dreh-/Skalierwerkzeug verwenden dieselbe bisherige Mittelpunktberechnung.
Der Eckanker `position` wird passend versetzt; Rotation, Grundriss samt Hof,
Skalierung, Kennungen und Plot-/Dungeonbindung bleiben fachlich erhalten.
Zwei Weltgeometrie-Gegenproben für Haus105 und106 FAIL vor/PASS nach Fix:
jeder Außen-/Hofpunkt dreht um die ursprüngliche Mitte. Derselbe Managed-/Vaultweg
prüft genau eine Historywirkung, Undo/Redo, exakte Savebytes, fremde Dateien,
Kamera und neue Repository-/Modellinstanz. Bestehende Dirty-Name-/Stale- und
CityGesture-Präzisions-/Skalierfälle bestehen. Vollsuite1084PASS/0FAIL/1Skip,
Typ/Build/Repo/Diff PASS. Planner-Refresh ist separat über PR131 integriert;
dessen native Speicherentscheidung bleibt in #69 offen.

**Konsumierter Anschluss:** Enger R01 auf8a29f9d und Exact-CI38119032938 PASS;
PR132 ist regulär auf Shared25792fb integriert. Der frisch koordinierte native
[H02](../../reference/city-building-rotation-h02/receipt.json) auf sauberer
QA-Source92e4b82/Build08537145 verwendet denselben Produktpfad. Sichtbare
Haus106-Auswahl, Dirty-Name-Grenze, Vierteldrehungen, UndoRedo und Save PASS;
separater frischer Obsidianprozess zeigt dieselbe gespeicherte Mittelpunktpose.
Before/right/fresh-Bilder selbst gelesen: Mitte bleibt bei etwa832/716px.
Beide app.quit normal, ExitStatus0, keine Zwangstermination; Slot zurückgegeben.
Sechs fremde räumliche Fixturedateien unverändert. Die gesamte Campaign wird
gegen ihre Eingangsstruktur geprüft, außer erlaubten City-/Registrydigest- und
Revisionfeldern; Citypayload-/Filedigest sind an tatsächliche Citybytes gebunden.
Die Ableitung der übrigen Revision-/Digestwerte wird nicht unabhängig recomputiert.

**H01-Belegkorrektur CITY127-H01-R01-01:** Der alte Oracletext „every foreign
fixture byte“ war zu breit: Nach Save wurden nur sechs fremde räumliche Dateien
geprüft, die Campaign lediglich als neue Baseline aufgenommen. H01-Originale bleiben
unverändert; daraus folgt kein Campaign-Erhaltungspass. H02 enthält den reparierten
Oracle und einen neuen Lauf auf dem Mittelpunktprodukt. Enger H02-/Helperreview
bleibt offen. Kein freier GM-/physischer-/Haus105-nativer-/voller Paritätspass.
Jede neue GUI benötigt frische Slotabstimmung.

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

1. Notify-/City-Review und gezielter Cloud-GM-Save-Nachtest konsumiert.
2. Post-Save-Fresh und sichtbares Apply/Discard konsumiert; direkter-Save-Fokusfall nativ offen.
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

## Verlauf der Notify- und Fokusreparatur

Die folgende Chronologie bewahrt Quellen und frühere Befunde; für die nächste
Arbeit gilt der kompakte Arbeitsstand oben.

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

**Aktueller Befund und Korrektur:** Der [freie Cloud-GM-Lauf](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92#issuecomment-6104735161)
ist nach eigener Hostreparatur partial: Cityname/Undo/Redo/Save/Wiederverwendung
auf 1d8c7ffc bestanden, nach In-App-Reload auf cf8d3c1 Save-Kollision reproduziert.
N03-Beobachtungen bleiben an ihre jeweilige Quelle gebunden und bei Hex.

Stadt reproduziert die Kollision ohne GPU über den echten Managed-Mount und
native Vaultadapter: Name speichern → Modell neu öffnen → Hausname übernehmen →
Undo/Redo bei offenem Inspector → neuen Namen direkt speichern. Vor Fix dieselbe
CityDraft-Fehlermeldung; nach Fix erfolgreich. AtlasHistory.notify pinnt seine
Empfänger zu Beginn. Ein beim Rendern des bereits übernommenen Zustands erzeugter
Draft erhält nicht mehr rückwirkend das gerade abgeschlossene Ereignis; inzwischen
abgemeldete Listener werden ausgelassen. Bestehender ABA-/Stale-/Contextschutz bleibt.
Fünf City-Inspectorfälle PASS; exakte Citybytes, fremde Dateien, Kamera, zwei
Historyschritte und entfernte Draft-/Journaldateien geprüft.

**Korrektur konsumiert:** [PR106-Review](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/106#issuecomment-6104780165)
ist unabhängig PASS; Integration auf Shared `a4f20a553060ec84941b97cbb71bd105d5ca5a62`
[bestätigt](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/106#issuecomment-6104784418).
Der [gezielte Cloud-GM-Nachtest](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92#issuecomment-6105037427)
besteht auf diesem installierten Build: zweimal Hausname übernehmen → Undo/Redo
bei offenem Inspector → direkter Inspector-Save → Zur Karte → Torheim öffnen
und gespeicherten Namen in der Suche wiederfinden. Nur Haus106-Name verändert;
Geometrie, Atlas, Terrain, Dungeon und Orte erhalten. Campaign-Digests aktualisiert.
Dies schließt den konkret reproduzierten Save-Kollisionsbefund im getesteten Weg.

**Post-Save-Fresh und Tastatur konsumiert:** Der [neue Cloud-GM-Bericht](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92#issuecomment-6105664357)
belegt auf sauberem installierten `eaf6bd95564ab398eabe9b2c0ac046feec079f0f`
einen neuen Obsidianprozess nach Schließen des alten Prozesses: gespeicherten
Hausnamen in der Suche wiederfinden, Haus öffnen, Namen erneut bearbeiten und
über die Toolbar dauerhaft speichern. Das schließt die bisher fehlende
Fresh-Process-Grenze des korrigierten Notifywegs im getesteten Ablauf.
Der Tester meldet allein `buildings[1].name` als Cityänderung; IDs/Geometrie samt
Hof und fremde räumliche Dateien erhalten, Campaignrevision/Digests aktualisiert.

[PR120](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/120)
archiviert den Bericht, Build-/Dateimanifeste und acht Bilder auf
`1262cbf7f4994626fc6ccc459550ea6e7aceb209`. Stadt hat alle acht SHA-256-Bindungen
und Bilder selbst geprüft: Suche/Inspector enthalten den gespeicherten Namen,
der zweite Save zeigt „Gespeichert“. Vollständige After-Save-Dateien fehlen im
Paket; der semantische Vergleich bleibt Testerbeleg. Prozesswechsel ist gemeldet,
kein Launcher-Exitcode belegt. Ältere H01/H02-Originale bleiben unverändert.

Der getrennte Tastaturlauf auf installiertem Shared
`a4c2cb39aafdfb7abf5469e575a82e630ef41313` zeigt Übernehmen/Verwerfen per Enter,
Fokus auf dem jeweils neu gerenderten Button und nächstes Tab zum Inspector-Save.
Verwerfen erhält den zuvor übernommenen Namen. Hier wurde nicht gespeichert;
die drei unveränderten City-/Atlas-/Campaignhashes sind Testerbeleg.
Synthetische Cloud-Eingabe bleibt von physischer Bedienung getrennt.
Direkter Save mit fokussiertem Namenfeld ist weiterhin nur Managed-DOM-geprüft;
dessen sichtbarer Fokusnachtest, breite Recovery und volle Stadtparität bleiben offen.

**Aktueller Tastaturanschluss:** Beim Übernehmen/Verwerfen ersetzte der
Inspector den fokussierten Button; direkter Save konnte das fokussierte
Namenfeld ersetzen. Drei Managed-DOM-Gegenproben verlieren vor der Korrektur
den Fokus an die abgetrennten Controls. Der integrierte Fix aus
[PR117](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/117) stellt ihn nach erfolgreichem Render nur
am entsprechenden Control desselben Hauses und derselben CitySource wieder
her, ohne Scrollsprung oder Fokusübernahme aus Karte/Toolbar. Alte Buttons
können weiterhin weder veröffentlichen noch Fokus umlenken. Drei Gegenproben
bestehen nach Fix; vorhandene Guards, Fachaktion und Persistenz bleiben erhalten.
[Unabhängiger enger R01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/117#issuecomment-6105537557)
ist auf `14729dc` PASS; [reguläre Stewardintegration](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/117#issuecomment-6105543027)
auf Shared `a4c2cb39aafdfb7abf5469e575a82e630ef41313` bestätigt.
Exact-CI `38112395045` und Shared-Struktur `38112524672` sind SUCCESS.
Die sichtbaren Apply-/Discard-Tastaturwege sind durch den oben gebundenen
Cloud-Bericht geprüft. Nur der direkte-Save-Fokusfall hat noch keinen nativen
Nachtest. Kein neuer DOM-, History- oder allgemeiner Save-Reviewauftrag.
