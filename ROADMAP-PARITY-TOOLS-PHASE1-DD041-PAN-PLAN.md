# Phase 1, DD-041.02/.03: temporäres Pan erneut prüfen

Planlauf vom 09.10.2026 zu [Phase 1](ROADMAP-PARITY-TOOLS-PHASE1-PLAN.md). Leertaste+Links und Mitteltaste verschieben den Ausschnitt der gemeinsamen Karte; dieser Ablauf bleibt für den grenzenlosen Atlas relevant. Die [direkte Originalprobe](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd041-navigation/REPORT.md) misst beide Gesten bei 100 und 125 %. [Originale P1-Folgen](/home/aaron/.cache/dungeon-native-qa/audit-20261004/karten-verwaltung/DD-041-HAND-PAN.md) und der [ältere installierte Hostlauf](/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd041-p1-installed/REPORT.md) decken Auswahl, Polygonentwurf, Leertastenwechsel und Escape ab. Die Fälle bleiben auf dem aktuellen gemeinsamen Build offen.

## Prüffolge

1. In einem isolierten V4-Hostvault eine sichtbare Prüfmarke und einen gespeicherten Ausgangszustand anlegen. Bei 64 und 80 Pixel/Feld jeweils 96×64 Bildschirmpixel mit Leertaste+Links und Mitteltaste ziehen. Kameraänderung, Karten-/Notizinhalt, Dirty, History und Dateihash getrennt erfassen.
2. Auswahlverhalten und einen begonnenen Polygonentwurf für beide Gesten prüfen. Die direkt gemessenen P1-Zeitfolgen für Freigabe der Leertaste, späteres Drücken und Escape mit gehaltenem Pointer nachstellen. Synthetische Eingabe als Hostnachweis kennzeichnen.
3. Über UI speichern, Host regulär schließen und in frischem Prozess Karte, IDs und Bytehash vergleichen. Implementierungsbefunde und einen getrennten Review auf integriertem Build veröffentlichen; bei Abweichung eine gezielte Nachbesserung mit erneutem Review durchführen.

Canvasrand, Fokusverlust, Touchpad, physische Hardwareeingabe und andere Pan-Wege bleiben außerhalb dieser gepaarten Folge offen. `DD-041.04` besitzt einen eigenen gemessenen Teilreview. Die Phase 1 und Atlas-Zielshell bleiben offen.
