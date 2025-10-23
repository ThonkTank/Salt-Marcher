---
smType: creature
name: Mammoth
size: Huge
type: Beast
alignmentOverride: Unaligned
ac: "13"
initiative: +2 (12)
hp: "126"
hitDice: 11d12 + 55
speeds:
  - type: walk
    value: "50"
abilities:
  - ability: str
    score: 24
  - ability: dex
    score: 9
  - ability: con
    score: 21
  - ability: int
    score: 3
  - ability: wis
    score: 11
  - ability: cha
    score: 6
pb: "+3"
cr: "6"
xp: "2300"
passivesList:
  - skill: Perception
    value: "10"
entries:
  - category: action
    name: Multiattack
    text: The mammoth makes two Gore attacks.
  - category: action
    name: Gore
    text: "*Melee Attack Roll:* +10, reach 10 ft. 18 (2d10 + 7) Piercing damage. If the target is a Huge or smaller creature and the mammoth moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition."
  - category: bonus
    name: Trample
    text: "*Dexterity Saving Throw*: DC 18, one creature within 5 feet that has the Prone condition. *Failure:*  29 (4d10 + 7) Bludgeoning damage. *Success:*  Half damage."

---

# Mammoth
*Huge, Beast, Unaligned*

**AC** 13
**HP** 126 (11d12 + 55)
**Initiative** +2 (12)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 24 | 9 | 21 | 3 | 11 | 6 |

CR 6, PB +3, XP 2300

## Actions

**Multiattack**
The mammoth makes two Gore attacks.

**Gore**
*Melee Attack Roll:* +10, reach 10 ft. 18 (2d10 + 7) Piercing damage. If the target is a Huge or smaller creature and the mammoth moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.

## Bonus Actions

**Trample**
*Dexterity Saving Throw*: DC 18, one creature within 5 feet that has the Prone condition. *Failure:*  29 (4d10 + 7) Bludgeoning damage. *Success:*  Half damage.
