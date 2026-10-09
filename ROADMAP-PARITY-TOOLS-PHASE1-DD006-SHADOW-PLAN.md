# Phase 1, DD-006.03/.04: Schattenwirkung im Dungeonbereich

Planlauf vom 09.10.2026 zu [ROADMAP-PARITY-TOOLS-PHASE1-PLAN.md](ROADMAP-PARITY-TOOLS-PHASE1-PLAN.md). Die `New Map`-Startschalter `DD-006.01/.02` sind kein Bedienvorbild für den gemeinsamen Atlas. Die beiden verbleibenden Fälle betreffen die getrennte sichtbare Wirkung von Wand- und Objektschatten. Ihre bisherigen Original- und Hostbelege zeigen gespeicherte Mischzustände, aber kein vollständiges Bildpaar mit gleicher Geometrie und sichtbarem Objekt.

## Messfolge

1. Eine isolierte Original-Testkarte mit sichtbarer Wand, Building und Objekt im Kartenausschnitt vorbereiten. Vier Kopien mit identischer Geometrie und `wall_shadow`/`object_shadow` jeweils an/an, aus/an, an/aus und aus/aus im Original öffnen. Die Kopien sind ein kontrollierter Renderer-Versuch, kein Beleg für eine aktuelle Original-Bedienfolge. Version, Quellenhash, Dateiunterschiede, Screenshots und frische Neuöffnung sichern. Prüfen, ob jeweils nur die zugehörige Schattenart sichtbar wechselt; unklare Bilder als offen markieren.
2. Im isolierten Host dieselbe Geometrie und alle vier Kombinationen über die vorhandenen Kartenoptionen ausführen. Sichtbare Änderung, getrennte V4-Felder, History, Save und frische Öffnung prüfen. Die bestehende Größenaktion nicht auslösen; Atlasanlage und endgültige Optionen-Bedienung gehören zu HEX-01 und der Atlasintegration.
3. Original- und Hostwirkung getrennt vergleichen. Ungefähr gleichwertige Schattenform reicht; unabhängiges An/Aus, kontrollierter Geltungsbereich und gespeicherte Wirkung müssen stimmen. `DD-006.03/.04` erst nach eigenem Review des belegten Scopes entscheiden. Die Falltexte zu Startwerten bleiben als historische Originalaussage erhalten; der Atlas-Zielpfad wird gesondert ergänzt.

## Grenze

Ein importierter Original-Rohkartenwechsel belegt nur die Renderwirkung der gespeicherten Werte. Er ersetzt keine Bedienprobe für künftige Atlasoptionen. Kein Produktbuild im Nutzervault, keine Originalkarte oder Dungeontexte ändern. QA-Rohdaten liegen unter `/home/aaron/.cache/dungeon-native-qa/`.

## Original-Zwischenbefund

Der [isolierte Original-Renderlauf](/home/aaron/.cache/dungeon-native-qa/parity-tools-phase1-dd006-shadow-20261009/original-render-probe.md) ergibt bei gleicher vorhandener Geometrie vier bytegleiche Bilder trotz Wechsel der globalen `world.wall_shadow`/`world.object_shadow`-Werte. Bei Wechsel der gespeicherten `shadow`-Felder an Wand beziehungsweise Objekt ändern sich die zugehörigen Bildbereiche getrennt. Daraus folgt für den Hostvergleich: vorhandene Elemente und Vorgaben für neue Elemente gesondert behandeln. Eine direkte Atlas-Bedienfolge ist damit noch nicht belegt.
