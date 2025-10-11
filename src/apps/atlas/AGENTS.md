# Ziele
- Fasst die ausgelagerten Bibliotheksansichten für Gelände und Regionen unter der neuen Atlas-App zusammen.
- Dokumentiert die benötigten Vault-Ressourcen (Terrain- und Regions-Dateien) und ihren Einsatz im Atlas-View.

# Aktueller Stand
- `view.ts` registriert den Atlas-ItemView inklusive Ribbon-/Command-Hooks über `apps/view-manifest.ts`.
- Der View nutzt Renderer aus `view/` für Terrains und Regionen und verwaltet Tabs, Suche und Erstellung inline.

# ToDo
- Noch offen: Persistenz-Validierungen und optionale Karten-Previews für Regionen.

# Standards
- Neue Renderer werden in `view/` dokumentiert und folgen der geteilten Workmode-Infrastruktur aus `ui/workmode`.
- Atlas-spezifische Texte verbleiben lokal in `view.ts`, damit Übersetzungen zentral gepflegt werden können.
