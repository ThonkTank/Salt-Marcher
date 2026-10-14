# Musik und Ambience: Fehler und Wiederaufnahme

Ergänzt [SMR-08](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-08--shops-wetter-und-musik)
und [Scene-Wetter](weather.md). Fachquelle sind die im
[Quellenregister](../../scope-sources.json) gebundenen Program Capabilities,
L175–190 und L270–287.

## Nutzerablauf und Vertrag

Der GM verwendet lokale Songs mit Mood-/Intensitäts-/Vibe-/Genre-Metadaten und
Ambience der fokussierten Running Scene. Manuelle Auswahl, Queue, Stop, Skip,
Back, Loop und deaktiviertes Autoplay haben Vorrang vor Automatik.

- `storage/music.ts` besitzt Bibliothek, Asset-/Scene-/Subjectmetadaten,
  Wiedergabestand, Positionen und Receipts. Kontext verwendet die fokussierte
  Scenezeit, ihren Ort und ihre Wetter-/Umweltmerkmale. Fehlende Umweltinputs
  werden erklärt und ersetzen keine bestätigte Automatikauswahl.
- `music-ui.ts` bindet Antworten und Commands an den Workspace.
  `LocalAudioPlayer` hält zwei Songslots und einzelne Ambience-Elemente.
  Gespeicherte Auswahl autorisiert nach Aktivierung keine lokale Wiedergabe;
  Media-/Play-/Fadegenerationen entziehen alten Callbacks ihre Autorität.
- Decoderfehler stoppen nur die betroffene Schicht und werden am Asset gespeichert.
  Metadaten und Bytes bleiben erhalten. Entfernte Fehlerschichten geben Fade,
  Audioquelle, Element und Runtimeeintrag frei; andere Schichten laufen weiter.
  Ausgewählte Fehlerschichten bleiben stumm, ohne automatischen Retry.
- Erst ausdrückliche Fehlerklärung und berechtigte erneute Auswahl erzeugen eine
  neue Wiedergabe. Alte Fehlercallbacks beeinflussen sie nicht. `retry-asset`
  klärt den aufgezeichneten Fehler; es ersetzt keine fehlenden Medienbytes.

Das Live-Soundboard verwendet denselben Musikstand und Writer für Transport,
Favoriten, gemeinsame Queueauswahl und Ambience. Seine paginierte Bibliothek
bleibt installationweit; Favoriten gehören zur Campaign. Suchwechsel entfernen
alte Treffer sofort, entfernte Controls dürfen keine andere Campaign bedienen.
Die [Soundboardprüfung](../../../tests/desktop-soundboard-context.test.mjs)
verbindet den echten Controller mit dem Store; der Audioport ist kontrolliert.
Das beweist keine hörbare native Ausgabe.

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
