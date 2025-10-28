---
smType: creature
name: Drider
size: Large
type: Monstrosity
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '19'
initiative: +4 (14)
hp: '123'
hitDice: 13d10 + 52
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 19
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 13
    saveProf: false
  - key: wis
    score: 16
    saveProf: false
  - key: cha
    score: 12
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '6'
  - skill: Stealth
    value: '10'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Elvish
  - value: Undercommon
cr: '6'
xp: '2300'
entries:
  - category: trait
    name: Spider Climb
    entryType: special
    text: The drider can climb difficult surfaces, including along ceilings, without needing to make an ability check.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Sunlight Sensitivity
    entryType: special
    text: While in sunlight, the drider has Disadvantage on ability checks and attack rolls.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Web Walker
    entryType: special
    text: The drider ignores movement restrictions caused by webs, and the drider knows the location of any other creature in contact with the same web.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: special
    text: The drider makes three attacks, using Foreleg or Poison Burst in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Foreleg
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 10 ft. 13 (2d8 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 4
          type: Piercing
          average: 13
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Poison Burst
    entryType: attack
    text: '*Ranged Attack Roll:* +6, range 120 ft. 13 (3d6 + 3) Poison damage.'
    attack:
      type: ranged
      bonus: 6
      damage:
        - dice: 3d6
          bonus: 3
          type: Poison
          average: 13
      range: 120 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: bonus
    name: Magic of the Spider Queen (Recharge 5-6)
    entryType: spellcasting
    text: The drider casts *Darkness*, *Faerie Fire*, or *Web*, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 14).
    recharge: 5-6
    spellcasting:
      ability: wis
      saveDC: 14
      excludeComponents:
        - M
      spellLists: []
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Drider
*Large, Monstrosity, Chaotic Evil*

**AC** 19
**HP** 123 (13d10 + 52)
**Initiative** +4 (14)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 16
**Languages** Elvish, Undercommon
CR 6, PB +3, XP 2300

## Traits

**Spider Climb**
The drider can climb difficult surfaces, including along ceilings, without needing to make an ability check.

**Sunlight Sensitivity**
While in sunlight, the drider has Disadvantage on ability checks and attack rolls.

**Web Walker**
The drider ignores movement restrictions caused by webs, and the drider knows the location of any other creature in contact with the same web.

## Actions

**Multiattack**
The drider makes three attacks, using Foreleg or Poison Burst in any combination.

**Foreleg**
*Melee Attack Roll:* +7, reach 10 ft. 13 (2d8 + 4) Piercing damage.

**Poison Burst**
*Ranged Attack Roll:* +6, range 120 ft. 13 (3d6 + 3) Poison damage.

## Bonus Actions

**Magic of the Spider Queen (Recharge 5-6)**
The drider casts *Darkness*, *Faerie Fire*, or *Web*, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 14).
