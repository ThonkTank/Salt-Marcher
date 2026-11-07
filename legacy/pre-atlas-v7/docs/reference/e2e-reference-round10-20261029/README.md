# Wiederherstellbarer Kernablaufstand, 29.10.2026

Status: Lokaler Referenzstand; E2E-01 technisch bestanden, E2E-02 Teilkette, E2E-03/04 offen.
Owner: project
Last Reviewed: 2026-10-29
Source of Truth: Der [E2E-Katalog](../../project/verification/end-to-end.md) besitzt die Pflichtwirkungen; diese Referenz bindet Ausgangsbestand, ausführbare Einstiege und tatsächliche lokale Ergebnisse.

## Welcher Stand gilt?

Die Referenz übernimmt ausdrücklich den archivierten Korrekturstand aus
[Plan 1 / nativer Runde 10](../native-baseline-round10-20261029/README.md).
Basis ist `fa2c3eb50af9b8970235f75b2d9c7b05e99602c9`, **dirty**, mit
Quellenfingerprint
`2005f9ed9906fb9fdbd79a15c325d63e2b29228a8c75ac8761e16c6bd2130865`.
Die 2.085 archivierten Laufzeit-/Prüfquellen einschließlich Lockfile sind die
tatsächliche Arbeitskopie dieses Standes. Die SHA allein beschreibt sie nicht.
Spätere oder parallele Dirtyarbeit im aktuellen Checkout gehört nicht zu diesem
Referenzbefund und wird weder entfernt noch automatisch integriert.

Der frühere integrierte technische E2E-01-Erfolg aus PR #1431 bleibt ein eigener
[historischer CI-Beleg](../../project/verification/end-to-end.md#integrierter-technischer-e2e-01-nachweis).
Er wird nicht zum Candidate-/Mainnachweis dieser lokalen Referenz umgedeutet.
Die Runde-9-Berichte bleiben ebenfalls datierte Geschichte. Übernommen werden
hier ausschließlich die auf denselben archivierten Plan-1-Stand gebundenen
Rohberichte; frühere Erfolgsmeldungen werden nicht summiert.

## Übergabebestand und Wiederherstellung

Die **lokale, kopierbare Kapsel** liegt unter
`.build/e2e-reference-round10-final-capsule-20261029/`. Sie enthält
`manifest.json`, vollständiges `base.bundle`, `sources.tar.gz`,
`dependencies.tar.gz`, `runtime.tar.gz`, das ausführende Nodebinary,
separat gebundene Controller und unveränderte Originalbelege unter `original/`.
Gitobjekte, Dirtyquellen, Lockfile, Electron, native npm-Module, Probehelfer,
Startdatenbanken, PNG-Medien sowie Ressourcen- und Prozessbelege sind damit
übertragbar. Im Manifest steht jeder Dateihash; zusätzlich werden alle entpackten
Abhängigkeitsdateien und Laufzeitdateien gegen Einzelhashes geprüft.
[binding.json](binding.json) hält den kompakten Übergabeverweis und Manifesthash.

Die Kapsel ist ein ignoriertes lokales Lieferartefakt, kein im Repository
veröffentlichtes Downloadangebot. Ein anderer Entwickler benötigt die **gesamte
Kapsel**, nicht nur dieses Markdown oder den alten Plan-1-Pfad. Zum Übertragen
das Verzeichnis unverändert kopieren. Es ist kein persönliches Profil enthalten.
Alte Prüfprofile, globale npm-Installationen, lokale Gitobjekte und frühere
`.build`-Ausgaben werden bei der Wiederherstellung nicht benötigt. Das archivierte
Nodebinary ist Linux x64; vorausgesetzt bleiben ein passender Linuxhost, Git,
GNU tar, Python 3, X11 und die Systembibliotheken für Electron sowie der vorhandene
delegierte 2/3-GiB-Ressourcenanschluss. Ein anderer Host ist damit ausführbar
vorbereitet, jedoch noch nicht qualifiziert.

Nach Kopie der Kapsel, mit absoluten Pfaden und neuen Ziel-/Ausgabeverzeichnissen:

```sh
CAPSULE=/absoluter/pfad/e2e-reference-round10-final-capsule-20261029
RESTORED=/absoluter/pfad/frische-referenz
PROOF=/absoluter/pfad/frischer-spielkettenbeleg
FAILURE=/absoluter/pfad/frischer-fehlerbeleg
"$CAPSULE/node" "$CAPSULE/controller/e2e-reference.mjs" restore "$CAPSULE" "$RESTORED"
"$CAPSULE/node" "$CAPSULE/controller/e2e-reference.mjs" audit "$RESTORED"
"$CAPSULE/node" "$CAPSULE/controller/e2e-reference.mjs" run "$RESTORED" "$PROOF"
"$CAPSULE/node" "$CAPSULE/controller/e2e-reference.mjs" run-failure "$RESTORED" "$FAILURE"
"$CAPSULE/node" "$CAPSULE/controller/e2e-reference.mjs" verify "$RESTORED"
```

Die Controller [e2e-reference.mjs](../../../tools/e2e-reference.mjs) und
[Seedadapter](../../../tools/e2e-reference-seed-loader.mjs) sind zusätzlich als
Repositoryquellen reviewbar. Der [separate Fehlercontroller](../../../tools/e2e-reference-fault.mjs) startet die beiden Fehlerfälle ohne positive Vorgeschichte. `restore` erzeugt einen neuen Checkout aus den
mitgelieferten Gitobjekten und legt die vollständigen Dirtyquellen darüber.
Der aktuelle Checkout bleibt erhalten. Das Laufzeitarchiv stammt aus dem
Plan-1-Testpaket; es wird nicht zufällig aus der heutigen `.build/desktop`
übernommen oder während der Probe neu gebaut. Es handelt sich weiterhin um den
Entwicklungs-/Testlauf, keine Installation oder veröffentlichte Paketfreigabe.

Der Loader ersetzt ausschließlich die Fixture-Erzeugung des archivierten
`seedE2E02` durch die hashgeprüfte Kopie des archivierten Seeds samt Medien in das
neue Probeprofil. UI-Aktionen, Produktcode, Transaktionen und unabhängige
SQLite-Orakel bleiben die archivierten Quellen. Diese Abweichung ist ausdrücklich
als Controller gebunden; kein unbenannter Helfer verändert Produktdaten.
Neue Ausgabeordner sind Pflicht. Das Profil entsteht jedes Mal frisch. Die
Fehlergegenfälle erhalten eigene byte-identische Seedkopien. Quellen, alle
Desktopartefakte, Abhängigkeiten und Node werden vor und nach dem Lauf geprüft.

## Pflichtfallmatrix und ausführbare Eingänge

[matrix.json](matrix.json) enthält jeden der vorhandenen 22 E2E-01- und 14
E2E-02-Pflichtfälle sowie jede E2E-03/04-Pflichtgruppe aus der vorhandenen
[Runde-9-Zuordnung](../round9-e2e-20261028/README.md). Die letzten beiden Gates
haben dort keine einzelnen kanonischen Fall-IDs; ihre lesbaren Gruppennamen
erfinden keine neue Abnahmenummerierung. Die Matrix unterscheidet `passed`,
`failed`, `prerequisite-blocked` und `not-yet-executable`; Teilwirkungen stehen
zusätzlich im Text. Ein früher Fehler entfernt keine späteren Pflichtzeilen.

| Gate / Strecke | Gebundener ausführbarer Einstieg | Ergebnis und Grenze |
| --- | --- | --- |
| E2E-01: alle 22 technischen Fälle | `tools/test-desktop-e2e01.mjs`, Katalog `tools/atlas-e2e01-scenarios.mjs`, Seed `tools/atlas-e2e01-fixture.mjs` | Plan-1-Schlusslauf übernommen nach Quellen-/Runtime-/Katalog-/Bild-/Prozess-/Ressourcenprüfung. 19 native Starts, gemeinsame History, Autosave/Crash/Fresh und vollständiger unabhängiger Import. Alle 22 Fälle bestanden. Kein neuer aktueller Main-/Paket-/Zielgerätebeleg. |
| E2E-02: Vorbereitung → Live → Chase/Combat → Award/Ledger → Sitzungsabschluss/Fresh | `run` oben; archivierte `tools/test-desktop-e2e02.mjs`, `tools/live-e2e02-fixture.mjs` und `tools/live-e2e02-countercases.mjs` | Neun Pflichtfälle bestanden. E02-01 bleibt für vollständige native Anlage noch nicht ausführbar; E02-02/03 fehlen die Produkteingänge für immutable Snapshot/LiveSession-Identität; E02-05/11 fehlen die vollständigen negativen nativen Matrizen. Der Teilkettenlauf meldet ausdrücklich `complete: false`, Gate `open`. |
| Kontrollierte Fehler separat wiederherstellen | `run-failure` oben; `tools/e2e-reference-fault.mjs` und archivierte `tools/live-e2e02-countercases.mjs` | Native Transaktionsabweisung vor Publish und verlorene Antwort nach Commit aus eigenen byte-identischen Seedkopien erneut reproduziert. Vorher/Nachher bleiben bei Abweisung gleich; Antwortverlust wird unter derselben ursprünglichen CommandId auf genau eine Wirkung geklärt. Der Controller besteht, wenn der erwartete Fehler korrekt erkannt wird. Kein unbeabsichtigter Produktfehler wird behauptet. |
| Instabiler Vorbereitungsbefund | Archivierte `tools/test-desktop-note-excerpts.mjs` | Im Plan-1-Schlusslauf rot: „Missing source Siv die Fährfrau“. Der neue Versuch am identischen Quellen-/Runtime-Stand ist vollständig erfolgreich, einschließlich frischem Prozess. Ursache und Reparatur sind nicht belegt; der alte rote Befund bleibt erhalten, ist aber kein reproduzierbarer Fehler dieser Referenz. |
| E2E-03: Reise → Zeit → Weltverbraucher | `tools/test-desktop-travel-checkpoints.mjs`, `tests/runtime/desktop-restock-journey.test.mjs`, `tools/test-desktop-weather-override.mjs`, `tools/test-desktop-scene-music-navigation.mjs`, `tools/test-desktop-music-stop.mjs` | Nur der gebundene Reise-Checkpointteil mit Undo/Redo/Fresh wird übernommen. Kein ausführbarer gemeinsamer Anschluss vom fortgeschriebenen E2E-02-Bestand an Kalender, Wetter, Shops, Musik und Autonomy. Vollständiges Gate voraussetzungsblockiert; einzelne Fachproben/Rezepte bleiben verfügbar. |
| E2E-04: fortgeschriebenen Spielstand übertragen/retten/sicher anzeigen | E2E-01-Transferprobe; `tests/shared/desktop-backup-worker.test.mjs`, `tests/campaign/desktop-archive-transfer.test.mjs`, `tools/test-desktop-player-scene-privacy.mjs` und weitere Matrixeinträge | Kein gemeinsamer nativer Recovery-/Salvage-/Player-/OS-/A11y-Lauf auf demselben fortgeschriebenen Spielstand. Vollständiges Gate nach E2E-03 voraussetzungsblockiert. Derselbe Linuxhost mit neuem Profil ist kein unabhängiger Host. |

Für die noch fehlende Reise→Zeit→Weltreaktionskette gibt es bewusst **keinen
vorgetäuschten gemeinsamen Startbestand**. Das gebundene Reiserezept baut seinen
kleinen Bestand selbst; die Consumerrezepte sind eigenständige Teilproben.
Die Referenz enthält keine private Musikbibliothek. Der vollständige E2E-03-Seed
mit gepinnten ManualDecision-/AmbienceOverride-/AudioSource-Identitäten, realen
Audiohashes und eigenen fehlenden/beschädigten Varianten bleibt eine konkrete
Lieferlücke. Vor deren Schließung wird kein gemeinsamer Wiederherstellungs- oder
Produkt-PASS behauptet. Gleiches gilt für die fortgeschriebene E2E-04-Closure.
Die fachliche Reihenfolge E2E-01 → E2E-02 → E2E-03 → E2E-04 bleibt bestehen.

## Praktischer Wiederherstellungsbeweis

Die finale Wiederholung umfasst sechs reguläre native Starts/Exits in fünf neuen Profilen bei 100 Prozent; beide eigenen Ressourcengruppen sind entfernt.
Die finalen Ergebnisse stehen in [restoration-result.json](restoration-result.json),
der unabhängige Übernahmeaudit in [adoption-audit.json](adoption-audit.json).
Die positiven und negativen Läufe verwenden einen aus der Kapsel frisch
entpackten Checkout und neue Profile ohne vorherige Prüfausgaben, bei 100 Prozent
Appzoom. Rohbelege liegen in den dort genau benannten lokalen Belegordnern.

Beim Spielkettenvergleich müssen Seedhash, Campaign-/Character-/Plan-/Visit-/Ort-
und Katalogidentitäten exakt gleich bleiben; die Vorbereitung bleibt byte- und
revisionsgleich. Neue Runtime-/Command-IDs sind eigenständige Ausführungen und
werden deshalb nicht mit alten Zufalls-IDs gleichgesetzt. Ihre Verknüpfungen und
ihre exakte Wiederaufnahme werden innerhalb jedes Laufs unabhängig geprüft.
Der Vergleich verlangt dieselben fachlichen Wirkungen: drei Mal 33 XP,
ein Kampfaward, ein Schatz, ein Beuteeintrag für denselben Character, ein Chase,
dieselbe Spielzeit und unveränderte Quelltexte. Fehlgeschlagenes Publish erhält
vollständig identische kanonische Vorher-/Nachherzeilen; Antwortverlust löst den
ursprünglichen Befehl auf genau eine bestätigte Wirkung auf.

Der separat aufgerufene Fehlerlauf benutzt ebenfalls ausschließlich den
archivierten Seed. Seine beiden eigenen Profile benötigen keinen erfolgreichen
Spielkettenlauf als Vorbereitung. Die erwartete Abweisung und der Antwortverlust
werden sichtbar und unabhängig im Speicher geprüft; beide Prozesse enden regulär
mit geklärtem Ressourcenbesitz. Der ebenfalls erneut versuchte Notizauszugsablauf
war erfolgreich. Sein Unterschied zum alten roten Befund bleibt ungeklärt und
ist weder ein stabiler Fehlerbeweis noch eine nachgewiesene Reparatur.

Die gezielten Controllerprüfungen weisen falsche Identität, fremden Seed,
abweichenden Zoom, altes Profil, behaupteten Vollabschluss und Teilwrites nach
fehlgeschlagenem Publish ab. Die tatsächliche Gegenprobe mit entfernter gebundener Mediendatei wurde vor
einem Produktstart abgewiesen; ein fehlendes Gitbundle wurde bereits vor Anlage
des Wiederherstellungsziels abgewiesen. Danach ist die vollständige Referenz
erneut erfolgreich geprüft worden. Diese Grenzen
prüft [e2e-reference.test.mjs](../../../tests/shared/e2e-reference.test.mjs)
zusammen mit der dokumentierten realen Mediengegenprobe.

Candidate/exakte neue Main-SHA, signiertes Paket, Installation/Restart,
vereinbartes Zielgerät und Ownerabnahme müssen später separat an einen dann
benannten Stand gebunden werden. Diese Übergabe integriert oder veröffentlicht
nichts und schließt keine offenen Produktanforderungen.

## Einmaliger Review von Plan 4

Der lokale, wiederherstellbare Teilstand ist akzeptiert. Der Review hat die
Manifestbindung sowie alle drei Controllerhashes zwischen Lieferkapsel,
Repositoryquellen und `binding.json` abgeglichen; auch das vorhandene Proofarchiv
stimmt mit seinem dokumentierten Hash überein. Die bereits erfolgreichen
Wiederherstellungs-, Controller- und Strukturprüfungen wurden wiederverwendet.
Ein veralteter Beschreibungssatz in `binding.json` behauptete noch einen älteren
Controller in der finalen Kapsel; er wurde anhand der übereinstimmenden Hashes
korrigiert. Kapsel, Controllercode, Laufbelege und Manifest bleiben unverändert.

Plan 4 ist damit noch nicht vollständig abgeschlossen: E2E-03/04 besitzen keinen
gemeinsamen fortgeschriebenen Startbestand, E2E-02 bleibt Teilnachweis und der
abweichende Notizauszugsbefund bleibt instabil. Die kontrollierten Fehlerproben
belegen reproduzierbare Fehlerbehandlung, keine Reproduktion dieses ungeklärten
Produkt-/Prüffehlers. Die Referenz bindet bewusst den historischen Plan-1-Stand;
spätere Besitzerkorrekturen aus Plan 2 gehören nicht zu ihrer Aussage.

Für eine Übergabe muss die ganze lokale Kapsel mitgeliefert werden. Repository-
Markdown allein und ein anderer unqualifizierter Host erfüllen den praktischen
Wiederherstellungsnachweis nicht. Diese Grenzen bleiben offen dokumentiert;
keine zusätzliche Reviewrunde, Restplanung oder Planung für Punkt 5.
