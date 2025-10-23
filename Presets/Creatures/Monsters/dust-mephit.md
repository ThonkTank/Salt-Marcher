---
smType: creature
name: Dust Mephit
size: Small
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "12"
initiative: +2 (12)
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
    score: 14
  - ability: con
    score: 10
  - ability: int
    score: 9
  - ability: wis
    score: 11
  - ability: cha
    score: 10
pb: "+2"
cr: 1/2
xp: "100"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Primordial (Auran
  - value: Terran)
passivesList:
  - skill: Perception
    value: "12"
damageVulnerabilitiesList:
  - value: Fire
damageImmunitiesList:
  - value: Poison
  - value: Exhaustion
  - value: Poisoned
entries:
  - category: trait
    name: Death Burst
    text: "The mephit explodes when it dies. *Dexterity Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Bludgeoning damage. *Success:*  Half damage."
  - category: action
    name: Claw
    text: "*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Slashing damage."
  - category: action
    name: Blinding Breath
    recharge: Recharge 6
    text: "*Dexterity Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  The target has the Blinded condition until the end of the mephit's next turn."
  - category: action
    name: Sleep (1/Day)
    text: The mephit casts the *Sleep* spell, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 10). - **At Will:** - **1/Day Each:** *Sleep*

---

# Dust Mephit
*Small, Elemental, Neutral Evil*

**AC** 12
**HP** 17 (5d6)
**Initiative** +2 (12)
**Speed** 30 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 5 | 14 | 10 | 9 | 11 | 10 |

**Senses** darkvision 60 ft.; Passive Perception 12
**Languages** Primordial (Auran, Terran)
CR 1/2, PB +2, XP 100

## Traits

**Death Burst**
The mephit explodes when it dies. *Dexterity Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Bludgeoning damage. *Success:*  Half damage.

## Actions

**Claw**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Slashing damage.

**Blinding Breath (Recharge 6)**
*Dexterity Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  The target has the Blinded condition until the end of the mephit's next turn.

**Sleep (1/Day)**
The mephit casts the *Sleep* spell, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 10). - **At Will:** - **1/Day Each:** *Sleep*
