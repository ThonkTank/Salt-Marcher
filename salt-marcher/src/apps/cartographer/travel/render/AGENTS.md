# Ziele
- Visualisiert Travel-Routen samt Startpunkt-Verbindung und Interaktionsflächen auf dem Hex-Layer.
- Stellt DOM-Helfer bereit, die von UI-Controllern (`ui/route-layer`, `ui/drag.controller`) wiederverwendet werden können.
- Trennt Rendering von Domain-/Playback-Logik, damit Tests Route-Manipulationen isoliert prüfen können.

# Aktueller Stand
## Strukturüberblick
- `draw-route.ts` räumt das Ziel-`<g>` leer und zeichnet Polyline, Dot-Hitboxen sowie sichtbare Punkte inklusive Datensätzen (`data-idx`, `data-kind`).
- `updateHighlight` toggelt CSS-Klassen und Radien, damit UI-Controller Hervorhebungen ohne komplettes Re-Render setzen können.

## Integrationspfade
- `ui/route-layer.ts` kapselt das `<g>`-Element und ruft `drawRoute`/`updateHighlight`, während `ui/drag.controller.ts` dieselben Daten-Attribute nutzt, um Dots zu finden.
- Die Farb- und Animationswerte kommen aus `src/app/css.ts` (`.tg-route-dot*`), wodurch Änderungen am Rendering CSS und TS gleichzeitig betreffen.

## Beobachtungen & Risiken
- `drawRoute` entfernt immer den kompletten Layer. Erfolgt während eines aktiven Drags ein Re-Render, gehen Pointer-Captures verloren und Controller verlieren Referenzen.
- Liefert `centerOf` für einzelne Koordinaten `null`, fehlen Dot- und Hitbox-Elemente komplett. UI-Interaktionen (Drag, Kontextmenü) bemerken dies erst über indirektes Fehlverhalten; es gibt weder Logging noch Fallback.
- Konstante Radien (`USER_RADIUS`, `AUTO_RADIUS`) leben ausschließlich in `draw-route.ts`; CSS und Tests spiegeln die Werte nicht automatisch.

# ToDo
- [P2.61] `draw-route.ts`: Fehlende Zentren (`centerOf` → `null`) als Warnung loggen und eine Wiederholungs-/`ensurePolys`-Strategie dokumentieren, damit Routenpunkte nicht stillschweigend verschwinden.
- [P2.62] `draw-route.ts`: Layer-Diff einführen, das bestehende Dot-/Hitbox-Elemente aktualisiert statt sie zu löschen, um Pointer-Capture und Event-Verweise während Rerenders zu erhalten.
- [P4.1] Animierte Routen und Status-Indikatoren ergänzen.

# Standards
- Render-Helfer dokumentieren ihre Canvas-/SVG-Abhängigkeiten im Kopf.
- Funktionen liefern reine Zeichenoperationen und nehmen Konfiguration als Parameter.
- Sichtbare Attribute (Radius, Klassen) werden zentral gehalten und bei Änderungen in Tests/CSS gespiegelt.
