# DD-028.06: RGBA/Hex am ausgewählten färbbaren Objekt

**Umfang:** bestehender Produktpfad überprüft, reine Session-Kernprüfung
ergänzt. Kein grafischer Hostlauf und keine Vault-/Acceptance-Änderung.

## Vorhandene Implementierung

`src/features/objekte/rgba-picker.ts` enthält bereits den isolierten
`ObjectColorPicker` und die montierbare Dialogoberfläche: R/G/B/A-Bytefelder,
Hex/ARGB, synchroner Swatch, `onPreview`, `onCommit`, Accept und Escape. Der
Picker ändert die Session nicht selbst. `src/properties.ts` öffnet ihn für das
aktuelle ausgewählte Objekt und bindet `onPreview` an den transienten
Renderer-Hook; `onCommit` ruft für das Objekt `Properties.change()` einmal
auf. `src/editor.ts` reicht die Vorschau an den Renderer weiter,
`src/renderer.ts` zeichnet sie ohne Session-Änderung und setzt sie beim
Schließen zurück. Diese gemeinsamen Dateien wurden hier nicht bearbeitet.

Die neue Prüfung `tests/object-rgba-session-history.test.mjs` verbindet den
realen Picker-Controller mit einer echten `Session`: A128→A0 über Escape und
A0→A128 über achtstelligen ARGB-Wert und Accept. Mehrere Liveänderungen lassen
`historySize` und gespeichertes Objekt unverändert; das Schließen erzeugt
genau einen Schritt. Undo und Redo stellen jeweils die beiden Alpha-Werte
wieder her. Die vorhandenen `tests/object-rgba-picker.test.mjs` prüfen
Feldsynchronisation und Eingabegrenzen. Beide Tests laufen ohne GUI.

## Original und Host

Der direkte Originalbericht liegt unter
`/home/aaron/.cache/dungeon-native-qa/audit-20261004-vollstaendigkeit/objekte/native-dd028-rgba-20261005/DD-028.06-ORIGINAL.md`.
Er zeigt Werkzeug-Picker mit RGB 64/128/192 und A128, Live-Swatch/
Bibliothekskachel, A0 nach Escape mit beibehaltenem Wert sowie **am
ausgewählten Objekt** A0→A128 vor Accept, einen Undo-/Redo-Schritt, Save und
Original-Neustart. Der bestehende Host-Edit unter
`/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/groups/objekte-03/evidence/1791197089265-objekte-03-edit/`
prüft ausgewählte A128→A0 (Escape) und A0→A128 (Accept) samt sichtbarer
Vorschau, History und Speicherwert. Der frische Hostlauf
`1791197099319-objekte-03-reopen` bestätigt RGB/Alpha und Pixelwirkung.

## Integrationsgrenze

Die gemeinsamen Hooks `previewObjectColor(id,rgb,alpha)` und
`clearObjectColorPreview(id)` sowie der einmalige `Session.execute`-Commit
sind in Main vorhanden. Beim Übertragen der neuen Kernprüfung genügt die
Testdatei; eine weitere Renderer-/Properties-Änderung wäre für die direkt
gemessene Teilfolge redundant. Der bestehende Gruppenfall `objekte-03`
sollte die ausgewählten Hostbelege neben der Werkzeug-Folgeplatzierung
verlinken, damit seine Teilbestätigung nachvollziehbar ist.

**Keine vollständige Originalparität für DD-028.06 behaupten:** Im Original
fehlen Escape am bereits ausgewählten Objekt, sechsstellige Hex-Eingabe bei
A<255 und Außenklick. Die aktuelle Implementierung verwendet die am
Werkzeug direkt gemessene Escape-Übernahme auch beim ausgewählten Objekt;
das ist eine plausible gemeinsame Dialogregel, aber noch kein direkter
Originalbeleg. Die sechsstellige Eingabe erhält im Editor das aktuelle Alpha;
deren native Wirkung bei A<255 bleibt DD-028.07 offen. Ein Außenklick wird
hier weder implementiert noch als Abbruchregel angenommen. Produktstand,
Hostbuild und installierter Endstand benötigen die spätere Gesamtprüfung.
