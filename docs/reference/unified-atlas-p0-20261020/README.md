# P0: kleine gemeinsame Prüfwelt, noch keine Leistungsabnahme

Zum [Arbeitsstand](../../plans/maps/unified-atlas-baseline.md) der neuen
Atlas-Roadmap. Der Produktcode dieser Probe ist unverändertes
`f83b04418f9822424c3ab6c3ae9610b314014e49`; neu sind Testwelt und Prüfwerkzeuge.
Die Ergebnisse vergleichen noch keine neuen Renderer und belegen keine Lieferung.

## Lokale Prüfungen

- `node build.mjs --test`: Testassets vorbereitet.
- `node --test tests/atlas-benchmark.test.mjs`: 3/3 bestanden. Höhen und
  Flussgefälle, freier Gebäudegrundriss neben der Straße, kanonische Speicherung,
  Regionshierarchie, Einrichtung/Geschosse, Raumänderung/Undo und frischer Store.
- `npm run check`, zusätzliche strikte Typprüfung der beiden Fixture-Module,
  `npm run build:desktop`, `npm run check:repo`, Syntax- und Diffprüfung bestanden.
- Capability-Katalog: neue Testdatei beim Ablauf der gemeinsamen eingerichteten
  Raumgruppen eingetragen und `--geprueft` vermerkt. Skalieren/Teilen und volle
  native Bedienung sind dadurch nicht erneut qualifiziert.

Beim Prüfen korrigiert: Meeresspiegel über seinen fachlichen Befehl setzen;
Fluss dem Tal folgend bis ins Meer führen; Straße vor der Taverne vorbeiführen
und den Eingang mit einem Weg anbinden. Der spätere Manifest-Fingerprint v2
berücksichtigt zusätzlich die beiden separaten Innenraumrezepte. Der hier
gemessene Bestand hat dieselben Rezepte und Geometrien, aber noch den älteren
Fingerprint-Umfang; seine originale Kennung bleibt unverändert im Rohbeleg.

## Native Beobachtung und Grenzen

Die [Region im nativen Fenster](region.png) zeigt Festland, Insel, Gebirge,
Talfluss, Straßen, Orte und Regionshierarchie. Die Küsten sind bereits auf diesem
Maßstab sichtbar unscharf; regionale Namen konkurrieren um denselben Bereich.
Das ist der bisherige Renderer, kein akzeptiertes Zielbild des neuen Atlas.

[Rohbeleg](result.json) und [letzter vollständiger Schritt](checkpoint.json):
1920 × 1080 Fensterinhalt; der Kartenbereich ist wegen Kopf-/Werkzeugleisten
kleiner. 16 Wheel-Schritte von 40.000 km bis 110,43 m Ausschnittbreite sind
gesichert. Die strengere Probe verlangte unter 80 m und erreichte den
Abschluss vor Abbruch nicht. Beobachtete Prozessstart-bis-Ready-Zeit: 11,71 s.
Input-bis-stabile-Ready-Beobachtung: 2,64–34,04 s, einschließlich einer
200-ms-Stabilitätsprüfung. Das misst weder erste Pixelreaktion noch reine
Berechnung, GPU-Zeit oder Compositorpräsentation.

Hostlast und OS-Cache sind unkontrolliert; während dieses diagnostischen Laufs
liefen zeitweise Typ-/Fixtureprüfungen. Deshalb sind die Zahlen ein reproduzierbar
lokalisierter Problembefund, keine belastbare Quantifizierung einer Verbesserung
und kein kontrollierter Vergleich. rAF-Statistik über Stand-/Ladezeiten würde
zudem schnelle Leerlaufframes mit Bewegung vermischen; daraus folgt kein 60-FPS-Beleg.

Der Prozess überschritt das 180-s-Limit. Die zugehörige `ui-session.py` wurde
gezielt beendet; alle Prozesse mit ihrem Sitzungsmarker waren anschließend weg.
[Supervisorbefund](supervisor.json): Wrapper-Exit 130; das im App-Rohbeleg
aufgezeichnete Electron-Exit 0 ist **kein** regulär abgeschlossener Probelauf.
Künftige Läufe haben zusätzlich `--kill-after=10s` und ein 300-s-Gesamtlimit.
Es wurde kein fehlender Lauf automatisch als erfolgreich gewertet.

Ein früherer Probelauf endete regulär, prüfte den Zielmaßstab jedoch zu schwach
(nur relative Verkleinerung, ebenfalls 110,43 m). Er wird nicht als bestandener
Ersatz verwendet. Ein erster Startversuch scheiterte am noch nicht installierten
Electron-Runtime; `npm run desktop:runtime` hat diese Voraussetzung hergestellt.

Offen: vollständiger nativer Ablauf einschließlich Höhenlinien, Neigung,
Terrain- und Wandbearbeitung/Undo, große Prüfwelt, direkte Pixelreaktion,
Ressourcenlanglauf und P1-Enginevergleich. Keine CI-, Integrations-, Paket-,
Installations- oder Nutzerabnahme wurde durchgeführt.
