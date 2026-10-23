# Atlas-Planprüfung: fertige Darstellungsprodukte vor globalen Indizes

Planprüfung vom 24.10.2026, ausgelöst um 01:19 Uhr. Der vorherige Cache-Schritt
wurde mit `dbd8e45f` gesichert; aktueller `origin/main` blieb dessen Vorfahr.
Die lauffähige M0-Referenz, kanonische Nutzerdaten und Liefergates bleiben erhalten.

## Befund und Entscheidung

Die persistente Wiederverwendung und getrennten privaten Workerindizes haben
sich bewährt: identische Daten nach Neustart, unabhängige Leser trotz Verdrängung,
atomare Veröffentlichung und Wiederaufbau. Der kalte native Geometrieabruf ist
mit zuletzt 4,42 s weiterhin über dem 2-s-Ziel. Der gemeinsame Retentionscache
begrenzt nun Indizes und Kacheln, hat aber das warme Öffnen in einer Einzelprobe
von 323 auf 456 ms verlängert. Das ist kein gemessener Produktgewinn.

Die schwache Vorbereitungsregel ist direkt im Code belegt: Vor jedem ersten
Kachelzugriff wurden `AtlasProjectionIndex.open`, Readerkonstruktion,
`reader.sync` und `pyramid.sync` ausgeführt, auch wenn das angeforderte Produkt
bereits vollständig und unverändert gespeichert war. Die Quellenprüfung ist
notwendig; eine Indexkopie und Synchronisation sind für diesen Treffer nicht nötig.

Drei tragfähige Alternativen wurden in der
[bestehenden Roadmap](../../plans/maps/unified-spatial-atlas.md) nach Kartenqualität,
Reaktion, Bearbeitbarkeit, Wartbarkeit und Umstellungsrisiko verglichen:
exakte Produkte zuerst, Indizes nach Datenart verzögert laden, oder räumlich
begrenzte inkrementelle Übersichtsquellen. Gewählt ist der erste Ansatz, weil
sein Nutzen ohne Qualitätsverlust belegt ist. Die dritte Alternative hat das
größte kalte Potenzial, benötigt aber erst eine Gegenprobe für vollständige
Abdeckung, Bindungen, Höhen, Fehlerhinweise und Bearbeitung. Kein erneuter
Renderer- oder Speicherarchitekturwechsel allein wegen des Prüfzeitpunkts.

## Gegenprobe

[Reproduzierbarer Vergleich](../../../tools/measure-atlas-first-product.mjs),
feste M0-Welt, vier abwechselnde A/B-Runden mit neuen readonly Verbindungen.
Beide Varianten pinnen denselben kanonischen Snapshot, prüfen Atlasrevision und
dauerhafte Quellenstempel und liefern denselben Meshdigest. Die ursprüngliche
[Entscheidungsprobe](decision-counterprobe.json.gz) benötigte mit Vorbereitungen
236–262 ms, beim Produktabruf ohne Index 41–93 ms. Das Indexöffnen allein kostete
164–175 ms. Der [Endstand mit dem implementierten Cachezugang](final-counterprobe.json.gz)
bestätigt denselben Digest in allen acht Abrufen: 251–278 ms vorbereitet,
41–92 ms direkt. Dies misst Bibliotheksarbeit, weder Workerstart noch native Bildlatenz.

## Umsetzung und Übergangsvertrag

Geometrie (grob/fein), Terrain und Material besitzen einen exakten Cachezugang.
Nur gültige Anfragen und vollständige, prüfsummengültige Produkte mit identischen
dauerhaften Quellenstempeln dürfen antworten; Material verlangt alle fünf
Kanäle einschließlich interner Wasser-Topologie. Die gemeinsame Quellenprüfung
wird innerhalb der gepinnten kanonischen Lesetransaktion ausgeführt, bevor ein
neuer Worker diesen Zugang nutzt. Rückgaben bekommen die aktuelle Revision/Fence.

Ein Miss, eine geänderte Quelle oder ein beschädigter Teilbestand führt zur
normalen Vorbereitung. Der erste Reader beginnt mit explizitem Reset, weil Main
während früherer direkter Treffer bereits seinen Cursor weiterführen konnte.
Nach erstmaliger Reader-Nutzung bleibt jede weitere Index-/History-Synchronisation
unverändert. Dadurch entfallen verlorene Invalidierungen; der Ansatz erfordert
weder einen weiteren Zustandsautomaten noch automatische Hintergrundarbeit.
Die erste nachfolgende neue Detailanfrage übernimmt den verschobenen Aufwand.

## Native Wirkung

[Reale Preload/Main/Worker-Probe](native-result.json.gz), unveränderte feste M0-Welt:

| Messabschnitt | Vorher (`dbd8e45f`) | Produkt zuerst |
| --- | ---: | ---: |
| Kalte Geometriedaten | 4.419 ms | 4.563 ms |
| Warme Geometriedaten nach neuem Prozess | 456 ms | **186 ms** |
| Erste neue Feinkachel nach der warmen Übersicht | 555 ms | 553 ms |
| Nutzbare Feinszene nach Erhalt der Feindaten | 775 ms | 724 ms |

Die neue Probe zeichnet auch die warme Übersicht: nach Datenerhalt 123 ms bis
zur nutzbaren Darstellung. Dieser Abschnitt wurde vorher nicht gemessen.
[Warme Übersicht](warm-overview.png) gesichtet. Die native Probe bestätigt explizit,
dass der warme Treffer keine private Index-Arbeitsdatei angelegt hat. Die erste
Detailanfrage blieb hier gleich schnell; daraus folgt keine allgemeine Garantie
für sämtliche späteren Misses. Kalte Werte sind nicht besser. Einzelproben,
keine p95-Statistik; Aktivierung und kompletter Produktstart sind nicht enthalten.

[Baselinevergleich](baseline-comparison.json): unveränderte Meshes für 11.500 Räume,
gleiche Pixelbelegung, gleiche Autorenhashes und exakter Raumtreffer. Die kalten
Übersichts- und Detailbilder bleiben bytegleich zum zuvor geprüften Stand.
Beide nativen Prozesse endeten regulär mit Exit 0 und verschwundenen PIDs;
keine Rendererfehler. Der normale Atlasrenderer wurde in diesem Schritt nicht
umgestellt oder erneut als vollständiger Produktablauf qualifiziert.

## Prüfungen und Gegenbeispiele

[46 gezielte Tests](final-tests.log.gz) bestehen am Endstand. Sechs neue echte
Workerfälle prüfen alle Produktarten ohne private Indexdatei, den ersten Miss,
eine zwischenzeitliche Autorenänderung mit korrekter neuer Region/Auswahl/Fokus,
veraltete dauerhafte Stempel bei gleicher Atlasrevision, Anfragerevision,
fehlende Trackingtrigger, beschädigte Cachebytes und fehlende Wasser-Topologie.
Die weiteren 40 Fälle decken Terrain-/Material-/Geometrieinvalidierung, Undo/Redo,
private Indizes, Verdrängung und persistente Wiederöffnung ab.
[App-Typprüfung](check.log.gz), [Desktop-Typprüfung](check-desktop.log.gz),
[Desktopbuild](build-desktop.log.gz) und [Repositoryprüfung](check-repo.log.gz)
bestanden. Die Testdatei ist den geprüften Abläufen im
[Capability-Katalog](capability.log.gz) zugeordnet.

Die [erste Testsammlung](first-tests.log.gz) fand einen Syntaxfehler im neuen
Test; die 40 vorhandenen Tests bestanden. Der nächste Worker-Test verglich
irrtümlich das gesamte `heights.buffer` statt der TypedArray-Sicht mit
`byteOffset`/`byteLength`. V8-deserialisierte Sichten können einen größeren
Hintergrundspeicher teilen. Seine riesige Differenzdarstellung verursachte den
[OOM-Abbruch](worker-oom.log.gz), nicht einen belegten Produktpfad-Leak. Die
[begrenzte Diagnose](worker-diagnosis.log.gz) lokalisierte die Abweichung sofort;
jetzt wird die tatsächliche Bytefolge über SHA-256 verglichen, mit kleinen
Fehlermeldungen. Ein separater Revisionsfall erhielt eine gültige abweichende
Revision statt `-1`. Der finale vollständige Lauf mit 512-MiB-V8-Heaplimit
bestand; daraus wird kein Gesamt-RAM-Limit der Anwendung abgeleitet.

## Grenzen

Dieser Schritt verkürzt den unveränderten ersten Produktabruf. Er beschleunigt
keine kalte Welt ohne passende Produkte und begrenzt keine aktiven Arbeitsdateien.
Die neue Darstellung bleibt isoliert bis zur vollständigen Werkzeugübernahme;
Native Kernmessung, normaler Atlas, Gesamt-M2 und Ownerabnahme bleiben getrennt.
Als Nächstes muss die kalte globale Quellenvorbereitung gegen einen räumlich
begrenzten Aufbau geprüft werden. Ein vollständiger Ersatz ist ohne diese
Gegenprobe noch nicht gerechtfertigt. Keine Main-Integration oder Veröffentlichung.
