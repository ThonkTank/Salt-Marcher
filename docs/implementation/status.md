# Aktueller Stand

Stand: 8. November 2026. Regulärer Produkteinstieg bleibt Atlas V7 mit
Dateiformat 22 und Generierungsrezept 4. Der optionale Electron-/Pixi-Höhenversuch
verwendet Format 24 (`atlas-p0-height-2`). [README](../../README.md) enthält
Befehle, [Architektur](../architecture.md) Zuständigkeiten und
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Ergebnis und Auftragsgrenze

Aaron hat nach dem Review die nächsten Schritte des bestehenden
[Aufräumplans](atlas-rebuild-plan.md) zur Umsetzung beauftragt. D11, die lokale
Rasterpriorität und reine Reads während des Speicherns sind implementiert.
Die gemeinsame Prüfung am gebauten Kandidaten läuft; aus dieser Zwischenbilanz
folgt noch keine neue Leistungsfreigabe.

Die Freigabe wird aus benötigten Quellen und dem tatsächlich eingereichten
lokalen Terrain der aktuellen Ansicht abgeleitet. UI, Eingabe und lesende
Beobachtung verwenden denselben Vertrag. Ein früher Druck beginnt keine
Modellgeste; Halten und Bewegen lösen später nichts aus. Loslassen und ein
neuer Druck sind erforderlich. Kurze gültige Klicks bleiben unmittelbar wirksam.
Verlässt der Pinsel seine sichtbare Grundlage vollständig, endet die weitere
Wirkung; angenommene Änderungen bleiben eine Undo-Aktion. D10 bleibt erhalten:
Halten wirkt weiter, langsamere Züge wirken stärker, verzögerte Verarbeitung
sammelt keine große Nachholdosis an.

## Umgesetzt und gezielt geprüft

- Die wartende Quellengeste, `pressPending` und der Punktepfad entfallen.
  Aktueller Werkzeugbedarf lädt unabhängig von einer Geste. Nur der neueste
  Eingabepunkt und höchstens eine noch nicht dargestellte Dosis bleiben erhalten.
- Der vorhandene Rasterdispatcher priorisiert angenommene lokale Änderungen,
  dann den lokalen Bildaufbau und übrige sichtbare Kacheln. Bedarfsklassen werden
  nicht im selben Batch vermischt. Nach vier konkurrierenden lokalen Batches
  darf höchstens eine Restkachel fortschreiten. Ein Worker und eine laufende
  Anfrage bleiben; Quellversionen werden innerhalb eines Batches nicht gemischt.
- `readRegion` und `readPresentation` umgehen die Mutationsqueue während
  asynchroner Save-Phasen. Der ungenutzte `readTiles`-Vertrag wurde vollständig
  entfernt. Ein echter Utility-Dispatcher-Test belegt beide Antworten vor Ende
  eines offenen Snapshots, geordnete Writes danach und einen Export exakt von S.
- Beide Read-Antwortpfade prüfen Session und Sequenz gemeinsam. Validierung und
  lokale Projektion erfolgen synchron zusammen, damit eine Speicherbestätigung
  benötigte Patches nicht zwischen Prüfung und Verbrauch freigeben kann.
- Der Cold-Collector wartet auf die tatsächliche lokale Freigabe. Für alle danach
  begonnenen Inputs gelten dieselben Live- und 50-ms-Regeln wie im warmen Fall.
  Quellen, Freigabe-Submit und native Bereitschaftspräsentation bleiben getrennt.
  Frühe blockierte Gesten und ihre Erholung sind eigene Funktionsfälle.

Datenmodell, numerische Übersichten, Dateiformat und V7-Fachfunktionen bleiben
erhalten. Der kleine Höheneditor ist weiterhin nicht der vollständige F01–F19-
Umfang. Eine allgemeine Überlegenheit von Electron/Pixi gegenüber V7 ist nicht
belegt.

## Nachweisstand und offene Grenzen

Die gezielten Controller-/Raster-/Auswertertests und 15 Store-/Fixturetests
bestehen. Die gemeinsame Endprüfung, der normale Programmstart, die vorhandene
500-ms-Hängerprüfung, warme/kalte Striche und die betroffenen
32/1.024/9.000-Quellenfälle werden am gebauten Kandidaten erneuert.

Die native Vorprüfung endet vor Fixtureerzeugung mit Exit 2 und
`NO_NATIVE_DISPLAY`; Beleg `artifacts/atlas-rebuild/d11-native-preflight/`.
Qualifizierte Referenz und echte Präsentationszuordnung fehlen. Softwaregrafik,
RAF und Submission ersetzen sie nicht. Der vollständige Ausbau P1–P9 wartet
auf das bestehende P0-Gate; PR #1469 bleibt Draft.

Der [vorherige Prüfstand](https://github.com/ThonkTank/Salt-Marcher/blob/0c56dcc27676f1dcc749604d61e903747e8b7ffe/docs/implementation/status.md)
und seine historischen Rohberichte bleiben unverändert. Seine kalten Fälle
begannen bei Quellenbereitschaft und sind kein D11-Nachweis. Neue Messungen werden
nicht rückwirkend in diese alten Berichte eingetragen.
