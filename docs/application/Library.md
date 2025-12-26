# Library

> **Lies auch:** [EntityRegistry](../architecture/EntityRegistry.md), [Application](../architecture/Application.md)
> **Konsumiert:** Alle Entities

Die zentrale Datenverwaltung fuer alle Entity-Typen.

**Pfad:** `src/application/library/`

---

## Uebersicht

Die Library ist der CRUD-Workmode fuer alle Entities im System. Sie nutzt das generische `data-manager` Pattern mit Entity-spezifischen `create-spec` Definitionen.

| Aspekt | Beschreibung |
|--------|--------------|
| **Zweck** | Erstellen, Bearbeiten, Loeschen aller Entities |
| **Pattern** | Generische Browse-View + Modal-basiertes CRUD |
| **Konfiguration** | Entity-spezifische `create-spec.ts` Dateien |

---

## Layout-Wireframe

### Standard-Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [≡] Library                                                        [⚙️]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ [Creatures] [Characters] [Items] [Spells] [Locations] [Factions] [...]  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Search: [________________________] 🔍  │ Filter: [All Types ▼] [+ New] ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                          ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │  🐺 Wolf                                    CR 1/4   │ [✏️] [🗑️]  │ ││
│  │  │  Beast • Medium • Forest, Grassland                                │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  │                                                                          ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │  🧟 Goblin                                   CR 1/4   │ [✏️] [🗑️]  │ ││
│  │  │  Humanoid • Small • Cave, Forest                                   │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  │                                                                          ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │  🐉 Young Red Dragon                         CR 10   │ [✏️] [🗑️]  │ ││
│  │  │  Dragon • Large • Mountain, Volcanic                               │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  │                                                                          ││
│  │  [Load More...]                                          Showing 3/127  ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Tab-Navigation

Die Tab-Leiste zeigt alle verfuegbaren Entity-Typen.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │ Creatures │ │ Characters│ │   Items   │ │  Spells   │ │ Locations │     │
│  │    127    │ │     8     │ │    234    │ │    89     │ │    42     │     │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘     │
│       ▲                                                                      │
│       └── Aktiver Tab (hervorgehoben)                                       │
│                                                                              │
│  Overflow-Menu (bei vielen Tabs):                                           │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────┐           │
│  │ Creatures │ │ Characters│ │   Items   │ │  Spells   │ │ ••• │           │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └──┬──┘           │
│                                                              │               │
│                                              ┌───────────────┴─────────────┐│
│                                              │ Locations                    ││
│                                              │ Factions                     ││
│                                              │ Terrains                     ││
│                                              │ Calendars                    ││
│                                              │ Quests                       ││
│                                              │ Maps                         ││
│                                              │ Playlists                    ││
│                                              └──────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Entity-Tabs

| Tab | Entity-Typ | Icon | Beschreibung |
|-----|------------|------|--------------|
| Creatures | `creature` | 🐺 | Monster, Tiere, NPCs mit Statblock |
| Characters | `character` | 👤 | Spielercharaktere |
| Items | `item` | 🗡️ | Ausruestung, Waffen, Gegenstaende |
| Spells | `spell` | ✨ | Zaubersprueche |
| Locations | `location` | 📍 | Orte, POIs, Gebaeude |
| Factions | `faction` | 🏴 | Organisationen, Gilden |
| Terrains | `terrain` | 🌲 | Terrain-Definitionen |
| Calendars | `calendar` | 📅 | Kalender-Systeme |
| Quests | `quest` | 📜 | Quest-Definitionen |
| Maps | `map` | 🗺️ | Karten (Overland, Dungeon) |
| Playlists | `track` | 🎵 | Audio-Playlists |
| Shops | `shop` | 🏪 | Haendler-Inventare |
| LootTables | `loottable` | 💰 | Wiederverwendbare Loot-Definitionen |
| LootContainers | `lootcontainer` | 📦 | Instanzen: Truhen, Horte, Leichen |

---

## Browse-View

Die generische Listen-Ansicht mit Filter und Suche.

### Filter-Controls

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Search: [________________________] 🔍                                       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Quick Filters (Entity-spezifisch):                                       ││
│  │                                                                          ││
│  │ Creatures:      [All CR ▼] [All Types ▼] [All Habitats ▼]              ││
│  │ Items:          [All Rarity ▼] [All Categories ▼] [Magic Only ☐]       ││
│  │ Spells:         [All Levels ▼] [All Schools ▼] [All Classes ▼]         ││
│  │ Locations:      [All Types ▼] [All Regions ▼]                          ││
│  │ LootTables:     [All Tags ▼] [Value Range ▼]                           ││
│  │ LootContainers: [All POIs ▼] [Status ▼] (pristine/looted)              ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Sort: [Name ▼] [Ascending ▼]                              [+ New Entity]   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Entity-Cards

Kompakte Karten mit Entity-spezifischen Informationen.

```
─────────── Creature Card ───────────

┌────────────────────────────────────────────────────────────────────────────┐
│  🐺 Wolf                                           CR 1/4  │ [✏️] [📋] [🗑️]│
│  ───────────────────────────────────────────────────────────────────────── │
│  Beast • Medium • Unaligned                                                │
│  HP: 11 │ AC: 13 │ Speed: 40ft                                            │
│  Habitats: Forest, Grassland, Hill                                        │
│  Tags: pack tactics, keen senses                                          │
└────────────────────────────────────────────────────────────────────────────┘

─────────── Item Card ───────────

┌────────────────────────────────────────────────────────────────────────────┐
│  🗡️ Longsword +1                                 Uncommon │ [✏️] [📋] [🗑️]│
│  ───────────────────────────────────────────────────────────────────────── │
│  Weapon (martial, melee) • 3 lb                                           │
│  1d8+1 slashing (versatile 1d10+1)                                        │
│  Requires Attunement: No                                                  │
└────────────────────────────────────────────────────────────────────────────┘

─────────── Spell Card ───────────

┌────────────────────────────────────────────────────────────────────────────┐
│  ✨ Fireball                                        3rd │ [✏️] [📋] [🗑️]  │
│  ───────────────────────────────────────────────────────────────────────── │
│  Evocation • V, S, M • 150 feet                                           │
│  8d6 fire damage (DEX save half)                                          │
│  Classes: Sorcerer, Wizard                                                │
└────────────────────────────────────────────────────────────────────────────┘

─────────── Location Card ───────────

┌────────────────────────────────────────────────────────────────────────────┐
│  📍 Silverwood Village                          Settlement │ [✏️] [📋] [🗑️]│
│  ───────────────────────────────────────────────────────────────────────── │
│  Region: Elderwood Forest │ Population: ~200                              │
│  Faction: Elven Council (dominant)                                        │
│  Notable: Ancient Tree, Moonwell                                          │
└────────────────────────────────────────────────────────────────────────────┘

─────────── LootTable Card ───────────

┌────────────────────────────────────────────────────────────────────────────┐
│  💰 Dragon Hoard                               ~15000 GP │ [✏️] [📋] [🗑️] │
│  ───────────────────────────────────────────────────────────────────────── │
│  Tags: dragon, hoard, high-tier, treasure                                 │
│  Gold: 5000-25000 GP │ Items: 4d6 gems, 2d4 magic                         │
│  Verwendungen: 3 (in LootContainern)                                      │
└────────────────────────────────────────────────────────────────────────────┘

─────────── LootContainer Card ───────────

┌────────────────────────────────────────────────────────────────────────────┐
│  📦 Hort von Scaldrath                          pristine │ [✏️] [📋] [🗑️] │
│  ───────────────────────────────────────────────────────────────────────── │
│  POI: Hoehle des Roten Drachen [→]                                        │
│  Inhalt: 12,500 GP │ 8 Items                                              │
│  Template: Dragon Hoard                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

**Card-Actions:**
- `[✏️]` = Edit (oeffnet Modal)
- `[📋]` = Duplicate
- `[🗑️]` = Delete (mit Bestaetigung)

---

## Create/Edit Modal

Modals werden aus `create-spec.ts` generiert.

### Modal-Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Create New Creature                                                    [X] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ [Basic Info] [Stats] [Abilities] [Actions] [Equipment] [Habitat]      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ─────────────────────── Basic Info ───────────────────────                 │
│                                                                              │
│  Name*                                                                       │
│  [Wolf                                                          ]           │
│                                                                              │
│  Type*                           Size*                                       │
│  [Beast               ▼]         [Medium             ▼]                     │
│                                                                              │
│  Alignment                       Challenge Rating*                           │
│  [Unaligned           ▼]         [1/4                ▼]                     │
│                                                                              │
│  Description                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ A wolf is a pack hunter known for its cunning and ferocity.           │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Tags                                                                        │
│  [pack tactics] [keen senses] [+ Add Tag]                                   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                              [Cancel]  [Save]  [Save & New] │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Modal-Navigation

Komplexe Entities haben mehrere Sektionen:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [Basic Info] [Stats] [●Abilities] [Actions] [Equipment] [Habitat]         │
└───────────────────────────────────────────────────────────────────────────┘
        │          │        ▲
        │          │        └── Aktive Sektion (ausgefuellt)
        │          └─────────── Sektion mit Validation-Error
        └────────────────────── Besuchte Sektion (gruen wenn valid)
```

**Section-States:**
- Unbesucht: Grau
- Besucht + Valid: Gruen
- Besucht + Invalid: Rot
- Aktiv: Hervorgehoben

---

## View-Modi

### List-View (Default)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🐺 Wolf                     CR 1/4 │ Beast • Forest, Grassland │ [✏️][🗑️]│
├────────────────────────────────────────────────────────────────────────────┤
│  🧟 Goblin                   CR 1/4 │ Humanoid • Cave, Forest   │ [✏️][🗑️]│
├────────────────────────────────────────────────────────────────────────────┤
│  🐉 Young Red Dragon         CR 10  │ Dragon • Mountain         │ [✏️][🗑️]│
└────────────────────────────────────────────────────────────────────────────┘
```

### Grid-View (Optional)

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│       🐺       │  │       🧟       │  │       🐉       │
│     Wolf       │  │     Goblin     │  │  Young Red     │
│    CR 1/4      │  │    CR 1/4      │  │  Dragon CR 10  │
│ [✏️]    [🗑️]  │  │ [✏️]    [🗑️]  │  │ [✏️]    [🗑️]  │
└────────────────┘  └────────────────┘  └────────────────┘
```

### Tree-View (Locations)

Fuer hierarchische Entities wie Locations:

```
▼ 📍 Elderwood Forest (Region)
  ├─ 📍 Silverwood Village
  │  ├─ 🏠 The Silver Oak Inn
  │  └─ ⛪ Temple of Silvanus
  ├─ 📍 Moonwell Glade
  └─ 🕳️ Goblin Caves
     ├─ Cave Entrance
     ├─ Main Chamber
     └─ Chieftain's Lair
```

---

## Keyboard-Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `Ctrl+N` | Neues Entity erstellen |
| `Ctrl+F` | Suche fokussieren |
| `Enter` | Ausgewaehltes Entity editieren |
| `Delete` | Ausgewaehltes Entity loeschen |
| `Ctrl+D` | Entity duplizieren |
| `↑` / `↓` | Navigation in Liste |
| `1-9` | Tab wechseln |
| `Escape` | Modal schliessen |

---

## State-Management

### ViewModel-State

```typescript
interface LibraryState {
  // Navigation
  activeTab: EntityType;

  // Browse
  searchQuery: string;
  filters: Record<string, FilterValue>;
  sortBy: string;
  sortDirection: 'asc' | 'desc';

  // Data
  entities: Entity[];
  totalCount: number;
  page: number;
  pageSize: number;

  // Selection
  selectedEntityId: EntityId | null;
  multiSelect: EntityId[];

  // Modal
  modalOpen: boolean;
  modalMode: 'create' | 'edit';
  modalEntityId: EntityId | null;
  modalSection: string;

  // View
  viewMode: 'list' | 'grid' | 'tree';
}
```

### Entity-Registry Integration

```typescript
// Library ruft EntityRegistry fuer Typ-Informationen
const entityConfig = entityRegistry.getConfig(activeTab);
// → { createSpec, browseConfig, filters, sorting }
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Tab-Navigation | ✓ | | Kern-UI |
| Browse-View (List) | ✓ | | Kern-UI |
| Search | ✓ | | Basis-Funktion |
| Entity-Cards | ✓ | | Kompakte Info |
| Quick Filters | ✓ | | Entity-spezifisch |
| Create Modal | ✓ | | CRUD-Kern |
| Edit Modal | ✓ | | CRUD-Kern |
| Delete mit Confirm | ✓ | | CRUD-Kern |
| Grid-View | | niedrig | Alternative Ansicht |
| Tree-View (Locations) | | mittel | Hierarchie |
| Bulk-Actions | | niedrig | Multi-Select |
| Import/Export | | niedrig | Datenaustausch |

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 2600 | 🔶 | Application/Library | apps | Tab-Navigation Component mit Entity-Type Tabs | hoch | Ja | #2801, #2599 | Library.md#layout-wireframe, Application.md#mvvm-pattern | [neu] src/application/library/TabNavigation.svelte, [neu] src/application/library/types.ts:LibraryState |
| 2601 | ✅ | Application/Library | apps | Entity-Tab Icons und Badges (Count Display) | hoch | Ja | #2600, #2800 | Library.md#state-management, Application.md#mvvm-pattern, Application.md#viewmodel-feature-kommunikation | [ändern] src/application/library/TabNavigation.svelte:renderTabs(), [nutzt] src/core/types/entity-registry.port.ts:EntityRegistryPort.count() |
| 2602 | ⬜ | Application/Library | apps | Tab Overflow-Menu fuer viele Entity-Typen | mittel | Nein | #2600, #2601 | Library.md#tab-navigation, EntityRegistry.md#entity-type-mapping, Application.md#mvvm-pattern | [ändern] src/application/library/TabNavigation.svelte:renderOverflowMenu() |
| 2603 | ✅ | Application/Library | apps | Browse-View Component (List-Ansicht) Umgesetzt: - BrowseView.ts Komponente mit Entity-Liste, Loading/Error/Empty-States - Entity-Cards mit Icon, Name, ID und Selection-Highlighting - Pagination UI mit 'Load More' Button und Count-Anzeige - Integration in view.ts (renderContent() delegiert an BrowseView) Deliverables: - [x] BrowseView.ts Komponente mit Factory-Funktion - [x] Entity-Card-Rendering (in BrowseView integriert statt separater EntityList.ts) - [x] Pagination UI (Load More, Showing X/Y) - [x] Integration in view.ts (renderContent ersetzen) DoD: - [x] TypeScript-Check erfolgreich - [x] Build erfolgreich - [x] Entity-Liste rendert für alle 17 Entity-Typen - [x] Tab-Wechsel zeigt korrekte Entities - [x] Selection funktioniert (Click) - [x] Edit-Intent funktioniert (DblClick) | hoch | Ja | #2600, #2601, #2621 | Library.md#browse-view, Library.md#view-modi, Application.md#mvvm-pattern | [neu] src/application/library/BrowseView.svelte, [neu] src/application/library/components/EntityList.svelte |
| 2604 | ⬜ | Application/Library | apps | Search-Bar mit Echtzeit-Filterung | hoch | Ja | #2603, #2621 | Library.md#filter-controls, EntityRegistry.md#querying | [ändern] src/application/library/BrowseView.svelte:renderSearchBar(), [ändern] src/application/library/viewmodel.ts:filterEntities() |
| 2605 | ⬜ | Application/Library | apps | Quick Filters (Entity-spezifisch: CR, Type, Habitat, Rarity, etc.) | hoch | Ja | #2603 | Library.md#filter-controls, Library.md#browse-view, EntityRegistry.md#querying | [ändern] src/application/library/BrowseView.svelte:renderQuickFilters(), [ändern] src/application/library/viewmodel.ts:applyFilters() |
| 2606 | ⬜ | Application/Library | apps | Sort Controls (Name, CR, Type, Custom Fields) | hoch | Ja | #2603, #2621 | Library.md#filter-controls, Library.md#state-management | [ändern] src/application/library/BrowseView.svelte:renderSortControls(), [ändern] src/application/library/viewmodel.ts:sortEntities() |
| 2607 | ⛔ | Application/Library | apps | Entity-Card Component (Creature) | hoch | Ja | #2603, #1200 | Library.md#entity-cards, Library.md#browse-view | [neu] src/application/library/cards/CreatureCard.svelte, [nutzt] src/core/schemas/creature.ts:CreatureDefinition |
| 2608 | ⬜ | Application/Library | apps | Entity-Card Component (Item) | hoch | Ja | #1600, #2601, #2603 | Library.md#create-edit-modal, EntityRegistry.md#port-interface, Application.md#viewmodel-feature-kommunikation | [neu] src/application/library/cards/ItemCard.svelte, [nutzt] src/core/schemas/item.ts:Item |
| 2609 | ⬜ | Application/Library | apps | Entity-Card Component (Spell) | hoch | Ja | #2601, #2603 | Library.md#create-edit-modal, EntityRegistry.md#port-interface, Application.md#viewmodel-feature-kommunikation | [neu] src/application/library/cards/SpellCard.svelte, [neu] src/core/schemas/spell.ts:Spell (Post-MVP) |
| 2610 | ⛔ | Application/Library | apps | Entity-Card Component (Location) | hoch | Ja | #1500, #2603, #2608, #2609 | Library.md#modal-navigation, Library.md#create-edit-modal | [neu] src/application/library/cards/LocationCard.svelte, [nutzt] src/core/schemas/poi.ts:POI |
| 2611 | ⛔ | Application/Library | apps | Entity-Card Component (Generisch fuer andere Entity-Typen) | mittel | Ja | #2603, #2610 | Library.md#modal-navigation, EntityRegistry.md#validierung, Error-Handling.md | [neu] src/application/library/cards/GenericCard.svelte |
| 2612 | ⛔ | Application/Library | apps | Card-Actions (Edit, Duplicate, Delete Buttons) | hoch | Ja | #2601, #2607, #2608, #2609, #2610, #2611, #2621 | Library.md#entity-cards, EntityRegistry.md#entity-deletion-cascades, Application.md#viewmodel-feature-kommunikation | [ändern] src/application/library/cards/*.svelte:renderActions(), [nutzt] src/application/library/viewmodel.ts:editEntity(), deleteEntity(), duplicateEntity() |
| 2613 | ✅ | Application/Library | apps | Create/Edit Modal Component (Generisch) Umgesetzt: - EntityModal.ts - Modal-Klasse (extends Obsidian Modal) - EntityModalOptions Interface (mode, entityType, entityId, onCancel) - Modal-Header mit Titel (Create/Edit + EntityType) - Platzhalter-Content für nachfolgende Tasks (#2614-#2618) - Cancel-Button (ruft viewModel.closeModal()) - Integration in view.ts (renderModal bei 'modal' RenderHint) - Export in index.ts Deliverables: - [x] EntityModal.ts - Modal-Klasse (extends Obsidian Modal) - [x] EntityModalOptions Interface (mode, entityType, entityId, onCancel) - [x] Modal-Header mit Titel (Create/Edit + EntityType) - [x] Platzhalter-Content für nachfolgende Tasks (#2614-#2618) - [x] Cancel-Button (ruft viewModel.closeModal()) - [x] Integration in view.ts (renderModal bei 'modal' RenderHint) - [x] Export in index.ts DoD: - [x] TypeScript-Check erfolgreich - [x] Build erfolgreich - [x] DblClick auf Entity öffnet Edit-Modal - [x] Modal schließt bei Cancel | hoch | Ja | #2601, #2621 | Library.md#entity-cards, EntityRegistry.md#port-interface | [neu] src/application/library/EntityModal.ts:EntityModal, EntityModalOptions, openEntityModal(), ENTITY_TYPE_LABELS [ändern] src/application/library/view.ts:renderModal(), currentModal Property, Import EntityModal [ändern] src/application/library/index.ts:Export EntityModal, openEntityModal, EntityModalOptions [nutzt] src/application/library/viewmodel.ts:openCreateModal(), openEditModal(), closeModal() [nutzt] src/application/library/types.ts:ModalState, ModalMode, LibraryRenderHint |
| 2614 | 📋 | Application/Library | apps | Modal Tab-Navigation (Basic Info, Stats, Abilities, etc.) Deliverables: - [ ] ModalSectionConfig Interface in types.ts - [ ] ENTITY_SECTIONS Mapping für Entity-spezifische Tabs - [ ] getEntitySections(entityType) Hilfsfunktion - [ ] renderTabNavigation() in EntityModal.ts - [ ] Tab-Click-Handler mit onSectionChange Callback - [ ] Aktiver Tab visuell hervorgehoben DoD: - [ ] TypeScript-Check erfolgreich - [ ] Build erfolgreich - [ ] DblClick auf Entity öffnet Modal mit Tab-Navigation - [ ] Tab-Wechsel aktualisiert modal.currentSection im State - [ ] Aktiver Tab ist visuell hervorgehoben - [ ] Entity-spezifische Tabs werden angezeigt (z.B. Creature vs Character) | hoch | Ja | #2603, #2613 | Library.md#view-modi, Library.md#state-management | Umgesetzt: - types.ts: ModalSectionConfig Interface, ENTITY_SECTIONS Mapping (creature, character, npc, item, quest, encounter, shop, faction, map, poi, terrain), DEFAULT_SECTIONS Fallback, getEntitySections() Hilfsfunktion - EntityModal.ts: renderTabNavigation() mit CSS-Styling, handleTabClick() mit Callback, refreshContent() für Tab-Wechsel, currentSection Tracking - view.ts: renderModal() erweitert um currentSection und onSectionChange Callback |
| 2615 | ⛔ | Application/Library | apps | Modal Section-States (Unbesucht, Valid, Invalid, Aktiv) | mittel | Ja | #2603, #2614, #2617 | Library.md#view-modi, POI.md#schema, POI.md#map-navigation | [ändern] src/application/library/EntityModal.svelte:updateSectionState(), [ändern] src/application/library/viewmodel.ts:validateSection() |
| 2616 | ⬜ | Application/Library | apps | Modal Form Generation aus create-spec.ts | hoch | Ja | #2603, #2613 | Library.md#state-management, EntityRegistry.md#port-interface | [ändern] src/application/library/EntityModal.svelte:renderForm(), [neu] src/application/library/form-generator.ts:generateFormFields() |
| 2617 | ⛔ | Application/Library | apps | Modal Validation (Required Fields, Type Checks) | hoch | Ja | #2601, #2616, #2803 | Library.md#state-management, EntityRegistry.md#storage | [ändern] src/application/library/EntityModal.svelte:validateForm(), [nutzt] Zod-Schemas via EntityRegistry |
| 2618 | ⛔ | Application/Library | apps | Modal Save Actions (Save, Save & New) | hoch | Ja | #2605, #2613, #2621, #2802 | Library.md#filter-controls, Creature.md#schema, Creature.md#creaturedefinition | [ändern] src/application/library/EntityModal.svelte:handleSave(), [nutzt] src/application/library/viewmodel.ts:saveEntity() |
| 2619 | ⛔ | Application/Library | apps | Delete Confirmation Dialog | hoch | Ja | #2605, #2612, #2810 | Library.md#filter-controls, Item.md#schema, Item.md#kategorie-details | [neu] src/application/library/DeleteConfirmDialog.svelte, [nutzt] EntityRegistry.delete() mit Referenz-Prüfung |
| 2620 | ⛔ | Application/Library | apps | Keyboard-Shortcuts (Ctrl+N, Ctrl+F, Enter, Delete, etc.) | mittel | Nein | #2603, #2605, #2621 | Library.md#filter-controls, EntityRegistry.md#entity-type-mapping | [ändern] src/application/library/viewmodel.ts:handleKeyPress(), [ändern] src/application/library/view.ts:registerDomEvent() |
| 2621 | ✅ | Application/Library | apps | LibraryViewModel State Management | hoch | Ja | - | Library.md#filter-controls, POI.md#poi-typen, POI.md#basepoi | [neu] src/application/library/viewmodel.ts, [neu] src/application/library/types.ts:LibraryState, [nutzt] EntityRegistryPort |
| 2622 | ⛔ | Application/Library | apps | EntityRegistry Integration (getConfig, createSpec, browseConfig) | hoch | Ja | #2602, #2621, #2800, #2801 | Library.md#tab-navigation, EntityRegistry.md#port-interface | [ändern] src/application/library/viewmodel.ts:loadEntities(), [nutzt] EntityRegistryPort.getAll(), query() |
| 2623 | ⛔ | Application/Library | apps | Grid-View Component (Alternative Ansicht) | niedrig | Nein | #2602, #2603 | Library.md#tab-navigation, Library.md#entity-tabs | [neu] src/application/library/GridView.svelte |
| 2624 | ⬜ | Application/Library | apps | Tree-View Component (Locations Hierarchie) | mittel | Nein | #1500, #2601, #2603 | Library.md#keyboard-shortcuts, Application.md#mvvm-pattern | [neu] src/application/library/TreeView.svelte, [nutzt] POI.parentId für Hierarchie |
| 2625 | ⬜ | Application/Library | apps | Bulk-Actions (Multi-Select und Batch-Delete) | niedrig | Nein | #2603, #2621 | Library.md#browse-view, Library.md#state-management | [ändern] src/application/library/BrowseView.svelte:renderBulkActions(), [ändern] src/application/library/viewmodel.ts:deleteMultiple() |
| 2626 | ⛔ | Application/Library | apps | Import/Export Funktionalitaet | niedrig | Nein | #2608, #2621, #2802 | Library.md#create-edit-modal, EntityRegistry.md#port-interface | [ändern] src/application/library/viewmodel.ts:exportEntities(), importEntities(), [nutzt] EntityRegistry save/delete |
| 3009 | ⛔ | Library | features | LootContainer CRUD-Interface in Library | mittel | Ja | #3006, #2800 | Library.md#entity-tabs, LootContainer.md | - |

---

*Siehe auch: [data-manager](../architecture/Data-Manager.md) | [EntityRegistry](../architecture/EntityRegistry.md)*
