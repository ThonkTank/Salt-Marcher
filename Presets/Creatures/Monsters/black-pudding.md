---
smType: creature
name: Black Pudding
size: Large
type: Ooze
alignmentOverride: Unaligned
ac: '7'
initiative: '-3 (7)'
hp: '68'
hitDice: 8d10 + 24
speeds:
  walk:
    distance: 20 ft.
  climb:
    distance: 20 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 5
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
    score: 1
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '60'
passivesList:
  - skill: Perception
    value: '8'
damageImmunitiesList:
  - value: Acid
  - value: Cold
  - value: Lightning
  - value: Slashing; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Deafened
  - value: Frightened
  - value: Grappled
  - value: Prone
  - value: Restrained
cr: '4'
xp: '1100'
entries:
  - category: trait
    name: Amorphous
    entryType: special
    text: The pudding can move through a space as narrow as 1 inch without expending extra movement to do so.
  - category: trait
    name: Corrosive Form
    entryType: special
    text: A creature that hits the pudding with a melee attack roll takes 4 (1d8) Acid damage. Nonmagical ammunition is destroyed immediately after hitting the pudding and dealing any damage. Any nonmagical weapon takes a cumulative -1 penalty to attack rolls immediately after dealing damage to the pudding and coming into contact with it. The weapon is destroyed if the penalty reaches -5. The penalty can be removed by casting the *Mending* spell on the weapon. In 1 minute, the pudding can eat through 2 feet of nonmagical wood or metal.
  - category: trait
    name: Spider Climb
    entryType: special
    text: The pudding can climb difficult surfaces, including along ceilings, without needing to make an ability check.
  - category: action
    name: Dissolving Pseudopod
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 10 ft. 17 (4d6 + 3) Acid damage. Nonmagical armor worn by the target takes a -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10. The penalty can be removed by casting the *Mending* spell on the armor.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 4d6
          bonus: 3
          type: Acid
          average: 17
      reach: 10 ft.
      onHit:
        other: Nonmagical armor worn by the target takes a -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10. The penalty can be removed by casting the *Mending* spell on the armor.
      additionalEffects: Nonmagical armor worn by the target takes a -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10. The penalty can be removed by casting the *Mending* spell on the armor.
---

# Black Pudding
*Large, Ooze, Unaligned*

**AC** 7
**HP** 68 (8d10 + 24)
**Initiative** -3 (7)
**Speed** 20 ft., climb 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 8
CR 4, PB +2, XP 1100

## Traits

**Amorphous**
The pudding can move through a space as narrow as 1 inch without expending extra movement to do so.

**Corrosive Form**
A creature that hits the pudding with a melee attack roll takes 4 (1d8) Acid damage. Nonmagical ammunition is destroyed immediately after hitting the pudding and dealing any damage. Any nonmagical weapon takes a cumulative -1 penalty to attack rolls immediately after dealing damage to the pudding and coming into contact with it. The weapon is destroyed if the penalty reaches -5. The penalty can be removed by casting the *Mending* spell on the weapon. In 1 minute, the pudding can eat through 2 feet of nonmagical wood or metal.

**Spider Climb**
The pudding can climb difficult surfaces, including along ceilings, without needing to make an ability check.

## Actions

**Dissolving Pseudopod**
*Melee Attack Roll:* +5, reach 10 ft. 17 (4d6 + 3) Acid damage. Nonmagical armor worn by the target takes a -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10. The penalty can be removed by casting the *Mending* spell on the armor.
