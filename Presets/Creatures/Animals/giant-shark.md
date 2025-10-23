---
smType: creature
name: Giant Shark
size: Huge
type: Beast
alignmentOverride: Unaligned
ac: "13"
initiative: +3 (13)
hp: "92"
hitDice: 8d12 + 40
speeds:
  - type: walk
    value: "5"
  - type: swim
    value: "60"
abilities:
  - ability: str
    score: 23
  - ability: dex
    score: 11
  - ability: con
    score: 21
  - ability: int
    score: 1
  - ability: wis
    score: 10
  - ability: cha
    score: 5
pb: "+3"
cr: "5"
xp: "1800"
sensesList:
  - type: blindsight
    range: "60"
passivesList:
  - skill: Perception
    value: "13"
entries:
  - category: trait
    name: Water Breathing
    text: The shark can breathe only underwater.
  - category: action
    name: Multiattack
    text: The shark makes two Bite attacks.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +9 (with Advantage if the target doesn't have all its Hit Points), reach 5 ft. 22 (3d10 + 6) Piercing damage."

---

# Giant Shark
*Huge, Beast, Unaligned*

**AC** 13
**HP** 92 (8d12 + 40)
**Initiative** +3 (13)
**Speed** 5 ft., swim 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 23 | 11 | 21 | 1 | 10 | 5 |

**Senses** blindsight 60 ft.; Passive Perception 13
CR 5, PB +3, XP 1800

## Traits

**Water Breathing**
The shark can breathe only underwater.

## Actions

**Multiattack**
The shark makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +9 (with Advantage if the target doesn't have all its Hit Points), reach 5 ft. 22 (3d10 + 6) Piercing damage.
