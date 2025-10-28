---
smType: creature
name: Earth Elemental
size: Large
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '17'
initiative: '-1 (9)'
hp: '147'
hitDice: 14d10 + 70
speeds:
  walk:
    distance: 30 ft.
  burrow:
    distance: 30 ft.
abilities:
  - key: str
    score: 20
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 20
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+3'
sensesList:
  - type: darkvision
    range: '60'
  - type: tremorsense
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Primordial (Terran)
damageVulnerabilitiesList:
  - value: Thunder
damageImmunitiesList:
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Unconscious
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Earth Glide
    entryType: special
    text: The elemental can burrow through nonmagical, unworked earth and stone. While doing so, the elemental doesn't disturb the material it moves through.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Siege Monster
    entryType: special
    text: The elemental deals double damage to objects and structures.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: special
    text: The elemental makes two attacks, using Slam or Rock Launch in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 10 ft. 14 (2d8 + 5) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 2d8
          bonus: 5
          type: Bludgeoning
          average: 14
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Rock Launch
    entryType: attack
    text: '*Ranged Attack Roll:* +8, range 60 ft. 8 (1d6 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.'
    attack:
      type: ranged
      bonus: 8
      damage:
        - dice: 1d6
          bonus: 5
          type: Bludgeoning
          average: 8
      range: 60 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Earth Elemental
*Large, Elemental, Neutral Neutral*

**AC** 17
**HP** 147 (14d10 + 70)
**Initiative** -1 (9)
**Speed** 30 ft., burrow 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft., tremorsense 60 ft.; Passive Perception 10
**Languages** Primordial (Terran)
CR 5, PB +3, XP 1800

## Traits

**Earth Glide**
The elemental can burrow through nonmagical, unworked earth and stone. While doing so, the elemental doesn't disturb the material it moves through.

**Siege Monster**
The elemental deals double damage to objects and structures.

## Actions

**Multiattack**
The elemental makes two attacks, using Slam or Rock Launch in any combination.

**Slam**
*Melee Attack Roll:* +8, reach 10 ft. 14 (2d8 + 5) Bludgeoning damage.

**Rock Launch**
*Ranged Attack Roll:* +8, range 60 ft. 8 (1d6 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.
