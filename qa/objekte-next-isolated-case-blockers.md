# Nächstes isoliertes Objektpaket: statische Eignungsprüfung

**Stand:** aktueller Integrationszweig `main` am 05.10.2026, nur gelesen.
**Ergebnis:** Unter DD-026–031 und DD-042/045/047 ist derzeit kein weiterer
**neuer, abschließbarer Pflichtfall** mit direktem Originalbeleg gefunden,
der ohne grafischen Host und ohne Änderung gemeinsamer Dateien übernommen
werden kann. Die schon gepaarten DD-028.08/.12 sind vorhanden; DD-028.06
hat eine getrennt dokumentierte Originallücke.

| Fall | Originalbeleg und Ziel | Aktueller Stand | Konkrete nächste Voraussetzung |
| --- | --- | --- | --- |
| DD-042.09, doppelter Vorlagenname | `/home/aaron/.cache/dungeon-native-qa/evidence/native-prefab-set-management.json`: getesteter Duplikatname im selben Set wird abgelehnt. | `src/main.ts` `savePrefab()` lehnt Duplikate desselben Sets bereits ab; der vorhandene Test betrifft eine andere Prefab-Funktion. Ein zweites reines Modul würde die vorhandene Regel duplizieren. | Isolierter Hostfall: bestehenden Prefab speichern, identischen Namen im selben Set erneut eingeben, Hinweis und unveränderte Definition/Datei prüfen. Erst danach gleichwertig belegen. Groß-/Kleinschreibung im Original wurde nicht getrennt gemessen. |
| DD-026.17, Custom Set und Tagliste | `/home/aaron/.cache/dungeon-native-qa/audit-20261004-vollstaendigkeit/objekte/native-gui-symbol-tags-retry/evidence/85-object-qa-filter-settled.png`: QA-Set begrenzt die Object-Galerie auf Atlas Globe 01. | Main bietet keine lokale Tag-/Set-Galerie in `src/properties.ts`/`src/assets.ts`. Eine reine Filterfunktion wäre ohne Asset-Metadaten, Verwaltung und sichtbare Galerie nicht anschließbar; ein früher isolierter Suchzustand ist daher noch nicht integrierbar. | Gemeinsame Tag-/Set-Daten und Assetkatalog-Schnittstelle, Werkzeug-UI und anschließender Hostlauf mit demselben Set/Asset. Kombinierte Mehrtagwahl bleibt eigene Originallücke. |
| DD-030.22, Alt-Klick auf gesperrtes Element | `/home/aaron/Schreibtisch/Obsidian/DnD OT/.obsidian/plugins/dungeon-auswertung/tests/native-selection-lock-evidence.json`: normaler Klick überspringt, Alt-Klick wählt gesperrtes Element. | Main `src/editor.ts` und `src/selection.ts` enthalten den Alt-Trefferpfad. Ein reiner Geometrietest könnte Pointer-/Fokuswirkung nicht belegen. | Echte isolierte Hostfolge mit normalem Klick, Alt-Klick, Auswahl und Entsperren; GUI-Slot nötig. |
| DD-042.19, Forget | `/home/aaron/.cache/dungeon-native-qa/audit-20261004-vollstaendigkeit/objekte/matrix.json` und Original-Prefab-Belege: Warnung und Entfernen der Vorlage bei bleibender Karteninstanz. | `src/features/objekte/prefab-forget.ts` plus `src/main.ts` und ein Kerntest bestehen bereits. | Frischer Originalprozess nach Forget und gepaarter Hostlauf mit Dialog, Liste, Instanz und Neustart; diese Beweislücken lassen sich durch weiteren reinen Code nicht schließen. |

**Empfehlung für den nächsten Grafikslot:** DD-042.09 ist der engste
Hostfall, weil Originalregel und vorhandene Produktfunktion klar sind.
DD-026.17 ist ein größeres Integrationspaket; dort sind Assetkatalog und
Werkzeug-UI zuerst zentral festzulegen. Bis zu diesen Voraussetzungen wird
keiner der vier Fälle als abgeschlossen oder paritätsbelegt markiert.
