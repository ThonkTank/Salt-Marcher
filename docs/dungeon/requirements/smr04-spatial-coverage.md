# SMR-04: räumlicher Dungeon, Paths und Passages

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: dungeon
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Scope und Eingänge

Dieses Paket ordnet den räumlichen Dungeonbedarf aus den gepinnten
SaltMarcher-Quellen konkreten vorhandenen Arbeitsorten oder ausdrücklich noch
fehlenden Folgepaketen zu. Es entscheidet weder das künftige Speicherschema
noch die endgültige Hostplattform. Attributvererbung, Autorenprosa und
Templates gehören zu [#52](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/52);
Graphbedienung, Trap-Lifecycle, FTG-Städte und Produktcode sind nicht Teil
dieses Abgleichs.

Verbindliche Eingänge sind die gepinnten Anforderungen
[Dungeon L24–62](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md#L24-L62),
[Dungeon L147–174](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md#L147-L174),
[Editor L41–170](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L41-L170)
und deren unveränderte Hashes in `docs/project/requirements/sources.json`:
`60e1e72432c1b9073b162cf9eedb8959dc36ae71cfa0c6ee82d968ed71bb7a0f`
beziehungsweise
`b596a4a30d75413a96c1d40b862b473ed8f480baa8ec18ed2217431987cba20d`.

## Gepinnte Ausgangsbasis

Die vorhandenen Arbeitsorte liefern wertvolle, aber engere Grundlagen:

- Die [Dungeondraft-Werkzeugfolge](tools.md) plant
  Geschosse, freie Wände/Portale und grafische Pfade getrennt. Sie prüft die
  Originalwerkzeuge, nicht das neue kontinuierliche 3D-Domänenmodell.
- [HEX-05 und HEX-22](../../atlas/requirements/atlas.md) führen Dungeonräume in
  derselben Atlasansicht und History wie Welt und Stadt. Sie definieren keine
  vertikalen Volumes, parametrischen 3D-Paths oder sensorischen Passages.
- Das damalige [MapDocument](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/5b57706b68f131c2d292bed6159cd6d3221f2ef8/src/model.ts#L10-L24)
  bindet jede Entität an genau ein `floorId`; ein
  [Room](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/5b57706b68f131c2d292bed6159cd6d3221f2ef8/src/model.ts#L38-L97)
  ist dort eine `Building`-Kontur. Der
  [MapPath](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/5b57706b68f131c2d292bed6159cd6d3221f2ef8/src/model.ts#L185-L200)
  ist eine zweidimensionale darstellende Linie. `Door` und
  [PassageDetails](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/5b57706b68f131c2d292bed6159cd6d3221f2ef8/src/model.ts#L119-L147)
  besitzen bereits Text, `open|closed|locked`, Geheimstatus und optionales
  `blocksLight`, aber weder ganze 3D-Grenzflächen noch getrennte Sicht-, Licht-
  und Schallübertragung oder externe Ziele.
- Der Kandidat in [PR #13](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13)
  schützt einen äußeren Konturpunkt eines Rooms auf einem Floor in der
  gemeinsamen History. Sein
  [enger Plan](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/de11ab0436cb9861d178a08bd19551f95bb47411/ROADMAP-E2E01-DUNGEON-GEOMETRY-PLAN.md#L39-L53)
  schließt neue Räume und Geschosse ausdrücklich aus. Er ist eine
  Integrationsgrundlage, kein Nachweis für die untenstehenden Fähigkeiten.

Darum dürfen heutige 2D-Zeichen-, Geschoss-, Portal-, Path- oder
Save/Reopen-Tests nicht als 3D-/Volume-/Passage-Abnahme gelesen werden.

## Quellen-zu-Paket-Matrix

Die Matrix bewahrt die quellengebundene Lückenanalyse gegenüber der oben gepinnten Ausgangsbasis. Die technischen Themenkennungen bezeichnen Anforderungen. Der aktuelle Integrationsstand steht im folgenden Abschnitt; damalige Lücken sind keine neue Arbeitsqueue.

| Bedarf | Exakte Quellpflicht | Vorhandener Arbeitsort oder Lücke | Zukünftig direkt prüfbares Nutzerverhalten |
| --- | --- | --- | --- |
| Kontinuierliches 3D-Gefüge und Schnitte | [Dungeon L26–42](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md#L26-L42), [Editor L41–61](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L41-L61): ein Dungeon ist ein Ganzes; 5-Fuß-Zellen und -Höhenschritte, Floor/Volume/Standarddecke, 10-Fuß-Schnitt, Onion-Slices, gestenübergreifende Schnitte und unabhängig editierbare Flächen. | `ROADMAP-PARITY-TOOLS` Phase 3 deckt Geschossbedienung ab; heutige `Floor.elevation` plus 2D-Entitäten sind kein Volume. **Paket fehlt:** `SMR04-DUNGEON-VOLUME` für Domänenvertrag, Schnitt-/Gestenmodell, Persistenz und Atlasprojektion. | Boden zeichnen erzeugt begehbares Volume und Standarddecke; Höhe auf 5/15 Fuß ändern, Räume stapeln, einen Zwischenboden öffnen und während eines Zugs den Schnitt wechseln. Undo/Redo, Save/Reopen und Atlaszoom erhalten exakt dasselbe 3D-Gefüge. |
| Volume als Geometrie gegenüber stabiler Room-Identität | [Dungeon L44–62](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md#L44-L62), [Editor L84–104](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L84-L104) und [Editor L512–529](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L512-L529): Volume ist geometrisch, Room ist stabile Autorenidentität; Bewegung erhält die Zuordnung, Split/Merge ordnet bestmöglich neu zu, Autoreninhalt bleibt notfalls ungebunden erhalten. | Rooms besitzen heute stabile IDs und Keys; PR #13 schützt eine 2D-Konturänderung. Eine von Geometrie getrennte Volume-Zuordnung und vollständige Split-/Merge-Reassoziation fehlen. **Paket fehlt:** `SMR04-ROOM-VOLUME-LIFECYCLE`. | Einen beschriebenen Room samt Featureanker bewegen, teilen und wieder verbinden. Die alte Room-ID folgt genau einem bestpassenden Ergebnis; weitere Volumes erhalten neue leere Rooms. Prosa wird nicht dupliziert, nicht sicher zuordenbarer Inhalt bleibt sichtbar ungebunden, und Undo/Redo sowie Neustart erhalten jede Entscheidung. |
| Abgeleitete Navigationsflächen | [Dungeon L44–49](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md#L44-L49), [Editor L114–117](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L114-L117) und [Editor L516–520](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L516-L520): Kreuzungen dürfen abgeleitet werden, besitzen aber keine stabile Autorenidentität und dürfen neu berechnet werden. | `DungeonRoute` und Atlas-Entrance-Routen sind heute semantische Links, kein aus Volumegeometrie berechnetes Navigationsnetz. Gehört nach dem Volumevertrag in dessen eigenes Ableitungs-/Performancepaket; nicht als neuer authored Owner modellieren. | Einen Korridor zur T-Kreuzung verformen und zurücknehmen. Die abgeleiteten Navigationsflächen ändern sich, während Room-, Passage- und Autorenkennungen unverändert bleiben; Save/Reopen erfindet keine dauerhaften Navigationsobjekte. |
| Parametrischer, nicht verzweigender 3D-Path | [Dungeon L147–160](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md#L147-L160), [Editor L106–146](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L106-L146): Endpunkte, optionale Wegpunkte, Querschnitt und Segmentformen erzeugen gewöhnliche Volumes; Route ist ableitbar, unmögliche Wege scheitern, Umleitung bleibt Vorschau, Konvertierung in feste Area beendet Autorouting. | Dungeondraft Phase 5 und heutiger `MapPath` decken 2D-Grafikpfade ab; HEX-14 deckt Overworld-Straßen ab. Beide sind ausdrücklich kein Dungeon-Verbindungs-Path. **Paket fehlt:** `SMR04-DUNGEON-PATH-PASSAGE`, nach dem Volumevertrag. | Zwei Volumes über Höhenunterschied mit Korridor-, Treppen- und Schachtsegmenten verbinden, Wegpunkt setzen, Endpunkt bewegen, unmögliche Route ohne Wirkung ablehnen und eine Route bewusst in feste Geometrie umwandeln. Vorschau, Apply/Cancel, Undo/Redo und Neustart bleiben konsistent. |
| Passage als stabile Grenzidentität | [Dungeon L162–174](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md#L162-L174), [Editor L148–170](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L148-L170): Passage besitzt stabile Identität, ganze 5-Fuß-Grenzflächen, Größenänderung unter derselben ID, eigene Inhalte und sichtbaren ungebundenen Zustand nach Geometrieverlust. | Dungeondraft Phase 4 und `Door`/`PassageDetails` liefern 2D-Tür-/Portalgrundlagen und Raum-Key-Verweise. Whole-face-3D-Geometrie, Rebinding und erhaltener ungebundener Zustand fehlen; sie gehören zum fehlenden Path-/Passagepaket. | Eine 5×10-Fuß-Passage auf 10×15 Fuß ändern, Geometrie entfernen und passend neu anlegen. ID, Beschreibung und Key bleiben erhalten; eindeutige Reassoziation erfolgt automatisch, mehrdeutige nur nach Vorschau und GM-Wahl. Überlappung scheitert vollständig ohne Teilwirkung. |
| Passierbarkeit und sensorische Übertragung | [Dungeon L162–167](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md#L162-L167), [Editor L186–196](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L186-L196): Passierbarkeit, Sicht, Licht und Schall sind unabhängige Fakten; bestätigte Zustandsaktionen dürfen mehrere davon atomar ändern. | `PassageDetails.state` und `Door.blocksLight` sind nur eine Teilbasis. Getrennte Sicht-/Licht-/Schallwerte und atomare Mehrzustandsaktionen fehlen; Vertrag und Commands gehören in das Path-/Passagepaket, Reise-/Player-Verbraucher bleiben eigene Folgeabnahmen. | Dieselbe Passage nacheinander als unpassierbar aber licht-/sichtdurchlässig, als schalldurchlässig aber sichtblockierend und durch eine bestätigte Aktion vollständig geöffnet prüfen. Cancel und Fehler ändern nichts; Apply/Undo/Redo/Restart ändern alle gewählten Fakten gemeinsam. |
| Verbindungen innerhalb/außerhalb des Dungeons | [Dungeon L169–174](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md#L169-L174), [Editor L165–170](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L165-L170) und [Editor L551–574](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L551-L574): jede Seite besitzt Richtung, Rücklink, Fakten und Reisezeit; Dungeongrenzen sind kein Sondertyp, Mehr-Dungeon-Aktionen sind atomar, fehlende Ziele bleiben sichtbar kaputt. | Atlasplatzierungen und `DungeonRoute` liefern IDs/Entrance-Links, aber keinen beidseitigen Passagevertrag. Erfordert im Path-/Passagepaket außerdem eine ownerübergreifende Command-/Persistenzgrenze; P02/P04 und Reise bleiben harte Eingänge. | Passage A mit Passage B in einem zweiten Dungeon verbinden, nur eine Rückrichtung setzen, unterschiedliche Seiteninhalte behalten, gemeinsam rückgängig machen und neu öffnen. Danach Ziel B entfernen: A bleibt mit derselben ID sichtbar und ausdrücklich nicht verfügbar, ohne lokalen Inhalt zu verlieren. |
| Größen-, Reaktions- und Verbraucherqualifikation | [Dungeon L302–321](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon.md#L302-L321), [Editor L576–584](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-editor.md#L576-L584): mindestens 100.000 authored cells; lokale Arbeit skaliert mit sichtbaren/berührten Regionen; erstes nutzbares Viewport/Context p95 2 s, Kamera/hover p95 16 ms, lokale Vorschau p95 50 ms, Fortschritt schwerer Vorschauen binnen 100 ms, Abbruch ab 2 s ohne blockierte Kamera/Selection/Reads, normaler Commit p95 500 ms und passive Sichtaktualisierung p95 100 ms. | HEX-08 besitzt ein getrenntes Großwelt-/Streamingtor; heutige Dungeon-Parität belegt diese Volume-/Routinggröße nicht. Nach den drei Fachpaketen fehlt ein gemeinsamer `SMR04-DUNGEON-SPATIAL-QUALIFICATION`-Lauf für Laden, Authoring und Commit. Die passive Sichtaktualisierung bleibt beim PlayerView-Owner `SMR-10` / `SMR-AC-14` / E2E-04 und konsumiert später die bestätigte sensorische Passageprojektion; sie wird nicht durch ein Dungeon-Renderermaß freigegeben. | 100.000 sparse 3D-Zellen mit gestapelten Volumes, Paths und Passages öffnen und bis zum ersten nutzbaren Viewport/Context messen; Schnittwahl, Hover und lokale Preview gegen 16/50 ms p95 prüfen. Eine schwere Path-/Volumevorschau zeigt binnen 100 ms Fortschritt, lässt sich oberhalb 2 s abbrechen und blockiert weder Kamera, Auswahl noch unabhängige Reads; ein gewöhnlicher Commit bleibt unter 500 ms p95. Offscreen-Inhalt darf keine globale Neuberechnung erzwingen. Getrennt aktualisiert die passive PlayerView nach Bewegung oder Sichtänderung binnen 100 ms p95 ausschließlich aus bestätigten Sicht-/Licht-/Passagefakten. Jede Überschreitung bleibt mit Rohmessung und zuständigem Folgeowner offen. |

## Technische Entscheidung vom 11.10.2026

Die räumliche Wertsemantik, Roomidentität, Paths/Passages, Features/Templates/
Graph und Laufzeitgeometriekorrektur stehen nun im [Runtimeplan](../../atlas/contract/spatial-runtime.md).
Persistenz folgt dem einen SQLite-Writer, nicht dem bestehenden Volume-/
Whole-Document-Dateiformat. Aktueller Volumecode ist ein geprüfter möglicher
Algorithmuslieferant, keine vorgeschriebene Architektur. Room-Key bleibt
geometrieunabhängig, Split/Merge erhält Prosa und stabile Identitäten.
Die folgenden alten Istbefunde bleiben datiert; Implementations-/Codecdetails
und direkte Fachqualifikation sind weiterhin zu liefern.

## Abhängigkeiten und Abnahmefolge

Die zentrale [Atlaspriorisierung](../../atlas/requirements/atlas.md#wie-kommen-wir-zum-ziel) bestimmt die Lieferung. Die folgenden Schritte sind Datenabhängigkeiten innerhalb der räumlichen Facharbeit, keine zusätzliche Gesamtlieferfolge. Originalgesten werden nach dem gemeinsamen Ergebnismaßstab bewertet.

1. `SMR04-DUNGEON-VOLUME` implementiert den entschiedenen räumlichen
   Vertrag und seine 2D-Schnittprojektion im gewählten Store. Eine bestehende
   `Floor`- oder Building-ID darf nicht stillschweigend zur neuen Volume- oder
   Room-Wahrheit erklärt werden.
2. `SMR04-ROOM-VOLUME-LIFECYCLE` bindet stabile Autorenidentitäten an diese
   Geometrie und beweist Move/Split/Merge/Reassignment ohne Textverlust.
3. `SMR04-DUNGEON-PATH-PASSAGE` baut darauf Endpunkte, Materialisierung,
   Passages, sensorische Fakten und externe Links. Der heutige grafische
   `MapPath` darf nicht als Abkürzung wiederverwendet werden, solange der
   Domänenunterschied nicht ausdrücklich modelliert ist.
4. Erst danach qualifiziert der gemeinsame Größenlauf die zusammenhängende
   Folge. Dungeondraft-Parität und HEX-05/22 bleiben Regressionen, aber keine
   Ersatzabnahme.

Persistente Änderungen benötigen Save/Reopen, Recovery und den gemeinsamen
Atlas-Command-/History-Pfad mit der gewählten Transaktionsgrenze. Originalvergleich gilt weiter für übernommene
Dungeondraft-Werkzeuge; die zusätzlichen SaltMarcher-Fachziele werden gegen die
hier gepinnten Anforderungen geprüft.

## Stand und offene Fähigkeiten

Der Quellenabgleich stammt aus `5b57706b68f131c2d292bed6159cd6d3221f2ef8`. Das Volume-Fundament wurde anschließend über [#151](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/151) auf Shared `dd7311e0ca310cee747cc8368fe87165ff2cfad9` integriert. Room-Identität bei Move/Split/Merge bleibt Bedarf in [#166](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/166); generierte Dungeon-Paths, vollständige Passages und die gemeinsame Größen-/Verbraucherqualifikation sind weiter offen. Dieser Quellenabgleich schließt weder #44 noch SMR-04.

Key-Beschreibungen bestimmen Raumgrenzen und Höhen ohne große temporäre Arrays
oder Argumentlisten. Die [Key-Prüfungen](../../../tests/campaign/desktop-key-store.test.mjs)
decken 100.000 Volumenspalten mit 200.000 Höhenintervallen, große Konturen,
Sammeländerungen an 1.001 Räumen mit Undo/Redo sowie den Schutz von privaten Texten
und gültigen Backups bei beschädigten Key-Daten ab. Die
[Oberflächenprüfungen](../../../tests/atlas/desktop-surface.test.mjs) prüfen diese
Volumengröße auch beim Nachschlagen und Neuverknüpfen von 20.000 markierten
Flächen. Der Volumenursprung wird je Neuverknüpfung einmal berechnet; Prosa,
Fragmentkennungen und nicht mehr zuordenbare Flächen bleiben erhalten.
Pfadanker, Fallenfelder und Oberflächen verwenden dieselbe Ursprungsberechnung
im Volumenmodell. Die [räumlichen Prüfungen](../../../tests/atlas/desktop-volume-spatial.test.mjs)
prüfen Pfadanker und Feldeintritt bei dieser Größe. Die automatische Ankerwahl
behält nur die nächstgelegene Grenzfläche und erhält die Reihenfolge bei Gleichstand.
Das sind lokale Prüfungen; eine native Gesamtqualifikation bleibt offen.

Öffentliche Raum-Key-Ausgaben verwenden die stabile Raumnummer und das öffentliche
Raumlabel. Interne Levelnamen stehen nur in der GM-Fassung. Das gilt für Markdown,
das druckbare Karte-/Key-Dokument und den Key-Anteil des öffentlichen JSON;
Autoreninhalte und Levelzuordnungen werden dabei nicht verändert.

## Direkte Rasterzüge (0.130, 15.10.2026)

Der Desktop-Volumeneditor bietet zusammenhängende Pinselzüge mit rundem oder
quadratischem Radius (0–10 Rasterzellen), gefüllte Rechtecke und Ellipsen.
Dieselben Formen bearbeiten Hinzufügen, Radieren, Boden-, Decken- und Wandflächen
sowie das gewählte Medium. Sparse Mausereignisse werden zwischen den Rasterpunkten
interpoliert; PageUp/PageDown kann während eines Zugs den Schnitt ändern.
Loslassen schreibt den vollständigen Zug unmittelbar als eine gemeinsame
Historyaktion. Escape, verlorener Pointer oder Abbruch verwerfen den offenen
Mauszug. Ein zu großer Zug wird vollständig verworfen, nicht als Präfix gespeichert.

Eine genaue inklusive X/Y/Z-Bereichseingabe bleibt ausdrücklich Vorschau bis zur
Übernahme. Quelle, Raum-/Volumenrevision und Werkzeugwerte werden bei Beginn
festgehalten. Nach einem Konflikt kann die Vorschau verworfen und der bestätigte
Stand neu geladen werden; ein neuer Lesevorgang wertet den alten Zug nicht auf.
Während einer Speicherung beginnt kein zweiter Zug. Der vorhandene Store schützt
auch hier atomare History, Identitäten, Keyprosa und Split-Zuordnung. Auch nach vollständigem Radieren bleiben Room-ID und Key
lesbar; Neuzeichnen bindet dieselbe Identität wieder an Geometrie. Leeren und
Neubinden lassen sich einzeln zurücknehmen.

Zoom per Mausrad/Schaltflächen, Verschieben per mittlerer Maustaste/Pfeiltasten
und Einpassen ändern keine Autorenfakten. Die Kamera bleibt bei Schnittwechseln
und gewöhnlichen Zügen erhalten, damit auch jenseits der ursprünglichen Kontur
gezeichnet werden kann. Markierte Zellen und ihre Höhenausdehnung sind vor dem
Loslassen sichtbar. Hinzufügen verwendet weiterhin die bestehende 10-Fuß-Schale
an jeder gewählten Ausgangshöhe; Radieren entfernt 5-Fuß-Zellen.

Der bestehende Store begrenzt einen Zug auf 2000 Zellen. Größere Arbeiten benötigen
mehrere Züge; eine schwere asynchrone Gesamtvorschau wird damit nicht behauptet.
Tests: `tests/atlas/desktop-volume-stroke.test.mjs` prüft lückenlose Züge, negative
Koordinaten, Schnittwechsel, Formen und Grenzen sowie echte Store-History und
Fresh-Reopen mit unveränderter Prosa. Dies erweitert die räumliche Bedienung,
belegt aber weder die gesamte 100.000-Zellen-Latenzabnahme noch alle geforderten
Auswahl-/Transformationsformen oder den vollständigen kontinuierlichen Atlas.

## Grundriss zeichnen und als Bild ausgeben

Eine freie Raumgruppe kann im Erzeugungsdialog mit „Leer beginnen“ angelegt
werden. Räume und Türen werden anschließend mit den gemeinsamen Zeichenwerkzeugen
bearbeitet. Der Bildexport liest die bestätigte Geometrie; er verändert keine
Raum-, Tür- oder Keydaten. Kacheln, Quell-Fence, Bildgrößenlimit und die getrennte
öffentliche Projektion bleiben die Exportgrenzen.

Bildexport und bearbeitbare Kampagnensicherung teilen einen Atlas-Ausgabelauf.
Dadurch kann nur eine Ausgabe zugleich starten. Eine
Workspace-Aktivierung verwirft dessen UI-Zuständigkeit, auch bei Wiederverwendung
desselben Workspace-Objekts. Späte Lese- und Speicherantworten können weder den
neuen Export sperren/freigeben noch dort einen Erfolg oder Fehler anzeigen. Auch
das Bestätigen offener Eingaben bleibt an dieselbe Aktivierung gebunden. Diese Fälle prüft
`tests/atlas/desktop-atlas-canvas.test.mjs` mit kontrollierten Antworten.

`python tools/ui-session.py node tools/test-desktop-dungeon-groundplan.mjs`
zeichnet drei benannte Räume und zwei Türen, vergrößert eine Wand samt Tür,
prüft Undo/Redo und die tatsächlich gespeicherten PNG-Pixel und öffnet den Stand
nach regulärem Prozessende erneut. Der gemeinsame native Sitzungshelfer prüft
Laufzeitdateien, frische Aufnahmen und verschwundene PIDs. Der Ablauf läuft bei
100 und 200 Prozent Browserzoom. Ein Kampagnenwechsel während zurückgehaltener
Leseantworten lässt nur den neuen Export speichern. Verzögerte Speicherantworten
und erneute Aktivierung desselben Workspace-Objekts sind dadurch nur im DOM-Test,
nicht nativ qualifiziert. `QA_EVIDENCE_DIR` trennt Varianten und Vergleichsläufe.
