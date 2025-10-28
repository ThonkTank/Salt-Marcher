---
smType: creature
name: Animated Flying Sword
size: Small
type: Construct
alignmentOverride: Unaligned
ac: '17'
initiative: +4 (14)
hp: '14'
hitDice: 4d6
speeds:
  walk:
    distance: 5 ft.
  fly:
    distance: 50 ft.
    hover: true
abilities:
  - key: str
    score: 12
    saveProf: false
  - key: dex
    score: 15
    saveProf: true
    saveMod: 4
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 5
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
    value: '7'
damageImmunitiesList:
  - value: Poison
  - value: Psychic; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Deafened
  - value: Frightened
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Slash
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Slashing
          average: 6
      reach: 5 ft.
---

# Animated Flying Sword
*Small, Construct, Unaligned*

**AC** 17
**HP** 14 (4d6)
**Initiative** +4 (14)
**Speed** 5 ft., fly 50 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 7
CR 1/4, PB +2, XP 50

## Actions

**Slash**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage.
