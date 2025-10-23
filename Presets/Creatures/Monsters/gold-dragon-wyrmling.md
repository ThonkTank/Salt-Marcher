---
smType: creature
name: Gold Dragon Wyrmling
size: Medium
type: Dragon
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: "17"
initiative: +4 (14)
hp: "60"
hitDice: 8d8 + 24
speeds:
  - type: walk
    value: "30"
  - type: fly
    value: "60"
  - type: swim
    value: "30"
abilities:
  - ability: str
    score: 19
  - ability: dex
    score: 14
  - ability: con
    score: 17
  - ability: int
    score: 14
  - ability: wis
    score: 11
  - ability: cha
    score: 16
pb: "+2"
cr: "3"
xp: "700"
sensesList:
  - type: blindsight
    range: "10"
  - type: darkvision
    range: "60"
languagesList:
  - value: Draconic
passivesList:
  - skill: Perception
    value: "14"
damageImmunitiesList:
  - value: Fire
entries:
  - category: trait
    name: Amphibious
    text: The dragon can breathe air and water.
  - category: action
    name: Multiattack
    text: The dragon makes two Rend attacks.
  - category: action
    name: Rend
    text: "*Melee Attack Roll:* +6, reach 5 ft. 9 (1d10 + 4) Slashing damage."
  - category: action
    name: Fire Breath (Recharge 5-6)
    text: "*Dexterity Saving Throw*: DC 13, each creature in a 15-foot Cone. *Failure:*  22 (4d10) Fire damage. *Success:*  Half damage."
  - category: action
    name: Weakening Breath
    text: "*Strength Saving Throw*: DC 13, each creature that isn't currently affected by this breath in a 15-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 2 (1d4) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically."

---

# Gold Dragon Wyrmling
*Medium, Dragon, Lawful Good*

**AC** 17
**HP** 60 (8d8 + 24)
**Initiative** +4 (14)
**Speed** 30 ft., swim 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 19 | 14 | 17 | 14 | 11 | 16 |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 14
**Languages** Draconic
CR 3, PB +2, XP 700

## Traits

**Amphibious**
The dragon can breathe air and water.

## Actions

**Multiattack**
The dragon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +6, reach 5 ft. 9 (1d10 + 4) Slashing damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 13, each creature in a 15-foot Cone. *Failure:*  22 (4d10) Fire damage. *Success:*  Half damage.

**Weakening Breath**
*Strength Saving Throw*: DC 13, each creature that isn't currently affected by this breath in a 15-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 2 (1d4) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.
