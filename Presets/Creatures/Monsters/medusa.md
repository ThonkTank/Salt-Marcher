---
smType: creature
name: Medusa
size: Medium
type: Monstrosity
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: "15"
initiative: +6 (16)
hp: "127"
hitDice: 17d8 + 51
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 10
  - ability: dex
    score: 17
  - ability: con
    score: 16
  - ability: int
    score: 12
  - ability: wis
    score: 13
  - ability: cha
    score: 15
pb: "+3"
cr: "6"
xp: "2300"
sensesList:
  - type: darkvision
    range: "150"
languagesList:
  - value: Common plus one other language
passivesList:
  - skill: Perception
    value: "14"
entries:
  - category: action
    name: Multiattack
    text: The medusa makes two Claw attacks and one Snake Hair attack, or it makes three Poison Ray attacks.
  - category: action
    name: Claw
    text: "*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Slashing damage."
  - category: action
    name: Snake Hair
    text: "*Melee Attack Roll:* +6, reach 5 ft. 5 (1d4 + 3) Piercing damage plus 14 (4d6) Poison damage."
  - category: action
    name: Poison Ray
    text: "*Ranged Attack Roll:* +5, range 150 ft. 11 (2d8 + 2) Poison damage."
  - category: bonus
    name: Petrifying Gaze (Recharge 5-6)
    text: "*Constitution Saving Throw*: DC 13, each creature in a 30-foot Cone. If the medusa sees its reflection in the Cone, the medusa must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition."

---

# Medusa
*Medium, Monstrosity, Lawful Evil*

**AC** 15
**HP** 127 (17d8 + 51)
**Initiative** +6 (16)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 10 | 17 | 16 | 12 | 13 | 15 |

**Senses** darkvision 150 ft.; Passive Perception 14
**Languages** Common plus one other language
CR 6, PB +3, XP 2300

## Actions

**Multiattack**
The medusa makes two Claw attacks and one Snake Hair attack, or it makes three Poison Ray attacks.

**Claw**
*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Slashing damage.

**Snake Hair**
*Melee Attack Roll:* +6, reach 5 ft. 5 (1d4 + 3) Piercing damage plus 14 (4d6) Poison damage.

**Poison Ray**
*Ranged Attack Roll:* +5, range 150 ft. 11 (2d8 + 2) Poison damage.

## Bonus Actions

**Petrifying Gaze (Recharge 5-6)**
*Constitution Saving Throw*: DC 13, each creature in a 30-foot Cone. If the medusa sees its reflection in the Cone, the medusa must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.
