# GM-UX-N-004: Atlasfläche im verfügbaren Pane halten

Grundlage: [HEX-01-Fachplan](ROADMAP-HEX-01-PLAN.md), abgeschlossener [Aufräumreview](ROADMAP-HEX-01-CLEAN-PLAN.md), [Cloud-Befund](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6084269776). Der eigene native Laptopablauf ist bestanden; der Cloud-Host zeigt auf Build `416c739…` eine schwarze und bis über 16.000 Bildpunkte hohe Fläche. Diese unterschiedlichen Nachweise bleiben getrennt.

## P01: begrenzte Diagnose und möglicher Fix

1. Vor Änderung den bestehenden Build im eigenen isolierten Host bei 1.440 × 1.000 und in zwei Obsidian-Panes messen: Wurzel, Viewport, Canvas-Bitmap, berechnete Layoutwerte und tatsächlich sichtbares Raster. Beobachtung über mehrere Zeichenbilder, nicht nur ein direktes Maß nach dem Öffnen. Tatsächliche Cloudmaße/Fehler beim Tester erfragen.
2. **Hypothese:** Der Canvas trägt im normalen Layout seine vom Renderer gesetzte Höhe zurück in die Größenmessung. Flex-/Min-Inhaltsgrößen können dadurch eine Resize-Rückkopplung bilden. Das ist vor Messung eine Vermutung, keine bestätigte GPU-Ursache.
3. Falls die Rückkopplung belegt ist, das bewährte Rasterlayout des Dungeoneditors für die Atlasfläche übernehmen: kompakte Leiste, begrenzte Kartenzeile, Fußzeile. Den Canvas aus der Inhaltsgrößenberechnung nehmen. Ausschließlich Atlas-CSS und bei nachgewiesenem Bedarf die Resize-Lebensdauer ändern. Keine pauschale Bildpunktobergrenze als Atlasgrenze verwenden.
4. Reale Voll-/Splitansicht wiederholen: sichtbares Raster und Ursprung, begrenzte Fläche, Plus/Minus, Zeiger-Zoom und Einpassen. Die native Datei bleibt bytegleich. Größe nach Paneänderung muss stabil werden; ein kleiner Screenshot prüft Lesbarkeit. Frischer Prozess bleibt ein eigener Fall.
5. Check/Test/Build prüfen. Unabhängigen Cloud-Nachtest auf dem exakten neuen Build anfordern. Falls ein reiner Cloud-WebGL-Blocker übrig bleibt, konkrete Fehler/Hosteigenschaften dokumentieren; keine erfolgreiche Cloud-Abnahme aus dem lokalen Bild ableiten.

| Lauf | Ergebnis | Tor |
|---|---|---|
| N-004-P01 | begrenzter Plan, eigene Ausgangsmessung | Planung bleibt getrennt von Produktänderung |
| N-004-I01 | nachgewiesene Ursache und schmaler Fix | native Vorher-/Nachherprüfung und Basisprüfungen |
| N-004-R01 | eigener Review und Cloud-Nachtest | offene Cloudgrenze ausdrücklich erhalten; Pflichtfehler vor Wiederverwendung beheben |

HEX-02 folgt mit Gelände, gemeinsamer Historie und Entwürfen auf dieser Kartenfläche. Dieses Paket legt keine zweite Kamera, keinen Kartenmodus und keinen Ersatzeditor an.

## R01: belegte Ursache und begrenzter Abschluss

Der [Cloud-Nachtest](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6084884147) bestätigte eine unvollständige QA-Installation: Programmdatei und Manifest waren aktuell, die installierte CSS-Datei war veraltet und enthielt keine geladenen Atlasregeln. Nach Sicherung und Kopie des vollständigen Build-Tripels sowie App-Reload waren Raster, Voll-/Splitlayout und sichtbare Zoom-/Einpassen-Reaktion stabil. Eigene tatsächliche Prozessneustart-/Layoutbelege bleiben getrennt. **Keine Produktänderung für N-004 erforderlich.**

Der Cloud-Tester konnte keinen neuen Electron-Prozess starten; dieser Fall bleibt offen. Die Cloudprobe belegt nur das leere Raster, keine Gelände-, Gesamtatlas-, Paritäts-, Großkarten- oder physische Abnahme. HEX-02 kann auf der geprüften Kartenfläche mit dem ersten Inselablauf weitergehen.
