---
smType: creature
name: Satyr
size: Medium
type: Fey
alignmentLawChaos: Chaotic
alignmentGoodEvil: Neutral
ac: '13'
initiative: +3 (13)
hp: '31'
hitDice: 7d8
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 12
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 14
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
  - skill: Performance
    value: '6'
  - skill: Stealth
    value: '5'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Common
  - value: Elvish
  - value: Sylvan
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The satyr has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Hooves
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Bludgeoning damage. If the target is a Medium or smaller creature, the satyr pushes the target up to 10 feet straight away from itself.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d4
          bonus: 3
          type: Bludgeoning
          average: 5
      reach: 5 ft.
      onHit:
        other: If the target is a Medium or smaller creature, the satyr pushes the target up to 10 feet straight away from itself.
      additionalEffects: If the target is a Medium or smaller creature, the satyr pushes the target up to 10 feet straight away from itself.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Mockery
    entryType: save
    text: '*Wisdom Saving Throw*: DC 12, one creature the satyr can see within 90 feet. *Failure:*  5 (1d6 + 2) Psychic damage.'
    save:
      ability: wis
      dc: 12
      targeting:
        type: single
        range: 90 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          other: 5 (1d6 + 2) Psychic damage.
        damage:
          - dice: 1d6
            bonus: 2
            type: Psychic
            average: 5
        legacyEffects: 5 (1d6 + 2) Psychic damage.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Satyr
*Medium, Fey, Chaotic Neutral*

**AC** 13
**HP** 31 (7d8)
**Initiative** +3 (13)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common, Elvish, Sylvan
CR 1/2, PB +2, XP 100

## Traits

**Magic Resistance**
The satyr has Advantage on saving throws against spells and other magical effects.

## Actions

**Hooves**
*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Bludgeoning damage. If the target is a Medium or smaller creature, the satyr pushes the target up to 10 feet straight away from itself.

**Mockery**
*Wisdom Saving Throw*: DC 12, one creature the satyr can see within 90 feet. *Failure:*  5 (1d6 + 2) Psychic damage.
