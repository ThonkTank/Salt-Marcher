# Cartographer mode registry

## Original Finding
> Die Modi werden im Presenter über `provideModes` fest verdrahtet (`createTravelGuideMode`, `createEditorMode`, `createInspectorMode`). Erweiterungen oder Konfigurationen erfordern weiterhin Codeänderungen statt deklarativer Registrierung.
>
> **Empfohlene Maßnahme:** Eine deklarative Registry/API für `provideModes` einführen, damit zusätzliche Modi ohne Core-Änderung ladbar sind.

Quelle: [`architecture-critique.md`](../architecture-critique.md).

## Kontext
- **Betroffene Module:** `salt-marcher/src/apps/cartographer/presenter.ts`, Mode-Fabriken unter `salt-marcher/src/apps/cartographer/modes/`.
- **Auswirkung:** Neue Modi oder Varianten benötigen invasive Änderungen am Presenter und riskieren Merge-Konflikte.
- **Risiko:** Fehlende Erweiterbarkeit blockiert Experimentier-Features und erschwert das Aktivieren/Deaktivieren einzelner Modi.

## Aktuelle Architekturbeobachtung
- `CartographerPresenter` erstellt die Modusliste einmalig im Konstruktor über `deps.provideModes()`; spätere Änderungen oder Kontextabhängigkeiten (z. B. Feature-Flags, Vault-Settings) können aktuell nicht berücksichtigt werden.
- `provideModes()` liefert konkrete Instanzen aus den Fabriken `createTravelGuideMode`, `createEditorMode`, `createInspectorMode`. Die Fabriken besitzen jeweils implizite Nebenwirkungen (z. B. DOM-Aufbau, Event-Handler, Zugriff auf globale Services), was den Presenter eng mit konkreten Implementierungen koppelt.
- Die Mode-Fabriken haben heterogene Abhängigkeiten:
  - **Travel Guide:** orchestriert `TravelPlaybackController`, `TravelInteractionController`, mehrere UI-Layer und den Terrain-Store; benötigt Map-Layer-Zugriff und App-Events.
  - **Editor:** hängt von Tool-Modulen (`ToolModule`, `ToolContext`) ab und initialisiert UI-Controls zur Werkzeugwahl.
  - **Inspector:** lädt/speichert Tile-Daten über `loadTile`/`saveTile` und arbeitet mit Terrain-Konstanten; nutzt verzögertes Speichern und UI-State.
- Die Fabriken exportieren `CartographerMode`-Objekte ohne gemeinsame Metadata-Struktur (Capabilities, Ressourcen-Bedarf, Lifecycle-Hooks), wodurch eine künftige Registry erst definiert werden muss.

## Offene Architekturfragen & Designoptionen
1. **Registrierungsmechanismus:**
   - _Option A:_ Statische Compile-Time-Liste (z. B. zentraler `modes/index.ts`), die ein deklaratives Array exportiert. Vorteil: einfache Kontrolle, Nachteil: weiterhin Rebuild nötig.
   - _Option B:_ Dependency-Injection/Service-Locator, bei dem Mode-Provider über `app`-Events oder Plugin-APIs registriert werden. Muss klären, wie Lebenszyklen verwaltet und Duplikate verhindert werden.
   - _Option C:_ Konfigurationsgetriebene Registrierung (JSON/YAML/Frontmatter). Erfordert Definition eines Serialisierungsformats und Sicherheitsbewertung (Trust-Boundary für Skripte/Module).
2. **Initialisierung & Lazy Loading:** Müssen Mode-Implementierungen synchron bereitstehen, oder kann die Registry async Provider liefern (z. B. dynamisches `import()`)? Presenter-Änderungen nötig, um Ladefortschritt und Fehlerbehandlung zu kapseln.
3. **Capabilities-Modell:** Braucht jede Mode-Definition deklarative Angaben (z. B. `requiresMapLayer`, `supportsHexClick`, `requiresSidebar`), damit Shell & Presenter UI/Hooks steuern können? Klärung notwendig, um generische Tests/Validierungen zu ermöglichen.
4. **Konfigurierbarkeit & Namespaces:** Wie werden Drittanbieter-Modi eindeutig identifiziert (Namensschema, Versionsangabe)? Brauchen wir Namespaces oder Prioritäten, falls mehrere Provider denselben Mode ersetzen?
5. **Lifecycle & Cleanup:** Aktuell übernehmen Modi selbst das Aufräumen. Registry sollte definieren, welche Ressourcen (Subscriptions, Styles, Worker) deklariert werden und wie Presenter bei Reload/Reloads damit umgeht.
6. **Testbarkeit:** Wie lassen sich Registry + Presenter automatisiert testen (z. B. Mock-Provider, Contract-Tests für Mode-Hooks)? Welche Schnittstellen müssen stabilisiert werden?

## Lösungsansätze (zu verfeinern)
1. Extrahiere eine Registry-Schnittstelle (`ModeDefinition[]` + Resolver), die Presenter und Modes über Abhängigkeiten verbindet.
2. Erlaube deklarative Konfiguration (z. B. JSON/Frontmatter oder Plugin-Settings), welche Modi geladen werden und mit welchen Capabilities.
3. Dokumentiere das Registrierungsprotokoll im Cartographer-Docs-Ordner und ergänze Tests, die dynamische Mode-Lieferanten validieren.

## Arbeitsplan & Deliverables
1. **Analysephase**
   - Aufgaben: Stakeholder-Interviews (Cartographer-Produktowner, Add-on-Teams), Bewertung bestehender Mode-Abhängigkeiten, Identifikation notwendiger Capabilities.
   - Deliverables: Entscheidungslog (ADR) mit Problemstatement, Anforderungen & Constraints; Mapping der aktuellen Mode-Abhängigkeiten.
   - Entscheidungskriterien: Vollständigkeit der Abhängigkeitsanalyse, abgestimmte Anforderungen an Erweiterbarkeit.
2. **Konzept & PoC**
   - Aufgaben: Designentwurf für Registry-API (Interface-Definition, Lifecycle, Capabilities), PoC mit minimaler Registry + Migration eines Modus (z. B. Inspector) zur neuen Struktur, Evaluate Lazy-Loading-Option.
   - Deliverables: RFC/Design-Dokument, PoC-Branch mit automatisierten Tests (Contract-Test für Registry, Presenter-Integrationstest).
   - Entscheidungskriterien: PoC erfüllt definierte Anforderungen (dynamische Registrierbarkeit, Fehlerbehandlung), Tests decken Kernpfade ab, Review-Greenlight der Architektur-Owners.
3. **Implementierungsvorbereitung**
   - Aufgaben: Backlog-Schnitt (Tickets für Migration weiterer Modi, Dokumentation, API-Stabilisierung), Abstimmung mit Docs-Team für Registry-Anleitung, Definition von Migrationsleitfäden für Drittanbieter.
   - Deliverables: Groomtes Epics/Stories, aktualisierte To-Do-Referenzen, abgestimmter Dokumentationsplan.
   - Entscheidungskriterien: Abnahmekriterien pro Ticket klar, Auswirkungen auf bestehende Nutzer dokumentiert, Rollout-Plan genehmigt.
4. **Rolloutplanung**
   - Aufgaben: Festlegen von Feature-Flags oder opt-in Mechanismen, Definition von Telemetrie/Success-Metriken (z. B. Anzahl externer Modi), Kommunikationsplan für Community.
   - Deliverables: Rollout-Playbook, Monitoring-Checkliste, Kommunikationspaket (Changelog, Migration Guide).
   - Entscheidungskriterien: Risikobewertung abgeschlossen, Stakeholder sign-off, klarer Backout-Plan.

## Referenzen
- Presenter `provideModes`: [`salt-marcher/src/apps/cartographer/presenter.ts`](../salt-marcher/src/apps/cartographer/presenter.ts)
- Mode-Fabriken: [`salt-marcher/src/apps/cartographer/modes/`](../salt-marcher/src/apps/cartographer/modes/)
