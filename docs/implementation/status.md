# Aktueller Stand

Stand: 11. November 2026. **P3.3 „Vorbereitete Gewässer und Ableitungen“ ist
umgesetzt. Editor-, Store- und gezielte Grafikprüfungen bestehen; die
übergreifende Höhen-GPU-Abnahme bleibt am zuletzt vollständig geprüften
P3.2-Stand FAIL.** Die finalen Paketnachweise sind unten separat ausgewiesen.
Der [Neubauplan](atlas-rebuild-plan.md) bleibt der einzige Ausführungsplan;
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.
Atlas V7 ist der reguläre Einstieg mit Format 22; der optionale
Electron-/Pixi-Editor verwendet Format 27 (`atlas-p3-derived-water-1`).
Frühere P0-Dateien werden nicht migriert.

## Arbeitsentscheidung

Der Auftrag zum nächsten Planschritt setzt die freigegebene begrenzte
R5-Fortsetzung nach P3.2 mit P3.3 fort. Nur dessen benötigte P1/P2-Erweiterungen
sind enthalten. Die formale R4-Auswertung bleibt bestehen; ihre offene
Leistungsabnahme widerruft diese Nutzerentscheidung nicht. Vollständige
P0-Abnahme und bestandener gemeinsamer P3-Fall bleiben Voraussetzungen für P4–P9.

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

## Nachweise am aktuellen Stand

Geprüfter Produktquellhash (`product-inputs-v1`):

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

Der normale vollständige `make`-Pfad bleibt lokal durch das fehlende `rpmbuild`
blockiert. ZIP/App und die beiden RPM-Metadatenregressionen belegen daher keine
lokal erzeugte und abgenommene RPM-Datei.

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

Aktuelle Rohbelege liegen ignoriert unter
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
