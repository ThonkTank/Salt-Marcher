# Ziele
- Bündelt wiederverwendbare Workmode-Bausteine (Tabs, Split-View, Renderer, Watcher) für alle Apps.
- Entkoppelt UI-Gerüste vom Almanac-spezifischen Code und erleichtert künftige Mode-Implementierungen.
- Dokumentiert Erwartungen an Styling und Lifecycle-Hooks für Konsumenten.

# Aktueller Stand
- Tab-Navigation, Split-View-Container und Mode-Renderer-Basis sind implementiert.
- Watcher-Hub koordiniert Dateisystem-Watcher zwischen mehreren Abnehmern.
- Stylesheet liefert Grundlayout für Tabs/Split-View plus erste Almanac-Anpassungen.

# ToDo
- [P1] Icon-Handling (`setIcon`) integrieren, damit Obsidian-Icons statt Fallback-HTML genutzt werden.
- [P2] Accessibility-Checks für Keyboard-Navigation und ARIA-Attribute automatisieren.
- [P3] Weitere Workmode-spezifische Styles auslagern, sobald zusätzliche Apps sie nutzen.

# Standards
- Neue Utilitys immer über `index.ts` exportieren und mit Unit- oder DOM-Tests absichern.
- Anpassungen an Layout oder Interaktion zeitgleich in `src/apps/*/mode/COMPONENTS.md` dokumentieren.
- Nach Ergänzungen von TODO-Kommentaren `npm run sync:todos` ausführen, bevor die Änderung abgeschlossen wird.
