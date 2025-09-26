# Encounter Workspace – Technische Standortbestimmung

## Ausgangspunkt & Artefakte
- **Codebasis:** `salt-marcher/src/apps/encounter/view.ts` implementiert `EncounterView` als Obsidian-`ItemView` mit minimalem DOM.
- **Erwartung:** Laut [Wiki](../wiki/Encounter.md) soll der Workspace Begegnungen aus dem Travel-Modus entgegennehmen, Kontextmaterial bündeln und nach Abschluss die Weiterreise ermöglichen.
- **Anbindung:** Cartographer ruft `openEncounter(app)` innerhalb von `travel-guide/encounter-gateway.ts` auf; das Gateway lädt lediglich das Encounter-Modul vor und öffnet ein Leaf, sobald `EncounterView` registriert ist.

## Beobachtetes Verhalten (Ist)
1. `EncounterView.onOpen` leert das Content-Element, setzt die CSS-Klasse `sm-encounter-view`, rendert eine `<h2>`-Überschrift und einen leeren `<div class="desc">` ohne Text oder Interaktionen.【F:salt-marcher/src/apps/encounter/view.ts†L12-L17】
2. `EncounterView.onClose` entfernt ausschließlich den gerenderten DOM und die CSS-Klasse; es existieren keine weiteren Aufräumarbeiten (Event-Listener, Stores, Controller).【F:salt-marcher/src/apps/encounter/view.ts†L19-L21】
3. Es gibt keinerlei Persistenz-Hooks (`getViewData`, `setViewData`, `serializeState`) oder Pane-Menü-Einträge, sodass die View im Obsidian-Lifecycle nicht rekonstruierbar ist und keine eigenen Kommandos bereitstellt.【F:salt-marcher/src/apps/encounter/view.ts†L6-L21】
4. In `src/app/css.ts` oder anderen Stylesheets existiert kein Styling für `sm-encounter-view`; der CSS-Hook bleibt wirkungslos, das Layout entspricht Obsidian-Defaults.

## Abgleich mit Soll-Erwartungen (aus Wiki & Architektur)
- **Kontextdarstellung:** Wiki erwartet, dass Encounter-Informationen (Gegnerlisten, Notizen, Hand-offs) sichtbar sind. Aktuell fehlt jegliche Datenbindung zu Library-, Regions- oder Travel-Stores; selbst Basisfelder (Titel, Beschreibung) werden nicht geladen.
- **Interaktionsfluss:** Travel pausiert Playback und ruft `openEncounter`. Die Encounter-View signalisiert jedoch nicht, wann ein Encounter beendet ist oder ob Informationen bestätigt wurden. Es gibt keinen Rückkanal zum Travel-Controller (z. B. via Events oder Services).
- **Session-Stabilität:** Ohne `setViewState` kann Obsidian die View beim Workspace-Restore nicht rekonstruieren. Ein Reload würde die Encounter-View ohne Inhalt wiederherstellen, wodurch laufende Encounter-Kontexte verloren gehen.
- **Lifecycle-Hooks:** Standardisierte Hooks wie `onPaneMenu`, `onResize`, `load`/`unload` werden nicht genutzt. Das erschwert Erweiterungen (z. B. eigene Menübefehle, responsive Layouts) und verhindert deterministisches Cleanup, sollte später State hinzukommen.
- **UX-Konsistenz:** Die View bietet keine Handlungsaufforderung (Buttons, Hinweise) und widerspricht dem Nutzer-Wiki, das die Encounter-View als zentrale Steuerfläche beschreibt. Selbst minimale UX-Elemente (Placeholder-Text, CTA zur Vorbereitung) fehlen.

## Risiken & Auswirkungen
- **Produktivbetrieb:** Encounter-Trigger landen auf einer leeren Seite; Spielleiter:innen verlieren Kontext und müssen auf externe Notizen ausweichen.
- **Architektur:** Ohne definierte Schnittstelle zwischen Encounter-View und Domain-Services kann keine weitere Funktionalität inkrementell ergänzt werden; jeder Schritt erfordert grundlegendes Refactoring.
- **Testing & Automation:** Es existiert kein Einstiegspunkt für Tests (keine separaten Controller oder Services). UI-Logik wäre aktuell nur über DOM-Snaphots testbar.

## Offene Fragen & Folgeaufgaben (siehe TODO)
1. Welche Datenquelle(n) sollen Encounter-Daten liefern (Regions, Library, externe YAML)?
2. Benötigt der Workspace einen Presenter/Controller analog zu Cartographer, um Travel-Callbacks sauber zu verarbeiten?
3. Welche UX-Grundbausteine gelten als Minimalversion (Encounter-Zusammenfassung, Aktionen, Buttons)?
4. Wie werden Encounter-Zustände persistiert, damit ein Obsidian-Restart keine laufenden Szenen zerstört?

Diese Punkte sind im Detail im To-Do [`todo/encounter-workspace-review.md`](../todo/encounter-workspace-review.md) zu verfolgen.
