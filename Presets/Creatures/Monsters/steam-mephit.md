---
smType: creature
name: Steam Mephit
size: Small
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "10"
initiative: +0 (10)
hp: "17"
hitDice: 5d6
speeds:
  - type: walk
    value: "30"
  - type: fly
    value: "30"
abilities:
  - ability: str
    score: 5
  - ability: dex
    score: 11
  - ability: con
    score: 10
  - ability: int
    score: 11
  - ability: wis
    score: 10
  - ability: cha
    score: 12
pb: "+2"
cr: 1/4
xp: "50"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Primordial (Aquan
  - value: Ignan)
passivesList:
  - skill: Perception
    value: "10"
damageImmunitiesList:
  - value: Fire
  - value: Poison
  - value: Exhaustion
  - value: Poisoned
entries:
  - category: trait
    name: Blurred Form
    text: Attack rolls against the mephit are made with Disadvantage unless the mephit has the Incapacitated condition.
  - category: trait
    name: Death Burst
    text: "The mephit explodes when it dies. *Dexterity Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Fire damage. *Success:*  Half damage."
  - category: action
    name: Claw
    text: "*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Slashing damage plus 2 (1d4) Fire damage."
  - category: action
    name: Steam Breath
    recharge: Recharge 6
    text: "*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  5 (2d4) Fire damage, and the target's Speed decreases by 10 feet until the end of the mephit's next turn. *Success:*  Half damage only. *Failure or Success*:  Being underwater doesn't grant Resistance to this Fire damage."

---

# Steam Mephit
*Small, Elemental, Neutral Evil*

**AC** 10
**HP** 17 (5d6)
**Initiative** +0 (10)
**Speed** 30 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 5 | 11 | 10 | 11 | 10 | 12 |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Primordial (Aquan, Ignan)
CR 1/4, PB +2, XP 50

## Traits

**Blurred Form**
Attack rolls against the mephit are made with Disadvantage unless the mephit has the Incapacitated condition.

**Death Burst**
The mephit explodes when it dies. *Dexterity Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Fire damage. *Success:*  Half damage.

## Actions

**Claw**
*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Slashing damage plus 2 (1d4) Fire damage.

**Steam Breath (Recharge 6)**
*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  5 (2d4) Fire damage, and the target's Speed decreases by 10 feet until the end of the mephit's next turn. *Success:*  Half damage only. *Failure or Success*:  Being underwater doesn't grant Resistance to this Fire damage.
