---
smType: creature
name: Goblin Minion
size: Small
type: Fey
typeTags:
  - value: Goblinoid
alignmentLawChaos: Chaotic
alignmentGoodEvil: Neutral
ac: '12'
initiative: +2 (12)
hp: '7'
hitDice: 2d6
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 8
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '6'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
languagesList:
  - value: Common
  - value: Goblin
cr: 1/8
xp: '25'
entries:
  - category: action
    name: Dagger
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +4, reach 5 ft. or range 20/60 ft. 4 (1d4 + 2) Piercing damage.'
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Nimble Escape
    entryType: special
    text: The goblin takes the Disengage or Hide action.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Goblin Minion
*Small, Fey, Chaotic Neutral*

**AC** 12
**HP** 7 (2d6)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 9
**Languages** Common, Goblin
CR 1/8, PB +2, XP 25

## Actions

**Dagger**
*Melee or Ranged Attack Roll:* +4, reach 5 ft. or range 20/60 ft. 4 (1d4 + 2) Piercing damage.

## Bonus Actions

**Nimble Escape**
The goblin takes the Disengage or Hide action.
