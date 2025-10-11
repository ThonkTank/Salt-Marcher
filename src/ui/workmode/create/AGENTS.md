# Ziele
- Stellt die Library-Style Create-Dialog Infrastruktur für alle Workmode-Apps bereit.
- Hält Abschnitts-Navigation, Karten-/Grid-Layouts und Form-Controls konsistent über Tabs hinweg.
- Dokumentiert die gemeinsam genutzten Komponenten, damit Atlas, Almanac und Library sie direkt verwenden können.

# Aktueller Stand
- `base-modal.ts` kapselt Navigation, Validierung und Lebenszyklus für Create-Dialoge.
- `layouts.ts` liefert Karten- und Grid-Builder mit den `sm-cc-*` Klassen der Library.
- `form-controls.ts` bündelt Such-Selects, Text-/Zahlenfelder und Checkboxen.
- `token-editor.ts` verwaltet Chips-basierte Token-Listen.

# Offene Lücken vor dem produktiven Einsatz in allen Apps
- **Serializer/Save-Vertrag:** Es fehlt noch eine gemeinsame Schnittstelle, über die Tabs ihre spezifischen Datei-Builder, Validierer und Defaultwerte einspeisen können, damit `BaseCreateModal` ohne Library-spezifische Hilfsfunktionen speichern kann.
- **Irreguläre/Same-Grids:** Creature-spezifische Sektionen erzeugen komplexe Grids manuell. Die dafür nötigen Helper müssen in `layouts.ts` abstrahiert werden, damit andere Tabs sie deklarativ nutzen können.
- **Wrap-Kacheln & Eintrag-Toolbar:** Die Komponenten `sm-cc-entry-card`, Kollaps-Header und farbcodierte Toolbars leben weiterhin im Library-Namespace; ohne deren Extraktion lassen sich wiederholte Kartenlisten nicht außerhalb der Library darstellen.
- **Add-Element-Mechanik:** Buttons und Menü-Logik zum Hinzufügen/Entfernen dynamischer Einträge existieren nur in Creature-spezifischen Helpers. Für wiederverwendbare Dialoge muss die Steuerung mitsamt Filterchips, Shortcut-Handling und Überschriften extrahiert werden.
- **Cross-App-Bindung:** Es existiert noch keine Referenz-Implementierung, die zeigt, wie Atlas/Almanac ihre Datenstrukturen an das gemeinsame Modal binden. Eine Demo erleichtert Konsumenten die Migration und dient als Regressionstest für Styles.

# ToDo
- [P2] Definition eines app-agnostischen Entry-/Save-Pipelines-Contracts, damit Tabs ihre Serializer & Validierungslogik einspeisen können.
- [P2] Zusätzliche Grid-Helfer für irreguläre und wiederholte Layouts ergänzen.
- [P2] Entry-Card-/Wrap-Kachel-Utilities in diesen Namespace heben.
- [P2] Allgemeine Add-Element-Steuerung samt Toolbar/Filter abstrahieren.
- [P3] Workmode-übergreifende Demo-/Story-Implementierung erstellen, die Library-, Atlas- und Almanac-Tab an das gemeinsame Modal anbindet.

# Standards
- Alle Utilities werden über `index.ts` re-exportiert.
- Öffentliche APIs tragen Header-Kommentare (Dateipfad + Zweck) und JSDoc für Parameter und Rückgaben.
- Anpassungen an Styles behalten die bestehenden `sm-cc-*` Klassennamen unverändert bei.
