---
smType: creature
name: Warrior Veteran
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '17'
initiative: +3 (13)
hp: '65'
hitDice: 10d8 + 20
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
skills:
  - skill: Athletics
    value: '5'
  - skill: Perception
    value: '2'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Common plus one other language
cr: '3'
xp: '700'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The warrior makes two Greatsword or Heavy Crossbow attacks.
    multiattack:
      attacks:
        - name: Crossbow
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Greatsword
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Slashing
          average: 10
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Heavy Crossbow
    entryType: attack
    text: '*Ranged Attack Roll:* +3, range 100/400 ft. 12 (2d10 + 1) Piercing damage.'
    attack:
      type: ranged
      bonus: 3
      damage:
        - dice: 2d10
          bonus: 1
          type: Piercing
          average: 12
      range: 100/400 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Warrior Veteran
*Small, Humanoid, Neutral Neutral*

**AC** 17
**HP** 65 (10d8 + 20)
**Initiative** +3 (13)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus one other language
CR 3, PB +2, XP 700

## Actions

**Multiattack**
The warrior makes two Greatsword or Heavy Crossbow attacks.

**Greatsword**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage.

**Heavy Crossbow**
*Ranged Attack Roll:* +3, range 100/400 ft. 12 (2d10 + 1) Piercing damage.
