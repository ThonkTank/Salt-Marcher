# Ziele
- Stellt die Library-Style Create-Dialog Infrastruktur für alle Workmode-Apps bereit.
- Hält Abschnitts-Navigation, Karten-/Grid-Layouts und Form-Controls konsistent über Tabs hinweg.
- Dokumentiert die gemeinsam genutzten Komponenten, damit Atlas, Almanac und Library sie direkt verwenden können.

# Aktueller Stand
- `base-modal.ts` kapselt Navigation, Validierung und Lebenszyklus für Create-Dialoge.
- `layouts.ts` liefert Karten- und Grid-Builder mit den `sm-cc-*` Klassen der Library.
- `form-controls.ts` bündelt Such-Selects, Text-/Zahlenfelder und Checkboxen.
- `token-editor.ts` verwaltet Chips-basierte Token-Listen.

# ToDo
- [P3] Zusätzliche Grid-Helfer für irreguläre und wiederholte Layouts ergänzen.
- [P3] Entry-Card-/Wrap-Kachel-Utilities in diesen Namespace heben.

# Standards
- Alle Utilities werden über `index.ts` re-exportiert.
- Öffentliche APIs tragen Header-Kommentare (Dateipfad + Zweck) und JSDoc für Parameter und Rückgaben.
- Anpassungen an Styles behalten die bestehenden `sm-cc-*` Klassennamen unverändert bei.
