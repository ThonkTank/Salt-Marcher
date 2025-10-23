---
smType: creature
name: Gray Ooze
size: Medium
type: Ooze
alignmentOverride: Unaligned
ac: "9"
initiative: "-2 (8)"
hp: "22"
hitDice: 3d8 + 9
speeds:
  - type: walk
    value: "10"
  - type: climb
    value: "10"
abilities:
  - ability: str
    score: 12
  - ability: dex
    score: 6
  - ability: con
    score: 16
  - ability: int
    score: 1
  - ability: wis
    score: 6
  - ability: cha
    score: 2
pb: "+2"
cr: 1/2
xp: "100"
sensesList:
  - type: blindsight
    range: "60"
passivesList:
  - skill: Perception
    value: "8"
damageResistancesList:
  - value: Acid
  - value: Cold
  - value: Fire
damageImmunitiesList:
  - value: Blinded
  - value: Charmed
  - value: Deafened
  - value: Exhaustion
  - value: Frightened
  - value: Grappled
  - value: Prone
  - value: Restrained
entries:
  - category: trait
    name: Amorphous
    text: The ooze can move through a space as narrow as 1 inch without expending extra movement to do so.
  - category: trait
    name: Corrosive Form
    text: Nonmagical ammunition is destroyed immediately after hitting the ooze and dealing any damage. Any nonmagical weapon takes a cumulative -1 penalty to attack rolls immediately after dealing damage to the ooze and coming into contact with it. The weapon is destroyed if the penalty reaches -5. The penalty can be removed by casting the *Mending* spell on the weapon. The ooze can eat through 2-inch-thick, nonmagical metal or wood in 1 round.
  - category: action
    name: Pseudopod
    text: "*Melee Attack Roll:* +3, reach 5 ft. 10 (2d8 + 1) Acid damage. Nonmagical armor worn by the target takes a -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10. The penalty can be removed by casting the *Mending* spell on the armor."

---

# Gray Ooze
*Medium, Ooze, Unaligned*

**AC** 9
**HP** 22 (3d8 + 9)
**Initiative** -2 (8)
**Speed** 10 ft., climb 10 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 12 | 6 | 16 | 1 | 6 | 2 |

**Senses** blindsight 60 ft.; Passive Perception 8
CR 1/2, PB +2, XP 100

## Traits

**Amorphous**
The ooze can move through a space as narrow as 1 inch without expending extra movement to do so.

**Corrosive Form**
Nonmagical ammunition is destroyed immediately after hitting the ooze and dealing any damage. Any nonmagical weapon takes a cumulative -1 penalty to attack rolls immediately after dealing damage to the ooze and coming into contact with it. The weapon is destroyed if the penalty reaches -5. The penalty can be removed by casting the *Mending* spell on the weapon. The ooze can eat through 2-inch-thick, nonmagical metal or wood in 1 round.

## Actions

**Pseudopod**
*Melee Attack Roll:* +3, reach 5 ft. 10 (2d8 + 1) Acid damage. Nonmagical armor worn by the target takes a -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10. The penalty can be removed by casting the *Mending* spell on the armor.
