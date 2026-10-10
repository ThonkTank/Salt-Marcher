# CITY-00 P48: Atmosphärenvorlage und frisches Öffnen

Ausgangspunkt: CO-COK-0004 bleibt offen. I47/R47 belegen in Steam-Demo3122210/build16643264 ausschließlich Schattenrichtung230→34 und Schneeschicht0→0.6 mit tatsächlichem Map-Save. Keine Vorlage wurde angewandt; Schnee0 war nur sichtbar zurückgestellt. Finaler I47-Maphash9f630a45… enthält weiterhin34/0.6. R47-Review unter `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-cok-i47-20261009-r02/review.json`. Eigene Produkt-, Host-, Usability- und Vollversionsabnahmen bleiben offen.

P48 plant zwei getrennte Umsetzungsfolgen, I48a und I48b, anschließend eigene R48-Referenzreview und gegebenenfalls N/R. Nach jeder Phase getrenntes Aufräum-P/I/R. Unterschiedliche Dialog-/Datei-/Prozessbelege sind getrennte Ergebnisse, keine Gesamtfreigabe.

## I48a: tatsächliche Vorlagenfolge

Vor Start aktuellen Shared-/Originalstand und Issue7 prüfen, GUI-Slot mit Hex ausdrücklich abstimmen. Geprüften tools/canvas-of-kings-Starter mit einem neuen, noch nicht vorhandenen externen QA-Lauf starten. Erst nachdem der Starter den Lauf angelegt hat: I43 CITY00-VARIANTS.mommap als eigene CITY00-TEMPLATE.mommap kopieren; Quelle SHA-256 `7ace1c83e482f16b7b5412ea367136c3314eebe1ffac5dea7c0e70116c39bf09` und Zielbytegleichheit festhalten. Produktive Profile, Originalinstallation und I43/I47-Karten bleiben geschützt. RFB/VNC ist ausdrücklich autorisiert; jedes Zwischenbild vor der nächsten Eingabe lesen. Originalidentität, StartUTC, PID/startTicks, Grafikreduktion, Lock und synthetische Eingabe dokumentieren.

Eigene Karte über sichtbares Open öffnen, Environment/Light und Weather lesen. I47 zeigte Open Template und Save As Template; dies belegt nur angebotene Zugänge. Aktuelle Dialoge entscheiden über Format, Umfang und Verhalten. Keine Dateiendung, kombinierte Licht-/Wettervorlage, Vorschau, Apply-Button oder Undo-Fähigkeit voraussetzen.

1. Baselinebild/Mapbytes aufnehmen. Eine eigene Vorlage über Save As Template im externen QA-Lauf speichern, tatsächliche Datei und Dialogabschluss sichern. Ist der Zugang nicht verfügbar, Demo-/Zugangslücke dokumentieren, keine Dateiwirkung erfinden.
2. Zwei bekannte, sichtbare Regler verändern (Schattenrichtung/Schneeschicht), ihre Werte und Wirkung aufnehmen. Tatsächlichen Map-Save ausschließlich über sichtbares Menu/Save ausführen; danach Datei-Diff und Hash lesen. Ein Diskettenbild allein ist kein Save-Receipt.
3. Eigene Baselinevorlage über Open Template laden. Vorher/selektierte Datei/Ergebnisbilder aufnehmen; angebotenen Apply gegebenenfalls ausdrücklich ausführen. Gemessenen Wirkungsumfang bestimmen: Light, Weather oder gesamte Environment; nicht enthaltene Felder müssen anhand des tatsächlichen Diffs untersucht werden. Dialog-Cancel vor Bestätigung getrennt prüfen, sofern ohne Schreibwirkung erreichbar. Sofortige Anwendung bleibt als solche dokumentiert; daraus keine transiente Vorschau ableiten.
4. Wieder Menu/Save, vollständigen Mapdiff sichern. Objekte, Pfade, info, map_settings, deco_tool und deco_images einzeln vergleichen, unbekannte zusätzliche Änderungen offen berichten. Vorlage als Dokument vergleichen, ohne interne Dateien zu verändern. Keine stille Baselinekorrektur durch direkte JSON-Schreibaktion.

Falls exakte Baselinewiederherstellung nicht gelingt, finale eigene Map/Template unverändert sichern und präzise offene Werte nennen. Auf höchstens zwei erfolglose Versuche/45min pro Hypothese begrenzen; kein blindes Speichern oder Neustarten. Normal über Menu/Exit schließen, originalExit0/Starterende und alle eigenen PID/startTicks prüfen, GUI-Slot zurückgeben. Abbruch separat benennen.

## I48b: eigener frischer Prozess

Erst nach I48a-Abschluss und dessen Aufräum-P/I/R; erneute konkrete GUI-Slotabsprache. Neue Starter-Session mit neuem privatem Profil und anderem Run/PID/startTicks; vorherige Identitäten müssen verschwunden sein. I48a-finalen gespeicherten Mapstand samt Vorlage bytegleich in diesen frisch angelegten Lauf kopieren. Nur eigene kopierte Karte über sichtbares Open laden.

Ohne Regler-/Saveaktion zuerst sichtbare Atmosphäre und Werte gegen den tatsächlich gespeicherten I48a-Endstand vergleichen. Geometrie-/Section-Orakel und Kartenhash vor/nach bloßem Öffnen prüfen. Dies belegt Map-Reopen, nicht Vorlagenpersistenz. Separat die eigene kopierte Vorlage über sichtbares Open Template laden und gegebenenfalls Apply; nur bei tatsächlicher Wirkung eine frische Vorlagenfolge behaupten. Ist I48a ohne Vorlagendatei geblieben, bleibt dieser Teil offen, Map-Reopen kann trotzdem getrennt geprüft werden. Eigenes Normalexit/Prozessende/GUI-Rückgabe wie I48a dokumentieren. Keine UI-Schließung innerhalb derselben Prozesssession als Neustart zählen.

## Technische Konsequenz und Revieworakel

CITY-07 bleibt geplant: materialisierte Gestaltung, versionierte Vorgabenreferenz und expliziter Abschnittsumfang; vollständige Validierung vor einem gemeinsamen Atlasbefehl. Keine Geometrie-/Personen-/Keyneugeneration, keine eigene Kamera/History/SceneClock oder Speicherstrecke. Konkrete Einheiten, Bereiche und Vorlagenformat bleiben Originalbefund und späterem gemeinsamem Vertrag vorbehalten. Diese Referenzprobe aktiviert keine neue City-Schema-API.

R48 prüft Rohhashes, Frame-/Sessionzeit, sichtbare Wirkung, tatsächliche Template-/Mapbytes, Abschnittsumfang, Cancel, geschützte Quelle, zwei echte Prozessfolgen, Demo-/Grafikgrenze und normale Enden. PASS darf nur belegte Teilfunktionen umfassen. Ein eigener Referenzreview ist kein unabhängiger Produktreview; der Paketbesitzer benennt bei Bedarf genau einen unabhängigen Reviewer vor dessen Start. Alle24CTY/65CO bleiben offen, bis die jeweils vollständigen Abnahmegates erfüllt sind. CITY01–04 wartet ausschließlich auf konkrete HEX04/05-Integrationsverträge, keine allgemeine Plattform-/Koordinationsrunde.

I48a ausgeführt: eigene `CITY00-BASELINE.momenv` besitzt info/environment; environment entspricht vollständig Baseline. Tatsächlicher Wirkungsnachweis betrifft geänderte Schatten-/Schneewerte, kein Wirkungsnachweis aller unveränderten Regler. Cancel nur sichtbar geprüft; finaler Menu/Save bytegleich Ausgangskarte. I48b öffnet die eigenen finalen Karten-/Vorlagenkopien aus `/home/aaron/.cache/dungeon-native-qa/city-plans/city00-cok-i48a-20261009-r01`; Rawmanifest dort/manifest.json. Keine frische Prozess-/Produktabnahme aus I48a.


## I48b ausgeführt (10.10.2026)

Neuer Kandidat vom aktuellen Shared eefbe6f; ausdrückliche neue Hex-GUI-Übergabe vor Start. Eigene frische Originalsession ec20905f-482c-44f7-9291-6698b719c9ab mit anderem privaten Profil/PID/startTicks gegenüber I48a. Rohmanifest: /home/aaron/.cache/dungeon-native-qa/city-plans/city00-cok-i48b-20261010-r01/manifest.json.

Eigene final-save.mommap-/CITY00-BASELINE.momenv-Kopien sind hashgleich. Sichtbares Open/Enter öffnete die Karte; Light230 und Weather snow0 wurden vor jeder Regler-/Saveaktion gelesen. map-reopen-proof.json hält den unveränderten Kartenhash und alle Abschnittsorakel fest. Erst danach wurden zwei bekannte Regler an der eigenen Kopie verändert, um die frische Vorlagenwirkung unterscheidbar zu machen: tatsächliche Schattenrichtung5 und Schneeschicht0.6. Open Template mit dem absoluten eigenen Vorlagenpfad/Enter stellte unmittelbar230/0 und die sichtbare Atmosphäre wieder her; kein separater Apply. Kein expliziter Map-Save in I48b; finale Map-/Vorlagenbytes entsprechen weiterhin den geschützten Quellen.

Sichtbares Menu/Exit, Originalexit0/Starterexit0, fünf eigene PID/startTicks verschwunden; lokaler GUI-Slot an Hex zurückgegeben. Demo build16643264 reduzierte Grafik automatisch; synthetisches RFB ist kein physischer Bediennachweis. Der erste Return-Tastenname wurde im Transport vor Eingabe abgewiesen; dokumentiertes Enter benutzt. Audio fällt laut Log auf Dummy zurück, Audio gehört nicht zu dieser Probe. Alle übrigen Regler/Ranges und eigenes Produkt/Host/Vollversion bleiben offen. Aufräum-P/I/R folgt getrennt, anschließend R48 über beide Originalfolgen. Kein R48-/Produkt-/Gesamt-PASS aus diesem Umsetzungsbericht.

## I48b Aufräum-P (getrennt)

Normalexit0, keine ForcedStop und alle fünf eigenen PID/startTicks verschwunden erneut geprüft. Ausschließlich drei regenerierbare Cacheverzeichnisse (13431760 Bytes) sind im externen cleanup-plan.json vollständig nach Datei/Hash enumeriert: eigener Godot-Vulkan-Pipelinecache, Godot-shader_cache und Mesa-shader_cache. Umsetzung prüft erneut Sessionende, Pfad-/Symlinkgrenzen, Cacheinventar und geschützte Hashes, dann entfernt nur diese drei Verzeichnisse. Logs, Profileinstellungen, Karten-/Vorlagenquellen und Kopien, Original-/Session-/Eingabe-/Screenshotbelege, Manifest und Prozess-/Reopenproofs bleiben erhalten. Review prüft separat Abwesenheit, unveränderte geschützte Bytes/Quellen und keinen Produkt-/Fremdwurzeleingriff. Noch keine Löschung, kein Cleanup-R oder R48-PASS.
