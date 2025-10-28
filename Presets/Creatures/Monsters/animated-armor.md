---
smType: creature
name: Animated Armor
size: Medium
type: Construct
alignmentOverride: Unaligned
ac: '18'
initiative: +2 (12)
hp: '33'
hitDice: 6d8 + 6
speeds:
  walk:
    distance: 25 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 13
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
    range: '60'
passivesList:
  - skill: Perception
    value: '6'
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
cr: '1'
xp: '200'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The armor makes two Slam attacks.
    multiattack:
      attacks:
        - name: Slam
          count: 2
      substitutions: []
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Bludgeoning
          average: 5
      reach: 5 ft.
---

# Animated Armor
*Medium, Construct, Unaligned*

**AC** 18
**HP** 33 (6d8 + 6)
**Initiative** +2 (12)
**Speed** 25 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 6
CR 1, PB +2, XP 200

## Actions

**Multiattack**
The armor makes two Slam attacks.

**Slam**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Bludgeoning damage.
