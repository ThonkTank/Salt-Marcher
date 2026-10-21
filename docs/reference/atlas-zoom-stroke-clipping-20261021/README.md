# Tiefer Zoom mit großem Regionenpinsel

Die praktische Autorenprobe erzeugte zunächst mehrere Landmassen, Relief,
einen Wald und ein unabhängiges Königreichsgebiet im normalen Atlas. Beim
Wechsel vom 9.000-km-Ausschnitt zur Bauplatzgröße blieb die laufende Ansicht
bei etwa 6,7 km Breite hängen. Frisches Öffnen derselben gespeicherten Welt
lud den Ausschnitt problemlos. Die Weltdaten waren nicht beschädigt.

## Ursache und Änderung

Der große feste Regionenpinsel verwendet einen gestrichelten Rand. Beim Zoom
werden die Striche in Weltmetern kleiner. Der räumliche Renderer zerlegte aber
weiterhin den vollständigen, 800 km großen Kreis in einzelne Strichobjekte,
auch außerhalb der geladenen Kartenfläche. Im [CPU-Profil](profile-summary.json)
entfielen rund 29,6 Sekunden allein auf das Entfernen dieser Objekte. Die
[diagnostische Zoomfolge](before-steps.json) scheiterte, anschließend auch das
reguläre Schließen; dieser Lauf ist kein bestandener nativer Check.

Strichmittellinien werden jetzt vor Strichaufteilung und Geländeanpassung auf
die geladene Terrainfläche samt Breiten-/Gehrungsrand zugeschnitten. Unsichtbare
Strecken werden rechnerisch übersprungen. Die tatsächliche zurückgelegte
Strecke bestimmt weiter die Strichphase; Ecken und sichtbare Teilstücke bleiben
zusammenhängend. Autorengeometrie und gespeicherte Pinselgröße ändern sich nicht.

## Nachprüfung

39 Szenen-/Kamera-/Trefferprüfungen sowie beide TypeScript-Prüfungen und
Desktopbuild bestanden. Neue Regressionen prüfen einen vollständig unsichtbaren
800-km-Pinselrand ohne erzeugte Meshes, eine lange sichtbar zugeschnittene Linie
mit transformierten Koordinaten, Strichphase über Ecken und Wiedereintritt in
den Ausschnitt. Die vorherigen Dash-/Loch-/Treffer- und Exportfälle bleiben grün.

Die [wiederholte native Folge](after-steps.json) erreicht jetzt 400 m Breite.
Gesamter profilierter Ablauf einschließlich Öffnen: 10,8 Sekunden; der App-
Prozess und der Teststarter endeten mit Exit 0, der PID war anschließend weg.
[Letzter Zustand](after-state.json). Dies belegt die beseitigte Hängeursache,
nicht allgemein sofortige Detailanzeige oder die Gesamtleistung einer vollen
Welt auf dem Pentium Gold 7505. Die große Sculpt-Operation bleibt separat offen.
