---
smType: creature
name: Cockatrice
size: Small
type: Monstrosity
alignmentOverride: Unaligned
ac: "11"
initiative: +1 (11)
hp: "22"
hitDice: 5d6 + 5
speeds:
  - type: walk
    value: "20"
  - type: fly
    value: "40"
abilities:
  - ability: str
    score: 6
  - ability: dex
    score: 12
  - ability: con
    score: 12
  - ability: int
    score: 2
  - ability: wis
    score: 13
  - ability: cha
    score: 5
pb: "+2"
cr: 1/2
xp: "100"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "11"
damageImmunitiesList:
  - value: Petrified
entries:
  - category: action
    name: Petrifying Bite
    text: "*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Piercing damage. If the target is a creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *First Failure* The target has the Restrained condition. The target repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition, instead of the Restrained condition, for 24 hours."

---

# Cockatrice
*Small, Monstrosity, Unaligned*

**AC** 11
**HP** 22 (5d6 + 5)
**Initiative** +1 (11)
**Speed** 20 ft., fly 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 6 | 12 | 12 | 2 | 13 | 5 |

**Senses** darkvision 60 ft.; Passive Perception 11
CR 1/2, PB +2, XP 100

## Actions

**Petrifying Bite**
*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Piercing damage. If the target is a creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *First Failure* The target has the Restrained condition. The target repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition, instead of the Restrained condition, for 24 hours.
