# Encounter Workspace Documentation

## Überblick
Dieser Ordner bündelt technische Notizen zum Encounter-Workspace. Aktuell existiert nur ein minimaler View, der vom Travel-Modus geöffnet wird. Die Dokumente richten sich an Entwickler:innen, die die Gateway-Logik bewerten oder den Workspace weiter ausbauen möchten.

## Struktur
```
docs/encounter/
├─ README.md
└─ overview.md
```

## Inhalte
- [overview.md](overview.md) – Analyse der Gateway-Funktion `openEncounter`, der registrierten Obsidian-Views sowie der bestehenden Lücken.

## Standards & Pflege
- Dokumentiere alle Erweiterungen der Encounter-APIs (View-Registrierung, Datenübergaben, UI-Hooks) in diesem Ordner.
- Halte Querverweise zum Travel-Mode aktuell, sobald sich Trigger oder Schnittstellen ändern.
- Offene Arbeiten werden im To-Do [`../todo/encounter-workspace-roadmap.md`](../../todo/encounter-workspace-roadmap.md) gepflegt und aus den Encounter-Dokumenten verlinkt.
