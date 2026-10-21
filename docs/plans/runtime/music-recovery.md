# Musik und Ambience: Fehler und Wiederaufnahme

Ergänzt [SMR-08](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-08--shops-wetter-und-musik)
und [Scene-Wetter](weather.md). Fachquelle sind die im
[Quellenregister](../../scope-sources.json) gebundenen Program Capabilities,
L175–190 und L270–287.

## Nutzerablauf und Vertrag

Der GM verwendet lokale Songs mit Mood-/Intensitäts-/Vibe-/Genre-Metadaten und
Ambience der fokussierten Running Scene. Manuelle Auswahl, Queue, Stop, Skip,
Back, Loop und deaktiviertes Autoplay haben Vorrang vor Automatik.

### GM-Stopp und verspätete Antworten

„Stopp“ in Konsole, Miniplayer und Soundboard benötigt keine vorherige
Speicherung offener Beschreibungen, keinen Positions-Checkpoint und keine
vorgeschaltete Musikabfrage. Eine ausstehende Leseantwort hält Stop nicht auf.
Als absoluter GM-Befehl stoppt er den aktuellen Writerstand auch nach einer
inzwischen bestätigten Auswahl; Queue und Beschreibungen werden nicht aus
einem alten Snapshot ersetzt. Ungültige/zukünftige Revisionen und veraltete
relative Befehle bleiben gesperrt. Der bestehende Receipt verhindert, dass ein
wiederholter Stopauftrag eine spätere ausdrückliche Wiedergabe erneut stoppt.
Vor Stop begonnene Wiedergabevorbereitungen prüfen nach ihren asynchronen
Schritten dieselbe Stop-Revision und können die Stille nicht wieder aufheben. Der
bestehende Writer setzt Status, manuellen Vorrang und Position null gemeinsam;
ungültige Eingaben bleiben zur Korrektur offen. Eine verspätete
Metadatenantwort darf die Ausgabe nicht erneut starten. Beim anschließenden
Bearbeiten bleiben unveränderte Notizen einschließlich ihrer Zeilenenden
erhalten. `desktop-music-stop.test.mjs` und die native Szenenprüfung decken
diesen Weg auch bei ausgefallener Positionsspeicherung ab.

### Audio-Schichten und Fehlerklärung

- [storage/music.ts](../../../src/app/storage/music.ts) besitzt Bibliothek, Asset-/Scene-/Subjectmetadaten,
  Wiedergabestand, Positionen und Receipts. Kontext verwendet die fokussierte
  Scenezeit, ihren Ort und ihre Wetter-/Umweltmerkmale. Fehlende Umweltinputs
  werden erklärt und ersetzen keine bestätigte Automatikauswahl.
- [music-ui.ts](../../../src/app/music-ui.ts) bindet Antworten und Commands an den Workspace.
  [LocalAudioPlayer](../../../src/app/music-player.ts) hält zwei Songslots und einzelne Ambience-Elemente.
  Gespeicherte Auswahl autorisiert nach Aktivierung keine lokale Wiedergabe.
  Die Freigabe für Song beziehungsweise gesamte Ambience folgt direkt daraus, ob
  ihre bestätigte Revision neuer als die letzte Stop-Revision ist. Zwei
  zusätzliche veränderliche Freigabeflags entfallen. Einzelne ausdrücklich gewählte
  Ambience-Schichten behalten ihre getrennte Freigabe. Media-/Play-/Fadegenerationen
  entziehen alten Callbacks ihre Autorität.
- Decoderfehler stoppen nur die betroffene Schicht und werden am Asset gespeichert.
  Metadaten und Bytes bleiben erhalten. Entfernte Fehlerschichten geben Fade,
  Audioquelle, Element und Runtimeeintrag frei; andere Schichten laufen weiter.
  Ausgewählte Fehlerschichten bleiben stumm, ohne automatischen Retry.
- Erst ausdrückliche Fehlerklärung und berechtigte erneute Auswahl erzeugen eine
  neue Wiedergabe. Alte Fehlercallbacks beeinflussen sie nicht. `retry-asset`
  klärt den aufgezeichneten Fehler; es ersetzt keine fehlenden Medienbytes.

### Soundboard und Titelhistorie

Das Live-Soundboard verwendet denselben Musikstand und Writer für Transport,
Favoriten, gemeinsame Queueauswahl und Ambience. Seine paginierte Bibliothek
bleibt installationweit; Favoriten gehören zur Campaign. Suchwechsel entfernen
alte Treffer sofort, entfernte Controls dürfen keine andere Campaign bedienen.
Die [Soundboardprüfung](../../../tests/desktop-soundboard-context.test.mjs)
verbindet den echten Controller mit dem Store; der Audioport ist kontrolliert.
Das beweist keine hörbare native Ausgabe.

„Zurück“ entnimmt den letzten Titel aus der gespeicherten Historie. Dieser
Rückweg legt den verlassenen Titel nicht erneut hinein: A → B → C und zweimal
„Zurück“ ergibt B → A. Neue Auswahl und Vorwärtsschritte führen die begrenzte
Historie weiterhin fort. Queue, Autoplayentscheidung und Medienbeschreibungen
bleiben dabei erhalten. Derselbe Command wird bei verlorener Antwort über
seinen vorhandenen Receipt erkannt und verbraucht keinen weiteren Rückschritt.
`desktop-music-history.test.mjs` prüft dies einschließlich Close/Fresh und dem
erneuten Vorwärtsweg nach einem Rückschritt. Gespeicherte ältere Historien
werden erhalten; es gibt keine neue Historientabelle oder Schemaänderung.

### Atlasnavigation und native Prüfung

Der Einstieg aus dem Atlas verwendet dieselbe Arbeitsbereichsnavigation wie
die übrige Anwendung. Ein offener Atlaszug blockiert weiterhin den Wechsel;
nach Abschließen oder Verwerfen sind Musik und Live-Spiel ohne Rückweg über
die Kampagnenliste erreichbar. Navigation wird als bestehender DOM-Knoten
umgestellt; ihre Handler, Save-Grenzen und Kampagnenidentität bleiben erhalten.
`desktop-workspace-navigation.test.mjs` prüft Eigentum und Wiederherstellung.
`tools/test-desktop-scene-music-navigation.mjs` prüft nativ mit 100 % und 200 %:
Atlaszug verwerfen, zwei Szenen mit verschiedener Musikintensität speichern,
manuelle Auswahl bei aktivierter Automatik über Fokuswechsel erhalten, Stop,
Atlas-Rückkehr, stillen Neustart und ausdrückliches Play mit nativer Dekodierung.
Szenenprosa und Medienmetadaten bleiben dabei unverändert. Dieser Teilbeleg
ersetzt weder hörbare Hardwareprüfung noch Wetter-/Ambience- und Race-Abnahmen.

### Bibliotheksintegrität

Bibliothekssuche, automatische Song-/Ambienceauswahl und Bibliotheksexport
verwenden die bereits gelesenen Assetzeilen direkt. Derselbe Zeilenleser wie
bei einer Einzelauswahl prüft Identität, Revision, Prüfsumme und aktuelle
Dateigröße; es gibt keinen Mediencache. Beschädigte Treffer werden in der Suche
gemeldet und in der Automatik ausgelassen; beim Export bricht die Prüfung ab.
`music-record-integrity.test.ts` prüft außerdem Seitengrenzen trotz beschädigter
Treffer sowie entfernte, wiederhergestellte und veränderte Mediendateien.

## Nachweise und nächste Arbeit

[Runtime-Prüfungen](../../../tests/desktop-audio-layer-recovery.test.mjs) prüfen
Freigabe, erneute Auswahl, fehlenden stillen Retry und unabhängige Schichten.
[Store-/UI-Prüfungen](../../../tests/desktop-music-stop.test.mjs) verbinden Assetfehler
und Retry mit diesen Wirkungen. Die Coreprüfungen zu Musik-Kontext, -Zustand und
-Records prüfen Sceneuhren, defektes Wetter, Identität/Revision, Receipts,
Positionen und Campaignkopien. Kontrollierte Mediaelemente belegen keine nativen
Decoder, hörbare Ausgabe oder freigegebenen nativen RAM.

1. Nativ gültige Formate, defekte/fehlende Medien, Play-/Autoplayablehnung,
   langsamen Start und ausdrücklichen Retry prüfen. Gesunde Ausgabe muss weiterlaufen;
   reparierte Quellen müssen hörbar sein. Wiederholte Entfernung auf Ressourcen messen.
2. Zwei Scenes mit unterschiedlichen Orten, Zeiten und Wetteroverride mit
   manueller Queue-/Loop-/Ambiencewahl kombinieren. A/B/A, verspätete Antworten,
   Freigabe und Stop dürfen keinen alten Crossfadeslot reaktivieren.
3. Editor-Rohwerte und ungeklärte Metadatenbestätigung bei Close/Fresh prüfen.
   Import/Export, unabhängige Kopie und Erasure müssen Medienidentitäten,
   lokale Metadaten und historische Auswahlbindungen erhalten.
4. Große Bibliotheken, Queues und häufige Schichtwechsel messen. Nur benötigte
   Asset-/Kontextdaten lesen; keine zweite Queue oder Musikpersistenz einführen.
