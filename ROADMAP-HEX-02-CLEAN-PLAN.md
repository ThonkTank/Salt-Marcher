# HEX-02: begrenztes Aufräumen vor dem ersten Ortsablauf

Grundlage: [HEX-02](ROADMAP-HEX-02-PLAN.md), [N01-Reparatur](ROADMAP-HEX-02-REPAIR-PLAN.md), unabhängiger [R02-PASS](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6087698506) auf `0fdc76c3cae7aa3b65b26308697c8fd716e997ef`. Beide R01-P1 sind geschlossen. Native Kopier-/Neuöffnungsreparatur: Produkt `63e1efb`, zwei normale Exits, sechs betrachtete Bilder, separater externer N01-H01-Beleg. Diese begrenzten Nachweise sind keine volle Paritäts-, Großwelt-, physische oder Installationsfreigabe.

## Nur zwei konkrete Aufräumpunkte

- **HEX02-C01:** Zwei beim Formattercheck aufgefallene Dateien formatieren: `src/ui/atlas-view.ts` und `tools/host/hex02-copy-repair.cjs`. AST-Vergleich mit dem Ausgangsstand muss unverändertes Verhalten zeigen; der erzeugte Produktbuild muss zum nativ geprüften Buildtriplet identisch bleiben. Keine neue Funktion, Testfamilie, Renderer- oder Speicherschnittstelle.
- **HEX02-C02:** Ausschließlich die aktuelle Hex-Nachweiszuordnung bereinigen: abgeschlossenes R01/R02, N01-Core/native und ausstehender Abschluss dieses Aufräumens klar trennen; aktueller Cleanup-Verweis und nächster Schritt HEX-03. Historische Originalbelege, Fremdwurzeln und ursprüngliche Build-SHAs erhalten. Architekturwortlaut den belegten Zustand widerspiegeln lassen.

## Getrennte Läufe

| Lauf | Prüfergebnis |
|---|---|
| CLEAN-P01 | Plan, eigene IDs/Dateigrenze, JSON und Diff veröffentlichen. |
| CLEAN-I01 | Ausschließlich die zwei Punkte umsetzen; AST vor/nach und clean check/test/build samt exaktem Triplet prüfen. Kein weiterer GUI-Lauf, wenn Produktbytes identisch bleiben. |
| CLEAN-R01 | Eigener separater Review der tatsächlich umgesetzten Änderungen: AST, Datei-/Text-/Wurzelschutz, Verweise, Belegzuordnung und Restgrenzen. Die unabhängige R02-Produktprüfung bleibt eigenständig ausgewiesen; dieser Cleanup-Review wird nicht als fremder Review bezeichnet. |

Nach bestandenem CLEAN-R01 beginnt [HEX-03](ROADMAP-HEX-ATLAS.md) mit einem konkret prüfbaren Ortsablauf auf derselben Kamera und History. CITY-01-PREP wird über vorhandenen `AtlasRenderer.detailLayer`, spätere Root-Platzierung/Frameprojektion und den gemeinsamen Pointerrouter in HEX-04/05 eingebunden. Kein separater Modus, keine weitere allgemeine Originalinventur als Voraussetzung für den ersten Ort. Der Gesamtatlas und spätere Parität bleiben ihre offenen Produktphasen.
