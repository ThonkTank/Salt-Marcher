# Musik und Ambience: Fehler, GM-Vorrang und Wiederaufnahme

Stand: 14.10.2026. Ergänzt [SMR-08](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-08--shops-wetter-und-musik),
[Scene-Wetter](weather.md) und den [Gesamtumfang](../../SCOPE.md).

## Vertrag und aktuelle Umsetzung

Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L175–190 und L270–287, verbinden
lokale Songs mit Mood-/Intensitäts-/Vibe-/Genre-Metadaten und der fokussierten
Running Scene. Die GM kann Autoplay deaktivieren; manuelle Auswahl, Queue,
Stop, Skip, Back und Loop haben Vorrang. Wetter bleibt eine unabhängige
Scenezeit-/Ort-/Klimaquelle; ein GM-Wetteroverride gilt bis zur Freigabe.
Das Quellenregister bindet den Inhaltshash
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

`storage/music.ts` hält Bibliothek, Assetmetadaten, Scene-/Subjectmetadaten,
Musikstand, Positionen und Receipts. `refreshMusicContext` übernimmt die
fokussierte Scenezeit, ihren Ort und ihre Wetter-/Umweltmerkmale. Unvollständige
Umweltinputs werden sichtbar erklärt und ersetzen nicht die letzte bestätigte
Automatikauswahl. Manuelle Holds, erzwungene und stummgeschaltete Schichten
bleiben eigene Entscheidungen. Mehrere Scenes besitzen keinen gemeinsamen
Wetterzeitpunkt; die Zukunft einer anderen Scene treibt die fokussierte Musik
nicht vorwärts.

`music-ui.ts` bindet Reads/Commands an den Workspace, schützt neuere Antworten
und hält die aktuelle Wiedergabeberechtigung getrennt von gespeicherten
Auswahlen. `LocalAudioPlayer` in `music-player.ts` setzt diese Projektion mit zwei
Songslots und einzelnen Ambience-Audioelementen um. Media-/Play-/Fadegenerationen
entziehen alten Callbacks ihre Autorität. Aktivierung bleibt zunächst stumm;
ein gespeicherter Auswahlstand allein autorisiert keine neue lokale Ausgabe.
Die bestehenden Stop-/Replyprüfungen sind Teilbelege dieses Anschlusses.

## Geschlossene Wiederaufnahmelücke

Ein Decoderfehler markiert eine Ambience-Schicht als fehlgeschlagen und pausiert
sie. Der Store führt den Fehler im Asset; dessen Metadaten und Medienbytes
bleiben erhalten. Das Asset verschwindet aus den spielbaren Schichten, bis die
GM den Fehler ausdrücklich klärt oder erneut versucht.

`fadeLayer` übersprang jedoch jede fehlgeschlagene Schicht, auch wenn sie nicht
mehr in der gewünschten Projektion vorkam. Ihr Audioelement, ihre Quelle und
der Runtimeeintrag blieben stehen. Nach `retry-asset` erschien das Asset wieder
in der gewünschten Auswahl, wurde aber durch denselben fehlgeschlagenen
Runtimeeintrag dauerhaft stumm gehalten. Drei Gegenproben reproduzierten dies,
eine davon über tatsächlichen Store und UI mit einem weiterlaufenden zweiten Sound.

Eine entfernte Fehlerschicht läuft jetzt über die bestehende `removeLayer`-
Freigabe: Fade abbrechen, Generation entziehen, Audio pausieren, Quelle lösen,
Element entfernen und Runtimeeintrag freigeben. Eine weiterhin ausgewählte
Fehlerschicht bleibt stumm, ohne automatischen Retry. Erst erneute berechtigte
Auswahl erzeugt ein neues Audioelement. Alte Decodercallbacks können weder
weitere Fehler melden noch den reparierten Owner beeinflussen. Andere Schichten
und deren laufende Fades bleiben erhalten. Persistenz-/Medienformat und
GM-Auswahl werden nicht geändert; keine Migration oder neue Fehlerverwaltung.

## Lokale Belege und ihre Aussagegrenze

`tests/desktop-audio-layer-recovery.test.mjs` prüft die produktive Runtime mit
kontrollierten Media-Promises und Animationsframes: Freigabe, erneute Auswahl,
kein stiller Retry, Entzug alter Fehlercallbacks sowie eine unabhängig
weiterlaufende Schicht. `desktop-music-stop.test.mjs` verbindet den tatsächlichen
Store-/UI-/Assetfehler-/Retryweg mit diesen Runtimewirkungen.

Bestehende Audio-Reply-, Stop- und Playerprüfungen ergänzen die drei neuen Fälle.
Die gezielte Audiogruppe bestand mit 25 lokalen Fällen. Die Coreprüfungen
`music-scene-context.test.ts`, `music-state-integrity.test.ts` und
`music-record-integrity.test.ts` prüfen außerdem unabhängige Sceneuhren,
beschädigtes fokussiertes Wetter ohne Automatikaustausch, Payload-/Rowbindungen,
Receipt-/Positionintegrität und Campaignkopien. Die Wetterintegritäts- und
Editorautoritätsprüfungen bleiben die gemeinsamen Gegenproben für GM-Overrides.
Kontrollierte Mediaelemente sind keine echten Decoder oder Nachweise freigegebenen
nativen RAMs; Host-, Klang-, Geräte-, Format-, Last- und Crashqualifikation bleiben offen.

## Nächste ausführbare Schritte

1. **Native Fehler-/Retryfolge schließen.** Echte unterstützte Formate,
   beschädigte Bytes, fehlende Medien, Playable-/Decoder-/Autoplayablehnung und
   einen langsamen Start prüfen. Ein fehlerhafter Sound darf nur seine Schicht
   stoppen; gesunde Ausgabe bleibt nutzbar. Nach ausdrücklich bestätigtem Retry
   muss die reparierte Quelle hörbar sein. Wiederholte Fehler/Entfernung mit
   DOM-/Decoder-/RAMmessung prüfen, ohne stilles Überspringen defekter Originale.
2. **Wetter-/Fokus-/GM-Vorrang gemeinsam qualifizieren.** Zwei Scenes mit
   verschiedenen Orten, Zeiten und Wetteroverride; manuelle Song-/Queue-/Loop-
   und Ambiencewahl; Scenezeit, Fokuswechsel und Freigabe kombinieren. Die
   Automatik darf einen unvollständigen Kontext nicht als neue Auswahl bestätigen.
   Native A/B/A, langsame Read-/Play-/Failureantworten und späterer Stop müssen
   ihre tatsächliche Autorität bewahren; kein Rückfall auf einen alten Crossfadeslot.
3. **Persistenz und Fehlerklärung mit echten Verbrauchern verbinden.** Die
   Musik-/Asset-/Scene-/Subjecteditoren besitzen noch ihren eigenen Draft- und
   Replyumfang. Close/Fresh bei offener Rohtexteingabe und ungeklärter
   Metadatenbestätigung prüfen; ursprüngliche Basis nicht auf neue Revisionen
   umhängen. Bibliotheksimport/-export, unabhängige Campaignkopie und Erasure
   müssen gemeinsam Medienidentitäten, lokale Metadaten und historische
   Auswahlbindungen erhalten. `retry-asset` klärt den aufgezeichneten Fehler,
   ersetzt aber keine fehlenden Bytes und überschreibt kein Medium.
4. **Konkrete Kosten messen.** Lange Bibliotheken, Queues und wiederholte
   Schichtwechsel messen. Nur benötigte Asset-/Kontextdaten lesen, statt eine
   gesamte Bibliothek für kleine Runtimeantworten zu kopieren. Begrenzte Queries
   und Darstellung gemeinsam liefern; keine zweite Queue-/Musikpersistenz.
