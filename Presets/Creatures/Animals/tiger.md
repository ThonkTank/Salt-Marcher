---
smType: creature
name: Tiger
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '30'
hitDice: 4d10 + 8
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
  - skill: Stealth
    value: '7'
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
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Slashing
          average: 10
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
  - category: bonus
    name: Nimble Escape
    entryType: special
    text: The tiger takes the Disengage or Hide action.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Tiger
*Large, Beast, Unaligned*

**AC** 13
**HP** 30 (4d10 + 8)
**Initiative** +3 (13)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 1, PB +2, XP 200

## Actions

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.

## Bonus Actions

**Nimble Escape**
The tiger takes the Disengage or Hide action.
