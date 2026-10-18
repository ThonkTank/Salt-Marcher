# Code verständlicher machen

Lade betroffenen Ablauf, direkte Aufrufer/Verbraucher, Typen und relevante Tests.
Fachquellen oder Historie nur nachziehen, wenn Bedeutung/Grund sonst unklar
bleiben. Den zusammenhängenden Ablauf vor seiner Umstrukturierung verstehen.

Bedeutung, Einheiten, Identität, Lebenszyklus und Verantwortung durch Namen,
Typen und sichtbaren Kontrollfluss erklären. Zusammengehörige Entscheidungen
bündeln, unnötige Umleitungen entfernen. Nur extrahieren, wenn dadurch der
Aufrufer verständlicher wird; viele kleine Helfer können das Gegenteil bewirken.
Verdichteten Code entpacken, keine globale Stilvereinheitlichung beginnen.

Kommentare erhalten nicht offensichtliche Gründe und Invarianten. Neue Namen
ersetzen solche Gründe nicht automatisch. Tests verdeutlichen wichtige Fälle,
ersetzen aber keinen verständlichen Produktionscode. Bestehende Absicherung
nutzen, echte Lücken gezielt schließen; keine Tests für private Namen/Formatierung.

Reihenfolge von Validierung/Mutation, Transaktionen, Fehlerausbreitung,
Callback-/Aktivierungswechsel, Recovery, Serialisierung und exakte Nutzertexte
erhalten. Produktfehler nicht beiläufig mit einem Lesbarkeitsumbau vermischen.
Mechanische Formatierung von strukturellen Änderungen unterscheidbar halten.

Fertig: derselbe Entwicklungsweg zeigt Besitzer, Datenfluss, Bedingungen und
Fehler verständlicher; Verhalten/Begleitänderungen geprüft und veröffentlicht.
Kürzere Funktionen und Testgrün allein genügen nicht.
