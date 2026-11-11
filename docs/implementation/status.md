# Aktueller Stand

Stand: 11. November 2026. **Vorschauversion 0.3.2 ist als Update für die bereits
installierte 0.3.1 veröffentlicht. Paketbau und kontrollierte Prüfungen von
Updatepfad und Oberfläche sind bestanden.** Der Nutzer hat die manuelle
Erstinstallation von 0.3.1 bestätigt. Die anschließende tatsächliche
Aktualisierung über den Fedora-DNF-/Polkit-Pfad in der App ist noch ungeprüft.
P3.3 „Vorbereitete Gewässer
und Ableitungen“ bleibt der enthaltene Fachstand. Die übergreifende
Höhen-GPU-Abnahme bleibt am zuletzt vollständig geprüften P3.2-Stand FAIL.
Der [Neubauplan](atlas-rebuild-plan.md) bleibt der einzige Ausführungsplan;
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.
Atlas V7 ist der reguläre Einstieg mit Format 22; der optionale
Electron-/Pixi-Editor verwendet Format 27 (`atlas-p3-derived-water-1`).
Frühere P0-Dateien werden nicht migriert.

## Arbeitsentscheidung

Der aktuelle Auftrag ergänzt einen gut erreichbaren GitHub-Testrelease und
einen Updatepfad in der App. Er aktiviert keinen weiteren Neubau-Planschritt
und ist keine Freigabe offener Leistungsnachweise. Der Vorschauworkflow darf
den expliziten Draft-Zweig nach erfolgreichen Paket-/Updaterprüfungen
veröffentlichen; reguläre Releases bleiben getrennt.

Der Auftrag zum nächsten Planschritt setzt die freigegebene begrenzte
R5-Fortsetzung nach P3.2 mit P3.3 fort. Nur dessen benötigte P1/P2-Erweiterungen
sind enthalten. Die formale R4-Auswertung bleibt bestehen; ihre offene
Leistungsabnahme widerruft diese Nutzerentscheidung nicht. Vollständige
P0-Abnahme und bestandener gemeinsamer P3-Fall bleiben Voraussetzungen für P4–P9.

## Vorschau-Release und Updates

Das rollende [GitHub-Prerelease `atlas-preview`](https://github.com/ThonkTank/Salt-Marcher/releases/tag/atlas-preview)
ist mit Version **0.3.2**, Revision **43101913532.1** veröffentlicht.
Geprüfter und veröffentlichter Programmstand ist Commit
[`66f11cb5046182283569941d18bca7b93d7b3a56`](https://github.com/ThonkTank/Salt-Marcher/commit/66f11cb5046182283569941d18bca7b93d7b3a56).
Für diesen Updateversuch wurden die Electron-Paketversion und die beiden
Root-Versionsfelder der Lockdatei von 0.3.1 auf 0.3.2 erhöht. Der
Funktionscode ist gleich geblieben. Eine anschließende Korrektur betrifft nur
die Synchronisation des gepackten Oberflächentests. Die bisherige Version
**0.3.1-43022087971.1** ist laut Nutzerrückmeldung installiert; der neue Feed
wird von derselben Manifestprüfung als neuerer Build akzeptiert.

Sein Produktquellhash (`product-inputs-v1`) lautet:

`faba5c44e5b953ddb4b420b42e136b60c350fab4e96a840c322d417219accecd`

Der [Vorschau-CI-Lauf 43101913532](https://github.com/ThonkTank/Salt-Marcher/actions/runs/43101913532)
ist vollständig **SUCCESS**: sowohl
[Paketbau und Prüfungen](https://github.com/ThonkTank/Salt-Marcher/actions/runs/43101913532/job/130795286576)
als auch
[Veröffentlichung](https://github.com/ThonkTank/Salt-Marcher/actions/runs/43101913532/job/130799977995)
gehören exakt zu diesem Commit. Nachfolgende reine Statuspflege ist kein neuer
Programm- oder Leistungsnachweis.

| Kriterium                                              | Umsetzung                                                                                                                | Nachweis am genannten Stand                                                                                                                                                             | Status                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Einfacher Download des aktuellen Drafts                | Rollendes GitHub-Prerelease mit RPM, ZIP, Manifest und eindeutigen Buildnummern                                          | Erfolgreicher Veröffentlichungsjob; Rückprüfung der veröffentlichten Assets siehe unten                                                                                                 | verifiziert                                             |
| Neue Builds direkt in der App finden und herunterladen | Startup-/manuelle Prüfung, Fortschritt, Größen-/Hashprüfung und passender Vorschaukanal                                  | **35/35** Updaterfälle, **7/7** echte Electron-Netzfälle gegen kontrollierte Prüfserver und **11/11** gepackte Dialog-/IPC-Prüfungen in derselben CI                                    | verifiziert gegen Prüfserver; Liveabruf unten getrennt  |
| Offene Karten vor Installation und Neustart sichern    | Gemeinsame Datei-/Writerbarriere, Speichern/Verwerfen/Abbrechen und unmittelbarer Neustart nach bestätigter Installation | Typprüfung, **25/25** Sessionfälle aus der vorigen Prüfung am unveränderten Sessioncode sowie **35/35** Updaterfälle und **11/11** gepackte UI-/IPC-Prüfungen am veröffentlichten Stand | verifiziert für die geprüften Datei- und Prozessabläufe |
| Nur geprüfte, aktuelle Vorschauen veröffentlichen      | Paketgate, exakter Commit, saubere Buildidentität, beschränkte Schreibrechte und Schutz vor veralteter Veröffentlichung  | **6/6** Releasefälle einschließlich fehlschlagendem CLI bei schmutzigem Build; erfolgreicher Build- und Veröffentlichungsjob                                                            | verifiziert                                             |
| Tatsächliches auslieferbares Linux-Paket               | Forge baut das RPM und die ZIP; Paketinhalt und native SQLite-Bindung werden geprüft                                     | Tatsächliches CI-RPM und **2/2** RPM-Prüfungen sowie normaler Paket-Smoke **95/95 PASS**                                                                                                | verifiziert für Bau und Paketstart                      |
| Systeminstallation auf Fedora                          | DNF/Polkit mit geprüfter Paketidentität, anschließend unmittelbarer Neustart                                             | Echte Fedora-Authentifizierung und Pakettransaktion wurden in dieser Umgebung nicht ausgeführt                                                                                          | umgesetzt, Nachweis offen                               |
| Veröffentlichten Build aus der App abrufen             | Unveränderter Produktionsadapter und normale Updateoberfläche                                                            | Liveversuch am Erstpaket 0.3.1: `net::ERR_EMPTY_RESPONSE`; danach derselbe Feed mit `curl` erfolgreich                                                                                  | in dieser Prüfumgebung blockiert; Ursache offen         |

Die veröffentlichte Release-Metadatenabfrage bestätigt `draft=false` und
`prerelease=true`. Die tatsächliche Git-Referenz des Tags `atlas-preview`
zeigt auf den genannten Programmcommit. Das
[öffentliche Update-Manifest](https://github.com/ThonkTank/Salt-Marcher/releases/download/atlas-preview/atlas-preview.json)
wurde einschließlich der GitHub-Weiterleitung erfolgreich heruntergeladen und
zurückgelesen: Revision und Commit stimmen mit dem geprüften Build überein.
Dateinamen, Download-URLs, Größen und SHA-256-Werte beider Pakete stimmen zwischen
Manifest und den tatsächlich veröffentlichten GitHub-Assets überein.
Die beiden direkten Binärdownload-URLs antworten einschließlich der
GitHub-Weiterleitungen auf einen HTTP-HEAD-Abruf mit Status 200.

Der zusätzliche Liveversuch am Erstpaket **0.3.1-43022087971.1** startete das
gepackte Programm mit isolierten Einstellungen und Cache und bediente die
normale Updateoberfläche. Er verwendete
den unveränderten Produktionsadapter und die bereits konfigurierte Netzwerkroute.
Die Feedprüfung scheiterte mit `net::ERR_EMPTY_RESPONSE`; eine Renderer-Exception
trat nicht auf. Anschließend ließ sich derselbe öffentliche Feed mit `curl`
erfolgreich abrufen. Im selben Electron-44.10.2-Prozess scheiterten auch ein
unabhängiger nativer `net.request`-Aufruf vor jeder ersten Antwort oder
Weiterleitung und `net.fetch` mit Standardverhalten mit demselben Fehler.
Dieser konkrete Fehler tritt damit bereits ohne unseren Adapter und dessen
Weiterleitungsabbruch auf. Seine genauere Ursache wurde nicht festgestellt.
Damit sind die Erkennung des tatsächlich veröffentlichten Builds und dessen
RPM-Download aus der App in dieser Umgebung **nicht nachgewiesen**. Ein
Download- oder Installationsversuch fand in diesem Liveablauf nicht statt.
Die kontrollierten Netzwerk- und UI-Prüfungen ersetzen diesen offenen Nachweis
nicht. Der Bericht und Screenshot liegen unter
`src-tauri/target/diagnostics/preview-live-20261111/`
(`live-summary.json`, `report.json`, `check.png`, `curl-manifest.json`,
`native-controls.json`).

Der erste 0.3.2-[Vorschau-Lauf 43100313542](https://github.com/ThonkTank/Salt-Marcher/actions/runs/43100313542)
blieb **FAIL** und veröffentlichte kein Paket. Typprüfung, 35 Updaterfälle,
6 Releasefälle, 7 native Netzfälle, 2 RPM-Fälle und der normale Paket-Smoke
mit **95/95** Prüfungen bestanden. Der Update-Smoke bestand neun Prüfungen
bis einschließlich der korrekten Ablehnung beschädigter Bytes. Der anschließende
einmalige DOM-Read fand den Prüfsummenfehler noch nicht.
Bis dahin hatte der Prüfer auf den Main-Zustand, nicht auf dessen Darstellung
in React gewartet.
Commit `66f11cb` wartet stattdessen mit derselben inhaltlichen Anforderung und
Playwrights Standard-Timeout auf den sichtbaren Prüfsummenfehler.

Die lokale Kontrolle am sauberen Paket von `66f11cb`, Version 0.3.2,
Testrevision 1.2 und demselben Produktquellhash bestand **11/11**, erkannte
dann einen isolierten Darstellungsfehler und bestand anschließend erneut
**11/11**. Die Negativkontrolle blendete ausschließlich das echte
Statusfeld per CSS aus: Neun vorherige Prüfungen bestanden, die unveränderte
Prüfsummen-Assertion scheiterte nach fünf Sekunden mit Exit 1. Das Paket und
der originale Prüfer blieben über die drei Läufe bytegleich. Diese
kontrollierten Netz-/Oberflächenläufe sind keine Fedora-Systeminstallation.
Die Belege liegen ignoriert unter
`src-tauri/target/diagnostics/preview-update-test/`.

### Grenzen und erkannte Fehler

Ergänzend bestanden lokal **88/88** echte Datei-/Schließprüfungen in einem
früheren, noch uncommitteten Implementierungslauf mit Produktquellhash
`dfbba0ee56cf2162573b9bfb016ebecba24de02a8685702f1e4d0bfcd38a6d1d`.
Dieser Lauf erfolgte vor den letzten Änderungen am Updateneustart. Die regulären
Datei-/Schließpfade blieben anschließend unverändert; der Lauf ist trotzdem
kein Nachweis einer erneuten Ausführung aller 88 Fälle am veröffentlichten
Commit `d589afc`. Der Bericht erhält die damalige Buildidentität und
`dirty=true` unter `src-tauri/target/diagnostics/preview-lifecycle/report.json`.

In der Prüfung wurde ein realer Transportfehler erkannt: Electrons `net.fetch`
lehnt die für GitHub nötige manuelle 302-Weiterleitung ab. Der neue
`net.request`-Adapter erhält Weiterleitungen und prüft jedes Ziel vor dem
nächsten Zugriff. Die sieben echten Electron-Netzfälle prüfen diesen Adapter;
die frühere reine Fetch-Nachbildung hätte den Fehler nicht erkannt.

Der erste [Vorschau-CI-Lauf 43021421958](https://github.com/ThonkTank/Salt-Marcher/actions/runs/43021421958)
blieb **FAIL**: Electron beendete sich wegen falschem Eigentümer beziehungsweise
Modus des `chrome-sandbox`-Helfers, bevor die native Netzwerkprüfung anlief.
Commit `d589afc` richtet den Helfer auf dem CI-Runner mit Eigentümer `root:root`
und Modus `4755` ein. Die Testkriterien wurden beibehalten; der darauf folgende
Lauf 43022087971 bestand am Erstpaket 0.3.1.

Der erste lokale Paket-Smoke des Erstpakets 0.3.1 scheiterte nach **17** bestandenen
Prüfungen an einem **30-Sekunden-Bereitschaftstimeout** im Landschaftsfall.
Ein kontrollierter Vergleich mit demselben unveränderten Landschaftsprüfer
reproduzierte denselben Timeout auch am vorausgehenden P3.3-Programm mit
Produktquellhash `6661b53a…`, dort nach **4** Prüfungen. Der damalige gepackte
Stand `d4083828…` bestand den getrennten Landschaftslauf mit **27/27** Prüfungen.
Dieser gezielte Erfolg macht den ersten lokalen Paketlauf nicht nachträglich
erfolgreich und belegt keine behobene Ursache des Timeouts. Der normale
Paket-Smoke **95/95 PASS** im damaligen GitHub-CI-Lauf 43022087971 ist ein
eigenständiger Nachweis am Erstrelease-Commit `d589afc`.

Die DNF-/Polkit-Systeminstallation auf Fedora benötigt eine entsprechende
Umgebung. Kontrollierte Prozess-, Versions- und Fehlerprüfungen sowie der
Paketstart belegen keine tatsächlich ausgeführte Fedora-Pakettransaktion.
Die bestehenden offenen Höhen- und Leistungsnachweise bleiben davon unberührt.

Rohbelege liegen ignoriert unter `artifacts/atlas-rebuild/ci-package/`
(einschließlich `updater/`), `src-tauri/target/diagnostics/preview-lifecycle/`
und `src-tauri/target/diagnostics/preview-landscape-comparison-20261111/`.
Der letzte Pfad erhält beide Vergleichsläufe und ihre getrennten Ergebnisse.

## P3.3 und Abschlusskriterien

**Gewässerszene öffnen** erzeugt im normalen Fenster über den regulären
Neu-Pfad eine Karte mit schrägem Terrain, einem See mit Loch und Pegel 32 Fuß,
einem bestätigten abwärts gerichteten Flussprofil und einem Haus am Hang.
**Neu** bleibt die leere Karte. Das Panel **Gewässer und Fundamente** zeigt
lokal aktuelle, veraltete oder noch unbekannte Ergebnisse.
**Gewässer an Gelände anpassen** bleibt sichtbar deaktiviert: Vollständige
Erstellungs- und Anpassungswerkzeuge gehören zu P7.

| Kriterium                      | Umsetzung und Nachweis                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Echte Wassergeometrie          | Persistierte Seemaske mit Loch und absolutem Pegel sowie bestätigte Flusssamples mit Breite und nicht ansteigendem Pegel. Die Darstellung verwendet diese Geometrie im tatsächlichen Farbpass.                                                                                                               |
| Aktuelles Bett und Wasserclip  | Das bestätigte Flussprofil senkt das natürliche Gelände höchstens bis Wasserpegel minus zwei Fuß mit weichem Uferübergang. Wasser wird gegen das aktuelle Bett vor der Fundamentwirkung geclippt; ein Höhenstrich verändert weder Maske noch Profilautoren.                                                  |
| Belegte Fundamente             | Der vollständige gedrehte Footprint erhält einen Intervallnachweis seines Maximums nach der Flussbettwirkung, mit Toleranz 0,0001 Fuß. `base` trägt Plateau und Übergang; `top = base + foundationHeight` ist die separate Oberkante. Unbelegte Maxima bleiben unbekannt.                                    |
| Inhaltsidentität               | Vollständige Bounds und SHA-256 über wirksame Kontrollwerte aller 22 Höhenstufen, unabhängig von Revision und Generation. Bekannte Abwesenheit gehört zum Read; neue Kontrollwerte im Stützbereich ändern die Identität. A → B → Undo(A) liefert wieder die Identität von A.                                 |
| Gemeinsame Autoren und Datei   | Sparse Höhe, Landschaft, Hausheader und Wasserautoren teilen Dokument, History, Pendingjournal, atomaren Writer und Dateisnapshot. Format 27 mit räumlichem Index und genauem Boundsfilter; keine eigene Wasser-Schreibqueue oder Migration. Echter Electron-/SQLite-Store und Skalierungsreferenz bestehen. |
| Lokale Ableitung und Retention | Ein gemeinsamer Leseslot und ein begrenzter Ableitungsslot, höchstens 128 Wasserquellen pro Read/Ansicht, 512 Punkte und 128 KiB pro Quelle, 4 MiB Höhensnapshot und 64 lokale Fundamentkandidaten ab einem Bildschirmpixel. Keine weltweite Nachführung entfernter Autoren.                                 |
| Gemeinsame Renderbudgets       | Höchstens acht Seepegel-Layer, 512 Flusssegmente und 4.096 Seemaskenpunkte pro Kachel. Ableitungen erhalten höchstens 0,5 ms und 32 Schritte aus dem gemeinsamen 2-ms-/128-Schritte-Budget. Hi/Lo-Höhen führen auch im CPU-Ausnahmeweg zum selben Farbpass.                                                  |
| Ehrliche Grenzen und Antworten | Fehlende Quellen, Geometrie- oder Nachweisgrenzen bleiben mit Begründung unbekannt. Bedarfe sind versioniert; alte Fehler sperren keinen ersetzten Bedarf. Alte und neue Geometrieflächen invalidieren auch kalte residente Renderkacheln.                                                                   |

Die späten Integrationskorrekturen sind Bestandteil dieses Produktstands:
Fundamentjobs halten höchstens **8.192 relevante Kontrollwerte** über alle
Stufen. Ihre Kontrollobjekte, Maps, Samplerindizes und Suchheaps tragen eine
konservative **4-MiB-Metadatengebühr** zusätzlich zu den gezählten Puffern.
Ein neuer Job benötigt **10 MiB Zulassungsreserve**; ein laufender Fundamentjob
benötigt diese Reserve nicht erneut. Der Wasserencoder reserviert höchstens
**2 MiB zusätzlich** für die abschließende Zusammenführung. Nach Abschluss,
Fehler oder Verwerfen endet der Arbeitsschritt vor der Zulassung eines neuen Jobs.

Eine monoton vergebene Entryversion bindet Lesefehler an den konkreten Bedarf
und dessen Bounds. Verschieben, Verkleinern oder Entfernen invalidiert alte
und neue Wasser-/Fundamentbounds. Ein nicht abbrechbarer Digest bleibt auch bei
Projektwechsel bis zum tatsächlichen Ende gezählt und belegt den gemeinsamen
Slot. Die alte Dokumentreferenz wird gelöst; die einzelne noch gehaltene
Wasserquelle erhält konservativ weitere 128 KiB Metadatengebühr. Es entsteht
keine Warteschlange alter Ableitungsjobs.

## Vorherige P3.3-Nachweise

Diese Fachnachweise gehören zum vorausgehenden Commit `0feacd1`; sie werden nicht
als neue Prüfung des Updaters ausgegeben. Damaliger Produktquellhash (`product-inputs-v1`):

`6661b53ab544e52d6518efac2bbfd9f6217358554e213d5cbc58c3d36350d56f`

| Prüfung                                               | Ergebnis                                                                                                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gesamte TypeScript- und Tool-Typprüfung               | **PASS.**                                                                                                                                                                                                          |
| Editor-Modell, Controller, Session und Darstellung    | **947/947** Tests in **31 Dateien** bestanden, mit `--maxWorkers=1`.                                                                                                                                               |
| Frischer P0-Desktop-Build                             | **PASS.**                                                                                                                                                                                                          |
| Echter Electron-/SQLite-Store und Skalierungsreferenz | **29/29 PASS.**                                                                                                                                                                                                    |
| Gezielte GL-Randfälle: normal und Cancellation        | **Je 9/9 PASS.** Identische Pixel; im geprüften Ausnahmeweg tatsächlich 80 Fallbackkacheln und 1.310.720 berechnete Samples.                                                                                       |
| ZIP und startbare App                                 | **PASS:** gebaut.                                                                                                                                                                                                  |
| Statische Paketprüfung                                | **PASS:** tatsächlicher ASAR-Inhalt mit den unveränderten Assertions des offiziellen Prüfers; kein zusätzlicher doppelter Smoke.                                                                                   |
| RPM-Metadaten und Zielplattform-Native-Binding        | **2/2 PASS.** Dies ist keine lokale RPM-Paketabnahme.                                                                                                                                                              |
| Vollständiger Smoke des gepackten Programms           | **202/202 PASS**, darunter **29 Haus- und 26 Wasserprüfungen**; Normalstart, Landschaft, Verzögerungen und Dateilebenszyklus eingeschlossen. Der erste Fehlversuch und seine Korrektur bleiben unten dokumentiert. |
| Formatierung und Diffprüfung                          | **44** geänderte/neue Dateien sowie `git diff --check` bestanden.                                                                                                                                                  |
| Negativkontrolle am identischen Produktquellhash      | **Erwarteter FAIL, Exit 1:** der dritte Check erkennt fälschlich gezeichnetes Wasser auf trockenem Gelände. Autoren- und Hashprüfungen davor bestehen; der Originalbuild bleibt bytegleich.                        |

Der normale vollständige `make`-Pfad war am damaligen P3.3-Stand lokal durch
das fehlende `rpmbuild` blockiert. Die damaligen ZIP-/App- und
RPM-Metadatennachweise belegten deshalb keine lokal erzeugte RPM-Datei. Für den
neuen Vorschau-Stand wurde inzwischen ein tatsächliches RPM mit benutzereigenem
RPM 4.18 gebaut; auch der aktuelle CI-Paketbau besteht. Eine Installation auf
Fedora ist damit weiterhin nicht nachgewiesen.

Der erste gepackte Gesamtlauf scheiterte nach 41 Prüfungen beim ersten
Hausplatzieren mit „Zielbereich noch nicht bereit“. Die eigene Vorschau
invalidierte zwischen Down und Up die abgeleiteten Fundamentfarben; eine
erneute `inspectRegion`-Prüfung entzog der bereits angenommenen Geste dadurch
fälschlich ihre Freigabe. Der Controller verwendet jetzt wie Landschaft
`captureFoundation`/`inspectFoundation`/`acceptFoundation`: Er übernimmt den
sichtbaren Nachweis vor der Autorenänderung und räumt ihn bei Abschluss oder
Abbruch auf. Vollständige Hausheader, Session, Ansicht, Vorbereitungsidentität
und fremde Quellenänderungen bleiben geprüft. Vier neue Regressionstests
belegen unmittelbares Loslassen, Drag und die weiterhin nötige Entwertung bei
Fremdquellen beziehungsweise Ansichtswechsel. Der separate echte Hausrundlauf
besteht auf dem korrigierten Produktquellhash alle 29 Prüfungen. Der vollständige
Paketlauf besteht anschließend alle 202 Prüfungen mit unveränderten Eingaben
und Kriterien.

Der erste Gewässerszenenlauf scheiterte an einer zu breiten UI-Zählung:
„Aktuell“ wurde auch für das Fundament gezählt, obwohl der Check zwei Gewässer
prüfen sollte. Der Selektor ist auf die beiden Gewässer begrenzt; die
eigenständigen Fundamentprüfungen bleiben bestehen.

Der erste vollständige Editorlauf mit **903/908** bestandenen Fällen zeigte
eine echte Schedulerregression: `scheduleLoad()` lief in jedem RAF und
veränderte damit die bestehende Brush-Readiness. Der Controller erneuert den
Ableitungsbedarf jetzt nur bei verändertem Schlüssel, Typ, Version oder Bounds.
Der abschließende Lauf mit 947 Fällen enthält die Korrektur und ihre
Regressionstests. Funktions- und Pixelprüfungen sind keine native Zeitmessung.

Der alte GitHub-CI-Lauf **42925010442** auf P3.2-Commit `6574dd1` war ebenfalls
**FAIL**. Ursache war die Dateibarriere im Haus-Smoke: Der Neu-Check konnte den
noch bereiten alten Zustand lesen, während `fileAction` bereits lief. Der
Prüfer wartet jetzt auf eine andere Sitzung und das Ende der Dateiaktion;
Inhaltsassertions und Zeitgrenzen bleiben erhalten. Das ist keine nachträgliche
Freigabe dieses alten CI-Laufs. Die CI wird für den veröffentlichten PR-Head separat geprüft;
ihr aktueller Zustand wird im verlinkten PR festgehalten. Ein Ergebnis des
Ausgangscommits wird nicht auf den neuen Head übertragen.

Die damaligen P3.3-Rohbelege liegen ignoriert unter
`src-tauri/target/diagnostics/p33-*`, die Negativkontrolle insbesondere unter
`src-tauri/target/diagnostics/p33-water-negative-6661b53a/`.
Es gibt keinen zusätzlichen dauerhaften Abschlussbericht.

## Weiterhin offene Höhen- und Leistungsnachweise

### Historischer vollständiger P3.2-GPU-Lauf: FAIL

Die vollständige Höhen-GPU-Abnahme am P3.2-Produktquellhash
`196a55cbedfa8f238bd27016515abf10c5eb199aa2a1e5b2138e6068536c83cb`
bleibt **FAIL: zuletzt 3/6, zuerst 4/6**. Dieser vollständige Lauf wurde nicht
am oben genannten P3.3-Head wiederholt. Die neuen gezielten GL-Randfälle
ersetzen ihn nicht.

Im Fall `normal-zoom-level9` fehlen bei der dritten Anhebung innerhalb der
unveränderten fünf Sekunden die `brush-submit`-Nachweise für elf Intervalle.
Alle acht Pixel-/Autorencheckpoints und die wiederhergestellte Quellenidentität
dieses Falls bestehen. `all-22-levels` überschritt zunächst nach einer bereits
gespeicherten Aktion die 20-Sekunden-Grenze für die vollständige Darstellung.
In der Wiederholung durchläuft der Fall alle 176 Aktionen und sämtliche
Inhaltscheckpoints; sechs Gesten scheitern an den Fünfsekundennachweisen.
`ordinary-22-level-cancellation` überschreitet im letzten vollständigen Lauf
bereits beim Ansichtswechsel die 20-Sekunden-Grenze. Es fehlen dabei keine
Quellen; die Terrainkomposition arbeitet weiter. Produktquellen, Eingaben,
Erfolgsbedingungen und Zeitlimits wurden für die damalige Wiederholung nicht
geändert.

Der anschließende kontrollierte Vergleich verwendete bytegleiche Kopien des
sauberen P3.1-Builds und des P3.2-Builds sowie denselben Diagnoserunner, nur auf
`normal-zoom-level9` begrenzt. **Beide isolierten Läufe bestehen.** Das ersetzt
die roten vollständigen Läufe nicht und belegt weder eine behobene
Höhenrückmeldung noch eine native Leistungsfreigabe. Der Einfluss der
Laufbedingungen beziehungsweise der vorhergehenden Fälle bleibt offen; aus
diesen Belegen war keine neue Hausregression nachgewiesen. Die historischen
Rohbelege liegen unter `src-tauri/target/diagnostics/p3-house-final/`.

### R4 und native Reaktionszeit

Der letzte R4-Haltebefund bleibt **FAIL**: Bei zehn Sekunden auf Level 4,
Scale 0,01 und 16-Pixel-Pinsel erreichte das Zentrum 200 statt 40.038,4
Referenzwirkung, ungefähr 0,5 Prozent. Während des Haltens wurde kein neues
Terrainpaket eingereicht. Die bisherige Codeableitung benennt wiederholt
verworfene Übersichtsvorbereitung mit mindestens 133 Schritten bei höchstens
128 Schritten je RAF. P3.3 ist keine neue Abnahme dieses Höhenfalls.

Die Analyse des damaligen Zoomfalls zeigte zusätzlich zwei Höhenpfade:
`Observation.dose` verlangte das Gesamt-Rechteck einer Materialisierung,
während der lokale Renderbeleg nur die tatsächlich beeinflussten Teilflächen
bestätigte. Zwei unveränderte Eckbereiche verhinderten dadurch die Zuordnung
bereits dargestellter früher Intervalle. Für den restlichen Autorenstand
erstellte `freezeBrushRender` nach `work.complete` keine weitere lokale Gruppe;
diese Darstellung lief über Hintergrundkacheln weiter. Die betroffenen
Funktionen waren gegenüber dem P3.1-Ausgangscommit unverändert. Die offene
Korrektur muss dieselben tatsächlichen Regionslisten durch Materialisierung,
Invalidierung, Intervall- und Commitnachweis führen sowie die letzte ausstehende
Rendergruppe abschließen. Die strenge Überdeckungsprüfung darf dafür nicht
gelockert werden.

Der native Hardware-/20-ms-Ergebnistakt und die vollständige
Eingabe→Präsentationsabnahme bleiben offen. Funktions-/Pixelprüfungen ersetzen
keine native Leistungsabnahme.

## Nächster Planschritt

**P3.4 „Echte Fachkonkurrenz“:** Ein tatsächlicher Gebäudejob und ein
tatsächlicher Hydrologiejob konkurrieren mit unveränderlichen Eingaben um die
gemeinsame Zulassung von höchstens zwei Rechenjobs. Beide müssen während
lokaler Bearbeitung und gleichzeitigem Speichern tatsächlich Fortschritt und
brauchbare Ergebnisse liefern. Ergebnisse bleiben
Vorschläge bis zur Prüfung ihrer vollständigen Abhängigkeiten. Dazu gehören
bekannte Abwesenheit und neue räumliche Treffer im gelesenen Bereich;
unabhängige Änderungen anderswo dürfen einen gültigen Vorschlag nicht pauschal
verwerfen. Danach folgt der gemeinsame P3-Rundlauf.

Vollständige P0-Abnahme und der bestandene gemeinsame P3-Fall bleiben vor P4–P9
erforderlich. Vollständige Haus-/Parzellen- und Innenraumwerkzeuge bleiben
P5/P6, die Wasser-Erstellungs- und Anpassungswerkzeuge P7. K1–K6 bleiben erledigt;
zusätzliche allgemeine Konsolidierung ist keine vorgeschaltete Aufgabe.
