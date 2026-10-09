# HEX-00: technische Planung der Referenz- und Testbasis

**Arbeitslauf HEX-00-P01 – Planung.** Start: 2026-10-08T19:42:27.848506+02:00 (Europe/Berlin). Ausgangscommit: `3cf41c876977e14a9444b4fb6fa768edcb80798d`. Ergebnis dieses Laufs ist ein überprüfbarer Umsetzungsplan; Originalaufnahme, Umsetzung, Fachreview und Aufräumen sind nachfolgende eigene Läufe.

Grundlagen: [Hex-Atlas-Roadmap](ROADMAP-HEX-ATLAS.md), [Wonderdraft-Vergleichsplan](WONDERDRAFT-PARITY.md), [Architektur](ARCHITECTURE.md#vereinbarte-hex-atlas-erweiterung) und `acceptance.json.wonderdraftParity`. Die gesamten HEX- und eingeordneten CITY-Phasen bleiben das Ziel. HEX-00 liefert die Voraussetzung für HEX-01, noch keinen Hex-Editor.

## Aktueller Ausgangspunkt

- Branch `active/installed-phase1` wurde abgerufen und war mit seinem Upstream identisch.
- Lokaler und installierter Dungeon-Build: SHA-256 `f8738f0788b18f156c45b7f421da32140c1bf146ba2724e701b1137a640069a4`. Das belegt Buildidentität, keine erneut ausgeführte Bedienabnahme.
- Wonderdraft-Katalog: 36 Gruppen, 79 Ausgangsproben, 96 zugeordnete Werkzeug-/UI-Pakethinweise; `uiInventory` enthält noch keinen direkten Originaleintrag. Inventartor und alle drei Schritte sind offen.
- Wonderdraft-Referenz: lokal 1.1.8.2 laut Paketkennung; Programm/Paketprüfsummen stehen im Katalog. Laufversion, echte UI-Pfade und Wirkungsfolgen müssen direkt bestätigt werden.
- `tools/run-host.sh` und `tools/host-test.cjs` bieten bereits isolierte Obsidian-Läufe; `--phase4-key` prüft den bestehenden Key-Weg. Native Dungeondraft-Helfer zeigen Profilisolierung, Originalbilder, kontrollierte Eingaben und eigene Prozessbeendigung. Deren Widgetkoordinaten und QA-Mod sind kein Wonderdraft-Nachweis.
- Zwei lokale Teständerungen und `checkpoint.localTestInstall` gehören zur bestehenden fremden Arbeit. Sie bleiben erhalten und werden nicht in diesen Planungscommit aufgenommen.

## Offene Punkte und verbindliche Entscheidungen

| Punkt | Klärung / Umsetzung | Nachweis für den Abschluss |
|---|---|---|
| P00-01 – Aktueller Dungeon-Kernweg | Installations-/Quellstand sichern; eine kleine V4-Dungeonkopie mit Raum-Key und gebundenem Durchgang als gemeinsame Testregion vorbereiten. | Originaldateien unverändert; isoliert Öffnen, Key-Änderung, Undo/Redo, Save und vollständiger Neustart bestanden. |
| P00-02 – Wonderdraft-Isolierung | Eigenes Profil, Karten-/Assetverzeichnis und eine grafische Sitzung. Laufversion/Hashes vor der Messung aufnehmen. | Das Original verwendet ausschließlich die Testdaten; Nutzerprofil und Ooke-Originalkarten bleiben unverändert. |
| P00-03 – Bedienen des Originals | Verfügbare zulässige UI-Steuerung prüfen. Falls erforderlich, Originalansicht einer isolierten Sitzung über einen lokalen Browser-Viewer bedienen; der Viewer zeigt das tatsächliche Originalbild. Vorhandene Native-Helfer nur gezielt wiederverwenden. | Tatsächliches Wonderdraft ist sichtbar und reagiert; Eingaben, Vorschau, Commit und echte Speicherdatei gehören zur selben nachgewiesenen Sitzung. |
| P00-04 – Vollständige Oberfläche | Alle Kategorien, Menüs, Werkzeuge, Optionen, Dialoge und Eingabekontexte direkt erfassen. Paketkandidaten als Funktion, Helfer oder Programmservice einordnen. | Kein erreichbarer Befehl/Regler ohne Inventareintrag, WD-Unterfall und Zielphase; jeder Pakethinweis begründet klassifiziert. |
| P00-05 – Erstablauf | Die festgelegten Startfälle an kleiner Kontrollkarte inklusive frischem Originalprozess messen. | Originalfolge, sichtbare Wirkung, gespeicherte Rohkarte und Neuöffnung vorhanden. |
| P00-06 – Größenentsprechung | Originalpixel, Kartenabmessungen und normalisierten Ausschnitt erfassen; geplanten Weltmeter-/Hex-Bezug pro Probe benennen. Nutzerpräzisierung: endliche Originalkarten-/Detailgrößen auf Bereiche im grenzenlos mit Inhalt wachsenden gemeinsamen Atlas abbilden. | Spätere Hostpaare haben feste logische Ausschnitte in Meilen/Hex-Kacheln, keine feste Atlasgröße. Ausschnittsänderung erhält außerhalb liegende Inhalte; Verfeinern bleibt durch Zoom unmittelbar im selben Editor. Pixel dienen Darstellung/Export. |
| P00-07 – Belegqualität | Originalbeleg, Pakethinweis, geplante Probe, Hostlauf und physische Eingabe unterscheiden. | Metadaten erlauben keine Abnahme aus Dateinamen, Webtext oder synthetischer Eingabe allein. |
| P00-08 – Eigener Review | Oberfläche und Rohbelege erneut gegen Roadmap/Plan prüfen, kritische Startfolgen wiederholen. | HEX-00-C entscheidet das Tor ausdrücklich; offene Pflichtlücke verhindert HEX-01. |
| P00-09 – Aufräumen | Nach Fachfreigabe eigener Aufräumplan, Umsetzung und Review der gerade entstandenen QA-/Inventarteile. | Reproduzierbare Helfer, konsistente Kennungen/Verweise, freigegebene Ressourcen und erneuter Kernweg. |
| P00-10 – Stadt-Ergebnisvorbilder | CITY-00 als eigenen Referenzlauf im frühen Referenzpaket vorbereiten. | Kleine Ergebnisgalerie vor CITY-01; keine Gestenparität für die Stadtvorbilder. CITY-00 bleibt als eigene Phase sichtbar. |

Die native UI-Steuerung, Profilisolierung und tatsächlich erreichbaren Wonderdraft-Dialoge sind noch nicht nachgewiesen. Der Umsetzungsbeginn prüft diese Voraussetzungen konkret. Falls ein Eingabeweg scheitert, wird genau dieser Weg korrigiert beziehungsweise ein nachweisbar unterstützter gewählt. Ein Paketauszug ersetzt keine Originalaufnahme und öffnet das Tor nicht.

## Begrenzte technische Umsetzung

### 1. Lauf und Testbasis sichern

Unter `/home/aaron/.cache/dungeon-native-qa/hex-00/` erhält jeder Umsetzungs-/Reviewlauf ein festes Verzeichnis. Ein Manifest nennt Laufkennung, Start/Ende, Fokus, Commit, Quell-/Build-/Referenz-/Assethashes, Testprofil, Fixture und Eingabeart. Prozesskennung, Startzeit und Sitzungskennung gehören zu einer gestarteten grafischen Sitzung; eine alte Lockdatei gilt nicht als laufender Prozessnachweis.

Installierten Pluginstand und produktive Karteneingaben vor/nach den Tests hashen. Nur die isolierte Testkopie ändern. Bestehende QA-Sperre verwenden; Original und Obsidian nacheinander starten. Ressourcen nur anhand der eigenen nachgewiesenen Prozesskennungen beenden. Keine anderen Programme schließen und kein produktives Plugin installieren.

Vorhandenen Hostweg zunächst mit `DUNGEON_PLUGIN_ROOT`, `DUNGEON_SOURCE_VAULT` und `DUNGEON_QA_ROOT` explizit auf den tatsächlichen Checkout und die isolierte Quelle einstellen; historische Defaultpfade nicht übernehmen. Ein neuer kleiner `tools/host/hex00-baseline.cjs`-Fall ist nur nötig, wenn der vorhandene Key-Lauf den vorgeschriebenen Kernweg nicht vollständig abdeckt. In diesem Fall den vorhandenen Harness erweitern statt einen zweiten Hoststarter anzulegen.

### 2. Kleine Wonderdraft-Helfer

Geplante Dateien unter `tools/wonderdraft/`:

| Datei | Eng begrenzte Verantwortung |
|---|---|
| `inventory.mjs` | Lokale Programm-/Pakethashes und PCK-Verzeichnis lesen; Werkzeug-/UI-Pfade mit den Kataloggruppen abgleichen. Ausgabe bleibt ausdrücklich Paketinventar. |
| `session.mjs` | Falls benötigt: eine Original-Testinstanz mit isoliertem Profil und virtueller Anzeige starten; Laufmanifest, Bereitschaft und eigene Beendigung verwalten. |
| `qa-viewer.mjs` | Falls der verfügbare UI-Weg es benötigt: tatsächliches Originalbild lokal im Browser anzeigen und kontrollierte Eingaben an diese Sitzung weitergeben. Kein eigener Kartenrenderer und kein Ersatz des Originals. |
| `validate-inventory.mjs` | Inventar-/Unterfallzuordnung und Belegverweise prüfen; fehlende Pflichtdaten sichtbar melden. Das Tool behauptet keine visuelle Vollständigkeit. |

Nur tatsächlich benötigte Helfer umsetzen. Der PCK-Verzeichnisalgorithmus ist in `src/assets.ts:readDungeondraftPack` vorhanden; das etablierte Format nutzen, ohne den Produkt-Assetleser für diese QA-Phase umzubauen. Keine Originalprogrammdateien, kompilierten Skripte oder Bildassets ins Repo kopieren.

Falls der lokale Viewer benötigt wird, verwendet er eine eindeutige Sitzung und feste Originalbildabmessungen. Eingaben stammen aus unterstützter UI-Steuerung; Screenshot und Aktion referenzieren dieselbe Frame-/Laufkennung. Nur lokale Bindung, keine beliebigen Shellbefehle und keine Steuerung fremder Sitzungen. Einen langsamen Originalmesslauf ermöglichen; kein allgemeines Fernsteuerungsprodukt entwickeln. Nach zwei erfolglosen Versuchen oder 45 Minuten an derselben Hypothese den belegten Befund entscheiden.

### 3. HEX-00-A: direkte Inventur

Vor jeder Eingabe den tatsächlichen Bildschirmzustand lesen. Native UI-Namen und Defaults direkt aufnehmen; keine Koordinaten oder Optionslisten aus Dungeondraft übernehmen.

Durchgang: Kategorien → Werkzeugleisten → Menüs → leere Karte → begonnene Geometrie → fertige Geometrie → Einzel-/Mehrfachauswahl → Farbe/Text/Dateidialoge. Sichtbare optionale Bereiche und deaktivierte Zustände ebenfalls einordnen. Jeder Eintrag in `uiInventory` erhält die bereits vorgesehenen Felder `id/version/exactUiPath/context/commandOrControl/controlType/default/rangeOrChoices/validation/gesture/previewOrCommit/stateScope/caseIds/phase/directEvidence/classification`.

Anpassungen in `acceptance.json` bleiben auf `wonderdraftParity` beschränkt:

- Tatsächlich beobachtete Originaldaten in `original`; geplante Proben bleiben in `plannedOriginalProbe`.
- Neue konkrete Varianten als zusätzliche stabile Unterfälle; vorhandene Kennungen nicht umnummerieren.
- Tiefe Wirkungsvarianten späterer Werkzeuge dürfen bis zu ihrer Fachphase offen sein. Ihre Oberfläche, Zuordnung und offenen Fragen müssen bereits erfasst sein.
- Alle 96 bisherigen Pakethinweise klassifizieren; neue erreichbare Funktionen ergänzen. Ein interner Helfer erhält einen begründeten Einordnungsbeleg.
- `inventoryComplete` und das Tor bleiben bis zum separaten HEX-00-C-Review offen.

Der Validator prüft doppelte IDs, fehlende Gruppen-/Phasenzuordnung, verwaiste UI-/Case-Verweise, unklassifizierte Pakethinweise und nicht auffindbare Belegdateien. Ein Beleg muss Version/Sitzung und Originalrolle nennen. Grenzfälle mit fehlenden oder bloßen Quellenbelegen als gezielte Negativtests unter `tests/wonderdraft-inventory.test.mjs` prüfen. Diese Tests prüfen die Beleggrenze, nicht bloß das erfolgreiche Einlesen eines JSON-Objekts.

### 4. HEX-00-B: originale Startfolge

Die 13 in `inventoryGate.initialProbeCases` genannten Startfälle werden vollständig im festgelegten frühen Umfang ausgeführt. `WD-026.01` betrifft hier nur Themenwahl bei Neuanlage; spätere Themenwechsel bleiben bei HEX-24.

Leere Karte → Neuanlage/Abbruch → Kamera und Zoomanker → Land-/Farbzug → geänderte Werkzeugvorgabe → Abbruch → Undo/Redo → Save/Save-as-Abbruch → Karte A/B/A → Prozess vollständig beenden → neu starten → gespeicherte Karte öffnen.

Vorher, Vorschau, Commit und Abbruch aufnehmen. Zusammenhängenden Zug und Einzelklick als History-Grenzen messen; Escape im Entwurf, in ruhender Vorschau und im Dialog trennen. Sichtbare Koordinaten und Maßverhältnisse dokumentieren. Die Rohkarte wird gesichert; bei unbekanntem Binärformat durch die direkte frische Originalöffnung die erhaltene Wirkung belegen. Kein Produktimport des Wonderdraft-Kartenformats und keine aus Binärbytes geratenen internen Felder.

Ergebnis sind kleine feste Kontrollkarten WD-F01/WD-F07 und die nötigen Land-/Farbanteile von WD-F02. Ein eigener Originalbeleg wird nicht als Hostpaar oder physischer Bedienbeleg ausgegeben.

## Prüftor und getrennte Arbeitsläufe

| Lauf | Eigener Fokus | Erwartetes Ergebnis |
|---|---|---|
| HEX-00-P01 | Planen | Dieser Plan, offene Punkte, konkrete Helfer/Tests und nächste Umsetzung im Checkpoint; kein geschlossenes Originaltor. |
| HEX-00-I01 | Umsetzung: Basis und direkte Inventur | Geschützte Ausgangsbasis, isolierter Kernlauf, funktionierende Original-Teststeuerung, vollständig zugeordnetes direktes UI-Inventar; Teilfortschritt nur mit tatsächlichen Belegen. |
| HEX-00-I02 | Umsetzung: originale Startfolgen | Frühe Originalregeln, Rohkarten, vollständiger Neustart, logische Vergleichsdaten und Validatorlauf. |
| HEX-00-R01 | Fachreview / HEX-00-C | Gegen Roadmap, Plan und Originaloberfläche prüfen; kritische Folgen in eigener Sitzung wiederholen; Torentscheidung mit Liste aller Restlücken. |
| HEX-00-Nxx | Nachbesserung | Nur benannte Reviewlücken korrigieren und die betroffenen Proben erneut belegen. |
| HEX-00-Rxx | Erneuter Review | Eigener Prüfstart und Ergebnis auf dem endgültigen Stand; wiederholen, bis keine Pflichtlücke bleibt. |
| HEX-00-CLEAN-P01 | Aufräumplanung | Datei neben der Roadmap: tatsächliche technische/architektonische Schwächen der eingeführten Helfer benennen und begrenzte Maßnahmen festlegen. |
| HEX-00-CLEAN-I01 | Aufräumumsetzung | Nur die freigegebenen Befunde beheben; relevante Referenz-/Hostproben erhalten. |
| HEX-00-CLEAN-Rxx | Aufräumreview | Reproduzierbarkeit, Belegverweise, Prozessfreigabe und Kernweg erneut prüfen; Nachbesserung und eigener Review bei Lücken. |

Ein Arbeitslauf führt nicht gleichzeitig Planung, Umsetzung und fachliche Freigabe aus. Start, Fokus, Ergebnis und nächster Lauf stehen in `checkpoint.hexAtlasExecution`. Daten-/Verweisprüfung des Planungsartefakts ist keine Fachfreigabe der künftigen Umsetzung.

**HEX-00-Fachfreigabe verlangt:** direkt vollständige Oberfläche zugeordnet; alle frühen Originalfolgen im vorgeschriebenen Umfang belegt; Dungeon-Kernweg auf isolierter Kopie bestanden; kontrollierter Prozessneustart; keine Schutzverletzung; eigener Review ohne offene Pflichtlücke. **HEX-01 beginnt zusätzlich erst nach dem bestandenen separaten Aufräumreview.**

Neue Werkzeug-/Helperprüfungen gezielt ausführen, danach bei Umsetzung `npm run check`, `npm test`, `npm run build` und den betroffenen Hostweg. Test- und Buildprovenienz nennt auch verbleibende lokale Fremdänderungen, damit ein Lauf nicht fälschlich dem sauberen Repo-Commit zugerechnet wird. Original-, Host-, Großkarten-, physische und Installationsabnahmen bleiben getrennt.

Jeder abgeschlossene Plan-/Umsetzungs-/Review-/Nachbesserungs-/Aufräumlauf wird nach dem Repo-Rhythmus geprüft veröffentlicht. Vor der Arbeit und vor dem Push eingehende Änderungen integrieren. Geschützte Daten, fremde lokale Arbeit und offene Paritätsfälle bleiben erhalten.
