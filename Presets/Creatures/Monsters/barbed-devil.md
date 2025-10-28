---
smType: creature
name: Barbed Devil
size: Medium
type: Fiend
typeTags:
  - value: Devil
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '15'
initiative: +3 (13)
hp: '110'
hitDice: 13d8 + 52
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: true
    saveMod: 6
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 18
    saveProf: true
    saveMod: 7
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 14
    saveProf: true
    saveMod: 5
  - key: cha
    score: 14
    saveProf: true
    saveMod: 5
pb: '+3'
skills:
  - skill: Deception
    value: '5'
  - skill: Insight
    value: '5'
  - skill: Perception
    value: '8'
sensesList:
  - type: darkvision 120 ft. (unimpeded by magical darkness)
passivesList:
  - skill: Perception
    value: '18'
languagesList:
  - value: Infernal
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Cold
damageImmunitiesList:
  - value: Fire
  - value: Poison; Poisoned
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Barbed Hide
    entryType: special
    text: At the start of each of its turns, the devil deals 5 (1d10) Piercing damage to any creature it is grappling or any creature grappling it.
  - category: trait
    name: Diabolical Restoration
    entryType: special
    text: If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The devil has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The devil makes one Claws attack and one Tail attack, or it makes two Hurl Flame attacks.
    multiattack:
      attacks:
        - name: Claws
          count: 1
        - name: Tail
          count: 1
        - name: Flame
          count: 1
      substitutions: []
  - category: action
    name: Claws
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13) from both claws.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 3
          type: Piercing
          average: 10
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 13
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13) from both claws.
  - category: action
    name: Tail
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 14 (2d10 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d10
          bonus: 3
          type: Slashing
          average: 14
      reach: 10 ft.
  - category: action
    name: Hurl Flame
    entryType: attack
    text: '*Ranged Attack Roll:* +5, range 150 ft. 17 (5d6) Fire damage. If the target is a flammable object that isn''t being worn or carried, it starts burning.'
    attack:
      type: ranged
      bonus: 5
      damage:
        - dice: 5d6
          bonus: 0
          type: Fire
          average: 17
      range: 150 ft.
      onHit:
        other: If the target is a flammable object that isn't being worn or carried, it starts burning.
      additionalEffects: If the target is a flammable object that isn't being worn or carried, it starts burning.
---

# Barbed Devil
*Medium, Fiend, Lawful Evil*

**AC** 15
**HP** 110 (13d8 + 52)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft. (unimpeded by magical darkness); Passive Perception 18
**Languages** Infernal, telepathy 120 ft.
CR 5, PB +3, XP 1800

## Traits

**Barbed Hide**
At the start of each of its turns, the devil deals 5 (1d10) Piercing damage to any creature it is grappling or any creature grappling it.

**Diabolical Restoration**
If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.

**Magic Resistance**
The devil has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The devil makes one Claws attack and one Tail attack, or it makes two Hurl Flame attacks.

**Claws**
*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13) from both claws.

**Tail**
*Melee Attack Roll:* +6, reach 10 ft. 14 (2d10 + 3) Slashing damage.

**Hurl Flame**
*Ranged Attack Roll:* +5, range 150 ft. 17 (5d6) Fire damage. If the target is a flammable object that isn't being worn or carried, it starts burning.
