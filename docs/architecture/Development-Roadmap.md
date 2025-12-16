# Development Roadmap

Implementierungsstrategie und aktueller Status für Salt Marcher.

---

## Phase-Übersicht

| # | Phase | Status | Scope |
|---|-------|--------|-------|
| 1 | Core | ✅ | Result, EventBus, Schemas, Hex-Math (128 Tests) |
| 2 | Travel-Minimal | 🟡 | Party-Bewegung auf Hex-Map mit Persistenz |

---

## Aktueller Fokus: Phase 2 - Travel-Minimal

**User Story:**
> Als GM kann ich eine Party auf einer Hex-Map platzieren und per Klick auf ein Nachbar-Hex bewegen. Die Bewegung verbraucht Zeit basierend auf Terrain. Die Position bleibt nach Plugin-Reload erhalten.

### Implementiert ✅

| Komponente | Code | Status |
|------------|------|--------|
| Hex-Math | `src/core/utils/hex-math.ts` | ✅ 45 Tests |
| Schemas | `src/core/schemas/{map,party,terrain,settings}.ts` | ✅ |
| Map Feature | `src/features/map/` | ✅ |
| Party Feature | `src/features/party/` | ✅ |
| Travel Feature | `src/features/travel/` | ✅ Nur Nachbar-Bewegung |
| Settings Service | `src/infrastructure/settings/` | ✅ Mit Settings-Tab |
| Vault I/O | `src/infrastructure/vault/shared.ts` | ✅ JSON R/W mit Zod |
| Vault Map Adapter | `src/infrastructure/vault/vault-map-adapter.ts` | ✅ |
| Vault Party Adapter | `src/infrastructure/vault/vault-party-adapter.ts` | ✅ |
| SessionRunner | `src/application/session-runner/` | ✅ Canvas + minimal UI |
| Entry Point | `src/main.ts` | ✅ Vault-Adapter integriert |

### Offene Lücken ⚠️

| Lücke | Problem | Lösung |
|-------|---------|--------|
| **Position nicht persistiert** | `saveParty()` wird nie aufgerufen | Nach Bewegung speichern + onunload |
| **Keine Bootstrap-Daten** | Vault-Adapter laden leeren Vault | Fixtures oder Create-UI |
| **Error-Handling UI** | Load-Fehler nur in Console | User-Notification bei Fehler |
| **Zeit-Feature fehlt** | User Story: "Zeit verbraucht" | Time-Feature (Phase 3) |

### Nächste Schritte

1. **Position persistieren** - `saveParty()` nach `moveToNeighbor()` aufrufen
2. **Bootstrap-Lösung** - Entweder:
   - Fixtures in Vault schreiben wenn leer (einfach)
   - Create-UI für Maps/Parties (aufwendig)
3. **Error-Notification** - Bei Load-Fehler User informieren

### MVP-Einschränkungen (bewusst)

- Direkte Aufrufe statt EventBus
- Keine Animation, nur Nachbar-Hex
- Kein File-Watcher (Reload bei Plugin-Neustart)

---

## Vault-Struktur

```
Vault/
└── SaltMarcher/              # Konfigurierbar in Settings
    ├── maps/
    │   └── {mapId}.json      # OverworldMap
    └── parties/
        └── {partyId}.json    # Party
```

---

## Test-Strategie

| Komponente | Stabilität | Test-Ansatz |
|------------|------------|-------------|
| Core | Hoch | ✅ 128 Unit-Tests |
| Features (Iteration) | Niedrig | Manuelles Testen |
| Features (Fertig) | Hoch | Automatisierte Tests nachziehen |

**Kriterium "Test-Ready":** User gibt Freigabe ("Feature ist fertig")

---

## Schema-Definitionen

| Ort | Inhalt |
|-----|--------|
| `docs/architecture/EntityRegistry.md` | Entity-Interfaces |
| `docs/architecture/Core.md` | Basis-Types (Result, Option, EntityId) |
| Feature-Docs | Feature-spezifische Typen |

Bei fehlenden oder unklaren Schemas: User fragen.

---

## Verwandte Dokumentation

| Thema | Dokument |
|-------|----------|
| Core-Types | [Core.md](Core.md) |
| Events | [Events-Catalog.md](Events-Catalog.md) |
| Layer-Struktur | [Project-Structure.md](Project-Structure.md) |
| Error-Handling | [Error-Handling.md](Error-Handling.md) |
| Conventions | [Conventions.md](Conventions.md) |
| Testing | [Testing.md](Testing.md) |
