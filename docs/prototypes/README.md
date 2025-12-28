# Prototype-to-Production Workflow

> **Lies auch:** [Goals.md](../../Goals.md)
Dieses Dokument beschreibt den Entwicklungsflow von Schemas über CLI-Prototypen bis zur Production-Integration.

---

## Übersicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENTWICKLUNGS-PIPELINE                                 │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┤
│  Phase 1    │  Phase 2    │  Phase 3    │  Phase 4    │  Ziel               │
│  Schema     │  CLI-Proto  │  EventBus   │  Production │                     │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────────────┤
│  docs/entities/ │  prototype/ │  prototype/ │  src/   │  Obsidian Plugin    │
│  Schemas    │  Isoliert   │  Verbunden  │  Integriert │                     │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┘
```

---

## Phase 1: Schema-Phase

**Ort:** `docs/entities/`

### Ziel
Saubere, vollständige Schema-Definitionen ohne Implementierungs-Details.

### Anforderungen
- **Felder:** Alle Felder mit Typen und Beschreibungen
- **Quelle:** Woher kommen die Daten? (User-Input, Berechnung, Generierung)
- **Konsumenten:** Welche Features nutzen diese Daten?
- **Validierung:** Constraints und Invarianten

### Deliverables
- Ein Markdown-Dokument pro Schema
- TypeScript-Interface (in Docs, nicht in Code)
- Beispiel-Instanzen

### Reifegrad-Kriterien
| Kriterium | Beschreibung |
|-----------|--------------|
| Vollständig | Alle Felder dokumentiert |
| Konsistent | Keine Widersprüche zu anderen Schemas |
| Referenziert | Alle Konsumenten identifiziert |
| Beispiele | Mindestens 2 valide Beispiel-Instanzen |

---

## Phase 2: CLI-Prototype-Phase

**Ort:** `prototype/`

### Ziel
Isolierte Feature-Implementierung ohne Plugin-Abhängigkeiten.

### Anforderungen
- **CLI-Interface:** Alle Interaktionen über Kommandozeile
- **Fixture-Daten:** Hardcodierte oder JSON-basierte Testdaten
- **Keine Obsidian-API:** Kein Import von `obsidian`
- **Keine Cross-Feature-Deps:** Jedes Feature unabhängig testbar

### Struktur
```
prototype/
├── encounter/
│   ├── cli.ts           # CLI-Entry-Point
│   ├── generator.ts     # Feature-Logik
│   └── fixtures/        # Test-Daten
├── travel/
│   ├── cli.ts
│   └── ...
└── shared/              # Geteilte Utilities (minimal!)
    └── types.ts
```

### Reifegrad-Kriterien
| Kriterium | Beschreibung |
|-----------|--------------|
| Isoliert | Keine Abhängigkeiten zu anderen Features |
| CLI-Testbar | Alle Funktionen via CLI aufrufbar |
| Fixture-basiert | Läuft mit Fixture-Daten ohne Vault |
| Dokumentiert | README mit Nutzungsanleitung |

### Beispiel-Aufruf
```bash
npx tsx prototype/encounter/cli.ts generate --terrain forest --time dusk
```

---

## Phase 3: EventBus-Prototype-Phase

**Ort:** `prototype/` (erweitert)

### Ziel
Multi-Feature-Workflows über EventBus verbinden.

### Anforderungen
- **EventBus-Integration:** Features kommunizieren via Events
- **Workflow-Simulation:** Komplette Abläufe testbar
- **Keine UI:** Weiterhin CLI-only

### Beispiel-Workflow
```
Travel-Start → Weather-Update → Encounter-Check → Combat-Init
```

### Struktur-Erweiterung
```
prototype/
├── encounter/
├── travel/
├── weather/
├── eventbus/            # Shared EventBus-Instanz
│   ├── bus.ts
│   └── events.ts
└── workflows/           # Multi-Feature-Workflows
    ├── travel-encounter.ts
    └── ...
```

### Reifegrad-Kriterien
| Kriterium | Beschreibung |
|-----------|--------------|
| Event-basiert | Alle Cross-Feature-Kommunikation via Events |
| Workflow-Tests | Mindestens 1 kompletter Workflow getestet |
| Idempotent | Gleiche Events → Gleiche Ergebnisse |
| Logging | Event-Flow nachvollziehbar |

---

## Phase 4: Production-Phase

**Ort:** `src/`

### Ziel
Integration in das Obsidian-Plugin.

### Schritte
1. **Kopieren:** Prototype-Code nach `src/features/` kopieren
2. **Adapter:** Vault-Adapter statt Fixtures
3. **EventBus:** An Production-EventBus anschließen
4. **ViewModel:** UI-Integration via ViewModel
5. **Tests:** Unit-Tests für kritische Pfade

### Struktur
```
src/
├── features/
│   ├── encounter/
│   │   ├── index.ts
│   │   ├── generator.ts    # (von Prototype)
│   │   ├── adapter.ts      # Vault-Integration
│   │   └── events.ts
│   └── ...
└── application/
    └── viewmodels/
        └── encounter-vm.ts
```

### Reifegrad-Kriterien
| Kriterium | Beschreibung |
|-----------|--------------|
| Vault-integriert | Lädt/speichert Daten im Vault |
| Event-connected | Alle Events im Production-Bus registriert |
| Error-Handling | AppError-Pattern implementiert |
| UI-ready | ViewModel für UI-Binding vorhanden |

---

## Reifegrad-Matrix

| Phase | Schema | CLI | Events | Vault | UI |
|-------|:------:|:---:|:------:|:-----:|:--:|
| 1. Schema | ✓ | - | - | - | - |
| 2. CLI-Proto | ✓ | ✓ | - | - | - |
| 3. EventBus-Proto | ✓ | ✓ | ✓ | - | - |
| 4. Production | ✓ | - | ✓ | ✓ | ✓ |

---

## Wann ist ein Feature "Production-Ready"?

Ein Feature gilt als Production-Ready wenn:

1. **Schema vollständig** - Alle Datenstrukturen in `docs/entities/` dokumentiert
2. **CLI-Prototype funktional** - Isolierter Test erfolgreich
3. **EventBus-Integration** - Kommuniziert korrekt mit anderen Features
4. **Vault-Adapter** - Persistenz implementiert
5. **ViewModel** - UI-Binding vorbereitet
6. **Error-Handling** - Alle Fehlerfälle behandelt
7. **Dokumentation** - Feature-Doc in `docs/features/` aktuell

---

## Anti-Patterns

| Anti-Pattern | Warum problematisch | Lösung |
|--------------|---------------------|--------|
| Direkt in `src/` starten | Keine isolierte Entwicklung | Phase 2 durchlaufen |
| Obsidian-API in Prototype | Schwer testbar | Adapter-Pattern nutzen |
| Cross-Feature-Imports | Tight Coupling | EventBus nutzen |
| Schema im Code definieren | Keine Single Source of Truth | Erst in `docs/entities/` |
| UI vor Logik | Schwer refaktorbar | Bottom-Up entwickeln |

---

