# Phase 7: begrenzte Diagnose des Inhalte-Dialogs

Stand: 09.10.2026. Dieser eigene Planlauf folgt auf den [getrennten Phase-7-Review](/home/aaron/.cache/dungeon-native-qa/parity-phase7-review-20261009/phase7-independent-review.md) bei Commit `122a1a6f05c2d5264fe3db618a39b2b903d20bcb` und Produktbuild `b321128188b944c3324594663a410acfd84863f17860f637b9ed2e6ecc33b466`. Er ändert keinen Produktcode. P7-3 und P7-4 sind reviewt; P7-1 und die vom Nutzer vorerst übersprungene physische Probe P7-2 bleiben offen.

## Befund und Grenze

Im ersten neuen P7-1-Editlauf bestanden vier Schritte bis zur Auswahlspiegelung. Danach öffnete ein Klick auf „Dungeon-Inhalte“ innerhalb von zwölf Sekunden keinen Dialog; der [Fehlerscreenshot](/home/aaron/.cache/dungeon-native-qa/parity-phase7-review-20261009/p7-1/evidence/1791505291776-parity-phase7-combined-edit/failure.png) zeigt die Key-Seitenleiste. Ein zweiter vollständiger Editlauf und die frische Neuöffnung bestanden. Das Ereignis belegt weder eine dauerhafte Produktabweichung noch einen bloßen Testtreiberfehler. Bisher fehlen die unmittelbar nach dem Klick erhobenen Werte für Klickziel, aktiven Button, Dialogzahl, Notice, Auswahl und `StructuredKeyPanel.commit()`.

## Getrennter Diagnose- und Umsetzungslauf

1. Remote abrufen und fremde Änderungen integrieren; Buildhash, installierten Build und produktive Drachenhöhlendateien prüfen. Eine isolierte QA-Kopie verwenden. Vor dem fraglichen Klick Auswahl-ID und Key-Panel-Zustand sichern; beim Klick das tatsächlich getroffene DOM-Ziel, Button-Ereignis, etwaige Notice/Exception und die Dialogzahl unmittelbar sowie nach kurzer UI-Stabilisierung protokollieren. Die Testfolge darf keine zweite Betätigung als erfolgreichen Erstklick ausgeben.
2. Den Pfad mit höchstens zwei erfolglosen Versuchen oder 45 Minuten je Hypothese eingrenzen. Wenn der Button-Handler nicht läuft, Trefferfläche und UI-Umschaltung untersuchen. Wenn er läuft, aber kein Dialog entsteht, `commitNote()`, `StructuredKeyPanel.commit()` und `manageContent()` samt Fehlermeldung prüfen. Bleibt der Ausfall nicht reproduzierbar, den offenen Befund und die Grenzen der Gegenprobe dokumentieren.
3. Nur bei belegter Produktursache eine kleine Korrektur am betroffenen Ereignisweg vornehmen. Liegt die Ursache ausschließlich im Testtreiber, die Zustandswartebedingung dort korrigieren und die ursprüngliche Fehlspur erhalten. Nach jeder Änderung Typprüfung, 167 Kernfälle, Build und die betroffene P7-1-Hostfolge samt frischer Neuöffnung auf finalem Buildhash prüfen; geschützte Texte und installierten Build nicht ändern.

## Eigener Nachbesserungsreview

Ein neuer, getrennter Review vergleicht die Diagnose-Rohwerte mit dem Fehlerscreenshot, prüft den begrenzten Diff, einen einzelnen Klick auf „Dungeon-Inhalte“, den exakten Feature-Key-Verbund, Undo/Redo, Speichern und frische Neuöffnung. P7-1 wird nur geschlossen, wenn entweder die Ursache behoben oder der einmalige Ausfall mit belastbarer Gegenprobe als Testartefakt eingegrenzt ist. P7-2 und das Phase-7-Fachphasentor bleiben bis zur direkten physischen Eingabe offen; die abschließende Aufräumphase beginnt erst nach bestandenem Fachphasentor.
