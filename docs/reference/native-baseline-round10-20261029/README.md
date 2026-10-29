# Native Regressionsgrundlage, Runde 10, 29.10.2026

Status: Ausgangskatalog und gebundener Schlusslauf vollständig erfasst. Transparenter Zwischenstand mit 80 roten Fällen; offene und instabile Ursachen verhindern eine vollständige Qualifikation.
Owner: project
Last Reviewed: 2026-10-29
Source of Truth: Aufrufkatalog in `tools/native-probes.mjs`, gebundene lokale Rohbelege je Lauf.

Der aktuelle Bestand wird aus `nativeProbeInventory()` abgeleitet, nicht aus der
historischen Zahl 80. 165 Einstiegsskripte teilen sich in 161 Produktsitzungen,
zwei Adapter (Entwicklung/Paketupdate), einen Orchestrator und einen historischen
Relief-R0-Prototyp. `node tools/native-probes.mjs --scenarios` ergänzt ausdrücklich
geprüfte CLI- und Umgebungsvarianten. Ausgabe-/Resumeparameter, historische
Vorher-/Layoutmodi und Referenzneuerzeugung sind keine normalen Produktszenarien.

Die Varianten sind nach ihrem Codezweig eingeordnet: `--cue`, `--handout`,
`--regions`, Kampf-/Verfolgungszustände, Wiederherstellungsfälle und
Gelände-/Bewuchsmodi besitzen eigene Aufrufe. `--unlink` schließt den verschachtelten
Notizfall bereits ein; `--assert-layout --reply-loss` prüft den Antwortverlust
zusätzlich mit Layoutassertionen. `--final` ändert bei `note-source-recovery` nur
den Belegordner. `--preview-only` ist der verkürzte erste Teil der vollständigen
Geländepinselprobe und deckt keinen zusätzlichen Produktzweig ab. `--out`,
`--resume`, `--reopen-from` und `--baseline-proof` wählen Ausgaben oder vorhandene
Diagnosebestände. `--before`, `--baseline`, `--layout-before`, `--layout-baseline`
und `--legacy-navigation` gehören zu historischen Gegenläufen.
`--refresh-reference` erzeugt eine Bildreferenz und ist keine Qualifikation gegen
diese Referenz. `--software-gpu` und `ATLAS_PACKAGE` wählen Laufzeitumgebungen;
die Ausgangsserie bindet den aktuellen Desktop auf dem dokumentierten X11-Host.
Paketupdates bleiben die drei ausdrücklich beschriebenen Adapterfälle.

Die Ausgangsserie enthält außerdem zwei absichtlich rote Detektorgegenfälle:
`campaign-transfer-visit --fail-import-atlas` muss die injizierte fehlende
Importnutzbarkeit erkennen, `atlas-terrain-stroke --recovery-only --drop-followup`
die absichtlich unterdrückte Folgegeste. Die erste Katalogfassung hat diese beiden
fälschlich als gewöhnliche positive Sitzungsvarianten eingeordnet. Ihre rohen roten
Ausgänge bleiben erhalten und werden als kontrollierte Fehlerinjektionen erklärt;
sie beweisen keinen unbeabsichtigten Produktfehler.

Der bestehende Baseline-Einstieg besitzt mit `--all` einen vollständigen seriellen
Modus. Jeder Aufruf läuft unter einem eigenen `ui-session.py`-Besitzer und
Belegordner. Fachfehler dürfen die unabhängige nächste Probe erreichen. Eine
verbleibende eigene PID oder geänderte Quellen/Runtimeartefakte stoppt die Serie;
verbleibende Aufrufe erhalten ausdrücklich `not-run`. Ein fehlender oder roter
Vorgänger wird nicht durch alte Ergebnisdateien ersetzt. Der kleine dreiteilige
Basissatz ohne `--all` behält seinen bisherigen eigenen Prüfzweck.

## Gebundener Ausgangslauf

Vorbereitung im aktuellen Checkout:

```sh
npm run build:desktop
npm run package:desktop -- .build/native-baseline-round10-package
QA_EVIDENCE_DIR=.build/native-baseline-round10-full-20261029 npm run verify:local -- node tools/test-desktop-baseline.mjs --all --package=.build/native-baseline-round10-package
```

Die Paketvorbereitung baut einmal denselben aktuellen Desktop. Drei unterschiedliche
Updatefälle verwenden diese private Testinstallation: Startseite, offener Workspace,
erzwungener Workspaceabschluss. Synthetisch signierte Testversionen sind keine
veröffentlichte oder produktiv installierte SaltMarcher-Version.

Ausgang: `fa2c3eb50af9b8970235f75b2d9c7b05e99602c9`, dirty. Node 22.19.0,
Linux x64, X11 auf `:0`, Plattformwahl `default`, Browserzoom ausschließlich 1.
Die tatsächliche Kernelversion und Cgroup stehen in `binding.json`; der äußere
Ressourcenrahmen verwendet `delegated-2G-3G`. Der Quellenfingerprint
`248be47bcfbc82fe7750fa98887aa5f334650a5680d3c38551857b6c1d7ecc2e`
bindet `src/`, `desktop/`, `tools/`, `tests/`, `resources/`, Paket-/Build- und
TypeScriptkonfigurationen. Vor und nach jedem Aufruf müssen alle gebundenen
Quelldateien und zwanzig Desktopartefakte identisch sein. Dokumentation ist kein
Runtimeinput dieses Fingerprints. Der Runner bewahrt vollständige Einzelhashes.

Zusätzlich bewahrt `sources.tar.gz` im lokalen Belegordner 2.078 tatsächlich
hashgeprüfte Quelldateien; `sources-archive.json` bindet das Archiv an denselben
Quellenfingerprint. So bleibt der Dirty-Ausgang nach späteren Änderungen
rekonstruierbar. Das separate Linuxpaket bewahrt die gebaute Laufzeit.

Die große kontinuierliche Welt wird einmal entpackt und per SHA-256 gebunden.
Die einzelnen Szenarien kopieren sie weiterhin in ihre eigenen Profile. Der
Katalog umfasst mit den drei Paketfällen **218 Aufrufe**. Historische Reliefdemo
und der Vergleich gegen eine ausdrücklich gespeicherte frühere ausgelieferte CSS
sind separat `not-run`; ein Vergleich aktueller CSS gegen sich selbst wäre kein
Ersatz für diesen früheren Referenzstand.

Lokale Rohbelege: `.build/native-baseline-round10-full-20261029/`, darin
`binding.json`, fortgeschriebener `report.json` und je Szenario `run.log` sowie die
unveränderten Fach-/Sitzungsbelege. Diese ignorierten Dateien sind nicht automatisch
außerhalb dieser Arbeitskopie verfügbar. Der vorgeschaltete, ausdrücklich
unterbrochene Pilot unter `.build/native-baseline-round10-before-20261029/`
bleibt erhalten und zählt nicht als vollständiger Ausgangslauf.

## Unterbrechung und gebundene Fortsetzung

Der ursprüngliche äußere Ressourcenlauf endete nach 87 abgeschlossenen Aufrufen
während E2E-01 mit `SIGKILL`. Sein unveränderter `report.json` bleibt erhalten;
`postmortem.json` ergänzt 45 rohe grüne, 42 rote, einen unterbrochenen und 130
nicht ausgeführte Aufrufe. Zwei rohe grüne Geländewiederherstellungsfälle besitzen
keinen vollständigen gemeinsamen Abschlussbeleg und gelten deshalb nicht als
technisch qualifiziert. Zwei rote Aufrufe sind die oben genannten absichtlichen
Fehlerinjektionen. Die Zahlen sind kein Produktabnahmeergebnis.

Der Ressourcenbeleg bestätigt die Entfernung der eigenen Cgroup und die
Nachbereinigung ihrer Nachkommen. Alle 90 registrierten Ausgangs-PIDs sind
abwesend. Der beobachtete Spitzenverbrauch von 2.156.269.568 Byte und die
verfügbaren Systembelege beweisen keine OOM-Ursache; der Ursprung des
`SIGKILL` bleibt offen. Quellen und zwanzig Runtimeartefakte wurden danach erneut
gegen die ursprüngliche Bindung geprüft und sind unverändert.

E2E-01 wurde separat unter
`.build/native-baseline-round10-e2e01-retry-20261029/` am identischen Stand
vollständig erfolgreich wiederholt. `completion-audit.json` bestätigt den
strengen Abschlusscheck, PID-Abwesenheit, Cgroupentfernung und erneut identische
Quellen/Artefakte. Die 130 übrigen Aufrufe verwenden
`.build/native-baseline-round10-continuation-20261029/`; die 22 darin enthaltenen
Fälle aus der historischen ungeklärten Liste werden zuerst ausgeführt. Die
bestehende Abhängigkeitskette bleibt in ihrer Reihenfolge erhalten. Ein separat gehashter
äußerer Supervisor bleibt außerhalb des Ressourcenrahmens jeder einzelnen Probe.
Er verwendet unverändert `runLocalCheck()` mit 2/3 GiB und `ui-session.py`, prüft
Quellen und Build vor und nach jedem Aufruf und bewahrt dessen Ressourcen- und
Prozessbeleg. Fachfehler setzen unabhängige Aufrufe fort; ungeklärter Besitz
stoppt die Fortsetzung. Ein technischer Gegenfall ohne Electron tötet den
eigenen begrenzten Befehl mit `SIGKILL`; der äußere Ressourcenbesitzer bewahrt
anschließend den Signalbeleg und bestätigt die Nachbereinigung und Entfernung
der Cgroup (`.build/native-baseline-round10-resource-kill-negative/`). Das prüft
diese technische Fehlergrenze, keine Produktfunktion.
Diese Controlleränderung ist ausdrücklich separat
gebunden und macht den ursprünglich unterbrochenen Bericht nicht nachträglich
zu einem abgeschlossenen Lauf.

## Korrekturen nach dem Ausgangslauf

Der vollständige Ausgangskatalog enthält **104 technisch grüne, 105 rote,
zwei technisch blockierte und sieben nicht ausgeführte Aufrufe**.
[initial-results.json](initial-results.json) bewahrt jeden Status mit Quellenbindung
und Belegordner. Die fünf abhängigen Notizfälle konnten ihren roten Vorgänger
nicht ersetzen; Reliefprototyp und historischer CSS-Vergleich sind die beiden
separaten Sonderfälle. Die 26 historischen offenen Fälle wurden alle versucht:
drei grün, 23 rot. Das ist keine Aussage historischer Regressionsfreiheit.

Das Abschlussaudit der Fortsetzung bestätigt alle 123 entfernten eigenen
Ressourcengruppen, abwesende Wrapper-PIDs und unveränderte Quellen/Artefakte.
Die 60 dort technisch grünen Sitzungsbelege bestehen zusätzlich den
nachgelagerten Artefakt-/Exit-/Renderer-/Captureaudit. Der fachlich leere
Aufruf `--city-only --raised-floor` bleibt im Ausgang sichtbar, ist aber aus dem
aktuellen Katalog entfernt und wird bei manuellem Aufruf vor einem Start
abgewiesen. Der aktuelle Aufrufkatalog besitzt mit den drei Paketfällen 217
Positionen: 210 Sitzungspositionen (einschließlich des mangels früherer CSS ausdrücklich nicht ausgeführten Vergleichs), vier Adapteraufrufe, zwei Detektorgegenfälle und ein historischer Prototyp. Der Marsh-Bibliotheksfall verwendet jetzt den tatsächlich benötigten
Aufruf `--library --marsh-only`.

Der übernommene Seriencontroller verlangt vollständige gemeinsame Abschlussbelege,
normal beendete Renderer, frische PNGs mit passenden Abmessungen/Hashes und die
exakte Laufzeitbindung. Zwei absichtliche Fehlerinjektionen erhalten nur bei ihrem
exakten erwarteten Fehler und vollständiger Bereinigung den Status `detected`.
Dieser Status ist kein positiver Produktfall. Ein gültiger leerer innerer
PID-Beleg ersetzt keinen fehlenden Ressourcenbeleg. Acht tatsächliche
Linux/Python-Negativproben prüfen unabhängige Fachfehler, Quellenänderung,
getöteten inneren Besitzer, fehlenden Ressourcenbeleg, unregistrierten Prozessbesitz, fehlerhafte Vorbereitung,
unzulässigen äußeren Ressourcenrahmen und Supervisorabbruch. Sie starten kein
Electron (`.build/native-baseline-round10-controller-eight-negatives-20261029/`).
Der äußere Supervisor muss direkt mit Node laufen; jede einzelne Probe erhält
den bestehenden eigenen 2/3-GiB-Ressourcenrahmen.

Die Referenzwelt wurde mit dem offiziellen Generator neu erzeugt. 1.024
Vegetationspresets erhalten fehlende aktuelle Pflichtfelder, 8.072
Payloadrevisionen entsprechen wieder den vorhandenen kanonischen Zeilenrevisionen.
Alle 108.076 Landschaftswerte und die vollständige kanonische Backupvalidierung
bestehen. Der alte Bestand bleibt im Ausgangsquellenarchiv erhalten.
[fixture-renewal.json](fixture-renewal.json) bindet Herkunft, Bytes und
die zwei geänderten Tabellen: Landschaftspayloads und den vorhandenen abgeleiteten
`atlas-shape-source`-Zähler. 189 weitere Tabellen bleiben identisch.
Die bisherigen nativen Bildreferenzen sind unverändert unter
[historical-reference-images](historical-reference-images/retention.json)
aufbewahrt. Die neue Serie unter `.build/native-baseline-round10-reference-refresh-third-20261029/`
besteht fünf Maßstäbe, frischen Neustart und PNG-Export bei 100 Prozent. Übersicht
und Raumdetail wurden visuell geprüft. Der normale Bildorakeltest einschließlich
seiner negativen Wasser-/Flachwald-Gegenfälle besteht wieder. Der gewöhnliche
native Vergleich im Schlusskatalog ist ebenfalls vollständig bestanden: fünf Maßstäbe,
frischer Neustart und PNG-Export mit regulären Prozessenden. Die Erzeugung allein
war noch keine Qualifikation.

Die übernommenen Probeänderungen richten belegte alte Bedienannahmen auf die
vorhandene Oberfläche aus: Workspace-/Key-Navigation, explizite Quellenwahl,
aktuelle Materialkanäle und kompakte Fenster bei 100 Prozent. Fachliche
Persistenz-, Bild-, Historien- und Negativassertionen bleiben erhalten.
`launch(2)` bezeichnet in zwei Notizproben die erwartete Quellenanzahl; das sind
keine Zoomargumente. Der verbliebene echte 200-Prozent-Neustart der Encounterprobe
verwendet nun 100 Prozent, die zweite Quellenanzahl im Notiz-Follow-up wieder zwei.

Die getrennt gebundenen Gegenläufe unter
`.build/native-baseline-round10-counters-20261029/` und
`.build/native-baseline-round10-followup-counters-20261029/` bestätigen:

- Perspektivische Auswahl auf der kanonischen Geländehöhe trifft denselben Felsen,
  den die alte lineare Klickhilfe um 11,586 CSS-Pixel verfehlte. Nur diese erste
  Auswahlursache ist damit geprüft.
- Der ursprüngliche erste Höhenzug beginnt bei noch ladender Autorenbasis und
  verändert keine Höhe. Derselbe Zug nach Bereitschaft besteht die unveränderte
  150-Meter-Assertion; spätere Höhenzweige bleiben eigenständige Prüfungen.
- Die Musikbeschreibung wird nach erfolgreichem Autosave durch ein verspätetes
  `change`-Ereignis nochmals identisch verbucht. Die begrenzte Produktkorrektur
  erkennt den bereits bestätigten Inhalt. Drei gezielte Tests sichern verspätete Feldereignisse, Änderungen während einer
  ausstehenden Bestätigung und die ausdrückliche Korrektur eines abgewiesenen Entwurfs.
- Eine verspätete Atlas-Öffnungsaktion verwirft eine neuere Raumauswahl. Zwei
  readonly Gegenläufe binden den zusätzlichen Werkzeugwechsel an den alten
  Öffnungsabschluss. Ein beobachteter Auswahlkontext schützt die neuere Navigation;
  drei gezielte Tests prüfen Überlappung und normales Öffnen.
- Die Audiomessung war am Ausgang instabil: Erstlauf mit RMS null, zwei
  unveränderte vollständige Wiederholungen erfolgreich. Am fertigen gebundenen
  Stand bestehen ebenfalls zwei gezielte Wiederholungen und der Schlusslauf.
  In diesen drei aktuellen Prüfungen trat der Ausreißer nicht erneut auf; die
  ursprüngliche Ursache und eine kausale Reparatur sind damit nicht bewiesen.

Der erste Höhen-Diagnoseentwurf scheiterte an seinem eigenen fehlenden `close`
vor `finish`. Sein roter Beleg bleibt erhalten; erst der separat gebundene,
regulär abgeschlossene Gegenlauf wird für die Ursachenbeobachtung verwendet.
`causes.json` trennt belegte erste Ursachen und noch offene Ursachenprüfungen.
Die Korrekturen sind anschließend im gemeinsamen nativen Schlusslauf am fertigen
Stand geprüft worden. Kein Ergebnis der alten Ausgangsserie wird dafür umetikettiert.

Quellenpfade und Zeilen in `causes.json` gehören zum jeweils gebundenen
Ausgangs- oder Gegenlaufstand. Die archivierten Quellen und Artefaktbindungen
bleiben maßgeblich, wenn sich diese Dateien im aktuellen Checkout geändert haben.

## Gebundener Schlusslauf

Der vollständige Katalog unter
`.build/native-baseline-round10-final-20261029/` schloss am 29.10.2026 von
06:50:51 bis 11:21:31 UTC alle **217 Positionen**: **129 bestanden, 80 fehlgeschlagen,
ein erwarteter Negativfehler erkannt, sieben nicht ausgeführt**. Der Stand
`2005f9ed9906fb9fdbd79a15c325d63e2b29228a8c75ac8761e16c6bd2130865`
ist im verifizierten Archiv
`.build/native-baseline-round10-review-source-20261029/sources.tar.gz`
mit 2.085 Quelldateien bewahrt. Alle zwanzig Artefakte stimmen mit dem privaten
Linuxpaket `.build/native-baseline-round10-review-package/` überein.
[final-results.json](final-results.json) bewahrt jeden konkreten Aufruf und Ausgang.
Quellen und Build blieben während der gesamten Serie eingefroren.
[final-binding-audit.json](final-binding-audit.json) bestätigt nach Abschluss erneut
alle 2.085 Archiv-/Quelldateien und je zwanzig Laufzeit-/Paketartefakte.
Alle drei Paketupdatevarianten sind bestanden. Nicht ausgeführt sind fünf
Notiz-/Quellenfolgen nach dem roten `note-excerpts`-Vorgänger, der historische
Reliefprototyp und der historische CSS-Vergleich ohne bereitgestellte frühere CSS.
Kein alter Beleg ersetzt diese fehlenden aktuellen Qualifikationen.
[current-causes.json](current-causes.json) trennt bereits belegte erste Ursachen
von weiterhin offenen späteren Fehlerstellen: 45 erste Ursachen sind eingeordnet,
35 bleiben offen. Diese 35 Fehlerstellen sind konkret reproduziert, aber nicht
als bereits verstandene Ursachen oder reparierte Fälle ausgewiesen. Die dort ebenfalls bewahrten
Mehrmaßstabsmessungen gehören zu den definierten Skriptabschnitten einschließlich
Vorbereitung und Aufnahme. Lange gemessene Öffnungs-/Ansichtszeiten und das
eigenständige Navigationsziel werden nicht durch einen technisch grünen
Szenarioausgang als erfüllt dargestellt. Der rote Kartografieaufruf benötigte
zwei durch den UI-Wächter beendete eigene Restprozesse: beide sind abwesend, die
Ressourcengruppe ist entfernt und der Besitz geklärt. Ein regulärer Prozessabschluss
wird für diesen Fall ausdrücklich nicht behauptet. Der unabhängige
[final-audit.json](final-audit.json) als Kopie des `posthoc-audit.json` im Rohordner
führt solche technischen Grenzen separat. Alle 210 ausgeführten Fälle besitzen
geklärten Ressourcenbesitz und entfernte eigene Gruppen; ihre 210 Wächter sind
abwesend. Alle 129 positiven Fälle und der erkannte Negativfehler bestehen die
strenge Wiederprüfung. Fehlende frische Bilder/Abschlussbelege, erzwungene
SIGKILL-Enden und die überschriebene NPC-Aufnahme bleiben technische rote Grenzen.
Auch der rote Entwurfs-Overlayfall wurde nach seinem Fachfehler mit `SIGKILL`
beendet. Mehrere weitere rote Belege protokollieren die PID-Abwesenheit ausschließlich im
zugehörigen Bereinigungseintrag. Der Audit verbindet für rote Fehlerbelege nur
vorhandene Einträge mit derselben Electron-PID und demselben Exit, prüft außerdem
die heutige PID-Abwesenheit und bewahrt die Rohdaten unverändert. Dieser technische
Abgleich ist kein fachlicher Erfolg und kein nachträglicher gemeinsamer Abschluss.

Die nativen Zielprüfungen am selben fertigen Stand bestehen beide
Musik-/Stoppvarianten, Ambience-Mix, Audiokopieren und zwei vollständige
Music-Stop-Wiederholungen. Der Raumablauf bestand zuvor mit unverändertem
Atlascode drei reguläre Starts, vollständige Pagination, Textspeicherung und
Wiederaufnahme eines abgewiesenen Entwurfs. Auch diese Abläufe werden im
Schlusskatalog erneut ausgeführt. Der Raumgrundlauf ist bestanden; die Regionsvariante
bleibt beim später versteckten Raumlisten-Zugriff rot. E2E-01 ist im gebundenen Schlusslauf
vollständig bestanden: 19 native Starts, 44 frische Bilder, bestätigter
absichtlicher Absturz, Wiederaufnahme, vollständiger Export und unabhängiger Import.
Der strenge Audit bestätigt Prozess-/Ressourcenabschluss und dieselben Quellen
und zwanzig Artefakte. Das ist kein Ersatz für den Candidate-CI-Aggregatstatus
oder eine Ownerabnahme. Die erste zu breite Musikänderung unterdrückte
irrtümlich die ausdrückliche Korrektur eines abgewiesenen Entwurfs. Ihr roter
nativer Zielbeleg und die exakt hashgeprüften Zwischenquellen bleiben unter
`.build/native-baseline-round10-product-targets-20261029/` erhalten.
Die letzte Fassung belässt explizite Eingaben unverändert; ausschließlich ein
verspätetes identisches `change` nach Bestätigung wird unterdrückt.

Repository-, Format-, alle Typ-/Environment- und Desktopprüfungen bestehen.
Die acht tatsächlichen Controller-Negativproben und die gezielten Node-Prüfungen
bleiben technische Belege. Ein roter späterer Fachzweig wird dadurch nicht grün.
Ein später erreichter Fehler nach einer korrigierten Bedienannahme wird als
neuer aktueller Befund dokumentiert; sein Name allein beweist weder die alte
Ursache noch eine historische Regression.

Der eigene neue Negativkatalog enthält einen belegten Fehler: Er erwartet
`closed-dependent-resumed-once` statt des tatsächlichen
`closed-dependent-resumed-once-without-new-input`. Der unterdrückte Folgezug wird
nativ erkannt und regulär beendet, erhält deshalb dennoch korrekt **failed** im
strengen aktuellen Detektor. Der rein lesende Metadatengegencheck ist belegt;
der eingefrorene Quellstand wurde nicht geändert und das Ergebnis nicht
nachträglich zu `detected` umetikettiert. Die konkrete Bezeichnerkorrektur mit
Literalvertragsprüfung und neuem nativen Gegenlauf ist offen. Ebenfalls offen:
`npc-conversation` erfüllt seine Fachassertionen, überschreibt aber durch einen
wiederholten Aufnahmenamen frühere PNG-Bytes. Der Hashfehler verhindert zurecht
seine Qualifikation.

Die Mehrmaßstabs-Exportprobe ist technisch grün, erreicht mit gemessenem
Navigations-p95 von 1.200,5 ms das separate Ziel von 33,3 ms jedoch nicht. Die
Performancevariante bleibt rot. Die Messintervalle umfassen die jeweiligen
Skriptabschnitte und sind keine isolierte Eingabelatenzmessung.

Der Rohbericht und sein Abschlusslog enthalten alle 217 geschlossenen Positionen.
Die spätere Einsammlung der äußeren Exec-Sitzung meldete dennoch Exit 143; dessen
Ursache ist ungeklärt. Der äußere Supervisor und sämtliche aufgezeichneten Wächter
sind abwesend. [supervisor-postmortem.json](supervisor-postmortem.json) bewahrt diese
Grenze; ein regulärer äußerer Shellabschluss wird ausdrücklich nicht behauptet.

83 tatsächlich geprüfte Abläufe wurden anschließend über `--geprueft` im
Capability-Katalog nachgeführt. Ihre aktuellen Testdateiverknüpfungen existieren;
[capability-maintenance.json](capability-maintenance.json) bindet die inverse
Übersicht. Ein Prüfdatum bezeichnet auch einen roten Versuch und beweist keine
vollständige Fachabdeckung. Der historische Reliefprototyp bleibt ausdrücklich
unzugeordnet zur Prüfung offen.

Der aktuelle Abschlussaudit ist wiederholbar mit
`node docs/reference/native-baseline-round10-20261029/audit-final.mjs .build/native-baseline-round10-final-20261029`.
Er benötigt die bewahrten lokalen Rohordner. Quellenarchive, Paket, PNGs und
Ressourcenbelege liegen lokal unter `.build/`; die eingecheckten Zusammenfassungen
ersetzen diese vollständigen Rohbelege nicht. Es wurde kein Paket installiert,
keine Version veröffentlicht und keine Integration vorgenommen.

## Aussagegrenzen

Die 26 historisch nicht gleichartig belegten roten Fälle bleiben gegenüber dem
alten Vergleich offen. Eine heutige Fehlerursache allein beweist keine historische
Regressionsfreiheit. Historische Belege unter `.build/native-standard-work/`
werden weder überschrieben noch nachträglich als heutiger Gesamtlauf bezeichnet.

Der nachgelagerte `audit.mjs` in diesem Ordner liest ausschließlich vorhandene
grüne Sitzungsbelege, prüft normale Exits/PID-Ende, Rendererfehler, 100 Prozent,
PNG-Hashes und Runtimebindung und schreibt `technical-audit.json` im Rohordner.
Entwicklungs- und Paketadapter behalten ihre ausdrücklich anderen
Generations-/Rendererlog- und Captureformate. Ein nachgelagerter Audit ist
keine zusätzliche Fachassertion und kann einen roten Szenariolauf nicht grün machen.

Die Fachassertionen bleiben erhalten. Kein pauschales längeres Warten, keine
Lockerung von Bildschwellen und keine Umdeutung von `not-run` zu Erfolg.
Regulärer Abschluss, Rendererfehler, Profil-/PIDbesitz und Artefaktstabilität
gehören weiterhin dem gemeinsamen Sitzungsunterbau. Die Candidate-E2E-01-Regeln,
Zielgerätequalifikation und ausdrückliche Ownerabnahme bleiben eigene Aussagen.
