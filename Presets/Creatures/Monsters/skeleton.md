---
smType: creature
name: Skeleton
size: Medium
type: Undead
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '14'
initiative: +3 (13)
hp: '13'
hitDice: 2d8 + 4
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
languagesList:
  - value: Understands Common plus one other language but can't speak
damageVulnerabilitiesList:
  - value: Bludgeoning
damageImmunitiesList:
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Shortsword
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Piercing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Piercing
          average: 6
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Shortbow
    entryType: attack
    text: '*Ranged Attack Roll:* +5, range 80/320 ft. 6 (1d6 + 3) Piercing damage.'
    attack:
      type: ranged
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Piercing
          average: 6
      range: 80/320 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Skeleton
*Medium, Undead, Lawful Evil*

**AC** 14
**HP** 13 (2d8 + 4)
**Initiative** +3 (13)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 9
**Languages** Understands Common plus one other language but can't speak
CR 1/4, PB +2, XP 50

## Actions

**Shortsword**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Piercing damage.

**Shortbow**
*Ranged Attack Roll:* +5, range 80/320 ft. 6 (1d6 + 3) Piercing damage.
