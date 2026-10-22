# Pinselregler und Werkzeugleiste mit dem vorhandenen Kartenbild aktualisieren

22.10.2026. Ein begrenzter UI-Kostenschritt; volle Weltkartenleistung bleibt offen.

Nach der GPU-Farbkomposition zeigte das CPU-Profil wiederholte Layoutabfragen
unter `syncBrushSizes → render → write`: 56,8 beziehungsweise 76,2 ms kumulierte
Samples während zweier Pinselzüge. Die Werkzeugverfügbarkeitsprüfung verbrauchte
jeweils etwa 57 ms. Diese Summen sind keine Einzelaufrufzeiten. Quelle:
`.build/gpu-detail-profile/profile-summary.json`.

## Entscheidung

| Option | Nutzen | Grenze |
| --- | --- | --- |
| DOM-Maße einzeln zwischenspeichern | Weniger synchrone Abfragen | Neue Invalidierungsregeln für Resize, Scroll, Zoom und Seitenschubladen. |
| Vorhandene Kartenmessung teilen und eine Werkzeugaufnahme je Aktualisierung verwenden | Weniger Layoutabfragen und wiederholte Katalogarbeit, klare vorhandene Besitzer | Andere UI-/GPU-Kosten bleiben. |
| Weitere Darstellung in Worker/GPU verlagern oder Detailstufen persistieren | Größeres Potenzial für Weltauflösung und Ladezeiten | Behebt die wiederholte DOM-Arbeit nicht. |

Gewählt wurde die zweite Option. `AtlasCanvas.paint` berechnet bereits den
aktuellen Kartenmaßstab. Seine Hilfsebene reicht diesen Wert nun an
`CampaignAtlasWorkbench.syncBrushSizes` weiter. Speicherbestätigungen messen
die Oberfläche nicht zusätzlich synchron. Direkte Eingaben lesen weiterhin
die aktuelle Geometrie; geänderte Fenstergrößen werden nicht aus einem alten
Cache übernommen. Eine fehlende neue Geometrie darf die Regler über das
vorhandene Kartenbild aktualisieren, ohne alte Autorentreffer freizugeben.

`AtlasWorkspaceLayout.sync` liest den aktuellen Werkzeugkatalog einmal und
verwendet dieselbe Aufnahme für Gruppen, Auswahl und Schaltflächen. Beim
nächsten Aufruf wird der Katalog neu gelesen. Unveränderte Beschriftungen und
gedrückte Zustände behalten ihre DOM-Knoten beziehungsweise Attribute.
Es gibt keinen zweiten Renderzyklus oder neuen globalen Geometriecache.

Die erste Fassung forderte zusätzlich vor jedem normalen Szenenaufbau ein
Bild der alten Szene an. Dieser unnötige Auftrag wurde vor der abschließenden
Prüfung entfernt. Normale Szenen nutzen ihren eigenen Zeichenauftrag;
direkte GPU-Gesten und noch ausstehende Geometrie nutzen die Hilfsebene.

## Messung ohne laufendes Pixelauslesen

Der bestehende Welttest besitzt nun ausdrücklich `WORLD_READBACK=off`. Dieser
Modus misst Frameabstände und prüft Draft, Speicherung und vollständige
Verfeinerung; er liefert **keine Eingabe-zu-Pixel-Latenz**. Die bisherigen Modi
und ihre Pixelanforderungen bleiben erhalten. Die nachgelagerten Bildorakel
werden weiterhin ausgeführt.

Das ist erforderlich, weil der separate Diagnoseablauf in den ersten 250 ms
eines Pinselzugs auch etwa 38 ms GL-Zustandsabfragen, 24 ms Auslesen und 19 ms
Pixelvergleich des Messwerkzeugs zeigt. Die Zeitzuordnung dieses ersten Fensters
hat etwa 54 ms Unsicherheit. Diese Werte dürfen weder als Produktkosten
ausgegeben noch nachträglich von gemessenen Antwortzeiten abgezogen werden.

| Ohne laufendes Pixelauslesen | Vorher p95 / p99 | Abschließend p95 / p99 |
| --- | --- | --- |
| Navigation | 24,8 / 78,8 ms | 24,9 / 66,7 ms |
| Sculpt, erster Zug | 40,5 / 48,6 ms | 39,5 / 41,2 ms |
| Sculpt, zweiter Zug | 41,5 / 62,3 ms | 40,5 / 50,0 ms |

[Vorher](before.json), [erste Fassung](first-after.json),
[abschließende Fassung](after.json). Die erste Fassung erreichte Navigation
p95 35 ms; einzelne Läufe sind kein stabiler statistischer Leistungsnachweis.
Lange UI-Aufgaben beim Sculpten gingen in diesem Vergleich von drei/drei auf
eine/null zurück. Die Frameziele bleiben verfehlt.

Die Welt enthält 100.000 Geländezuordnungen, 5.000 Orte und eingerichtete
Gebäude, 50 Details und 4.001 Dungeonräume. Geländezuordnungen sind keine
100.000 separat bearbeiteten Reliefzellen. Beide Züge verwenden einen Radius
von 2.500 Meilen, wurden gespeichert und bis 48/48 Kacheln verfeinert.
Alle Prozesse endeten normal; Fehlerlisten sind leer. Entwicklungsrechner mit
Intel UHD 620, keine Pentium-Qualifikation. Drei vollständige mängelfreie
Produktaudits, Gestaltung und Langzeitprüfung mit Bearbeitung bleiben offen.

Die [separate Pixelantwortprüfung](pixels.json) der abschließenden Fassung
misst 200,4 und 176,6 ms bis zur ersten ausgelesenen Änderung innerhalb des
Pinsels. Sie enthält den Ausleseaufwand und belegt das 100-ms-Ziel nicht.
Auch hier werden beide Züge gespeichert und vollständig verfeinert. Die
Farb-, Kontur-, Draft- und Ausgabeorakel des bestehenden Welttests bestehen.

144 betroffene Tests prüfen unter anderem gemeinsame Frame-Skalierung,
frische Eingabemaße nach Resize, Werkzeugwechsel, unveränderte Beschriftungen,
gesperrte Pinsel und das Beibehalten der GPU-Szene bei Speicherbestätigungen.
Die native Pinselbedienung prüft außerdem 640-px-Fenster, 200-%-Skalierung,
Weltmaßmodus, Shift-Mausrad, Regions-/Innenraumpinsel, Undo/Redo und Wiederöffnen.
[Prüfprotokolle und Quellenhashes](checks.json), [native Bedienfolge](brush.json)
und [Referenzraum mit Pinselreglern](brush.png) halten die genaue Zuordnung fest.
Typprüfungen, Desktopbuild und Repositoryprüfung bestehen. Die Bedienfixture
belegt keine natürliche Reliefgestaltung oder lesbare Weltkarte. Bei 200-%-
Browserzoom fiel unscharfe Kartenbeschriftung auf; die einmalige Übernahme der
Pixeldichte im Renderer ist als mögliche Ursache noch separat zu untersuchen.
