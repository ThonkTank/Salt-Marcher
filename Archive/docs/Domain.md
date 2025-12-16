# Domain Layer

Isolierte, datenorientierte Geschäftslogik. Kein Workflow-State.

**Pfad:** `src/domains/`

---

## Verzeichnis-Struktur

```
src/domains/<name>/
├── ports.ts      # ServicePort (inbound) + StoragePort (outbound)
├── service.ts    # createXxxService() Factory
├── types.ts      # Domain-spezifische Types (optional)
└── index.ts      # Public API
```

---

## Hexagonal Architecture (Ports)

| Komponente | Datei | Verantwortung |
|------------|-------|---------------|
| **Inbound Port** | `ports.ts` | Interface das die Domain anbietet |
| **Outbound Port** | `ports.ts` | Interface das die Domain benötigt |
| **Service** | `service.ts` | Geschäftslogik, implementiert Inbound Port |

### Datenfluss

```
Aufrufer → ServicePort → Service → StoragePort → [Infrastructure Adapter]
```

### Beispiel

```typescript
// ports.ts
interface GeographyServicePort {
  getMap(id: MapId): Result<Map, AppError>;
  findPath(mapId: MapId, from: Coord, to: Coord): Result<Path, AppError>;
}

interface MapStoragePort {
  load(id: MapId): Promise<Result<MapData, AppError>>;
  save(id: MapId, data: MapData): Promise<Result<void, AppError>>;
}

// service.ts
export function createGeographyService(
  storage: MapStoragePort
): GeographyServicePort {
  return {
    getMap(id) { /* ... */ },
    findPath(mapId, from, to) { /* ... */ },
  };
}
```

---

## Domain-Regeln

### Erlaubt

- Pure Geschäftslogik
- Queries und Commands über ServicePort
- Verwendung von StoragePort für Persistenz
- `Result<T, AppError>` Return Types
- Import aus `@core/`

### Verboten

- Import aus `infrastructure/`, `application/`, `orchestration/`
- Implementierung von Adaptern (gehören in Infrastructure)
- Event-Subscriptions
- State-Machines
- Workflow-State

### Kommunikation

Domains haben **keine** Event-Kommunikation:
- Keine EventBus-Subscriptions
- Keine Event-Publikation
- Rein synchrone Port-Calls

---

## Testing

### Pattern: Unit-Tests mit Mock-Storage

```typescript
describe('GeographyService', () => {
  it('should find path between coordinates', () => {
    // Arrange: Mock Storage
    const storage = createMockStorage(testMapData);
    const service = createGeographyService(storage);

    // Act
    const result = service.findPath(mapId, from, to);

    // Assert
    expect(isOk(result)).toBe(true);
    expect(unwrap(result).length).toBe(5);
  });

  it('should return error for invalid map', () => {
    const storage = createMockStorage({}); // Keine Maps
    const service = createGeographyService(storage);

    const result = service.getMap(unknownId);

    expect(isOk(result)).toBe(false);
    expect(unwrap(result).code).toBe('MAP_NOT_FOUND');
  });
});
```

### Test-Utilities

- `createMockStorage(data)` - Mock StoragePort mit vordefinierten Daten
- Fixtures in `devkit/testing/fixtures/`

---

## Checkliste: Neue Domain

- [ ] `ports.ts`: ServicePort + StoragePort Interfaces definieren
- [ ] `service.ts`: `createXxxService(storage: StoragePort)` Factory
- [ ] `index.ts`: Ports und Service-Factory exportieren
- [ ] Return Types: `Result<T, AppError>` für fehlbare Operationen
- [ ] Keine Adapter im Domain-Ordner
- [ ] Keine Event-Subscriptions
- [ ] Keine State-Machines
- [ ] Unit-Tests mit Mock-Storage

---

*Zurück zur [Übersicht](DevGuide.md)*
