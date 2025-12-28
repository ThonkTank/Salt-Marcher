# Orchestration Layer

Die Orchestration-Schicht koordiniert Workflows waehrend einer aktiven Session. Der **SessionControl** ist der zentrale State-Owner und orchestriert alle In-Session-Aktivitaeten.

---

## Abgrenzung

| Layer | Verantwortlichkeit | State | Beispiele |
|-------|-------------------|-------|-----------|
| **Services** | Business-Logik als Pipelines | Stateless | EncounterService, WeatherService |
| **Orchestration** | Workflow-Koordination | Stateful | SessionControl, Workflows |
| **Views** | UI-Darstellung | Reactive (subscribed) | SessionRunner, DetailView |

**Services vs Orchestration:**
- Services empfangen Context, liefern Result - keine Entscheidungen
- Orchestration entscheidet WANN welcher Service aufgerufen wird
- Orchestration verwaltet den State zwischen Service-Aufrufen

---

## SessionControl

Der SessionControl ist der **Single Source of Truth** fuer alle In-Session-Daten:

- Party-Position und Transport
- Aktuelle Zeit und Wetter
- Aktive Workflows (Travel, Encounter, Combat, Rest)
- UI-State (nicht persistiert)

**Kernprinzip:** Views subscriben auf den State. Methoden-Aufrufe aendern den State. Keine Events zwischen SessionControl und Views.

---

## Workflows

Workflows sind State-Machines die den SessionControl-State veraendern:

| Workflow | State-Machine | Trigger |
|----------|--------------|---------|
| **Travel** | idle → planning → traveling ↔ paused → idle | GM plant Route |
| **Encounter** | idle → preview → active → resolving → idle | Encounter-Check waehrend Travel |
| **Combat** | idle → active → idle | GM startet Combat aus Encounter |
| **Rest** | idle → resting ↔ paused → idle | GM startet Short/Long Rest |

Workflows koennen sich gegenseitig unterbrechen:
- Travel → Encounter (automatisch bei Check)
- Encounter → Combat (GM-Entscheidung)
- Rest → Encounter (bei Encounter-Check waehrend Rest)

---

## Dokumentation

Detaillierte Spezifikationen unter `docs/orchestration/`:

| Dokument | Inhalt |
|----------|--------|
| [SessionControl.md](../orchestration/SessionControl.md) | State-Interface, Persistenz, API-Uebersicht |
| [TravelWorkflow.md](../orchestration/TravelWorkflow.md) | Reise-Orchestration, Speed, Encounter-Checks |
| [EncounterWorkflow.md](../orchestration/EncounterWorkflow.md) | Encounter-Generierung, Preview, Resolution |
| [CombatWorkflow.md](../orchestration/CombatWorkflow.md) | Combat-Start, Zug-Verwaltung, Ende |
| [RestWorkflow.md](../orchestration/RestWorkflow.md) | Short/Long Rest, Unterbrechung |

---

## Verwandte Dokumente

- [Services.md](Services.md) - Service-Pipeline-Pattern
