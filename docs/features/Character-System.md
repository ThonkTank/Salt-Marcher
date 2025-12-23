# Character-System

> **Lies auch:** [Inventory-System](Inventory-System.md), [Item](../domain/Item.md)
> **Wird benoetigt von:** Travel, Combat, Party

Verwaltung von Player Characters (PCs): Schema, Tracking, Integration mit anderen Systemen.

**Design-Philosophie:** PCs haben spezifische Daten die NPCs nicht haben (HP-Tracking, Inventory). Das MVP-Schema fokussiert sich auf das, was fuer Encounter-Balancing und Travel-Berechnung benoetigt wird.

---

## Uebersicht

Das Character-System verwaltet die Spielercharaktere:

1. **Character-Entity** - Persistierte PC-Daten
2. **HP-Tracking** - Aktueller Gesundheitszustand
3. **Inventory-Integration** - Ausruestung und Gegenstaende
4. **Travel-Berechnung** - Speed fuer Reise-Dauer

```
┌─────────────────────────────────────────────────────────────────┐
│  Character Entity                                                │
├─────────────────────────────────────────────────────────────────┤
│  Basis-Daten                                                     │
│  ├── Name, Level, Klasse                                         │
│  ├── AC fuer Combat-Reference                                    │
│  └── Speed fuer Travel-Berechnung                                │
├─────────────────────────────────────────────────────────────────┤
│  Tracking-Daten                                                  │
│  ├── maxHp / currentHp                                           │
│  └── strength (fuer Encumbrance)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Inventory                                                       │
│  └── InventorySlot[] → Inventory-System.md                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Character-Schema

Characters werden im EntityRegistry gespeichert (`EntityType: 'character'`).

```typescript
interface Character {
  id: EntityId<'character'>;

  // === Basis-Daten ===
  name: string;
  level: number;              // 1-20, fuer XP/Encounter-Balancing
  class: string;              // Klasse (Fighter, Wizard, etc.)

  // === Combat-Stats ===
  maxHp: number;              // Max HP fuer Encounter-Balancing
  currentHp: number;          // Aktueller HP-Stand
  ac: number;                 // Armor Class

  // === Movement ===
  speed: number;              // Bewegung in ft, fuer Travel-Berechnung

  // === Attributes (fuer Encumbrance) ===
  strength: number;           // STR-Score, benoetigt fuer Tragkapazitaet

  // === Inventory ===
  inventory: InventorySlot[]; // Siehe Inventory-System.md

  // === Sinne (Post-MVP) ===
  senses?: CharacterSenses;
}

interface CharacterSenses {
  darkvision?: number;       // Range in Feet (60, 120, etc.) - 0 = keine
  blindsight?: number;       // Range in Feet
  tremorsense?: number;      // Range in Feet
  trueSight?: number;        // Range in Feet
}
```

### Was NICHT im MVP-Schema ist

Diese Felder koennen spaeter hinzugefuegt werden:

| Feld | Grund fuer Ausschluss |
|------|----------------------|
| Ability Scores (DEX, CON, etc.) | Nicht fuer MVP-Features benoetigt |
| Spell Slots | Combat-Automatisierung ist Post-MVP |
| Class Features & Feats | Zu komplex fuer MVP |
| Proficiencies | Skills werden am Tisch gehandhabt |
| Background | Reine RP-Information |

---

## Integration mit anderen Systemen

### Encounter-Balancing

Das Encounter-System nutzt Character-Daten fuer Balancing:

```typescript
interface EncounterBalancingInput {
  partyLevel: number;           // Durchschnitt aller Character.level
  partySize: number;            // Anzahl Characters
  totalPartyHp: number;         // Summe aller Character.maxHp
}

// Berechnung
function getBalancingInput(characters: Character[]): EncounterBalancingInput {
  return {
    partyLevel: Math.round(
      characters.reduce((sum, c) => sum + c.level, 0) / characters.length
    ),
    partySize: characters.length,
    totalPartyHp: characters.reduce((sum, c) => sum + c.maxHp, 0)
  };
}
```

→ **Details:** [Encounter-Balancing.md](Encounter-Balancing.md)

### Travel-System

Character-Speed beeinflusst Reise-Dauer:

```typescript
// Party-Speed = langsamster Character
function getPartySpeed(characters: Character[]): number {
  const speeds = characters.map(c => c.speed);
  return Math.min(...speeds);
}

// Encumbrance reduziert Speed
function getEffectiveSpeed(character: Character): number {
  const encumbrance = calculateEncumbrance(character);

  switch (encumbrance) {
    case 'light':       return character.speed;
    case 'encumbered':  return character.speed - 10;
    case 'heavily':     return character.speed - 20;
    case 'over_capacity': return 0;  // Kann nicht reisen
  }
}
```

→ **Details:** [Travel-System.md](Travel-System.md), [Inventory-System.md](Inventory-System.md)

### Combat-Tracker

Der Combat-Tracker referenziert Characters fuer:

- Initiative-Reihenfolge (GM gibt Werte ein)
- HP-Tracking (Damage/Heal)
- Death Saves
- Condition-Tags

→ **Details:** [Combat-System.md](Combat-System.md)

---

## Character-Lifecycle

### Erstellung

Characters werden in der Library oder im Party Manager erstellt:

```
GM oeffnet Party Manager
    │
    ├── "Character hinzufuegen"
    │
    ├── Formular: Name, Level, Klasse, Stats
    │
    └── Character wird via EntityRegistry persistiert
```

### HP-Tracking

HP-Aenderungen erfolgen ueber Events:

```typescript
// HP-Aenderung
'character:hp-changed': {
  characterId: EntityId<'character'>;
  previousHp: number;
  currentHp: number;
  reason: 'damage' | 'heal' | 'rest' | 'manual';
}

// Bei 0 HP
'character:downed': {
  characterId: EntityId<'character'>;
}
```

### Level-Up

Level-Ups werden manuell im Party Manager durchgefuehrt:

```typescript
'character:level-changed': {
  characterId: EntityId<'character'>;
  previousLevel: number;
  newLevel: number;
}
```

**Wichtig:** Das Plugin berechnet KEINE automatischen Level-Ups. Der GM aktualisiert Character-Daten manuell wenn ein Level-Up am Tisch erfolgt.

---

## Session State Synchronization

Waehrend einer laufenden Session (SessionRunner) werden Character/Party-Aenderungen **sofort** zu allen aktiven Features propagiert.

### Sync-Garantie

| Aenderung | Event | Consumer | Reaktion |
|-----------|-------|----------|----------|
| Character HP | `character:hp-changed` | Combat | HP im Tracker aktualisiert |
| Party Member hinzugefuegt | `party:member-added` | Combat | Initiative-Liste erweitert |
| Party Member entfernt | `party:member-removed` | Travel | Kapazitaet neu berechnet |
| Character Attribute | `entity:saved` | Encounter | Balancing neu berechnet |

### Flow

```
GM aendert Character-Daten (z.B. fuegt Spieler zur Party hinzu)
    │
    ├── 1. State-Update (synchron)
    │   └── Party-State wird sofort aktualisiert
    │
    ├── 2. Event-Publication (synchron)
    │   └── 'party:member-added' { characterId }
    │
    └── 3. Consumer-Reaktion (synchron)
        ├── Combat: Initiative-Liste aktualisiert (falls aktiv)
        ├── Travel: Kapazitaet neu berechnet
        └── Encounter: Balancing neu berechnet
```

### Praxisbeispiel

**Szenario:** Spieler kommt zu spaet, Party ist bereits im Combat.

```
GM oeffnet Party Manager
    │
    ├── Klickt "Zur Party hinzufuegen": [Neuer Charakter]
    │
    ├── Event: party:member-added
    │
    └── Combat-Tracker:
        - Fuegt Character zur Initiative-Liste hinzu
        - GM kann Initiative-Wert eintragen
        - Character nimmt am laufenden Combat teil
```

**Wichtig:** Sofortige Sync ist eine bewusste Design-Entscheidung um maximale GM-Flexibilitaet zu gewaehrleisten.

---

## Character vs NPC

| Aspekt | Character (PC) | NPC |
|--------|----------------|-----|
| HP-Tracking | currentHp | Nur im Combat |
| Inventory | Vollstaendig | Keine |
| Encumbrance | Ja | Nein |
| Persistenz | EntityRegistry | EntityRegistry |
| Erstellung | Manuell | Manuell oder generiert |

**Warum getrennt:**

NPCs haben andere Anforderungen (Persoenlichkeit, Kultur-Generierung, Faction-Zugehoerigkeit) waehrend PCs andere haben (Inventory, HP-Tracking, Level-Progression).

→ **Details:** [NPC-System.md](../domain/NPC-System.md)

---

## GM-Interface

### Party Manager

Der Party Manager zeigt alle Characters:

```
┌─────────────────────────────────────────────────────────┐
│  Party Manager                                           │
├─────────────────────────────────────────────────────────┤
│  Thorin (Level 5 Fighter)                               │
│  HP: 45/52  AC: 18  Speed: 25 ft                        │
│  Encumbrance: Encumbered (-10 ft)                       │
│  [Edit] [Inventory]                                     │
├─────────────────────────────────────────────────────────┤
│  Elara (Level 5 Wizard)                                 │
│  HP: 28/28  AC: 13  Speed: 30 ft                        │
│  Encumbrance: Light                                     │
│  [Edit] [Inventory]                                     │
├─────────────────────────────────────────────────────────┤
│  [+ Character hinzufuegen]                              │
└─────────────────────────────────────────────────────────┘
```

### Character-Bearbeitung

Formular-Felder:

| Feld | Typ | Validierung |
|------|-----|-------------|
| Name | Text | Required |
| Level | Number | 1-20 |
| Class | Text | Required |
| Max HP | Number | > 0 |
| Current HP | Number | 0 - maxHp |
| AC | Number | > 0 |
| Speed | Number | > 0, Vielfaches von 5 |
| Strength | Number | 1-30 |

---

## Sinne (Post-MVP)

Optionale Sinnes-Faehigkeiten fuer Charaktere. Diese beeinflussen das Overland-Visibility-System.

### Sinn-Typen

| Sinn | Typische Werte | Effekt |
|------|----------------|--------|
| **Darkvision** | 60, 120 | Nacht-Modifier ignoriert (100% statt 10%) |
| **Blindsight** | 10, 30, 60 | Alle Modifier ignoriert bis Range |
| **Tremorsense** | 30, 60 | Erkennt Bewegung, unabhaengig von Sicht |
| **True Sight** | 30, 120 | Sieht durch magische Dunkelheit |

### Beste Sicht der Party

**Regel:** Der beste Wert in der Party wird verwendet.

```typescript
function getBestPartySense(
  characters: Character[],
  senseType: keyof CharacterSenses
): number {
  return characters.reduce((best, char) => {
    const value = char.senses?.[senseType] ?? 0;
    return Math.max(best, value);
  }, 0);
}
```

**Wichtig:**
- Fuer jeden Sinn gilt: Hoechster Wert in Party wird verwendet
- Sinne stacken NICHT untereinander (Blindsight 60ft + Darkvision 120ft ≠ 180ft)
- Jeder Sinn wirkt in seinem eigenen Range-Bereich

→ **Visibility-System:** [Map-Feature.md](Map-Feature.md#visibility-system)

---

## Post-MVP Erweiterungen

| Feature | Beschreibung | Prioritaet |
|---------|--------------|------------|
| Ability Scores | STR, DEX, CON, INT, WIS, CHA | Mittel |
| Spell Slots | Tracking fuer Caster | Niedrig |
| Class Features | Automatische Reminder | Niedrig |
| Proficiencies | Skill-Modifikatoren | Niedrig |
| D&D Beyond Sync | Import von Character-Daten | Fernziel |

---

*Siehe auch: [NPC-System.md](../domain/NPC-System.md) | [Inventory-System.md](Inventory-System.md) | [Combat-System.md](Combat-System.md) | [Encounter-Balancing.md](Encounter-Balancing.md)*

## Tasks

| # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 500 | ✅ | Character | Character-Interface: id, name, level, class, maxHp, currentHp, ac, speed, strength, inventory | hoch | Ja | #1603 | Character-System.md#character-schema, EntityRegistry.md | character.ts |
| 502 | ✅ | Character | EncounterBalancingInput-Interface: partyLevel, partySize, totalPartyHp | hoch | Ja | #500 | Character-System.md#encounter-balancing, Encounter-Balancing.md#combat-befuellung | character.ts |
| 504 | ✅ | Character | getPartySpeed(characters): Math.min(...characters.map(c => c.speed)) | hoch | Ja | #500 | Character-System.md#travel-system, Travel-System.md#speed-berechnung | character.ts (calculatePartySpeed) |
| 506 | ⬜ | Character | character:hp-changed Event definieren: characterId, previousHp, currentHp, reason | hoch | Ja | #500 | Character-System.md#hp-tracking, Events-Catalog.md, Combat-System.md#hp-tracking | docs/architecture/Events-Catalog.md [ändern], src/core/events/domain-events.ts [ändern - Event Type + Payload Interface hinzufügen] |
| 508 | ⛔ | Character | character:downed Event definieren: characterId | hoch | Ja | #506, #507 | Character-System.md#hp-tracking, Events-Catalog.md, Combat-System.md#hp-tracking | docs/architecture/Events-Catalog.md [ändern], src/core/events/domain-events.ts [ändern - Event Type + Payload Interface hinzufügen] |
| 509 | ⛔ | Character | character:downed Handler: Bei currentHp <= 0 automatisch publizieren | hoch | Ja | #308, #508 | Character-System.md#hp-tracking, Combat-System.md#hp-tracking | src/features/party/character-service.ts [ändern - publishDowned() in HP-Handler], src/features/combat/combat-service.ts [ändern - Event abonnieren für Death Save UI] |
| 511 | ⛔ | Character | character:level-changed Handler: Level-Update, Encounter-Balancing-Recalc | hoch | Ja | #237, #502, #503, #510 | Character-System.md#level-up, Events-Catalog.md, Encounter-Balancing.md#xp-budget | src/features/party/character-service.ts [ändern - publishLevelChanged()], src/features/encounter/encounter-service.ts [ändern - Balancing-Recalc bei Event] |
| 513 | ✅ | Character | party:member-removed Event + Handler: Combat/Travel/Encounter Sync | hoch | Ja | #300, #500, #502, #503 | Character-System.md#session-state-synchronization, Events-Catalog.md#party, Combat-System.md, Travel-System.md | src/core/events/domain-events.ts:PartyMemberRemovedPayload, src/features/party/party-service.ts:publishMemberRemoved(), src/features/combat/combat-service.ts:setupEventHandlers(), src/features/travel/travel-service.ts:setupEventHandlers(), src/features/encounter/encounter-service.ts:setupEventHandlers() |
| 515 | ⬜ | Character | Party Manager View: Character-Liste mit HP, AC, Speed, Encumbrance | hoch | Ja | #500, #603 | Character-System.md#party-manager, Inventory-System.md#encumbrance | src/application/views/PartyManager.svelte [neu], src/application/viewmodels/PartyManagerViewModel.ts [neu - Character-Query + Encumbrance-Calc] |
| 516 | ⛔ | Character | Character-Bearbeitungs-Formular: Name, Level, Class, Max HP, Current HP, AC, Speed, Strength | hoch | Ja | #515 | Character-System.md#character-bearbeitung | src/application/views/components/CharacterForm.svelte [neu], src/application/viewmodels/CharacterFormViewModel.ts [neu - Validation + Save] |
| 518 | ⛔ | Character | Character Edit/Delete Buttons in Party Manager | hoch | Ja | #516 | Character-System.md#party-manager | src/application/views/PartyManager.svelte [ändern - Edit/Delete Actions], src/application/viewmodels/PartyManagerViewModel.ts [ändern - deleteCharacter()] |
| 519 | ⬜ | Character | CharacterSenses-Interface: darkvision, blindsight, tremorsense, trueSight | mittel | Nein | #500 | Character-System.md#sinne-post-mvp, Map-Feature.md#visibility-system | src/core/schemas/character.ts [ändern - CharacterSenses Interface + senses?: CharacterSenses Feld] |
| 521 | ⬜ | Character | Ability Scores: STR, DEX, CON, INT, WIS, CHA im Character-Schema | mittel | Nein | #500 | Character-System.md#post-mvp-erweiterungen | src/core/schemas/character.ts [ändern - abilityScores: { str, dex, con, int, wis, cha } Feld] |
| 523 | ⛔ | Character | Class Features: Automatische Reminder | niedrig | Nein | #521 | Character-System.md#post-mvp-erweiterungen, Combat-System.md | src/features/combat/combat-service.ts [ändern - Feature-Reminder in Initiative], src/core/schemas/character.ts [ändern - features Feld] |
| 525 | ⛔ | Character | D&D Beyond Sync: Import von Character-Daten | niedrig | Nein | #521 | Character-System.md#post-mvp-erweiterungen | src/infrastructure/integrations/dndbeyond-import.ts [neu - API-Client + Mapping] |
| 501 | ✅ | Character | Zod-Schema für Character-Validierung | hoch | Ja | #500 | Character-System.md#character-schema | character.ts |
| 503 | ✅ | Character | getBalancingInput(characters): Berechnet partyLevel (avg), partySize, totalPartyHp | hoch | Ja | #502 | Character-System.md#encounter-balancing | character.ts |
| 505 | ✅ | Character | getEffectiveSpeed(character): character.speed mit Encumbrance-Reduktion | hoch | Ja | #500 | Character-System.md#travel-system | inventory-utils.ts (calculateEffectiveSpeed) |
| 507 | ⛔ | Character | character:hp-changed Handler: HP-Update im State, Combat-Sync | hoch | Ja | #506 | Character-System.md#hp-tracking | src/features/party/character-service.ts [neu - HP-Update-Logik], src/features/party/party-service.ts [ändern - Event-Handler abonnieren] |
| 510 | ⬜ | Character | character:level-changed Event definieren: characterId, previousLevel, newLevel | hoch | Ja | #500 | Character-System.md#level-up | docs/architecture/Events-Catalog.md [ändern], src/core/events/domain-events.ts [ändern - Event Type + Payload Interface hinzufügen] |
| 512 | ✅ | Character | party:member-added Event + Handler: Combat Initiative-Liste, Travel Kapazität | hoch | Ja | #500, #603 | Character-System.md#session-state-synchronization | src/core/events/domain-events.ts:PartyMemberAddedPayload, src/features/party/party-service.ts:publishMemberAdded(), src/features/combat/combat-service.ts:setupEventHandlers(), src/features/travel/travel-service.ts:setupEventHandlers(), src/features/encounter/encounter-service.ts:setupEventHandlers() |
| 514 | ⬜ | Character | Sofort-Sync bei Character-Attribut-Änderung (entity:saved → Recalc) | hoch | Ja | #500, #502, #503, #504 | Character-System.md#sync-garantie | src/features/party/party-service.ts [ändern - entity:saved Handler für Character-Type], src/features/encounter/encounter-service.ts [neu - Balancing-Recalc], src/features/travel/travel-service.ts [neu - Speed-Recalc] |
| 517 | ⛔ | Character | "Character hinzufügen" Button + Workflow: Formular → EntityRegistry.save() | hoch | Ja | #516 | Character-System.md#erstellung | src/application/views/PartyManager.svelte [ändern - Add Button + Modal], src/infrastructure/vault/entity-registry.ts [verwenden für save()] |
| 520 | ⛔ | Character | getBestPartySense(characters, senseType): Max-Wert aus Party | mittel | Nein | #519 | Character-System.md#beste-sicht-der-party | src/core/schemas/character.ts [ändern - getBestPartySense() Funktion hinzufügen] |
| 522 | ⛔ | Character | Spell Slots Tracking für Caster | niedrig | Nein | #521 | Character-System.md#post-mvp-erweiterungen | src/core/schemas/character.ts [ändern - spellSlots Feld], src/features/combat/combat-service.ts [ändern - Slot-Verbrauch] |
| 524 | ⛔ | Character | Proficiencies: Skill-Modifikatoren | niedrig | Nein | #521 | Character-System.md#post-mvp-erweiterungen | src/core/schemas/character.ts [ändern - proficiencies Feld] |
