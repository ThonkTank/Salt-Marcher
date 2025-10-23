---
smType: creature
name: Goblin Boss
size: Small
type: Fey
alignmentLawChaos: Chaotic
alignmentGoodEvil: Neutral
ac: "17"
initiative: +2 (12)
hp: "21"
hitDice: 6d6
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 10
  - ability: dex
    score: 15
  - ability: con
    score: 10
  - ability: int
    score: 10
  - ability: wis
    score: 8
  - ability: cha
    score: 10
pb: "+2"
cr: "1"
xp: "200"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Common
  - value: Goblin
passivesList:
  - skill: Perception
    value: "9"
entries:
  - category: action
    name: Multiattack
    text: The goblin makes two attacks, using Scimitar or Shortbow in any combination.
  - category: action
    name: Scimitar
    text: "*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage."
  - category: action
    name: Shortbow
    text: "*Ranged Attack Roll:* +4, range 80/320 ft. 5 (1d6 + 2) Piercing damage, plus 2 (1d4) Piercing damage if the attack roll had Advantage."
  - category: bonus
    name: Nimble Escape
    text: The goblin takes the Disengage or Hide action.

---

# Goblin Boss
*Small, Fey, Chaotic Neutral*

**AC** 17
**HP** 21 (6d6)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 10 | 15 | 10 | 10 | 8 | 10 |

**Senses** darkvision 60 ft.; Passive Perception 9
**Languages** Common, Goblin
CR 1, PB +2, XP 200

## Actions

**Multiattack**
The goblin makes two attacks, using Scimitar or Shortbow in any combination.

**Scimitar**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.

**Shortbow**
*Ranged Attack Roll:* +4, range 80/320 ft. 5 (1d6 + 2) Piercing damage, plus 2 (1d4) Piercing damage if the attack roll had Advantage.

## Bonus Actions

**Nimble Escape**
The goblin takes the Disengage or Hide action.
