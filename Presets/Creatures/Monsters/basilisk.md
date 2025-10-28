---
smType: creature
name: Basilisk
size: Medium
type: Monstrosity
alignmentOverride: Unaligned
ac: '15'
initiative: '-1 (9)'
hp: '52'
hitDice: 8d8 + 16
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
cr: '3'
xp: '700'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage plus 7 (2d6) Poison damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Piercing
          average: 10
        - dice: 2d6
          bonus: 0
          type: Poison
          average: 7
      reach: 5 ft.
  - category: bonus
    name: Petrifying Gaze (Recharge 4-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 12, each creature in a 30-foot Cone. If the basilisk sees its reflection within the Cone, the basilisk must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.'
    recharge: 4-6
    save:
      ability: con
      dc: 12
---

# Basilisk
*Medium, Monstrosity, Unaligned*

**AC** 15
**HP** 52 (8d8 + 16)
**Initiative** -1 (9)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 9
CR 3, PB +2, XP 700

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage plus 7 (2d6) Poison damage.

## Bonus Actions

**Petrifying Gaze (Recharge 4-6)**
*Constitution Saving Throw*: DC 12, each creature in a 30-foot Cone. If the basilisk sees its reflection within the Cone, the basilisk must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.
