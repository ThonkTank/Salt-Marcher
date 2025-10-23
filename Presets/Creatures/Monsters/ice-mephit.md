---
smType: creature
name: Ice Mephit
size: Small
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "11"
initiative: +1 (11)
hp: "21"
hitDice: 6d6
speeds:
  - type: walk
    value: "30"
  - type: fly
    value: "30"
abilities:
  - ability: str
    score: 7
  - ability: dex
    score: 13
  - ability: con
    score: 10
  - ability: int
    score: 9
  - ability: wis
    score: 11
  - ability: cha
    score: 12
pb: "+2"
cr: 1/2
xp: "100"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Primordial (Aquan
  - value: Auran)
passivesList:
  - skill: Perception
    value: "12"
damageVulnerabilitiesList:
  - value: Fire
damageImmunitiesList:
  - value: Cold
  - value: Poison
  - value: Exhaustion
  - value: Poisoned
entries:
  - category: trait
    name: Death Burst
    text: "The mephit explodes when it dies. *Constitution Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Cold damage. *Success:*  Half damage."
  - category: action
    name: Claw
    text: "*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Slashing damage plus 2 (1d4) Cold damage."
  - category: action
    name: Frost Breath
    recharge: Recharge 6
    text: "*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  7 (3d4) Cold damage. *Success:*  Half damage."
  - category: action
    name: Fog Cloud (1/Day)
    text: The mephit casts *Fog Cloud*, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** - **1/Day Each:** *Fog Cloud*

---

# Ice Mephit
*Small, Elemental, Neutral Evil*

**AC** 11
**HP** 21 (6d6)
**Initiative** +1 (11)
**Speed** 30 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 7 | 13 | 10 | 9 | 11 | 12 |

**Senses** darkvision 60 ft.; Passive Perception 12
**Languages** Primordial (Aquan, Auran)
CR 1/2, PB +2, XP 100

## Traits

**Death Burst**
The mephit explodes when it dies. *Constitution Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Cold damage. *Success:*  Half damage.

## Actions

**Claw**
*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Slashing damage plus 2 (1d4) Cold damage.

**Frost Breath (Recharge 6)**
*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  7 (3d4) Cold damage. *Success:*  Half damage.

**Fog Cloud (1/Day)**
The mephit casts *Fog Cloud*, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** - **1/Day Each:** *Fog Cloud*
