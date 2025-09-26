# Encounter workspace review

## Problem Statement
Travel-triggered Encounter-Events landen in einer Obsidian-View, die nur statisches Placeholder-Markup rendert. Es existiert weder Datenanbindung noch UX, obwohl das Nutzer-Wiki die View als zentrale Steuerfläche beschreibt.

## Betroffene Module
- `salt-marcher/src/apps/encounter/view.ts` – minimaler `ItemView` ohne State oder Hooks.
- `salt-marcher/src/apps/cartographer/modes/travel-guide/encounter-gateway.ts` – öffnet Encounter-Leaf, kann derzeit keine Fehler abfedern oder Statusmeldungen austauschen.
- `salt-marcher/src/app/main.ts` – registriert die Encounter-View, stellt aber keine zusätzlichen Services oder Stores bereit.
- Dokumentation: [`docs/encounter/README.md`](../salt-marcher/docs/encounter/README.md), [Notes/encounter-workspace-review.md](../Notes/encounter-workspace-review.md), [wiki/Encounter.md](../wiki/Encounter.md).

## Beobachtungen & Gaps
1. **Lifecycle & Persistenz** – `EncounterView` implementiert ausschließlich `onOpen`/`onClose`. Es fehlen `getViewData`/`setViewState`, Menü-Hooks und Events für Travel-Rückmeldungen. Damit gehen Encounter-Kontexte nach einem Workspace-Restore verloren.
2. **UI/UX** – Keine Inhalte außer Überschrift + leerem `div.desc`. Erwartete Komponenten (Encounter-Zusammenfassung, Aktionen) existieren nicht; CSS-Hooks bleiben ungenutzt.
3. **State-Management** – Kein Store oder Service, der Encounter-Daten verwaltet. Travel-Gateway kann keine Daten übergeben oder Fehler anzeigen.
4. **Testbarkeit** – Mangels Presenter/Controller gibt es keinen Test-Harness. Jede Erweiterung müsste DOM-Tests oder Integrationstests über Obsidian hinaus aufsetzen.

## Offene Fragen & Investigations
- **Datenfluss definieren:** Welche Quelle liefert Encounter-Details (Regions-Store, Library, dedizierte Encounter-Dateien)?
- **Controller entwerfen:** Wird ein Presenter benötigt, der Travel-Events entgegennimmt, UI-State verwaltet und Aktionen (z. B. "Encounter abgeschlossen") an Travel zurückmeldet?
- **UX-Roadmap klären:** Welche Minimalfunktionen (z. B. Gegnerliste, XP-Berechnung, Notiz-Templates) sollen zuerst entstehen, und wie greifen sie auf bestehende Module zu?
- **Persistenzstrategie:** Wie werden Encounter-Zustände gespeichert, damit Obsidian-Restarts oder View-Schließungen keine Daten verlieren?
- **Styling & Komponenten:** Müssen gemeinsame UI-Bausteine aus `docs/ui/` genutzt oder erweitert werden, um Encounter-spezifische Layouts konsistent zu halten?

## Nächste Schritte
1. Workshop mit Produkt- und UX-Verantwortlichen, um Mindestumfang für Encounter-UI festzulegen (Mockups, Akzeptanzkriterien).
2. Architektur-RFC zur Definition eines Encounter-Presenters inkl. Lifecycle, Services und Persistenzmodell.
3. Prototyp implementieren, der Travel-Event-Daten annimmt, Basisinformationen rendert und einen Abschluss-Button bereitstellt.
4. Testsuite erweitern (Unit + Integration), um Encounter-Hand-off, View-Restore und Travel-Rückgabe abzudecken.
5. Dokumentation aktualisieren (README, Wiki), sobald Architekturentscheidungen gefallen sind.
