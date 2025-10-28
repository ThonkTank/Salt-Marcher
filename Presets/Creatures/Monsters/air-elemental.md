---
smType: creature
name: Air Elemental
size: Large
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '15'
initiative: +5 (15)
hp: '90'
hitDice: 12d10 + 24
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 90 ft.
    hover: true
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 20
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Primordial (Auran)
damageResistancesList:
  - value: Bludgeoning
  - value: Lightning
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Poison
  - value: Thunder; Exhaustion
conditionImmunitiesList:
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Prone
  - value: Restrained
  - value: Unconscious
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Air Form
    entryType: special
    text: The elemental can enter a creature's space and stop there. It can move through a space as narrow as 1 inch without expending extra movement to do so.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The elemental makes two Thunderous Slam attacks.
    multiattack:
      attacks:
        - name: Slam
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Thunderous Slam
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 10 ft. 14 (2d8 + 5) Thunder damage.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 2d8
          bonus: 5
          type: Thunder
          average: 14
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Whirlwind (Recharge 4-6)
    entryType: save
    text: '*Strength Saving Throw*: DC 13, one Medium or smaller creature in the elemental''s space. *Failure:*  24 (4d10 + 2) Thunder damage, and the target is pushed up to 20 feet straight away from the elemental and has the Prone condition. *Success:*  Half damage only.'
    recharge: 4-6
    save:
      ability: str
      dc: 13
      targeting:
        type: single
        restrictions:
          size:
            - Medium
            - smaller
      onFail:
        effects:
          conditions:
            - condition: Prone
          movement:
            type: push
            distance: 20 feet
            direction: straight away from the elemental
        damage:
          - dice: 4d10
            bonus: 2
            type: Thunder
            average: 24
      onSuccess:
        damage: half
        legacyText: Half damage only.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Air Elemental
*Large, Elemental, Neutral Neutral*

**AC** 15
**HP** 90 (12d10 + 24)
**Initiative** +5 (15)
**Speed** 10 ft., fly 90 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Primordial (Auran)
CR 5, PB +3, XP 1800

## Traits

**Air Form**
The elemental can enter a creature's space and stop there. It can move through a space as narrow as 1 inch without expending extra movement to do so.

## Actions

**Multiattack**
The elemental makes two Thunderous Slam attacks.

**Thunderous Slam**
*Melee Attack Roll:* +8, reach 10 ft. 14 (2d8 + 5) Thunder damage.

**Whirlwind (Recharge 4-6)**
*Strength Saving Throw*: DC 13, one Medium or smaller creature in the elemental's space. *Failure:*  24 (4d10 + 2) Thunder damage, and the target is pushed up to 20 feet straight away from the elemental and has the Prone condition. *Success:*  Half damage only.
