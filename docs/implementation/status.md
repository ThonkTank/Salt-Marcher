# Aktueller Stand

Stand: 8. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Konsolidierung und verbleibende Abnahme

Das begrenzte [Konsolidierungspaket K1–K6](atlas-rebuild-plan.md#aktueller-auftrag-p0-konsolidierung-k1k6)
folgt dem Review dieses PR. Lokale Freigabe, zeitabhängige Höhengesten, numerische
Übersichten, begrenzter Rasterdispatcher und Reads während Save bleiben die Grundlage.
Der vollständige F01–F19-Ausbau P1–P9 ist weiterhin an das offene P0-Gate gebunden.

| Paket                  | Implementierter Stand                                                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1 Lebenszyklus        | Neu/Öffnen/natives Schließen schließen dieselbe lokale Geste ab und warten alle angenommenen Writes ab. Save/Discard/Cancel beurteilt den vollständigen lokalen Stand. Fehler und Abbruch erhalten das Dokument.                       |
| K2 Schreibfehler       | Dauerhafter sichtbarer Persistenzfehler; erhaltene ChangeSets werden erst nach Session-/Sequenzabgleich über denselben idempotenten Transaktionspfad wiederholt. Verlorene Bestätigungen führen nicht zu doppelten Änderungen.         |
| K3 Nativer Nachweisweg | Explizites Referenzprofil, Umgebungsabgleich, kleine Traceprobe und Vorprüfung vor Fixtures. Fehlende Präsentationszuordnung bleibt ein eigener Implementierungsblocker; die native Abnahme bleibt offen.                              |
| K4 CI/Paket            | Echter Normalstart, Rendererhänger und Dateilebenszyklus sind Teil des bestehenden Aggregatchecks. Ein separater Schritt baut und startet das P0-Paket. Die Laufzeit-Allowlist schließt das Archiv auch im vollständigen Checkout aus. |
| K5 Bereinigung         | Tote Quellen-/Snapshot-/JSON-APIs samt Spiegeltests entfernt. Auswertertypen kommen direkt aus geprüftem JavaScript/JSDoc. Bestehende Dokumente gekürzt und nach Zuständigkeit geordnet.                                               |
| K6 Großpinsel          | Diagnose zerlegt Eingabe→Modell→Dispatch→Worker→Rückweg→Upload→Submit. Die kurze Gegenprobe am sauberen Integrationsstand steht noch aus.                                                                                              |

## Bisherige Funktionsprüfung dieses Pakets

Der gemeinsame Entwicklungsbuild enthält die vollständigen Produktänderungen.
Sein Produktquellhash lautet
`fb3aa5ef25297b344572189643880db57c46d7d88a06c46c9899c6a2a08b4a87`.
Sein Manifest ist wegen der noch uncommitteten Integration als dirty markiert;
diese Läufe werden nicht als native Leistungsabnahme verwendet.

| Prüfung                                         | Ergebnis                                                                                                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produkt-TypeScript, Auswerter-CheckJs, P0-Tests | Bestanden; 196 P0-Tests einschließlich Zeitzerlegung.                                                                                                                                               |
| Echter Dateilebenszyklus                        | 51 Checks in 13 Appfällen bestanden: aktive Geste, zwei lokale ausstehende Writes und abgewiesener Write jeweils mit Save/Discard/Cancel; verlorene Bestätigung, dauerhafter Fehler und Neu/Öffnen. |
| Normalstart ohne Diagnose                       | 13 Checks bestanden: sichtbare Pixel, Feldentwürfe, Undo/Redo, Speichern, Öffnen und neuer Prozess.                                                                                                 |
| Echter 500-ms-Rendererhänger                    | 19 Checks bestanden: keine Nachholdosis nach Loslassen, begrenzte Annahme beim Weiterhalten und danach tatsächlich fortgesetzte Wirkung.                                                            |
| Forge-Anwendungsverzeichnis                     | 130 ASAR-Einträge geprüft; keine Archive/Quellen/unnötigen Laufzeitmodule, native SQLite vorhanden. Echter Paketstart mit 13 Funktionschecks bestanden.                                             |

Rohbelege liegen ignoriert unter `artifacts/atlas-rebuild/` in
`consolidation-lifecycle/`, `consolidation-normal/`, `consolidation-stall-complete/`
und `ci-package/`. Der abschließende saubere Build, Storetests, Zeitprobe und
Repository-Checks werden vor der endgültigen Übergabe ergänzt.

## Offene P0-Grenzen

Die bisherige große warme SwiftShader-Probe lag bei 54,3 / 68,7 / 50,0 ms
Edit→Submit-p95 und belegt das 50-ms-Ziel nicht. Die neue Zeitzerlegung darf diese
Werte weder umdeuten noch Schwellen absenken. Ein begründeter Renderumbau folgt
nur aus einem dominierenden gemessenen Zeitanteil.

Native Bildschirmpräsentation ist weiterhin nicht nachgewiesen. Dem gepinnten
Electron-/Traceadapter fehlt die belegte Zuordnung einer Atlas-Generation zu
ihrem tatsächlich dargestellten Frame. Ein benannter Rechner, Capture, RAF oder
erster Folgeframe ersetzt sie nicht. Ohne geeignete Anbindung endet die native
Vorprüfung vor der teuren Sammlung. Zusätzlich besitzt diese Arbeitsumgebung
kein natives Display. Vollständige native Stichprobe und installierte RPM-Abnahme
bleiben offen.

Das Repository-Gate `Candidate · exact-SHA aggregate` prüft den veröffentlichten
PR-Head; maßgeblich sind dessen [Checks](https://github.com/ThonkTank/Salt-Marcher/pull/1469/checks).
Lokal fehlen `cargo` und `rpmbuild`; Rust, Vertragsgenerator und RPM-Bau werden
über diesen bestehenden CI-Weg geprüft. Ein Paketstart ist kein Beleg einer
RPM-Installation oder nativer Leistungsziele.

Der [vorherige Prüfstand](https://github.com/ThonkTank/Salt-Marcher/blob/6855e6cdc11894548b5a73f8ba736be85cb2aaee/docs/implementation/status.md)
enthält die historische D11-Collection und deren Identitäten. Seine erfolgreichen
Teilprüfungen gelten nicht automatisch für diesen Integrationsstand.
