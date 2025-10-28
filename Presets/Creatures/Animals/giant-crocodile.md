---
smType: creature
name: Giant Crocodile
size: Huge
type: Beast
alignmentOverride: Unaligned
ac: '14'
initiative: '-1 (9)'
hp: '85'
hitDice: 9d12 + 27
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 50 ft.
abilities:
  - key: str
    score: 21
    saveProf: false
  - key: dex
    score: 9
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+3'
skills:
  - skill: Stealth
    value: '5'
passivesList:
  - skill: Perception
    value: '10'
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Hold Breath
    entryType: special
    text: The crocodile can hold its breath for 1 hour.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The crocodile makes one Bite attack and one Tail attack.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Bite
          count: 1
        - name: Tail
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 5 ft. 21 (3d10 + 5) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 15). While Grappled, the target has the Restrained condition and can''t be targeted by the crocodile''s Tail.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 3d10
          bonus: 5
          type: Piercing
          average: 21
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 15
            restrictions:
              size: Large or smaller
              while: While Grappled, the target has the Restrained condition
          - condition: Restrained
            escape:
              type: dc
              dc: 15
            restrictions:
              size: Large or smaller
              while: While Grappled, the target has the Restrained condition
        other: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 15). While Grappled, the target has the Restrained condition and can't be targeted by the crocodile's Tail.
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 15). While Grappled, the target has the Restrained condition and can't be targeted by the crocodile's Tail.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Tail
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 10 ft. 18 (3d8 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 3d8
          bonus: 5
          type: Bludgeoning
          average: 18
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
        other: If the target is a Large or smaller creature, it has the Prone condition.
      additionalEffects: If the target is a Large or smaller creature, it has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Crocodile
*Huge, Beast, Unaligned*

**AC** 14
**HP** 85 (9d12 + 27)
**Initiative** -1 (9)
**Speed** 30 ft., swim 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 5, PB +3, XP 1800

## Traits

**Hold Breath**
The crocodile can hold its breath for 1 hour.

## Actions

**Multiattack**
The crocodile makes one Bite attack and one Tail attack.

**Bite**
*Melee Attack Roll:* +8, reach 5 ft. 21 (3d10 + 5) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 15). While Grappled, the target has the Restrained condition and can't be targeted by the crocodile's Tail.

**Tail**
*Melee Attack Roll:* +8, reach 10 ft. 18 (3d8 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.
