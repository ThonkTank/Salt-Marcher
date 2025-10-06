# Ziele
- Liefert Kernservices zum Laden und Persistieren von Bibliotheksdaten.

# Aktueller Stand
- `creature-files` verarbeitet Kreaturendateien aus dem Vault.
- `spell-files` verwaltet Zauber- und Ritualsammlungen.
- `file-pipeline` stellt eine gemeinsame Datei-Pipeline für Vault-Verzeichnisse bereit.
- `sources` fasst die Kategorie-Setups zusammen und bietet Ensure-/Beschreibungshilfen.

# ToDo
- keine offenen ToDos.

# Validierungsregeln
- Creatures: Frontmatter mit `smType: creature`, `name` sowie optionale Listenfelder (`speed`, `skills`, Immunitäten) als Arrays; strukturierte Aktionen müssen als `entries_structured_json` mit gültigem JSON vorliegen.
- Spells: Frontmatter mit `smType: spell`, `name`, numerischem `level` und boolean Flags (`concentration`, `ritual`) im YAML-Standard; Komponentenlisten erscheinen als Strings innerhalb eines Arrays.
- Alle Dateien nutzen Markdown-Inhalt nur nach dem Frontmatter-Block; zusätzliche Metadaten gehören in die YAML-Sektion.

# Standards
- Services beschreiben ihre Datenquellen und Cache-Strategien im Kopf.
- Exportierte Funktionen bleiben Utilitys ohne globale Seiteneffekte.
