---
smType: creature
name: Basilisk
size: Medium
type: Monstrosity
alignmentOverride: Unaligned
ac: "15"
initiative: "-1 (9)"
hp: "52"
hitDice: 8d8 + 16
speeds:
  - type: walk
    value: "20"
abilities:
  - ability: str
    score: 16
  - ability: dex
    score: 8
  - ability: con
    score: 15
  - ability: int
    score: 2
  - ability: wis
    score: 8
  - ability: cha
    score: 7
pb: "+2"
cr: "3"
xp: "700"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "9"
entries:
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage plus 7 (2d6) Poison damage."
  - category: bonus
    name: Petrifying Gaze (Recharge 4-6)
    text: "*Constitution Saving Throw*: DC 12, each creature in a 30-foot Cone. If the basilisk sees its reflection within the Cone, the basilisk must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition."

---

# Basilisk
*Medium, Monstrosity, Unaligned*

**AC** 15
**HP** 52 (8d8 + 16)
**Initiative** -1 (9)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 16 | 8 | 15 | 2 | 8 | 7 |

**Senses** darkvision 60 ft.; Passive Perception 9
CR 3, PB +2, XP 700

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage plus 7 (2d6) Poison damage.

## Bonus Actions

**Petrifying Gaze (Recharge 4-6)**
*Constitution Saving Throw*: DC 12, each creature in a 30-foot Cone. If the basilisk sees its reflection within the Cone, the basilisk must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.
