---
smType: creature
name: Swarm of Ravens
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '11'
hitDice: 2d8 + 2
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 50 ft.
abilities:
  - key: str
    score: 6
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
passivesList:
  - skill: Perception
    value: '15'
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
conditionImmunitiesList:
  - value: Charmed
  - value: Frightened
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Prone
  - value: Restrained
  - value: Stunned
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Swarm
    entryType: special
    text: The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny raven. The swarm can't regain Hit Points or gain Temporary Hit Points.
  - category: action
    name: Beaks
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
        - dice: 1d4
          bonus: 0
          type: Piercing
          average: 2
      reach: 5 ft.
  - category: action
    name: Cacophony
    entryType: save
    text: '*Wisdom Saving Throw*: DC 10, one creature in the swarm''s space. *Failure:*  The target has the Deafened condition until the start of the swarm''s next turn. While Deafened, the target also has Disadvantage on ability checks and attack rolls.'
    save:
      ability: wis
      dc: 10
      targeting:
        type: single
      area: one creature in the swarm's space
      onFail:
        effects:
          conditions:
            - condition: Deafened
              duration:
                type: until
                trigger: the start of the swarm's next turn
          mechanical:
            - type: disadvantage
              target: ability checks
              description: has Disadvantage on ability checks and
            - type: advantage
              target: ability checks
              description: advantage on ability checks and
          other: The target has the Deafened condition until the start of the swarm's next turn. While Deafened, the target also has Disadvantage on ability checks and attack rolls.
        legacyEffects: The target has the Deafened condition until the start of the swarm's next turn. While Deafened, the target also has Disadvantage on ability checks and attack rolls.
---

# Swarm of Ravens
*Medium, Beast, Unaligned*

**AC** 12
**HP** 11 (2d8 + 2)
**Initiative** +2 (12)
**Speed** 10 ft., fly 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/4, PB +2, XP 50

## Traits

**Swarm**
The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny raven. The swarm can't regain Hit Points or gain Temporary Hit Points.

## Actions

**Beaks**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied.

**Cacophony (Recharge 6)**
*Wisdom Saving Throw*: DC 10, one creature in the swarm's space. *Failure:*  The target has the Deafened condition until the start of the swarm's next turn. While Deafened, the target also has Disadvantage on ability checks and attack rolls.
