# Combat-System

> **Lies auch:** [Encounter-System](Encounter-System.md), [Character-System](Character-System.md)
> **Wird benoetigt von:** SessionRunner, Dungeon

Initiative-Tracker und Condition-Management fuer D&D Kaempfe.

**Design-Philosophie:** Combat wird am Tisch ausgewuerfelt. Der Combat Tracker automatisiert nur das Merken - nicht das Spielen.

---

## Uebersicht

Das Combat-System trackt:

1. **Initiative-Reihenfolge** - Wer ist dran
2. **HP-Tracking** - Damage/Healing
3. **Conditions** - Status-Effekte mit Reminders
4. **Automatische Effekte** - Start/End-of-Turn Trigger

```
┌─────────────────────────────────────────────────────────────────┐
│  Combat Tracker                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Im Scope                        │  Nicht im Scope              │
│  ───────────────────────────────────────────────────────────────│
│  Initiative-Reihenfolge          │  Wuerfeln fuer Spieler       │
│  HP-Tracking                     │  Trefferwuerfe berechnen     │
│  Conditions als Tags             │  Damage-Resistenzen anwenden │
│  Automatische Effekte            │  Taktische Entscheidungen    │
│  Konzentration Tracking          │  Grid-Positioning (Post-MVP) │
│                                  │  Death Saves (Spieler-Sache) │
└─────────────────────────────────────────────────────────────────┘
```

---

## Combat-Flow

```
combat:start-requested
    │
    ├── GM traegt Initiative-Werte ein (gewuerfelt am Tisch)
    │
    └── combat:started { participants, initiativeOrder }

Pro Runde:
    │
    ├── combat:turn-changed { participantId, roundNumber }
    │   │
    │   ├── UI zeigt Start-of-Turn Effekte
    │   │   └── "Goblin: Save DC 13 DEX oder 2d4 acid"
    │   │
    │   └── GM fuehrt Zug aus (am Tisch)
    │
    ├── GM klickt "Zug beenden"
    │
    └── combat:turn-changed { participantId } (naechster Teilnehmer)
        │
        └── UI zeigt End-of-Turn Effekte

combat:end-requested
    │
    ├── Encounter resolved
    │
    └── combat:completed
        │
        └── XP-Berechnung, Loot-Generierung
```

---

## Schemas

### CombatState

```typescript
interface CombatState {
  status: 'idle' | 'active';
  encounterId?: EntityId<'encounter'>;

  // Teilnehmer
  participants: CombatParticipant[];
  initiativeOrder: string[];      // Sortierte participant IDs

  // Aktueller Stand
  currentTurnIndex: number;
  roundNumber: number;
}

interface CombatParticipant {
  id: string;
  type: 'character' | 'creature';
  entityId: EntityId<'character' | 'creature'>;

  name: string;
  initiative: number;

  // HP-Tracking
  maxHp: number;
  currentHp: number;

  // Status
  conditions: Condition[];
  effects: CombatEffect[];

  // Konzentration
  concentratingOn?: string;  // Spell-Name

  // Note: Death Saves werden vom Spieler getrackt, nicht im Combat-Tracker
}
```

### Conditions

D&D 5e Standard-Conditions mit automatischen Reminders:

```typescript
type ConditionType =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious'
  | 'exhaustion';

interface Condition {
  type: ConditionType;
  sourceId?: string;           // Wer hat's verursacht
  duration?: number;           // Runden, oder undefined fuer permanent
  reminder: string;            // Automatischer Reminder-Text
}

// Condition-Reminders
const CONDITION_REMINDERS: Record<ConditionType, string> = {
  blinded: "Can't see. Attack rolls have disadvantage. Attacks against have advantage.",
  charmed: "Can't attack charmer. Charmer has advantage on social checks.",
  frightened: "Disadvantage on checks/attacks while source visible. Can't move closer.",
  poisoned: "Disadvantage on attack rolls and ability checks.",
  prone: "Disadvantage on attacks. Melee attacks have advantage, ranged disadvantage.",
  stunned: "Incapacitated. Can't move. Auto-fail STR/DEX saves.",
  unconscious: "Incapacitated, drops items, falls prone. Auto-crit if within 5ft.",
  // ... etc.
};
```

### CombatEffect

Effekte die am Anfang/Ende einer Runde ausgeloest werden:

```typescript
interface CombatEffect {
  id: string;
  name: string;                           // "Tasha's Caustic Brew"
  targetId: string;                       // Participant ID

  trigger: 'start-of-turn' | 'end-of-turn';

  effect: {
    type: 'damage' | 'save' | 'condition-end' | 'custom';
    damage?: {
      dice: string;                       // "2d4"
      type: string;                       // "acid"
    };
    save?: {
      ability: AbilityKey;
      dc: number;
      onSuccess: 'end' | 'half-damage';
    };
    description: string;                  // Fuer GM-Anzeige
  };

  duration?: number;                      // Runden verbleibend
  sourceId?: string;                      // Wer hat's verursacht
}

type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
```

---

## Initiative

### Eingabe

Initiative wird vom GM eingetragen (gewuerfelt am Tisch):

```
┌─────────────────────────────────────────────────────────┐
│  Initiative eintragen                                    │
├─────────────────────────────────────────────────────────┤
│  Thorin (Fighter)       [  18  ]                        │
│  Elara (Wizard)         [  12  ]                        │
│  Goblin Boss            [  15  ]                        │
│  Goblin Minion ×3       [   8  ]                        │
├─────────────────────────────────────────────────────────┤
│  [Combat starten]                                        │
└─────────────────────────────────────────────────────────┘
```

### Sortierung

```typescript
function sortByInitiative(participants: CombatParticipant[]): string[] {
  return [...participants]
    .sort((a, b) => {
      // Hoeherer Initiative-Wert zuerst
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      // Bei Gleichstand: Characters vor Creatures
      if (a.type !== b.type) {
        return a.type === 'character' ? -1 : 1;
      }
      // Sonst: alphabetisch
      return a.name.localeCompare(b.name);
    })
    .map(p => p.id);
}
```

---

## HP-Tracking

### Damage/Heal

```typescript
function applyDamage(
  participant: CombatParticipant,
  amount: number
): void {
  const previousHp = participant.currentHp;
  participant.currentHp = Math.max(0, participant.currentHp - amount);

  eventBus.publish('combat:participant-hp-changed', {
    participantId: participant.id,
    previousHp,
    currentHp: participant.currentHp,
    change: -amount
  });

  // Konzentrations-Check bei Damage
  if (participant.concentratingOn && amount > 0) {
    const dc = Math.max(10, Math.floor(amount / 2));
    eventBus.publish('combat:concentration-check-required', {
      participantId: participant.id,
      spell: participant.concentratingOn,
      dc
    });
  }

  // Character bei 0 HP
  if (participant.currentHp === 0 && participant.type === 'character') {
    // Post-MVP: participant.deathSaves = { successes: 0, failures: 0 };
    eventBus.publish('combat:character-downed', {
      participantId: participant.id
    });
  }
}

function applyHealing(
  participant: CombatParticipant,
  amount: number
): void {
  const previousHp = participant.currentHp;
  participant.currentHp = Math.min(participant.maxHp, participant.currentHp + amount);

  eventBus.publish('combat:participant-hp-changed', {
    participantId: participant.id,
    previousHp,
    currentHp: participant.currentHp,
    change: amount
  });

  // Post-MVP: Death Saves zuruecksetzen wenn wieder bei HP > 0
  // if (previousHp === 0 && participant.currentHp > 0) {
  //   participant.deathSaves = undefined;
  // }
}
```

### Death Saves

**Entscheidung:** Nicht im Combat-Tracker

Death Saves werden vom **Spieler selbst** getrackt, nicht vom GM. Daher kein UI-Element im Combat-Tracker.

**Begruendung:**
- Death Saves sind Spieler-Verantwortung (der Spieler wuerfelt)
- GM muss nur wissen: "Charakter ist down" oder "Charakter ist tot"
- Einfaches Tracking am Charakterbogen (3 Kaestchen)
- Kein Mehrwert durch Automatisierung

**Combat-Tracker zeigt nur:**
- HP: 0 → Charakter ist "Downed" (💀 Icon)
- Spieler teilt mit wenn stabilisiert oder tot

**Events (weiterhin verfuegbar fuer Integration):**
```typescript
'combat:character-downed': { participantId: string }
'combat:character-stabilized': { participantId: string }  // Spieler teilt mit
'combat:character-died': { participantId: string }         // Spieler teilt mit
```

---

## Automatische Effekte

### Start-of-Turn

Am Anfang eines Zuges zeigt die UI relevante Effekte:

```
┌─────────────────────────────────────────────────────────┐
│  Goblin's Zug - Start-of-Turn Effekte                   │
├─────────────────────────────────────────────────────────┤
│  ⚠ Tasha's Caustic Brew                                │
│    Save: DC 13 DEX                                      │
│    Bei Fail: 2d4 acid damage                            │
│    Bei Success: Effekt endet                            │
├─────────────────────────────────────────────────────────┤
│  [Save erfolgt] [Save fehlgeschlagen]                   │
└─────────────────────────────────────────────────────────┘
```

### End-of-Turn

Am Ende eines Zuges:

```
┌─────────────────────────────────────────────────────────┐
│  Thorin's Zug - End-of-Turn Effekte                     │
├─────────────────────────────────────────────────────────┤
│  ⚠ Held Person                                          │
│    Save: DC 15 WIS                                      │
│    Bei Success: Effekt endet                            │
├─────────────────────────────────────────────────────────┤
│  [Save erfolgt] [Save fehlgeschlagen] [Zug beenden]     │
└─────────────────────────────────────────────────────────┘
```

### Effekt-Verarbeitung

```typescript
function processTurnStart(participant: CombatParticipant): CombatEffect[] {
  return participant.effects.filter(e => e.trigger === 'start-of-turn');
}

function processTurnEnd(participant: CombatParticipant): void {
  // Duration reduzieren
  for (const effect of participant.effects) {
    if (effect.duration !== undefined) {
      effect.duration--;
      if (effect.duration <= 0) {
        removeEffect(participant, effect.id);
      }
    }
  }

  // Condition-Duration reduzieren
  for (const condition of participant.conditions) {
    if (condition.duration !== undefined) {
      condition.duration--;
      if (condition.duration <= 0) {
        removeCondition(participant, condition.type);
      }
    }
  }
}
```

---

## GM-Interface

### Combat-Tracker UI

```
┌─────────────────────────────────────────────────────────┐
│  Combat - Runde 2                                        │
├─────────────────────────────────────────────────────────┤
│  ► Thorin (18)        HP: 45/52   [Poisoned]            │
│    Elara (12)         HP: 28/28   [Concentrating: Haste]│
│    Goblin Boss (15)   HP: 12/35   [Frightened]          │
│    Goblin ×2 (8)      HP: 7/7, 0/7 ☠                   │
├─────────────────────────────────────────────────────────┤
│  [Damage] [Heal] [Condition] [Effect] [End Turn]        │
└─────────────────────────────────────────────────────────┘

► = Aktueller Zug
☠ = Tot
```

### Initiative-Layout

**Entscheidung:** Vertikale Liste

Die Initiative wird als vertikale Liste dargestellt (nicht horizontal oder als Ring):

```
┌───────────────────────────────────────┐
│ ▶ Goblin Boss              [18]      │  ← aktiv (hervorgehoben)
├───────────────────────────────────────┤
│   Thorin                   [15]      │
├───────────────────────────────────────┤
│   Elara                    [12]      │
├───────────────────────────────────────┤
│   Goblin 1                 [10]      │
├───────────────────────────────────────┤
│   Goblin 2  💀             [ 8]      │  ← tot (ausgegraut)
└───────────────────────────────────────┘
```

**Vorteile:**
- Klare Reihenfolge auf einen Blick
- Einfache Scroll-Navigation bei vielen Teilnehmern
- Platz fuer HP, Conditions, Aktionen pro Zeile
- Natuerliche Top-to-Bottom Leserichtung

### Conditions-UI

**Entscheidung:** Icons mit Tooltip

Conditions werden als kompakte Icons dargestellt. Details erscheinen beim Hovern.

```
┌───────────────────────────────────────────────────────┐
│  Goblin Boss  🔥 💀  HP: 15/30                        │
│               ↑  ↑                                    │
│         [Tooltip bei Hover]                           │
└───────────────────────────────────────────────────────┘

Hover ueber 🔥:
┌─────────────────────────────────────────────────────┐
│  Burning (2 Runden)                                  │
│  ────────────────────────────────────────────────── │
│  Source: Elara (Scorching Ray)                       │
│  Start of Turn: 1d6 fire damage                      │
└─────────────────────────────────────────────────────┘
```

**Condition-Icons:**

| Condition | Icon | Farbe |
|-----------|------|-------|
| Blinded | 👁️‍🗨️ | Grau |
| Charmed | 💖 | Pink |
| Deafened | 🔇 | Grau |
| Frightened | 💀 | Gelb |
| Grappled | 🤝 | Orange |
| Incapacitated | ⚡ | Grau |
| Invisible | 👻 | Hellblau |
| Paralyzed | ⚡ | Gelb |
| Petrified | 🗿 | Grau |
| Poisoned | 🤢 | Gruen |
| Prone | ⬇️ | Braun |
| Restrained | ⛓️ | Grau |
| Stunned | 💫 | Gelb |
| Unconscious | 😴 | Dunkelblau |
| Exhaustion | 😩 | Orange (1-6) |
| Concentrating | 🔮 | Violett |

**Custom-Effekte** (Brennen, Gift-DoT, etc.) nutzen generische Icons:
- 🔥 Damage-over-Time
- 🛡️ Buff
- ⚠️ Debuff

### Condition-Hinzufuegen

```
┌─────────────────────────────────────────────────────────┐
│  Condition hinzufuegen: Goblin Boss                      │
├─────────────────────────────────────────────────────────┤
│  Condition: [Frightened     ▼]                          │
│  Quelle:    [Thorin         ▼]                          │
│  Dauer:     [1 Minute (10 Runden)]                      │
├─────────────────────────────────────────────────────────┤
│  [Hinzufuegen] [Abbrechen]                              │
└─────────────────────────────────────────────────────────┘
```

---

## Events

```typescript
// Combat-Lifecycle
'combat:start-requested': { encounterId: EntityId<'encounter'> }
'combat:started': { participants: CombatParticipant[]; initiativeOrder: string[] }
'combat:end-requested': {}
'combat:completed': { xpAwarded: number; roundsTotal: number }

// Zuege
'combat:turn-changed': { participantId: string; roundNumber: number }

// HP
'combat:participant-hp-changed': {
  participantId: string;
  previousHp: number;
  currentHp: number;
  change: number;
}

// Character-spezifisch
'combat:character-downed': { participantId: string }
'combat:character-stabilized': { participantId: string }  // Spieler teilt GM mit
'combat:character-died': { participantId: string }         // Spieler teilt GM mit

// Effekte
'combat:concentration-check-required': {
  participantId: string;
  spell: string;
  dc: number;
}
'combat:concentration-broken': {
  participantId: string;
  spell: string;
}
'combat:effect-added': { participantId: string; effect: CombatEffect }
'combat:effect-removed': { participantId: string; effectId: string }

// Conditions
'combat:condition-added': { participantId: string; condition: Condition }
'combat:condition-removed': { participantId: string; conditionType: ConditionType }
```

---

## Combat ↔ Calendar Handoff

Combat-Zeit wird automatisch zum Calendar addiert, um konsistentes Zeit-Tracking zu gewaehrleisten.

### Zeit-Berechnung

```typescript
// Bei Combat-Ende wird Zeit automatisch vorgerueckt
const SECONDS_PER_ROUND = 6;

function calculateCombatDuration(roundNumber: number): Duration {
  return { seconds: roundNumber * SECONDS_PER_ROUND };
}

// Beispiel: 10 Runden Combat = 60 Sekunden = 1 Minute Calendar-Zeit
```

### Event-Flow

```
combat:completed
    │
    ├── Combat-Feature berechnet Duration
    │   └── duration = roundNumber × 6 Sekunden
    │
    ├── Published: time:advance-requested
    │   └── { duration: { seconds: X }, reason: 'combat' }
    │
    ├── Calendar-System verarbeitet Zeit-Aenderung
    │   └── Published: time:state-changed
    │
    └── Andere Features reagieren auf Zeit-Aenderung
        ├── Weather: Pruefen ob neues Segment
        ├── Travel: Zeitbasierte Updates
        └── WorldEvents: Pruefen ob Events faellig
```

### Automatisches Verhalten

| Situation | Verhalten |
|-----------|-----------|
| Combat endet normal | Zeit wird automatisch vorgerueckt |
| Combat wird abgebrochen | Zeit wird vorgerueckt (bis zum Abbruch-Punkt) |
| Combat bei 0 Runden beendet | Keine Zeit-Aenderung |

**Hinweis:** Der GM kann die Zeit nach Combat manuell anpassen, falls die automatische Berechnung nicht passt (z.B. bei sehr langen In-Combat-Verhandlungen).

---

## Post-Combat Resolution

Nach `combat:end-requested` startet der Resolution-Flow im DetailView (Combat-Tab).

### Event-Sequenz

```
GM klickt [End Combat]
    │
    ▼
combat:end-requested {}
    │
    ├── Combat-Feature: XP berechnen, Zeit addieren
    │
    ▼
combat:completed { xpAwarded, roundsTotal }
    │
    ▼
DetailView wechselt zu Resolution-Modus
    │
    ├── Phase 1: XP-Summary (automatisch angezeigt)
    │   ├── GM passt XP an (+/-%)
    │   └── User: [Weiter] oder [Ueberspringen]
    │
    ├── Phase 2: Quest-Zuweisung (nur bei aktiven Quests)
    │   └── User waehlt Quest oder ueberspringt
    │       └── quest:xp-accumulated { questId, amount }
    │
    └── Phase 3: Loot-Verteilung
        └── User verteilt Loot oder ueberspringt
            └── loot:distributed { items, recipients }
    │
    ▼
encounter:resolved { encounterId, xpAwarded }
```

### XP-Berechnung

XP wird automatisch gleichmaessig auf Party-Mitglieder verteilt. GM kann Gesamt-XP anpassen:

```typescript
// GM kann Prozent-Modifier setzen (-50% bis +100% empfohlen)
const baseXP = calculateEncounterXP(defeatedCreatures);
const adjustedXP = Math.floor(baseXP * (1 + gmModifierPercent / 100));
const xpPerCharacter = Math.floor(adjustedXP / partySize);

// 40/60 Split bei Quest-Encounter
const immediateXP = Math.floor(adjustedXP * 0.4);    // Sofort vergeben
const questPoolXP = Math.floor(adjustedXP * 0.6);    // In Quest-Pool oder verfallen

// Typische Anpassungen:
// -10%: Encounter war einfacher als erwartet
// +25%: Besonders clevere Taktik belohnen
// +50%: Story-relevanter Encounter
```

### Ueberspringen-Verhalten

| Phase | Bei Ueberspringen |
|-------|-------------------|
| XP-Summary | XP wird trotzdem vergeben (Basis-XP ohne Anpassung) |
| Quest-Zuweisung | Quest-Pool XP (60%) verfallen |
| Loot-Verteilung | Loot verfaellt |

**Prinzip:** GM hat volle Kontrolle. System zeigt Optionen, GM entscheidet durch Ueberspringen/Bestaetigen.

→ UI-Details: [DetailView.md](../application/DetailView.md#post-combat-resolution)

---

## Was NICHT automatisiert wird

| Aspekt | Grund |
|--------|-------|
| Wuerfelergebnisse | Spieler wuerfeln am Tisch |
| Trefferwuerfe berechnen | GM-Ermessen bei Modifikatoren |
| Damage-Resistenzen | GM-Ermessen |
| Taktische Entscheidungen | Kreative GM-Arbeit |
| Spell-Effekte anwenden | Zu komplex, variabel |

**Prinzip:** Das Plugin ist ein Merkzettel, kein Spielleiter.

---

## Post-MVP Erweiterungen

| Feature | Beschreibung | Prioritaet |
|---------|--------------|------------|
| Resumable Combat State | Combat-State bei Plugin-Reload wiederherstellen | Mittel |
| Grid-Positioning | Positionierung auf Battle-Map | Mittel |
| Legendary Actions | Tracking fuer Boss-Kreaturen | Niedrig |
| Lair Actions | Automatische Trigger | Niedrig |
| Reaction-Tracking | Wer hat Reaction verbraucht | Niedrig |
| Spell Slot Tracking | Automatische Reduktion | Niedrig |

### Resumable Combat State (Skizze)

Bei Plugin-Reload kann der aktive Combat wiederhergestellt werden:

**Persistiert (Plugin-Data):**
- `initiativeOrder[]` - Sortierte Participant-IDs
- `currentTurnIndex` - Wer ist dran
- `roundNumber` - Aktuelle Runde

**Pro Participant:**
- `currentHp` - Aktueller HP-Stand
- `conditions[]` - Aktive Conditions

**Nicht persistiert (zu volatil):**
- `effects[]` - Komplexe Effekte mit Triggern
- Concentration-State - Spell-spezifisch

**Validierung bei Restore:**
- Pruefen ob alle Participants noch existieren (Creature/Character nicht geloescht)
- Bei Inkonsistenz: Combat verwerfen, User benachrichtigen

---

*Siehe auch: [Character-System.md](Character-System.md) | [Encounter-Balancing.md](Encounter-Balancing.md) | [Encounter-System.md](Encounter-System.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 300 | ✅ | Combat | core | CombatState Interface implementieren | hoch | Ja | - | Combat-System.md#combatstate | src/core/schemas/combat.ts:combatStateSchema |
| 302 | ✅ | Combat | core | ConditionType + CONDITION_REMINDERS implementieren | hoch | Ja | - | Combat-System.md#conditions | src/core/schemas/combat.ts:conditionTypeSchema, src/core/schemas/combat.ts:CONDITION_REMINDERS |
| 304 | ✅ | Combat | core | AbilityKey Type definieren | hoch | Ja | - | Combat-System.md#combateffect, Character-System.md#character-schema | src/core/schemas/combat.ts:abilityKeySchema |
| 305 | ✅ | Combat | features | Combat State Machine: idle → active → idle | hoch | Ja | #300 | Combat-System.md#combat-flow | src/features/combat/combat-service.ts:startCombat(), src/features/combat/combat-service.ts:endCombat() |
| 307 | ✅ | Combat | features | sortByInitiative(): Höherer Wert zuerst, Tie-breaker | hoch | Ja | #301 | Combat-System.md#sortierung, Character-System.md#combat-tracker | src/features/combat/combat-store.ts:startCombat() (Zeile 106) |
| 309 | ✅ | Combat | features | applyHealing(): HP erhöhen (max: maxHp) | hoch | Ja | #301 | Combat-System.md#damage-heal, Character-System.md#hp-tracking | src/features/combat/combat-service.ts:applyHealing() |
| 311 | ✅ | Combat | features | Character-Downed Event bei HP = 0 | hoch | Ja | #308 | Combat-System.md#death-saves, Character-System.md#hp-tracking | src/features/combat/combat-service.ts:publishCharacterDowned() (in applyDamage) |
| 313 | ✅ | Combat | features | Condition entfernen (removeCondition) | hoch | Ja | #302 | Combat-System.md#conditions | src/features/combat/combat-service.ts:removeCondition(), src/features/combat/combat-store.ts:removeCondition() |
| 315 | ✅ | Combat | features | CombatEffect hinzufügen (addEffect) | hoch | Ja | #303 | Combat-System.md#combateffect | src/features/combat/combat-service.ts:addEffect(), src/features/combat/combat-store.ts:addEffect() |
| 317 | ✅ | Combat | features | processTurnStart(): Start-of-Turn Effekte sammeln | hoch | Ja | #315 | Combat-System.md#start-of-turn | src/features/combat/combat-utils.ts:getStartOfTurnEffects() |
| 319 | ✅ | Combat | features | nextTurn(): Zum nächsten Participant wechseln | hoch | Ja | #307 | Combat-System.md#combat-flow | src/features/combat/combat-service.ts:nextTurn() |
| 321 | ✅ | Combat | features | combat:start-requested Handler implementieren | hoch | Ja | #225, #305 | Combat-System.md#combat-flow, Encounter-System.md#integration | src/features/combat/combat-service.ts:setupEventHandlers() (Zeile 205-217) |
| 323 | ✅ | Combat | features | combat:end-requested Handler implementieren | hoch | Ja | #305 | Combat-System.md#events | src/features/combat/combat-service.ts:setupEventHandlers() (Zeile 220-225) |
| 324 | ✅ | Combat | features | combat:completed Event publizieren mit xpAwarded, roundsTotal | hoch | Ja | #323 | Combat-System.md#events, Combat-System.md#post-combat-resolution | src/features/combat/combat-service.ts:publishCombatCompleted() |
| 326 | ✅ | Combat | features | combat:participant-hp-changed Event publizieren | hoch | Ja | #308, #309 | Combat-System.md#events, Character-System.md#hp-tracking | src/features/combat/combat-service.ts:publishHpChanged() |
| 328 | ⬜ | Combat | features | combat:character-stabilized Event Handler: Spieler-Input verarbeiten (0 HP → Stabilisiert) | hoch | Ja | #311 | Combat-System.md#events, Combat-System.md#death-saves | src/features/combat/combat-service.ts:publishCharacterStabilized() [neu] |
| 330 | ✅ | Combat | features | combat:concentration-check-required Event publizieren | hoch | Ja | #310 | Combat-System.md#events | src/features/combat/combat-service.ts:publishConcentrationCheckRequired() |
| 332 | ✅ | Combat | features | combat:effect-added Event publizieren | hoch | Ja | #315 | Combat-System.md#events | src/features/combat/combat-service.ts:addEffect() (Zeile 542-545) |
| 334 | ✅ | Combat | features | combat:condition-added Event publizieren | hoch | Ja | #312 | Combat-System.md#events | src/features/combat/combat-service.ts:publishConditionAdded() |
| 336 | ✅ | Combat | features | calculateCombatDuration(): roundNumber × 6 Sekunden | hoch | Ja | #324 | Combat-System.md#zeit-berechnung, Time-System.md#zeit-operationen | src/features/combat/combat-utils.ts:calculateCombatDuration() |
| 338 | ✅ | Combat | features | XP-Berechnung: Basis-XP aus besiegten Kreaturen | hoch | Ja | #324 | Combat-System.md#xp-berechnung, Encounter-System.md#typ-spezifisches-verhalten | src/features/combat/combat-utils.ts:calculateCombatXp(), src/features/combat/combat-utils.ts:getXpForCr() |
| 340 | ✅ | Combat | features | 40/60 XP-Split: 40% sofort, 60% Quest-Pool | hoch | Ja | #338 | Combat-System.md#xp-berechnung, Quest-System.md#xp-verteilung | src/features/combat/types.ts:CombatResult (UI-Integration offen) |
| 343 | ⛔ | Combat | application | encounter:resolved Event nach Resolution-Flow | hoch | Ja | #223, #338, #2431, #2441 | Combat-System.md#post-combat-resolution, Encounter-System.md#events, DetailView.md#post-combat-resolution | DetailView/Resolution-UI [neu] (UI-Verantwortung, nicht Combat-Service) |
| 345 | ⬜ | Combat | features | Grid-Positioning: Positionierung auf Battle-Map (Post-MVP) | mittel | Nein | #301 | Combat-System.md#post-mvp-erweiterungen | src/features/combat/types.ts:CombatParticipant.position [neu], UI-Grid [neu] |
| 347 | ⬜ | Combat | features | Lair Actions: Automatische Trigger (Post-MVP) | niedrig | Nein | #300 | Combat-System.md#post-mvp-erweiterungen | src/features/combat/types.ts:CombatState.lairActions [neu] |
| 349 | ⬜ | Combat | features | Spell Slot Tracking: Automatische Reduktion (Post-MVP) | niedrig | Nein | #301 | Combat-System.md#post-mvp-erweiterungen, Character-System.md#post-mvp-erweiterungen | src/features/combat/combat-service.ts:trackSpellSlot() [neu], Character-Integration [neu] |
| 301 | ✅ | Combat | core | CombatParticipant Interface implementieren | hoch | Ja | #300 | Combat-System.md#combatstate | src/core/schemas/combat.ts:combatParticipantSchema |
| 303 | ✅ | Combat | core | CombatEffect Interface implementieren | hoch | Ja | #301 | Combat-System.md#combateffect | src/core/schemas/combat.ts:combatEffectSchema |
| 306 | ✅ | Combat | features | Initiative-Eingabe: GM trägt Werte ein | hoch | Ja | #301 | Combat-System.md#eingabe | src/features/combat/combat-service.ts:updateInitiative(), src/features/combat/combat-store.ts:updateInitiative() |
| 308 | ✅ | Combat | features | applyDamage(): HP reduzieren, Events publizieren | hoch | Ja | #301 | Combat-System.md#damageheal | src/features/combat/combat-service.ts:applyDamage() |
| 310 | ✅ | Combat | features | Konzentrations-Check bei Damage: DC = max(10, damage/2) | hoch | Ja | #308 | Combat-System.md#damageheal | src/features/combat/combat-utils.ts:calculateConcentrationDc(), src/features/combat/combat-utils.ts:needsConcentrationCheck() |
| 312 | ✅ | Combat | features | Condition hinzufügen (addCondition) | hoch | Ja | #302 | Combat-System.md#conditions | src/features/combat/combat-service.ts:addCondition(), src/features/combat/combat-store.ts:addCondition() |
| 314 | ✅ | Combat | features | Condition-Duration bei Turn-Ende reduzieren | hoch | Ja | #312 | Combat-System.md#effekt-verarbeitung | src/features/combat/combat-store.ts:decrementConditionDurations() (in nextTurn) |
| 316 | ✅ | Combat | features | CombatEffect entfernen (removeEffect) | hoch | Ja | #303 | Combat-System.md#combateffect | src/features/combat/combat-service.ts:removeEffect(), src/features/combat/combat-store.ts:removeEffect() |
| 318 | ✅ | Combat | features | processTurnEnd(): Effect-Duration reduzieren | hoch | Ja | #315 | Combat-System.md#effekt-verarbeitung | src/features/combat/combat-store.ts:decrementEffectDurations() (in nextTurn) |
| 320 | ✅ | Combat | features | Round-Tracking: roundNumber incrementieren bei Umlauf | hoch | Ja | #319 | Combat-System.md#combat-flow | src/features/combat/combat-store.ts:advanceTurn() |
| 322 | ✅ | Combat | - | combat:started Event publizieren | hoch | Ja | #321 | Combat-System.md#events | src/features/combat/combat-service.ts:publishCombatStarted() |
| 325 | ✅ | Combat | features | combat:turn-changed Event publizieren | hoch | Ja | #319 | Combat-System.md#events | src/features/combat/combat-service.ts:publishTurnChanged() |
| 327 | ✅ | Combat | features | combat:character-downed Event publizieren | hoch | Ja | #311 | Combat-System.md#events | src/features/combat/combat-service.ts:publishCharacterDowned() |
| 329 | ⬜ | Combat | features | combat:character-died Event Handler: Spieler-Input verarbeiten (0 HP → Tod) | hoch | Ja | #328 | Combat-System.md#events, Combat-System.md#death-saves | src/features/combat/combat-service.ts:publishCharacterDied() [neu] |
| 331 | ✅ | Combat | features | combat:concentration-broken Event publizieren | hoch | Ja | #330 | Combat-System.md#events | src/features/combat/combat-service.ts:publishConcentrationBroken() |
| 333 | ✅ | Combat | features | combat:effect-removed Event publizieren | hoch | Ja | #316 | Combat-System.md#events | src/features/combat/combat-service.ts:removeEffect() (Zeile 573-576) |
| 335 | ✅ | Combat | features | combat:condition-removed Event publizieren | hoch | Ja | #313 | Combat-System.md#events | src/features/combat/combat-service.ts:publishConditionRemoved() |
| 337 | ✅ | Combat | features | time:advance-requested bei combat:completed publizieren | hoch | Ja | #336 | Combat-System.md#event-flow-1 | src/features/combat/combat-service.ts:publishTimeAdvance() (in endCombat) |
| 339 | ✅ | Combat | features | GM XP-Modifier: ±% Anpassung | hoch | Ja | #338 | Combat-System.md#xp-berechnung | src/features/combat/types.ts:CombatResult (UI integriert Modifier) |
| 342 | ⛔ | Combat | application | loot:distributed Event bei Loot-Verteilung | hoch | Ja | #324, #2437, #2441 | Combat-System.md#event-sequenz | DetailView/Resolution-UI [neu] (UI-Verantwortung, nicht Combat-Service) |
| 344 | ⬜ | Combat | features | Resumable Combat State: initiativeOrder, currentTurnIndex, roundNumber, currentHp, conditions persistieren bei Plugin-Reload | mittel | Nein | #305 | Combat-System.md#resumable-combat-state-skizze | src/features/combat/combat-service.ts:restoreCombat() [neu], Plugin-Daten-Integration [neu] |
| 346 | ⬜ | Combat | features | Legendary Actions: Tracking für Boss-Kreaturen (Post-MVP) | niedrig | Nein | #301 | Combat-System.md#post-mvp-erweiterungen | src/features/combat/types.ts:CombatParticipant.legendaryActions [neu] |
| 348 | ⬜ | Combat | features | Reaction-Tracking: Wer hat Reaction verbraucht (Post-MVP) | niedrig | Nein | #301 | Combat-System.md#post-mvp-erweiterungen | src/features/combat/types.ts:CombatParticipant.reactionUsed [neu] |
| 3034 | ⬜ | Combat | - | Concentrating-Tag visuell anzeigen: 🔮 Icon mit Spell-Name | hoch | Nein | #312, #2421 | Combat-System.md#gm-interface, Combat-System.md#conditions-ui | combat-tab.ts:renderConcentration() [neu], participant-row.ts [ändern] |
| 3035 | ⬜ | Combat | - | Condition Icons + Tooltips rendern (gemäß Icon-Mapping) | hoch | --spec | #302, #2421 | - | combat-tab.ts:renderConditionIcon() [neu], condition-tooltip.ts [neu] |
| 3036 | ⬜ | Combat | - | Start-of-Turn Effects UI: Effekt-Liste mit Aktionen anzeigen | hoch | --spec | #317, #2421 | - | combat-tab.ts:renderStartOfTurnEffects() [neu], turn-effect-dialog.ts [neu] |
| 3037 | ⬜ | Combat | - | End-of-Turn Effects UI: Save-Dialoge anzeigen | hoch | --spec | #318, #2421 | - | combat-tab.ts:renderEndOfTurnEffects() [neu], save-prompt-dialog.ts [neu] |
| 3038 | ⬜ | Combat | - | Concentration Break Handler: concentratingOn zurücksetzen | hoch | --spec | #331 | - | src/features/combat/combat-service.ts:breakConcentration() [neu] |
