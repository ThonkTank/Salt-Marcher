---
smType: creature
name: Tyrannosaurus Rex
size: Huge
type: Beast
alignmentOverride: Unaligned
ac: "13"
initiative: +3 (13)
hp: "136"
hitDice: 13d12 + 52
speeds:
  - type: walk
    value: "50"
abilities:
  - ability: str
    score: 25
  - ability: dex
    score: 10
  - ability: con
    score: 19
  - ability: int
    score: 2
  - ability: wis
    score: 12
  - ability: cha
    score: 9
pb: "+3"
cr: "8"
xp: "3900"
passivesList:
  - skill: Perception
    value: "14"
entries:
  - category: action
    name: Multiattack
    text: The tyrannosaurus makes one Bite attack and one Tail attack.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +10, reach 10 ft. 33 (4d12 + 7) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17). While Grappled, the target has the Restrained condition and can't be targeted by the tyrannosaurus's Tail."
  - category: action
    name: Tail
    text: "*Melee Attack Roll:* +10, reach 15 ft. 25 (4d8 + 7) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition."

---

# Tyrannosaurus Rex
*Huge, Beast, Unaligned*

**AC** 13
**HP** 136 (13d12 + 52)
**Initiative** +3 (13)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 25 | 10 | 19 | 2 | 12 | 9 |

CR 8, PB +3, XP 3900

## Actions

**Multiattack**
The tyrannosaurus makes one Bite attack and one Tail attack.

**Bite**
*Melee Attack Roll:* +10, reach 10 ft. 33 (4d12 + 7) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17). While Grappled, the target has the Restrained condition and can't be targeted by the tyrannosaurus's Tail.

**Tail**
*Melee Attack Roll:* +10, reach 15 ft. 25 (4d8 + 7) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.
