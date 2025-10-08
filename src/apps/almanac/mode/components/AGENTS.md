# Ziele
- Stellt die Almanac-Workmode-Komponenten für Calendar-View und Content-Tabs bereit.
- Kapselt generische UI-Brücken (`ui/workmode`) und verbindet sie mit den Almanac-Verträgen.
- Hält Container leichtgewichtige, damit spezialisierte Presenter/Renderer angedockt werden können.

# Aktueller Stand
- Kalender- und Content-Container erzeugen Layout, Tabs und Placeholder-Renderings.
- Navigation greift auf die neue `ui/workmode`-Tab-Navigation zu, Presets und Events sind Mock-Daten.
- TODO-Blöcke markieren fehlende Detailrenderings für Monats-, Wochen- und Tagesansichten.

# ToDo
- [P1] Monat-/Woche-/Tag-Renderings implementieren und Tests in `tests/apps/almanac` ergänzen.
- [P2] Events-/Manager-Child-Komponenten nachziehen und Verträge aus `contracts.ts` verlinken.
- [P3] UX-Spezifikation updaten, sobald echte Renderer vorhanden sind.

# Standards
- Keine Logik der Datenbeschaffung im Container; delegiere an Presenter/Renderer.
- Änderungen an Tab-Struktur oder Layout werden in `mode/COMPONENTS.md` und `styles.css` dokumentiert.
- Entferne Placeholder-/TODO-Kommentare, sobald Implementierungen stehen und `sync:todos` gelaufen ist.
