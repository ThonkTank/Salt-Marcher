---
smType: creature
name: Cockatrice
size: Small
type: Monstrosity
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '22'
hitDice: 5d6 + 5
speeds:
  walk:
    distance: 20 ft.
  fly:
    distance: 40 ft.
abilities:
  - key: str
    score: 6
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
conditionImmunitiesList:
  - value: Petrified
cr: 1/2
xp: '100'
entries:
  - category: action
    name: Petrifying Bite
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Piercing damage. If the target is a creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *First Failure* The target has the Restrained condition. The target repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition, instead of the Restrained condition, for 24 hours.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d4
          bonus: 1
          type: Piercing
          average: 3
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Restrained
            duration:
              type: hours
              count: 24
            saveToEnd:
              timing: custom
              description: at the end of its next turn if it is still Restrained
          - condition: Petrified
            duration:
              type: hours
              count: 24
            saveToEnd:
              timing: custom
              description: at the end of its next turn if it is still Restrained
      additionalEffects: 'If the target is a creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *First Failure* The target has the Restrained condition. The target repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition, instead of the Restrained condition, for 24 hours.'
---

# Cockatrice
*Small, Monstrosity, Unaligned*

**AC** 11
**HP** 22 (5d6 + 5)
**Initiative** +1 (11)
**Speed** 20 ft., fly 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 11
CR 1/2, PB +2, XP 100

## Actions

**Petrifying Bite**
*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Piercing damage. If the target is a creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *First Failure* The target has the Restrained condition. The target repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition, instead of the Restrained condition, for 24 hours.
