# GPU-Varianten: planare Netzverdichtung nicht übernommen

22.10.2026, Entwicklerhost Intel UHD 620, Node 22.22.0, nativer Electron-Atlas.
Ausgangspunkt `8325168224e8a6e371c593ce29f80a18eb63aab9` (PR #1370).
Dessen Main-CI `39748595853` ist erfolgreich. Die hier untersuchte
Netzverdichtung war ein uncommitteter Prototyp und wurde vollständig aus dem
Produktcode entfernt. Kein Release- oder Pentium-7505-Nachweis.

## Problem und drei Optionen

Die letzte volle Weltprobe erreichte bei Navigation p95 24,9 ms und beim Sculpt
39,5/40,5 ms. Einzelne Hauptgelände-Draws verbrauchten zuvor GPU-p95 10–14 ms;
das ist nicht die gesamte Bildzeit. Einfache nacheinander gemessene Varianten
waren wegen stark schwankender Referenzzeiten nicht aussagekräftig.

| Ansatz | Vorteil | Nachteil / Grenze |
| --- | --- | --- |
| Adaptives Geländenetz | Größtes Potenzial im ersten gepaarten Komponentenvergleich | Veränderte Dreiecke können Höhenlinien, Küsten, Straßenauflage und Treffer auseinanderbringen; Netzpflege kostet CPU-Zeit |
| Weniger Shaderarbeit / vorberechnete Kartenanteile | Erhält die vorhandene Geometrie | Konturen, Wald und Details dürfen nicht einfach entfallen; reine GPU-Zeit erklärt den Gesamtverzug nicht |
| GPU-Höhenvorschau | Kann CPU-Schleifen und wiederholte Attributuploads während Sculpt ersetzen | Neue Höhen-/Wasser-/Schutz- und Rücknahmegrenzen nötig; hilft statischer Navigation nicht automatisch |

Ausgewählt wurde zunächst Netzverdichtung mit möglichst unverändertem Bild.
[Mapbox MARTINI](https://github.com/mapbox/martini) ist eine geprüfte Referenz für
RTIN-Detailstufen; ein direktes Einsetzen passt nicht ohne weitere Arbeit zu
unserem nicht gleichmäßigen Fokusnetz und dessen bestehender Zelltriangulierung.
Es wurde kein Bibliothekscode übernommen. Der Prototyp fasste stattdessen nur
planare Rechtecke rekursiv zusammen und behielt alle Randsegmente. Gegenüber
der bestehenden Fläche war die mathematische Höhenabweichung vor GPU-Rundung
auf 20 µm begrenzt. Vor einer direkten Pinseländerung stellte er das vollständige
Netz wieder her. Keine Reduktion der gespeicherten Höhen oder Objektbestände.

## Ergebnisse

[Komponentenvergleich](components.json): je Variante 48 unmittelbar aufeinander
folgende Referenz-/Variantenpaare, Reihenfolge abwechselnd. Keine Pixelabfrage
zwischen den beiden Draws. GPU-Timer nicht disjoint; Referenzbilder bei Rückkehr
bytegleich. Ein 129²-Netz benötigte im Median etwa 62 % der GPU-Zeit des 257²-Netzes,
65² etwa 52 %. Das Abschalten von Konturen ergab etwa 77 %, Wald 89 %, Detailfarbe
83 %. Diese Abschaltungen waren ausschließlich Diagnostik, keine Produktoptionen.

[Planarer Prototyp](planar-pixels.json): die ebene Fläche verwendete 1.024 statt
131.072 Dreiecken, die Insel 22.912. Vollständig gekrümmtes Gelände blieb dicht.
36 GPU-Bildvergleiche deckten zwei Maßstäbe, drei Höhenfelder, drei Kameraposen
und normalen/gekächelten Output ab. Größte Abweichung: 6 Farbstufen in einem
Randpixel; höchstens 3 Pixel eines Bildes wichen um mehr als 2 Stufen ab.
Meer/Insel benötigten in 40 gepaarten Draws pro Fall etwa 77–85 % der GPU-Zeit.
Die reinen Wellenfelder zeigten keinen konsistenten Gewinn.

Das [isolierte Prüfbild](planar-island.png) zeigt den Verlauf der Konturen. Seine
weiche Küste stammt aus der absichtlich kleinen 128²-Farbtextur; das Bild ist
keine gestalterische Abnahme und belegt keine Verbesserung der Küstenschärfe.

| Vollständige Welt, p95 / p99 in ms | [Vorher](before.json) | [Prototyp](planar-world.json) |
| --- | --- | --- |
| Navigation | 24,9 / 66,7 | 24,8 / 66,7 |
| Sculpt | 39,5 / 41,2 | 45,2 / 63,1 |
| Erneuter Sculpt | 40,5 / 50,0 | 40,8 / 45,6 |

100.000 Biome-Hexes, 5.000 Orte, 5.000 ausgestattete Gebäude, 50 Details und
4.001 Dungeonräume; 108.076 Landschaftsrecords. Die Hexes sind keine 100.000
feinen Höhenbearbeitungen. Beide Pinselzüge mit 2.500 Meilen Radius wurden
gespeichert und vollständig auf 48/48 Farbkacheln verfeinert. `WORLD_READBACK=off`:
keine Aussage zur Eingabe-bis-Pixel-Latenz. Alle nativen Prozesse schlossen
normal, verschwanden und meldeten keine Rendererfehler. Vorher/Nachher sind
separate Läufe, keine statistisch abgesicherte Ursache der Sculpt-Verschlechterung.

## Entscheidung und Aufräumen

**Nicht übernehmen:** kein belegter Gewinn in der vollständigen Navigation,
langsamerer erster Sculpt-Lauf und zusätzliche CPU-/Indexverwaltung während
Höhenpublikationen. Ein isolierter GPU-Gewinn reicht als Liefergrund nicht aus.
35 gezielte Geometrie-/Treffer-/Pinseltests sowie App-Typprüfung und Desktopbuild
bestanden während des Versuchs; diese Teilbelege widerlegen den End-to-End-Befund
nicht. Der zusätzliche schräge-Ebene-Test wurde vor dem Verwerfen nicht mehr
ausgeführt und zählt nicht zu diesen 35 Tests.

Die beiden veränderten Produktdateien wurden auf den Ausgangsstand zurückgeführt;
der neue Indexgenerator, seine Tests und die isolierte native Probe wurden aus
dem Repository entfernt. Der Versuch bleibt lokal unter
`~/.cache/saltmarcher/atlas-planar-rejected-20261022/` rekonstruierbar. Die hier
abgelegten JSON-Belege sind Messprotokolle, keine dauerhaft ausführbare Suite.
Der anschließend erneute Desktopbuild verwendet wieder den unveränderten
Produktrenderer. Keine neue Cache-, LOD- oder Umschaltlogik bleibt zurück.

Nächste Entscheidung: den gesamten Weg von Eingabe bis Präsentation untersuchen
und gekachelte Terrain-Detailstufen, GPU-Höhenfelder sowie einen Vektorkartenrenderer
unter denselben Bedingungen vergleichen. Bestehende Architektur ist gemäß dem
erweiterten Nutzerauftrag keine Bindung. Kriterien bleiben reale Reaktionszeit,
Lesbarkeit, Bearbeitung, Innenräume/Etagen, Ausgabe und wartbarer Gesamtaufbau.
