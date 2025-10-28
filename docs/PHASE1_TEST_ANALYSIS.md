# Phase 1: Test-Suite Analyse
**Erstellt:** 2025-10-28
**Status:** 31 failures (nicht 14 wie ursprünglich gedacht)

## 📊 Übersicht

```
Test Files:  14 failed | 25 passed | 1 skipped (40)
Tests:       29 failed | 165 passed | 2 skipped (196)
```

## 🔍 Kategorisierung der Failures

### Kategorie 1: Obsidian API Mocks fehlen (BLOCKER)
**Anzahl:** 2 Test-Files
**Impact:** CRITICAL - Blockiert alle Modal/UI Tests

| Test File | Problem | Benötigte Mocks |
|-----------|---------|-----------------|
| `ui/create/base-modal.test.ts` | `Class extends value undefined` | Obsidian `Modal` class |
| `session-runner/view/encounter-gateway.test.ts` | Import resolution failure | Tile repository (behoben), aber läuft noch nicht |

**Lösung:**
- Vitest Setup erweitern mit Obsidian API Mocks
- `vi.mock('obsidian', ...)` mit stub implementations

---

### Kategorie 2: Integration Tests benötigen App-Mocks
**Anzahl:** 6 Tests in `main.integration.test.ts`
**Impact:** HIGH - Integration Tests testen kritischen Bootstrap-Pfad

| Test | Problem | Benötigte Mocks |
|------|---------|-----------------|
| ensures and primes the terrain palette | `spy not called` | `app.vault`, terrain loading |
| reports telemetry when terrain priming fails | promise doesn't reject | Error handling |
| reports telemetry when cartographer command fails | promise doesn't reject | Command registration |
| reports telemetry when cartographer leaves fail | promise doesn't reject | Leaf management |
| reports telemetry when terrain watching fails | promise doesn't reject | File watching |

**Lösung:**
- Mock `app.vault.read()`, `app.vault.create()`, `app.vault.modify()`
- Mock `app.workspace.registerObsidianProtocolHandler()`
- Mock file watching APIs

---

### Kategorie 3: Almanac Repository/State-Machine Tests
**Anzahl:** 7 Tests
**Impact:** MEDIUM - Almanac Feature

| Test File | Problem | Root Cause |
|-----------|---------|------------|
| `almanac-repository.test.ts` (2) | Persistence/filtering failures | Vault API mocks |
| `calendar-repository.test.ts` (1) | `expected undefined to be null` | State persistence |
| `state-machine.telemetry.test.ts` (4) | Telemetry not emitted | Event system |

**Lösung:**
- Mock vault read/write für Repository-Tests
- Mock telemetry sink für State-Machine Tests

---

### Kategorie 4: Cartographer Editor Tests
**Anzahl:** 8 Tests
**Impact:** MEDIUM - Cartographer Feature

| Test File | Problem | Root Cause |
|-----------|---------|------------|
| `editor-mode.test.ts` (3) | Panel UI, brush clicks, telemetry | DOM/Event mocks |
| `terrain-brush-apply.test.ts` (4) | Brush operations, rollback | Vault API, transaction logic |
| `terrain-brush-options.test.ts` (2) | Polygon handling, region tracking | Vault API, state updates |
| `inspector-mode.test.ts` (1) | `expect '' to be 'Wald'` | Terrain select value not set |

**Lösung:**
- Mock vault für tile save/load operations
- Mock DOM elements (`createEl`, `querySelector`)
- Fix terrain select binding in inspector mode

---

### Kategorie 5: Watcher/Notification Tests
**Anzahl:** 4 Tests
**Impact:** LOW-MEDIUM - File watching system

| Test File | Problem | Root Cause |
|-----------|---------|------------|
| `terrain-watcher.test.ts` (1) | Console logging check fails | Logger output capture |
| `regions-store.test.ts` (3) | Notification checks, debouncing | Notice API mocking |

**Lösung:**
- Mock `new Notice()` API
- Mock console logging capture

---

### Kategorie 6: Library View Tests
**Anzahl:** 2 Tests
**Impact:** LOW - UI rendering

| Test File | Problem | Root Cause |
|-----------|---------|------------|
| `library/view.test.ts` (2) | Label rendering, mode switching | DOM mocks, data loading |

**Lösung:**
- Mock data sources for library entities
- Mock DOM rendering

---

## 🎯 Priorisierung & Strategie

### Phase 1a: Mock Infrastructure (CRITICAL) - 2-3 Tage

**Ziel:** Basisinfrastruktur für alle Tests schaffen

**Tasks:**
1. **Obsidian API Mock erstellen** (`devkit/testing/mocks/obsidian-api.ts`)
   ```typescript
   export const mockApp = {
     vault: {
       read: vi.fn(),
       create: vi.fn(),
       modify: vi.fn(),
       delete: vi.fn(),
       adapter: { exists: vi.fn(), read: vi.fn(), write: vi.fn() }
     },
     workspace: {
       registerObsidianProtocolHandler: vi.fn(),
       getLeaf: vi.fn(),
       registerView: vi.fn()
     }
   };

   export const mockModal = class MockModal {
     constructor(app: any) {}
     open() {}
     close() {}
     onOpen() {}
     onClose() {}
   };

   export const mockNotice = class MockNotice {
     constructor(message: string) {}
   };
   ```

2. **Vitest Setup konfigurieren** (`vitest.config.ts` oder `devkit/testing/setup.ts`)
   ```typescript
   vi.mock('obsidian', () => ({
     Modal: mockModal,
     Notice: mockNotice,
     Plugin: class MockPlugin {},
     TFile: class MockTFile {},
     // ... weitere Obsidian classes
   }));
   ```

3. **Test Utilities** (`devkit/testing/utils/test-helpers.ts`)
   - `createMockApp()` - Fertig konfigurierter Mock
   - `createMockVault()` - Mit test fixtures
   - `createMockWorkspace()` - Mit leaf management

**DoD:**
- [ ] `base-modal.test.ts` läuft grün
- [ ] `encounter-gateway.test.ts` läuft grün
- [ ] Mock-Infrastruktur dokumentiert

---

### Phase 1b: Integration Test Fixes - 1-2 Tage

**Ziel:** Main integration tests grün kriegen

**Tasks:**
1. Vault API Mocks für `main.integration.test.ts` anpassen
2. Error handling Mocks (rejects) richtig konfigurieren
3. Spy/Mock assertions debuggen

**DoD:**
- [ ] Alle 6 Tests in `main.integration.test.ts` grün

---

### Phase 1c: Feature-Specific Tests - 2-3 Tage

**Ziel:** Almanac, Cartographer, Library Tests fixen

**Tasks:**
1. Almanac Repository Mocks
2. Cartographer Brush/Inspector Mocks
3. Library View data loading

**DoD:**
- [ ] Almanac Tests grün (7 tests)
- [ ] Cartographer Tests grün (8 tests)
- [ ] Library Tests grün (2 tests)
- [ ] Watcher Tests grün (4 tests)

---

## 📋 Alternative: Quick Wins First

Statt alle Mocks zu bauen, könnten wir auch:

1. **Tests supporten die NICHT broken sind** (25 passing files) ✅
2. **Trivial fixbare Tests zuerst** (z.B. Inspector-Mode terrain select)
3. **Integration Tests auf "pending" setzen** (temporär skippen)
4. **Mock-Infrastruktur incremental bauen**

**Vorteil:** Schneller zu grüner Test-Suite
**Nachteil:** Integration-Coverage fehlt

---

## 💡 Empfehlung

**OPTION A: Full Mock Infrastructure** (~1 Woche)
- Baut robuste Mock-Basis für alle zukünftigen Tests
- Integration Tests haben echten Wert
- Entspricht "Foundation First" Principle

**OPTION B: Skip Integration Tests temporarily** (~2-3 Tage)
- Fokus auf Library-Repos Migration
- Integration Tests als "known issue" markieren
- Mock-Infra später nachziehen

**Was bevorzugst du?**

## 🔄 Nächste Schritte

Je nach Entscheidung:

**Wenn Option A:**
1. Mock Infrastructure aufbauen (Phase 1a)
2. Tests schrittweise fixen (Phase 1b + 1c)
3. Dann Library-Repos migrieren

**Wenn Option B:**
1. Integration Tests temporarily skippen
2. Library-Repos sofort migrieren
3. Zu Phase 2.6 übergehen
4. Mock-Infra als "Phase 1 Cleanup" später

