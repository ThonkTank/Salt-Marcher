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

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 300 | CombatState Interface implementieren | hoch | Ja | - | Combat-System.md#schemas |
| 302 | ConditionType + CONDITION_REMINDERS implementieren | hoch | Ja | - | Combat-System.md#conditions |
| 304 | AbilityKey Type definieren | hoch | Ja | - | Combat-System.md#combateffect, Character-System.md#character-schema |
| 305 | Combat State Machine: idle → active → idle | hoch | Ja | #300 | Combat-System.md#combat-flow |
| 307 | sortByInitiative(): Höherer Wert zuerst, Tie-breaker | hoch | Ja | #301 | Combat-System.md#sortierung, Character-System.md#combat-tracker |
| 309 | applyHealing(): HP erhöhen (max: maxHp) | hoch | Ja | #301 | Combat-System.md#damage-heal, Character-System.md#hp-tracking |
| 311 | Character-Downed Event bei HP = 0 | hoch | Ja | #308 | Combat-System.md#death-saves, Character-System.md#hp-tracking |
| 313 | Condition entfernen (removeCondition) | hoch | Ja | #302 | Combat-System.md#conditions |
| 315 | CombatEffect hinzufügen (addEffect) | hoch | Ja | #303 | Combat-System.md#combateffect |
| 317 | processTurnStart(): Start-of-Turn Effekte sammeln | hoch | Ja | #315 | Combat-System.md#start-of-turn |
| 319 | nextTurn(): Zum nächsten Participant wechseln | hoch | Ja | #307 | Combat-System.md#combat-flow |
| 321 | combat:start-requested Handler implementieren | hoch | Ja | #305, #225 | Combat-System.md#combat-flow, Encounter-System.md#integration |
| 323 | combat:end-requested Handler implementieren | hoch | Ja | #305 | Combat-System.md#combat-flow |
| 324 | combat:completed Event publizieren mit xpAwarded, roundsTotal | hoch | Ja | #323 | Combat-System.md#events, Combat-System.md#post-combat-resolution |
| 326 | combat:participant-hp-changed Event publizieren | hoch | Ja | #308, #309 | Combat-System.md#events, Character-System.md#hp-tracking |
| 328 | combat:character-stabilized Event publizieren | hoch | Ja | #327 | Combat-System.md#events, Combat-System.md#death-saves |
| 330 | combat:concentration-check-required Event publizieren | hoch | Ja | #310 | Combat-System.md#damage-heal |
| 332 | combat:effect-added Event publizieren | hoch | Ja | #315 | Combat-System.md#events |
| 334 | combat:condition-added Event publizieren | hoch | Ja | #312 | Combat-System.md#events |
| 336 | calculateCombatDuration(): roundNumber × 6 Sekunden | hoch | Ja | #324 | Combat-System.md#zeit-berechnung, Time-System.md#zeit-operationen |
| 338 | XP-Berechnung: Basis-XP aus besiegten Kreaturen | hoch | Ja | #324 | Combat-System.md#xp-berechnung, Encounter-System.md#typ-spezifisches-verhalten |
| 340 | 40/60 XP-Split: 40% sofort, 60% Quest-Pool | hoch | Ja | #338 | Combat-System.md#xp-berechnung, Quest-System.md#xp-verteilung |
| 341 | quest:xp-accumulated Event bei Quest-Zuweisung | hoch | Ja | #340, #412, #2430, #2435, #2441 | Combat-System.md#post-combat-resolution, Quest-System.md#quest-assignment-ui, DetailView.md#post-combat-resolution |
| 343 | encounter:resolved Event nach Resolution-Flow | hoch | Ja | #223, #338, #2431, #2441 | Combat-System.md#post-combat-resolution, Encounter-System.md#events, DetailView.md#post-combat-resolution |
| 345 | Grid-Positioning: Positionierung auf Battle-Map | mittel | Nein | - | Combat-System.md#post-mvp-erweiterungen |
| 347 | Lair Actions: Automatische Trigger | niedrig | Nein | - | Combat-System.md#post-mvp-erweiterungen |
| 349 | Spell Slot Tracking: Automatische Reduktion | niedrig | Nein | - | Combat-System.md#post-mvp-erweiterungen, Character-System.md#post-mvp-erweiterungen |
