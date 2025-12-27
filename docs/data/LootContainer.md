# Schema: LootContainer

> **Produziert von:** [Library](../application/Library.md), [Loot-Feature](../features/Loot-Feature.md) (generateLoot)
> **Konsumiert von:**
> - [POI](poi.md) - Container an Orten referenzieren
> - [DetailView](../application/DetailView.md) - Looting UI
> - [Encounter](../features/encounter/Encounter.md) - Loot nach Combat

Persistente Loot-Instanzen in der Spielwelt: Schatzkisten, Drachenhorte, tote Abenteurer.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `id` | `EntityId<'lootcontainer'>` | Eindeutige ID | Required |
| `name` | `string` | Anzeigename ("Schatzkiste", "Drachenhort") | Required, non-empty |
| `locationRef` | `EntityId<'poi'>` | POI an dem der Container liegt | Required |
| `goldAmount` | `number` | Konkrete GP-Menge | Required, >= 0 |
| `items` | `EntityId<'item'>[]` | Konkrete Item-Liste | Required |
| `status` | `LootContainerStatus` | Aktueller Zustand | Required |
| `locked` | `boolean` | Verschlossen? | Optional, default: false |
| `lockDC` | `number` | DC fuer Lockpicking/Aufbrechen | Optional, nur wenn locked=true |
| `trapped` | `boolean` | Falle vorhanden? | Optional, default: false |
| `trapRef` | `EntityId<'poi'>` | Referenz auf Fallen-POI (fuer Details) | Optional, nur wenn trapped=true |
| `discoveredAt` | `GameDateTime` | Wann entdeckt? | Optional |
| `lootedAt` | `GameDateTime` | Wann gepluendert? | Optional |
| `description` | `string` | GM-Beschreibung | Optional |
| `gmNotes` | `string` | Private GM-Notizen | Optional |

---

## Sub-Schemas

### LootContainerStatus

```typescript
type LootContainerStatus = 'pristine' | 'looted' | 'partially_looted';
```

| Wert | Bedeutung |
|------|-----------|
| `pristine` | Unberuehrt, voller Inhalt |
| `partially_looted` | Einige Items/Gold entnommen |
| `looted` | Vollstaendig leer |

---

## Invarianten

- `locationRef` muss auf existierenden POI verweisen
- `lockDC` nur setzbar wenn `locked=true`
- `trapRef` nur setzbar wenn `trapped=true`
- `lootedAt` nur setzbar wenn `status !== 'pristine'`
- Wenn `items.length === 0 && goldAmount === 0`, muss `status === 'looted'` sein

---

## Beispiel

```typescript
const dungeonChest: LootContainer = {
  id: 'lootcontainer-dungeon-01-chest',
  name: 'Verstaubte Truhe',
  locationRef: 'poi-dungeon-01-treasure-room',

  goldAmount: 150,
  items: ['gem-ruby', 'potion-healing', 'scroll-fireball'],
  status: 'pristine',

  locked: true,
  lockDC: 15,
  trapped: true,
  trapRef: 'poi-dungeon-01-poison-needle-trap',

  description: 'Eine alte, mit Staub bedeckte Holztruhe mit eisernen Beschlaegen.'
};
```
