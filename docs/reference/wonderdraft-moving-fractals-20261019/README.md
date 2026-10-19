# Wonderdraft: vier Landpinsel in Bewegung · 19.10.2026

Direkter Versuch in Wonderdraft 1.1.8.2, `/opt/Wonderdraft/Wonderdraft.x86_64`, isoliertes Profil. Keine Eingriffe in Modell oder Speicher des Originals. 25 zeitgesteuerte Linkszüge über RFB, visuell geprüft. Ausgangskarte 1920 × 1080, Anzeige 47 %, Pinselgröße 128, Fraktalrauheit 2. Landbasis für Absenken/Radieren mit normalem Pinsel Größe 512 angelegt.

Lokaler [Belegordner](/home/aaron/.cache/dungeon-native-qa/wonderdraft-moving-fractals-20261019/measurements.json): `session.json` enthält Prozess-/Binäridentität, `input.jsonl` alle Eingaben, `screens/*.json` Bildhash und Eingabezeiten, `gestures/*.json` die Pfade. Screenshots sind unveränderte Originalframes.

Gerade: (300,520) → (700,520). S-Kurve: gleiche Endpunkte, y = 520 + 40 sin(2πu). Umkehr: dieselbe Gerade hin und zurück bei durchgehend gedrückter Taste. Schnell 960 ms/48 Intervalle, langsam 12000 ms/120 Intervalle. Gemessene Sendezeiten liegen nahe den Sollzeiten; größte Punktabweichung unter 5 ms. Das sind Sendezeiten, keine internen Wonderdraft-Verarbeitungszeiten. Die unterschiedliche Ereignisdichte ist keine eigenständige Prüfung der Abtastratenunabhängigkeit.

| Werkzeug/Fall | Beobachtete Originalwirkung | Frames in `screens/` |
| --- | --- | --- |
| Fraktal erhöhen, Gerade und S-Kurve, 960 ms | Keine sichtbare Landbildung | 007, 012 |
| Fraktal erhöhen, gleiche Pfade, 12000 ms | Gezackte schmale Landspur entlang des Zuges; auf der Geraden stellenweise unterbrochen | 009, 014 |
| Fraktal erhöhen, sechs schnelle Geraden ohne Undo | Kumulative Wirkung; nach drei Zügen kleine Landflecken, nach sechs deutlichere Spur | 016-repeat-1 bis -6 |
| Fraktal erhöhen, Hin-/Rückzug, 12000 ms | Durchgehende fraktale Landspur | 018 |
| Land zeichnen, S-Kurve, 960 ms | Sofort geschlossene Fläche mit glatter Begrenzung | 022 |
| Land radieren, S-Kurve, 960 ms | Sofort durchgehender glatter Wasserkanal | 028 |
| Fraktal absenken, Gerade und S-Kurve, 960 ms | Keine sichtbare Wasserbildung | 031, 035 |
| Fraktal absenken, gleiche Pfade, 12000 ms | Schmaler gezackter Wasserkanal entlang des Zuges | 033, 037 |
| Fraktal absenken, sechs schnelle Geraden ohne Undo | Gemeinsam sichtbarer Wasserkanal | 039-lower-repeat-1 bis -6 |
| Fraktal absenken, Hin-/Rückzug, 12000 ms | Durchgehender fraktaler Wasserkanal | 041 |

Unabhängige Fälle wurden per Undo auf die Ausgangsfläche zurückgesetzt. Die Kartenpixel nach beiden Sechserreihen entsprechen exakt der jeweiligen sichtbaren Ausgangsfläche. Am letzten Hin-/Rückzug ergeben Undo, Redo und Speichern/erneutes Öffnen ebenfalls exakt die erwarteten Kartenpixel: 0 abweichende Pixel im Bereich x=100..1018, y=242..758; Einzelvergleiche in `measurements.json`. Gespeichert als `data/Wonderdraft/maps/moving-fractal-strokes.wonderdraft_map`. Das prüft die sichtbare Karte, keine Gleichheit unsichtbarer Maskenwerte.

Die Sitzung wurde nach dem Wiederöffnen über Menü → Exit geschlossen. Der vorhandene Starter protokollierte anschließend `Original/display exited before explicit stop` und Status `failed`; dieser Abschlussfehler bleibt erhalten. Er wird nicht als bestandener Sitzungsabschluss ausgegeben. Aufnahmen und Pixelvergleiche stammen aus der laufenden Originalanwendung vor diesem Ausgang.

## Folgerung für SaltMarcher

Die frühere stationäre Prüfung genügte nicht. Gefordert sind geschlossene schnelle Land-/Radierzüge, zeitabhängige fraktale Wirkung über die ganze Strecke, Akkumulation auch zwischen einzeln unsichtbaren Zügen, sinnvolle Umkehr und ein Undo-Schritt pro Zug. Für einen Vergleich müssen Pinselgröße relativ zur Strecke, Zoom, Ausgangsmaske, Rauheit und tatsächliche Dauer zusammenpassen. Nicht jede langsame Originalspur ist lückenlos; eine pauschale Forderung nach lückenloser Fraktalwirkung wäre falsch.

Die begonnene SaltMarcher-Probe gegen Paket `0.164.0-coast-contours` ist **kein gültiger Schnellzugvergleich**: statt 700 ms wurden 53247,7 ms zwischen Pointerdown/-up gemessen. Rohbeleg: `/home/aaron/.local/share/saltmarcher-qa/fractal-strokes-20261019/installed/result.json`. Ob Eingabetreiber, Vorschau oder anderes Scheduling den Lauf verzögert, ist nicht geklärt. Die Diagnose lehnt künftig solche Zeitabweichungen vor Wirkungsbewertungen ab. Keine neue Produktinstallation, keine Behauptung abgeschlossener Pinselparität.


## Fortsetzung: Landform und Farbe getrennt

Die ergänzende Originalprüfung liegt lokal unter `/home/aaron/.cache/dungeon-native-qa/wonderdraft-land-color-separation-20261019`. Die Aufnahmen 007–013 zeigen die drei Farbspitzen, weichen/harten Farbauftrag über eine Küste und reine Farbradierung. 014 zeigt beim normalen Landpinsel ausschließlich die Größe. 015–016 belegen neutrales neues Land in zuvor überstrichener Wasserfläche; 020 zeigt das Füllen aller vorhandenen Landflächen. 027–030 zeigen, dass Farbe unter entferntem und wiederhergestelltem Land erhalten bleibt. Daraus folgen getrennte Werkzeuge und Datenverantwortungen. Eigentümliche Originaltexturen oder identische Pixel sind kein Abnahmeziel.

Die früheren fehlgeschlagenen Geschwindigkeitsproben bleiben unverändert erhalten. Die neue Diagnose nutzt native XTEST-Eingaben statt auf jede Chromium-Mausbestätigung zu warten. Sie berücksichtigt `getCoalescedEvents()` sowohl bei der Eingabeauswertung als auch im Pinselkern. So werden tatsächlich empfangene Dauer und vollständige Pfade geprüft; eine bloße Zahl an äußeren Pointermove-Ereignissen würde zusammengefasste Eingaben fälschlich als fehlend zählen. Lokale Folgeläufe liegen unter `/home/aaron/.local/share/saltmarcher-qa/land-color-separation-20261019`.
