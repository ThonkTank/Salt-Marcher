---
smType: creature
name: Raven
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '2'
hitDice: 1d4
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 50 ft.
abilities:
  - key: str
    score: 2
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
passivesList:
  - skill: Perception
    value: '13'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Mimicry
    entryType: special
    text: The raven can mimic simple sounds it has heard, such as a whisper or chitter. A hearer can discern the sounds are imitations with a successful DC 10 Wisdom (Insight) check.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Beak
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 1 Piercing damage.'
    attack:
      type: melee
      bonus: 4
      damage: []
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Raven
*Small, Beast, Unaligned*

**AC** 12
**HP** 2 (1d4)
**Initiative** +2 (12)
**Speed** 10 ft., fly 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 0, PB +2, XP 0

## Traits

**Mimicry**
The raven can mimic simple sounds it has heard, such as a whisper or chitter. A hearer can discern the sounds are imitations with a successful DC 10 Wisdom (Insight) check.

## Actions

**Beak**
*Melee Attack Roll:* +4, reach 5 ft. 1 Piercing damage.
