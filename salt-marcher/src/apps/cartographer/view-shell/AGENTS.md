# Ziele
- Stellt die Shell-Komponenten bereit, die Modi und Karte miteinander verbinden.

# Aktueller Stand
- `layout` erzeugt das Grundgerüst und Slot-Container.
- `map-surface` koordiniert Hex-Rendering und Event-Bubbling.
- `mode-controller` wechselt zwischen registrierten Modi.
- `mode-registry` verbindet Shell und `mode-registry`-Modul.

# ToDo
- Responsive Layoutvarianten dokumentieren und implementieren.
- Shell-Hooks für Kollaborationszustände vorbereiten.

# Standards
- Shell-Komponenten erklären ihre Slots und Lebenszyklen im Kopf.
- Controller-Dateien exportieren `create<Name>`-Factories und vermeiden globale Zustände.
