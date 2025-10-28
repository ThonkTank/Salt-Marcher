---
smType: creature
name: Stirge
size: Small
type: Monstrosity
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '5'
hitDice: 2d4
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 40 ft.
abilities:
  - key: str
    score: 4
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
cr: 1/8
xp: '25'
entries:
  - category: action
    name: Proboscis
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Piercing damage, and the stirge attaches to the target. While attached, the stirge can''t make Proboscis attacks, and the target takes 5 (2d4) Necrotic damage at the start of each of the stirge''s turns. The stirge can detach itself by spending 5 feet of its movement. The target or a creature within 5 feet of it can detach the stirge as an action.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Piercing
          average: 6
        - dice: 2d4
          bonus: 0
          type: Necrotic
          average: 5
      reach: 5 ft.
---

# Stirge
*Small, Monstrosity, Unaligned*

**AC** 13
**HP** 5 (2d4)
**Initiative** +3 (13)
**Speed** 10 ft., fly 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 9
CR 1/8, PB +2, XP 25

## Actions

**Proboscis**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Piercing damage, and the stirge attaches to the target. While attached, the stirge can't make Proboscis attacks, and the target takes 5 (2d4) Necrotic damage at the start of each of the stirge's turns. The stirge can detach itself by spending 5 feet of its movement. The target or a creature within 5 feet of it can detach the stirge as an action.
