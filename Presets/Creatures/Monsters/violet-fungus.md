---
smType: creature
name: Violet Fungus
size: Medium
type: Plant
alignmentOverride: Unaligned
ac: '5'
initiative: '-5 (5)'
hp: '18'
hitDice: 4d8
speeds:
  walk:
    distance: 5 ft.
abilities:
  - key: str
    score: 3
    saveProf: false
  - key: dex
    score: 1
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 3
    saveProf: false
  - key: cha
    score: 1
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '30'
passivesList:
  - skill: Perception
    value: '6'
conditionImmunitiesList:
  - value: Blinded
  - value: Charmed
  - value: Deafened
  - value: Frightened
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The fungus makes two Rotting Touch attacks.
    multiattack:
      attacks:
        - name: Touch
          count: 1
      substitutions: []
  - category: action
    name: Rotting Touch
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 10 ft. 4 (1d8) Necrotic damage.'
    attack:
      type: melee
      bonus: 2
      damage:
        - dice: 1d8
          bonus: 0
          type: Necrotic
          average: 4
      reach: 10 ft.
---

# Violet Fungus
*Medium, Plant, Unaligned*

**AC** 5
**HP** 18 (4d8)
**Initiative** -5 (5)
**Speed** 5 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft.; Passive Perception 6
CR 1/4, PB +2, XP 50

## Actions

**Multiattack**
The fungus makes two Rotting Touch attacks.

**Rotting Touch**
*Melee Attack Roll:* +2, reach 10 ft. 4 (1d8) Necrotic damage.
