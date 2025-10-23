---
smType: creature
name: Ghoul
size: Medium
type: Undead
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "12"
initiative: +2 (12)
hp: "22"
hitDice: 5d8
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 13
  - ability: dex
    score: 15
  - ability: con
    score: 10
  - ability: int
    score: 7
  - ability: wis
    score: 10
  - ability: cha
    score: 6
pb: "+2"
cr: "1"
xp: "200"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Common
passivesList:
  - skill: Perception
    value: "10"
damageImmunitiesList:
  - value: Poison
  - value: Charmed
  - value: Exhaustion
  - value: Poisoned
entries:
  - category: action
    name: Multiattack
    text: The ghoul makes two Bite attacks.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 3 (1d6) Necrotic damage."
  - category: action
    name: Claw
    text: "*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Slashing damage. If the target is a creature that isn't an Undead or elf, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn."

---

# Ghoul
*Medium, Undead, Chaotic Evil*

**AC** 12
**HP** 22 (5d8)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 13 | 15 | 10 | 7 | 10 | 6 |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Common
CR 1, PB +2, XP 200

## Actions

**Multiattack**
The ghoul makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 3 (1d6) Necrotic damage.

**Claw**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Slashing damage. If the target is a creature that isn't an Undead or elf, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.
