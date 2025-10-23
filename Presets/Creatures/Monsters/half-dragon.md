---
smType: creature
name: Half-Dragon
size: Medium
type: Dragon
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: "18"
initiative: +5 (15)
hp: "105"
hitDice: 14d8 + 42
speeds:
  - type: walk
    value: "40"
abilities:
  - ability: str
    score: 19
  - ability: dex
    score: 14
  - ability: con
    score: 16
  - ability: int
    score: 10
  - ability: wis
    score: 15
  - ability: cha
    score: 14
pb: "+3"
cr: "5"
xp: "1800"
sensesList:
  - type: blindsight
    range: "10"
  - type: darkvision
    range: "60"
languagesList:
  - value: Common
  - value: Draconic
passivesList:
  - skill: Perception
    value: "15"
damageResistancesList:
  - value: Damage type chosen for the Draconic Origin trait below
entries:
  - category: trait
    name: Draconic Origin
    text: "The half-dragon is related to a type of dragon associated with one of the following damage types (DM's choice): Acid, Cold, Fire, Lightning, or Poison. This choice affects other aspects of the stat block."
  - category: action
    name: Multiattack
    text: The half-dragon makes two Claw attacks.
  - category: action
    name: Claw
    text: "*Melee Attack Roll:* +7, reach 10 ft. 6 (1d4 + 4) Slashing damage plus 7 (2d6) damage of the type chosen for the Draconic Origin trait."
  - category: action
    name: Dragon's Breath (Recharge 5-6)
    text: "*Dexterity Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  28 (8d6) damage of the type chosen for the Draconic Origin trait. *Success:*  Half damage."
  - category: bonus
    name: Leap
    text: The half-dragon jumps up to 30 feet by spending 10 feet of movement.

---

# Half-Dragon
*Medium, Dragon, Neutral Neutral*

**AC** 18
**HP** 105 (14d8 + 42)
**Initiative** +5 (15)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 19 | 14 | 16 | 10 | 15 | 14 |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 15
**Languages** Common, Draconic
CR 5, PB +3, XP 1800

## Traits

**Draconic Origin**
The half-dragon is related to a type of dragon associated with one of the following damage types (DM's choice): Acid, Cold, Fire, Lightning, or Poison. This choice affects other aspects of the stat block.

## Actions

**Multiattack**
The half-dragon makes two Claw attacks.

**Claw**
*Melee Attack Roll:* +7, reach 10 ft. 6 (1d4 + 4) Slashing damage plus 7 (2d6) damage of the type chosen for the Draconic Origin trait.

**Dragon's Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  28 (8d6) damage of the type chosen for the Draconic Origin trait. *Success:*  Half damage.

## Bonus Actions

**Leap**
The half-dragon jumps up to 30 feet by spending 10 feet of movement.
