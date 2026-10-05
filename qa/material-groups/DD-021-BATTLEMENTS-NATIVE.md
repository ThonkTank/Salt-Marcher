# DD-021.15/.21 – Battlements-Pfad im Original 1.2.0.1

## Isolierter Stand

- Original: `Dungeondraft.x86_64` SHA-256 `9670325214d744194511d3ce731e910594b75e373928d95ca9e97ea30a769438`; `Dungeondraft.pck` SHA-256 `f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60`.
- Ausgangskarte: [`base.dungeondraft_map`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/base.dungeondraft_map), SHA-256 `6285582f167f5ebcf5c2f6297fc8131bd3b4678ac802ba8b61a3440b07d7aeff`. Karte 12 × 8 Felder, ohne Pfade, Standard-Assets, keine Mods. Isolierte App-Kopie und XDG-Daten auf VNC `:12`; keine Vault-Datei verwendet.
- Gespeicherte Karte: [`saved-three-paths.dungeondraft_map`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/saved-three-paths.dungeondraft_map), SHA-256 `1f6bcaeeb9bb8720244495de9dacf6544ed2666b978fdbab13328a7fdca41900`.
- Alle geschützten Eingabedateien hatten innerhalb beider Läufe identische Vorher-/Nachher-Prüfsummen (`native-run1/protected-*.sha256`, `native-reopen/protected-*.sha256`). Eigene Dungeondraft- und Xvnc-Prozesse sind beendet.

## Bedienfolge und sichtbare Wirkung

Bei 100 % Zoom lagen 64 Bildschirm-Pixel auf einem Feld. Grid war an, Snap aus. Path Tool: eingebaute Library-Kachel **Battlements**, Layer `100: User Layer 1`, Sorting `Over`, Smoothness `1`, Block Light `OFF`, Transition In/Out `None`. Die Screenshots [`03-path-controls.png`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/native-run1/evidence/03-path-controls.png), [`04-horizontal-preview.png`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/native-run1/evidence/04-horizontal-preview.png) und [`14-kink-finish-width2.png`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/native-run1/evidence/14-kink-finish-width2.png) dokumentieren Bedienelemente, Vorschau und Ergebnis.

| Pfad | Klickpunkte in Feldern | UI Width | Gespeicherte Breite | Sichtbares Ergebnis |
| --- | --- | ---: | ---: | --- |
| Gerade | (2, 1,5) → (9, 1,5) | 1 | 69 | Durchgehender waagerechter, texturierter Streifen über 7 Felder. |
| Diagonal | (2, 3) → (8, 4,5) | 1 | 69 | Der Streifen folgt der Diagonale; Motive sind zur Tangente gedreht. |
| Rechtwinkliger Knick | (2, 6) → (5, 6) → (5, 7,5) | 2 | 138 | Die Textur folgt der Kurve; am Knick entsteht ein gerundeter, tangential gedrehter Übergang, keine achsenparallele Rechteckfüllung. |

Alle gespeicherten Pfade tragen `res://textures/paths/battlements.png`, `smoothness: 1`, `layer: 100`, `loop: false` und deaktivierte Fade-/Grow-/Shrink-/Block-Light-Flags. Die gespeicherten `edit_points` enthalten den letzten Punkt jeweils doppelt: gerade `(0,0,1792,0,1792,0)`, diagonal `(0,0,1536,384,1536,384)`, Knick `(0,0,768,0,768,384,768,384)` bei Positionen `(512,384)`, `(512,768)` und `(512,1536)`. Daraus folgt unmittelbar **256 Originaleinheiten pro Feld**. Width 1 = 69/256 = **0,26953125 Feld**, Width 2 = 138/256 = **0,5390625 Feld**, also exakt der doppelte Wert. Auf dem Bildschirm sind das rund 17,25 bzw. 34,5 Pixel bei 100 %.

Der Abschluss war in diesem Lauf nicht zuverlässig durch ein einziges Enter reproduzierbar: beim geraden Pfad legte das erste Enter noch keinen `paths`-Eintrag an, das zweite schon ([`06-horizontal-save.png`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/native-run1/evidence/06-horizontal-save.png), [`07-horizontal-second-enter.png`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/native-run1/evidence/07-horizontal-second-enter.png)). Beim diagonalen Pfad erzeugten auch weitere Enter-Tasten keinen Eintrag; ein Doppelklick am Endpunkt schloss ihn ab ([`09-diagonal-finish.png`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/native-run1/evidence/09-diagonal-finish.png), [`11-diagonal-doubleclick.png`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/native-run1/evidence/11-diagonal-doubleclick.png)). Der Knick wurde mit Startklick, Eckklick und Doppelklick am Endpunkt abgeschlossen. Die Ursache der unterschiedlichen Enter-Reaktion ist offen; daraus folgt keine allgemeine Regel für alle Pfadmodi.

## Texturmaße, Wiederholung und Grenzen

Das aus dem installierten PCK extrahierte [`battlements.webp`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/battlements.webp) hat **1024 × 69 Pixel** (SHA-256 `6f51ee6c15c88466ed1691793fdd4416941f865bcb21766cf3f4cccab783bcaa`). Die gespeicherte Breite bei UI Width 1 ist somit genau die Quellhöhe. **Bei proportionaler Skalierung** wäre die volle 1024-Pixel-Textur bei Width 1 nach 4 Feldern, bei Width 2 nach 8 Feldern wiederholt: `repeatLength = 1024 / 69 × gespeicherteBreite / 256`. Die sichtbare Motivgröße bei Width 2 ist entsprechend ungefähr doppelt so groß wie bei Width 1; ein fest auf Bildschirmgröße skaliertes Bild passt nicht zu den Aufnahmen.

Die beiden Hälften des Quellbilds sind selbst nahezu gleich (rund 85,5 % identische RGBA-Pixel). Der Bildvergleich der geraden Strecke zeigt starke periodische Ähnlichkeit bereits nach ungefähr 2 Feldern bei Width 1. Damit lässt sich **der exakte UV-Umschlag nach 4 statt 2 Feldern aus diesen Screenshots allein nicht eindeutig beweisen**. Für die Modellabbildung ist eine isotrope Wiederholung nach Quellbreite die naheliegende, aber noch hostseitig zu paarende Regel. Ein eigenständiger Anfangs-/Endkappen-Effekt ist hier nicht belegt; das sichtbare Motiv endet am gezeichneten Endpunkt. Knickkrümmung ist bei `Smoothness 1` beobachtet, ihr mathematischer Radius ist offen.

## Speichern und frisches Öffnen

Eine neue, isolierte Dungeondraft-Instanz öffnete die gespeicherte Karte ohne vorherige Sitzung. [`02-fresh-open-ready.png`](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd021-band-native/native-reopen/evidence/02-fresh-open-ready.png) zeigt alle drei Pfade mit der gespeicherten Geometrie und Textur. Die zum zweiten Lauf kopierte Karte behielt die SHA-256 `1f6bcaeeb9bb8720244495de9dacf6544ed2666b978fdbab13328a7fdca41900`.

**Fallgrenze:** Dies ist ein direkter Originalbeleg für Battlements-Platzierung, Breite, tangentialen Verlauf sowie Speichern/Frischstart (DD-021.15/.21). Die Gleichwertigkeit des Obsidian-Renderers braucht die Paarung derselben drei Geometrien im isolierten Host. Weitere Pfadtexturen, Optionen und Motivvollständigkeit sind hier nicht geprüft.
