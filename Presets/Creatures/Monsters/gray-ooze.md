---
smType: creature
name: Gray Ooze
size: Medium
type: Ooze
alignmentOverride: Unaligned
ac: '9'
initiative: '-2 (8)'
hp: '22'
hitDice: 3d8 + 9
speeds:
  walk:
    distance: 10 ft.
  climb:
    distance: 10 ft.
abilities:
  - key: str
    score: 12
    saveProf: false
  - key: dex
    score: 6
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 6
    saveProf: false
  - key: cha
    score: 2
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '2'
sensesList:
  - type: blindsight
    range: '60'
passivesList:
  - skill: Perception
    value: '8'
damageResistancesList:
  - value: Acid
  - value: Cold
  - value: Fire
damageImmunitiesList:
  - value: Exhaustion
conditionImmunitiesList:
  - value: Blinded
  - value: Charmed
  - value: Deafened
  - value: Frightened
  - value: Grappled
  - value: Prone
  - value: Restrained
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Amorphous
    entryType: special
    text: The ooze can move through a space as narrow as 1 inch without expending extra movement to do so.
  - category: trait
    name: Corrosive Form
    entryType: special
    text: Nonmagical ammunition is destroyed immediately after hitting the ooze and dealing any damage. Any nonmagical weapon takes a cumulative -1 penalty to attack rolls immediately after dealing damage to the ooze and coming into contact with it. The weapon is destroyed if the penalty reaches -5. The penalty can be removed by casting the *Mending* spell on the weapon. The ooze can eat through 2-inch-thick, nonmagical metal or wood in 1 round.
  - category: action
    name: Pseudopod
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 10 (2d8 + 1) Acid damage. Nonmagical armor worn by the target takes a -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10. The penalty can be removed by casting the *Mending* spell on the armor.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 2d8
          bonus: 1
          type: Acid
          average: 10
      reach: 5 ft.
      onHit:
        other: Nonmagical armor worn by the target takes a -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10. The penalty can be removed by casting the *Mending* spell on the armor.
      additionalEffects: Nonmagical armor worn by the target takes a -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10. The penalty can be removed by casting the *Mending* spell on the armor.
---

# Gray Ooze
*Medium, Ooze, Unaligned*

**AC** 9
**HP** 22 (3d8 + 9)
**Initiative** -2 (8)
**Speed** 10 ft., climb 10 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

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
