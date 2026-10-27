# Terrain-/Wasser-Messfixture v1

`v1.json` wird vor dem ersten Baseline-Versuch unverändert in das Belegverzeichnis
kopiert und mit SHA-256 gebunden. `tools/terrain-water-fixture.mjs` erzeugt daraus
44 reine Höhenkacheln: grobe Kontinente, eine nichtflache Küsten-/Gebirgsregion
und Raumdetails über positiven und negativen Kachelgrenzen. Welt und Eingaben
besitzen keine Zufallsauswahl. Die 30 Pfade enthalten stationäres Halten sowie
dünne und dichte Ereignisfolgen. Ein Test bindet den kanonischen Höhenhash.

Die vollständige Matrix benutzt sieben Werkzeuge, fünf Ansichtsbreiten und zwei
UI-Skalierungen. Die drei Spezialwerkzeuge sind ausdrücklich nicht implementiert;
ihre vorhandenen Parametervorlagen sind keine entsprechenden Baseline-Werkzeuge.
TW01 beginnt mit vier Grundwerkzeugen bei 10 km / 100 %, je 30 Versuchen.

```sh
python tools/ui-session.py node tools/test-desktop-terrain-water.mjs
python tools/ui-session.py node tools/test-desktop-terrain-water.mjs --scale 20 --ui-scale 2 --tools raise,lower,roughen,smooth
```

Der Lauf verwendet ein isoliertes Profil und die vorhandenen Desktopartefakte.
Vorher `npm run build:desktop` ausführen; während des Laufs keine Builds oder
anderen eigenen UI-Prüfungen. Die gewünschten Kombinationen werden vor Start
ausgewählt. Jeder Versuch wird einmal ausgeführt und durch Undo auf exakt
denselben Höhenpayload zurückgesetzt. Ausgelassene/abgewiesene/unsichtbare
Versuche bleiben Fehler; keine Ersatzsamples. Eine Datei `STOP` im jeweiligen
Belegverzeichnis stoppt am nächsten Versuchsrand und schließt das native Fenster
regulär; der Lauf bleibt unvollständig. Signale lösen auch Playwrights globale
Notbereinigung aus und sind kein normaler Close-Nachweis.

Der Renderer zeichnet echte Pointerankünfte und den ersten geänderten
Terrainframe auf derselben `performance.now()`-Zeitbasis auf. Der vollständige
Eingabeplan wird in Main mit `WebContents.sendInputEvent` terminiert; zwischen
Einzelevents gibt es keine Protokoll-Rundreisen. DIP-/Zoomkoordinaten werden am
tatsächlich angekommenen Rendererpunkt geprüft. Ein synchroner
16×16-Pixel-Readback innerhalb der unveränderten Pinselkontur wird nur nach
lokalem Höhenupdate und dessen Deck-Renderabschluss geprüft. Hover oder reine
LOD-/Cursoränderungen reichen nicht. Baseline-Readback und nachfolgende
Beobachterkosten bleiben separat im Datensatz; der Nachweiszeitpunkt liegt nach
dem Readback und wird vom früheren afterRender-Zeitpunkt getrennt. Nach dem
ersten Nachweis gibt es keine weiteren GPU-Readbacks. Die gemessene Pipeline enthält
diesen Aufwand. Physische Bildschirmausgabe wird damit nicht gemessen.
`commit.roundtrip` und Zeit seit echtem Pointerup werden separat berichtet.

Der Test friert ausschließlich den einwortigen Autoren-Seed im isolierten
Renderer ein. UUIDs bleiben zufällig. Reale kanonische Aufträge belegen Mode,
Seed, Radius und tatsächlich integrierte Samples. Parameter, Ausgangshöhen,
Manifest und Pfade bei Vergleichsläufen nicht verändern. Eine Änderung erfordert
eine neue Fixtureversion und eine neue Baseline; fehlgeschlagene alte Belege
bleiben erhalten.

Diagnoseoptionen verändern keine Manifestpfade: `--probe` führt nur die ersten
Halten-/dünn-/dicht-Versuche aus, `--boundaries-only` nur die Korrektheitsfälle;
beide Ergebnisse tragen `diagnosticOnly=true`. `--skip-blur` erhält alle geplanten
Baselineversuche und übrigen Korrektheitsfälle, nennt den fehlenden echten
Fensterfokusnachweis aber ausdrücklich in `boundaryLimitations`. Ein solcher
Lauf allein erfüllt nicht das gesamte TW01-Paket.

Der echte Fokusverlust wird getrennt von injiziertem Pointercancel geprüft.
Playwright aktiviert laut lokaler Primärquelle
`node_modules/playwright-core/lib/coreBundle.js` die CDP-Fokusemulation; für die
Probe wird sie abgeschaltet und anschließend wiederhergestellt. Auf Wayland
sind Electron-Fokusanforderungen kein Fokusnachweis. Die enge KDE-Probe aktiviert
mit einem temporären KWin-Skript ausschließlich PIDs aus `app.getAppMetrics()`
des durch `native-session` bereits besessenen Testprozesses und den eindeutigen
Lauftitel. Sie protokolliert KWin-Aktivität, BrowserWindow-Fokus und Rendererfokus
getrennt; erforderlich bleiben echter DOM-Fokus vor Down, ein vertrauenswürdiges
Window-Blur und genau ein Commit vor Up. Das Skript wird immer entladen. Ein
privater Einmal-DBus-Reporter benötigt das vorhandene `python` mit `dbus`,
`dbus.service` und `gi.repository.GLib`, außerdem `gdbus` und KDE KWin. Es werden
keine Pakete installiert oder Desktop-Einstellungen geändert. Quellen:
[KWin Scripting API](https://develop.kde.org/docs/plasma/kwin/api/),
[Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window).

Der separate Fokusnachweis ist auf diesem Host unter explizitem Xwayland/X11
bestanden. Diagnosebefehl (keine Baseline):

```sh
QA_OZONE_PLATFORM=x11 python tools/ui-session.py node tools/test-desktop-terrain-water.mjs --boundaries-only --cancel-blur-only --blur-only --tools raise
```

Bei reinen Boundarydiagnosen wird die tatsächlich vom Compositor zugelassene
Fenstergröße dokumentiert; nur echte Baselineversuche erzwingen unverändert die
Manifestgröße. Im Wayland-Lauf war KWin-Aktivität nach Weg-/Rückwechsel belegt,
der echte DOM-Blur während gehaltener Geste blieb jedoch aus. Dieser Beleg darf
nicht als Wayland-Blur-Pass gelten. Die Fokusemulation wird in jedem Pfad
wiederhergestellt; der Produktcode erhält keine testbedingte Fokussonderregel.

Die verpflichtende Fokusqualifikation verlangt jetzt eine **Ereignisfolge**:
vertrauenswürdiges Window-Focus nach dem eigenen Weg-/Rückwechsel, dann Down,
vertrauenswürdiges Window-Blur nach erneutem Wegwechsel, Commit vor Up und keine
zweite Übernahme nach Up. Zustandswerte allein genügen nicht. KWin-Klassenname
und Electrons zur Laufzeit aufgelöster Ozone-Schalter unterscheiden das echte
Backend unabhängig von `XDG_SESSION_TYPE`.

Vor einer Fokusprüfung und erneut vor der Fokusfolge liest der Runner
`org.freedesktop.ScreenSaver.GetActive`. Eine gesperrte oder unbekannte Sitzung
stoppt die Qualifikation; sie wird weder entsperrt noch am Sperren gehindert.
Die vorhandene KWin-Version 6.7.5 leitet echten Keyboardfokus bei gesperrter
Sitzung ausschließlich an Sperrbildschirmfenster. Native Focus-/Blur-Events
gewöhnlicher Testfenster sind dann kein erfüllbarer Prüfschritt. Nach manuellem
Entsperren wird nur die enge Fokusprobe fortgesetzt:

```sh
QA_OZONE_PLATFORM=wayland python tools/ui-session.py node tools/test-desktop-terrain-water.mjs --boundaries-only --cancel-blur-only --blur-only --tools raise
```

Ein früherer experimenteller Zugriff auf die private ursprüngliche Playwright-
CDP-Session ist entfernt; er war keine Lösung der gesperrten Sitzung. Es bleibt
die öffentliche CDP-Session mit Wiederherstellung/Detach. Quelldateien werden
künftig automatisch vor Launch zusätzlich zu ihren Hashes als Bytekopien unter
`source-snapshot/` gesichert. `WAYLAND_DEBUG=1` kann für eine reine Diagnose die
eigene Wayland-Clientspur protokollieren; daraus stammen keine Timingwerte.

Der nach manuell bestätigtem Entsperren ausgeführte Wayland-Restnachweis unter
`.build/terrain-water-native/1792957007206-9086/result.json` ist bestanden:
beide Sperrchecks false, native und vertrauenswürdige DOM-Focus-/Blurfolge,
Commit vor Up genau einmal, keine weitere Revision/Write danach und regulärer
Exit. Die frühere Wayland-Lücke war eine gesperrte Desktop-Sitzung und bleibt
als Diagnose erhalten; sie ist kein offener Produktfehler. Die 120er-Baseline
wurde dafür nicht wiederholt. Aktuelle Fokusläufe binden auch den tatsächlich
geladenen Lazy-Terrainruntime vor Launch und beim Abschluss.
