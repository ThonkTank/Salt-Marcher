# Bau-01: Paketwand und „None“ beim Building Tool

**Originalbeleg:** `tools/groups/bau.json`, DD-015.01/.02. Eine vor dem Zeichnen gewählte QAWall01-Textur steht auf der geschlossenen automatischen Ellipsenwand. Die Wahl „None“ fügte dagegen ein Bodenpolygon hinzu, ohne die Zahl der gespeicherten Wände zu erhöhen (3→4 Polygone, 3→3 Wände). Die Bildwirkung und die Originaldatei sind im Gruppenmanifest verlinkt.

**Statische Produktabweichung:** `properties.ts` bietet derzeit nur „Lesbare Grundwand“ und Paketassets an; „None“ fehlt. `editor.ts` `composeArea('floor')` liest zwar `settings.room.wallAssetId`, legt aber `newBuilding` ohne diese ID an. Sein `styleKey` berücksichtigt sie auch beim Zusammensetzen benachbarter Flächen nicht. So kann die vorab gewählte Paketwand den neuen Grundriss nicht erreichen.

Das reine Modul `src/features/bau/building-wall-choice.ts` stellt `BuildingWallChoice`, `buildingDrawStyle`, `buildingStyleKey` und `buildingHasWall` bereit. Der gemeinsame Anschluss benötigt:

1. Im Building-Optionsfeld die drei Zustände **Grundwand**, **Paketwand** und **None** explizit anbieten, auch wenn noch kein Paket aktiviert ist. Der Zustand muss in den Werkzeugvorgaben als `BuildingWallChoice` unterscheidbar bleiben; `undefined` für die Grundwand darf nicht zugleich „None“ meinen.
2. Vor dem asynchronen `compose-building`-Aufruf Wahl, Bodenstandard und Material als Momentaufnahme mit `buildingDrawStyle()` auflösen. Bei einer neuen Building-Entität diese Style-Felder übernehmen. Für die Auswahl zusammenzusetzender bestehender Buildings `buildingStyleKey(existing)` gegen `buildingStyleKey(snapshot)` vergleichen. Den Water-Zweig mit seinen eigenen Einstellungen nicht ändern.
3. Im Renderer bei `buildingHasWall(e) === false` weder einfache Kontur noch Paketwand zeichnen. Ob der allgemeine Flächenschatten bei „None“ ebenfalls wegfallen muss, ist bildlich am isolierten Original/Host zu vergleichen.

Die Tests belegen nur die Style-Entscheidung und getrennte Compose-Schlüssel. Galeriebedienung, sichtbare Wandwirkung, Undo/Redo, Save und frisches Öffnen benötigen nach dem gemeinsamen Anschluss einen isolierten Hostlauf. Die einmotivative QAWall01-Probe sagt nichts über die Vollständigkeit einzelner Wandmotive oder über Farbreset/Bevel aus.
