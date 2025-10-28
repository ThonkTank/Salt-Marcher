---
smType: creature
name: Brown Bear
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '22'
hitDice: 3d10 + 6
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
cr: '1'
xp: '200'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The bear makes one Bite attack and one Claw attack.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Bite
          count: 1
        - name: Claw
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Piercing
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d4
          bonus: 3
          type: Slashing
          average: 5
      reach: 5 ft.
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

# Brown Bear
*Large, Beast, Unaligned*

**AC** 11
**HP** 22 (3d10 + 6)
**Initiative** +1 (11)
**Speed** 40 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 1, PB +2, XP 200

## Actions

**Multiattack**
The bear makes one Bite attack and one Claw attack.

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage.

**Claw**
*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.
