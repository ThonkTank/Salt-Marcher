---
area: city
owner: Stadt
issue: 92
status: active
checkpoint: cityExecution
---
# Gebäudenamen im gemeinsamen Atlas bearbeiten

Nutzerweg: vorhandenes Haus auswählen → Namen exakt bearbeiten → gemeinsames
Undo/Redo → Save → frischer Prozess erhält Namen und Hausgeometrie.
[#92](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92)
gehört zur individuellen Hauskorrektur in CITY-01/CITY-04. Volle Stadtparität und
bessere Bedienung bleiben der Gesamtumfang; dieser Weg ist keine Gesamtfreigabe.

## Arbeitsstand #92

Branch city/building-name-inspector auf Shared ca29032. Erste Fachaktion
`set-building-name` in CityEdit ist umgesetzt. Bestehender Citycodec prüft den
vollständigen Endzustand; Namensbytes werden weder getrimmt noch normalisiert.
IDs, Grundriss samt Hof, Pose, Plotreferenz und andere Elemente bleiben erhalten.
Der vorhandene CitySource/cityDocumentChange-Anschluss verwendet AtlasHistory;
kein zusätzlicher Store, Snapshot-, Kamera- oder Publishvertrag.

Zwei direkte Gegenproben FAIL vor/PASS nach Implementierung: exakte Namensänderung
mit unveränderten übrigen Daten und Undo/Redo; ungültiger Name, fehlendes/fremdes
Element, doppeltes Schreibziel, Getter ohne Aufruf und stale Beforebasis ohne
Teilpublikation. 576 gebaute Kerntests PASS. Typprüfung/Build/Repositoryprüfung PASS; unabhängiger Review bleibt offen.

Nächster Consumer ist der sichtbare Haus-Inspector im bestehenden AtlasEditor.
Vor dessen gemeinsamer Mount-/Seitenleistenänderung wird der konkrete Anschluss
mit Hex abgeglichen: ausgewählter CityHit liefert Owner/Building-ID; vorhandene
Keyseitenleiste und applyKeys/Undo/Save/Close/Contextguards werden konsumiert.
Gültiger Name wird als ein gemeinsamer Historybefehl übernommen. Ungültige oder
stale Aktionen erhalten sichtbaren Entwurf. Kein Eingriff in #80-H01-Belege.

## Verbleibende Umsetzung und Abnahme

1. Bestehende Auswahl und Keyseitenleiste um Hausnamenfeld ergänzen; alte
   Callbacks dürfen nach Haus-/Contextwechsel keinen anderen Entwurf mutieren.
2. Vorhandenen Repositorysave konsumieren; native Namensänderung erhält
   Fremdbytes/Geometrie und Undo-/Redo-Save, Fehler und Recovery bleiben atomar.
3. Direkte DOM-/Repository-Erhaltungsfälle und unabhängiger Exact-SHA-Review.
4. Frühe freie GM-Bedienprobe sowie separate isolierte native Save-/Frischstartprobe
   nach konkret abgestimmtem GUI-Slot; Nutzervault bleibt unberührt.

Kein sichtbarer Inspector, Save/Fresh-/Host- oder Paritäts-PASS aus dem Fachbefehl.
