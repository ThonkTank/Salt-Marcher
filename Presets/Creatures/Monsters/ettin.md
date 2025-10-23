---
smType: creature
name: Ettin
size: Large
type: Giant
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "12"
initiative: "-1 (9)"
hp: "85"
hitDice: 10d10 + 30
speeds:
  - type: walk
    value: "40"
abilities:
  - ability: str
    score: 21
  - ability: dex
    score: 8
  - ability: con
    score: 17
  - ability: int
    score: 6
  - ability: wis
    score: 10
  - ability: cha
    score: 8
pb: "+2"
cr: "4"
xp: "1100"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Giant
passivesList:
  - skill: Perception
    value: "14"
damageImmunitiesList:
  - value: Blinded
  - value: Charmed
  - value: Deafened
  - value: Frightened
  - value: Stunned
  - value: Unconscious
entries:
  - category: action
    name: Multiattack
    text: The ettin makes one Battleaxe attack and one Morningstar attack.
  - category: action
    name: Battleaxe
    text: "*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition."
  - category: action
    name: Morningstar
    text: "*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Piercing damage, and the target has Disadvantage on the next attack roll it makes before the end of its next turn."

---

# Ettin
*Large, Giant, Chaotic Evil*

**AC** 12
**HP** 85 (10d10 + 30)
**Initiative** -1 (9)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 21 | 8 | 17 | 6 | 10 | 8 |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Giant
CR 4, PB +2, XP 1100

## Actions

**Multiattack**
The ettin makes one Battleaxe attack and one Morningstar attack.

**Battleaxe**
*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.

**Morningstar**
*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Piercing damage, and the target has Disadvantage on the next attack roll it makes before the end of its next turn.
