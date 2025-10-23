---
smType: creature
name: Storm Giant
size: Huge
type: Giant
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: "16"
initiative: +7 (17)
hp: "230"
hitDice: 20d12 + 100
speeds:
  - type: walk
    value: "50"
  - type: fly
    value: "25"
    hover: true
  - type: swim
    value: "50"
abilities:
  - ability: str
    score: 29
  - ability: dex
    score: 14
  - ability: con
    score: 20
  - ability: int
    score: 16
  - ability: wis
    score: 20
  - ability: cha
    score: 18
pb: "+5"
cr: "13"
xp: "10000"
sensesList:
  - type: darkvision
    range: "120"
  - type: truesight
    range: "30"
languagesList:
  - value: Common
  - value: Giant
passivesList:
  - skill: Perception
    value: "20"
damageResistancesList:
  - value: Cold
damageImmunitiesList:
  - value: Lightning
  - value: Thunder
entries:
  - category: trait
    name: Amphibious
    text: The giant can breathe air and water.
  - category: action
    name: Multiattack
    text: The giant makes two attacks, using Storm Sword or Thunderbolt in any combination.
  - category: action
    name: Storm Sword
    text: "*Melee Attack Roll:* +14, reach 10 ft. 23 (4d6 + 9) Slashing damage plus 13 (3d8) Lightning damage."
  - category: action
    name: Thunderbolt
    text: "*Ranged Attack Roll:* +14, range 500 ft. 22 (2d12 + 9) Lightning damage, and the target has the Blinded and Deafened conditions until the start of the giant's next turn."
  - category: action
    name: Lightning Storm (Recharge 5-6)
    text: "*Dexterity Saving Throw*: DC 18, each creature in a 10-foot-radius, 40-foot-high Cylinder [Area of Effect]|XPHB|Cylinder originating from a point the giant can see within 500 feet. *Failure:*  55 (10d10) Lightning damage. *Success:*  Half damage."
  - category: action
    name: Spellcasting
    text: "The giant casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Light* - **1/Day Each:** *Control Weather*"

---

# Storm Giant
*Huge, Giant, Chaotic Good*

**AC** 16
**HP** 230 (20d12 + 100)
**Initiative** +7 (17)
**Speed** 50 ft., swim 50 ft., fly 25 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 29 | 14 | 20 | 16 | 20 | 18 |

**Senses** darkvision 120 ft., truesight 30 ft.; Passive Perception 20
**Languages** Common, Giant
CR 13, PB +5, XP 10000

## Traits

**Amphibious**
The giant can breathe air and water.

## Actions

**Multiattack**
The giant makes two attacks, using Storm Sword or Thunderbolt in any combination.

**Storm Sword**
*Melee Attack Roll:* +14, reach 10 ft. 23 (4d6 + 9) Slashing damage plus 13 (3d8) Lightning damage.

**Thunderbolt**
*Ranged Attack Roll:* +14, range 500 ft. 22 (2d12 + 9) Lightning damage, and the target has the Blinded and Deafened conditions until the start of the giant's next turn.

**Lightning Storm (Recharge 5-6)**
*Dexterity Saving Throw*: DC 18, each creature in a 10-foot-radius, 40-foot-high Cylinder [Area of Effect]|XPHB|Cylinder originating from a point the giant can see within 500 feet. *Failure:*  55 (10d10) Lightning damage. *Success:*  Half damage.

**Spellcasting**
The giant casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Light* - **1/Day Each:** *Control Weather*
