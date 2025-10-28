---
smType: creature
name: Sphinx of Wonder
size: Small
type: Celestial
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '13'
initiative: +3 (13)
hp: '24'
hitDice: 7d4 + 7
speeds:
  walk:
    distance: 20 ft.
  fly:
    distance: 40 ft.
abilities:
  - key: str
    score: 6
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 15
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
skills:
  - skill: Arcana
    value: '4'
  - skill: Religion
    value: '4'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Celestial
  - value: Common
damageResistancesList:
  - value: Necrotic
  - value: Psychic
  - value: Radiant
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The sphinx has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Slashing damage plus 7 (2d6) Radiant damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d4
          bonus: 3
          type: Slashing
          average: 5
        - dice: 2d6
          bonus: 0
          type: Radiant
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Sphinx of Wonder
*Small, Celestial, Lawful Good*

**AC** 13
**HP** 24 (7d4 + 7)
**Initiative** +3 (13)
**Speed** 20 ft., fly 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 11
**Languages** Celestial, Common
CR 1, PB +2, XP 200

## Traits

**Magic Resistance**
The sphinx has Advantage on saving throws against spells and other magical effects.

## Actions

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Slashing damage plus 7 (2d6) Radiant damage.
