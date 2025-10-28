---
smType: creature
name: Frost Giant
size: Huge
type: Giant
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '15'
initiative: +2 (12)
hp: '149'
hitDice: 13d12 + 65
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 9
    saveProf: false
  - key: con
    score: 21
    saveProf: true
    saveMod: 8
  - key: int
    score: 9
    saveProf: false
  - key: wis
    score: 10
    saveProf: true
    saveMod: 3
  - key: cha
    score: 12
    saveProf: true
    saveMod: 4
pb: '+3'
skills:
  - skill: Athletics
    value: '9'
  - skill: Perception
    value: '3'
passivesList:
  - skill: Perception
    value: '13'
languagesList:
  - value: Giant
damageImmunitiesList:
  - value: Cold
cr: '8'
xp: '3900'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The giant makes two attacks, using Frost Axe or Great Bow in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Frost Axe
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 10 ft. 19 (2d12 + 6) Slashing damage plus 9 (2d8) Cold damage.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 2d12
          bonus: 6
          type: Slashing
          average: 19
        - dice: 2d8
          bonus: 0
          type: Cold
          average: 9
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Great Bow
    entryType: attack
    text: '*Ranged Attack Roll:* +9, range 150/600 ft. 17 (2d10 + 6) Piercing damage plus 7 (2d6) Cold damage, and the target''s Speed decreases by 10 feet until the end of its next turn.'
    attack:
      type: ranged
      bonus: 9
      damage:
        - dice: 2d10
          bonus: 6
          type: Piercing
          average: 17
        - dice: 2d6
          bonus: 0
          type: Cold
          average: 7
      range: 150/600 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: War Cry (Recharge 5-6)
    entryType: special
    text: The giant or one creature of its choice that can see or hear it gains 16 (2d10 + 5) Temporary Hit Points and has Advantage on attack rolls until the start of the giant's next turn.
    recharge: 5-6
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Frost Giant
*Huge, Giant, Neutral Evil*

**AC** 15
**HP** 149 (13d12 + 65)
**Initiative** +2 (12)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Giant
CR 8, PB +3, XP 3900

## Actions

**Multiattack**
The giant makes two attacks, using Frost Axe or Great Bow in any combination.

**Frost Axe**
*Melee Attack Roll:* +9, reach 10 ft. 19 (2d12 + 6) Slashing damage plus 9 (2d8) Cold damage.

**Great Bow**
*Ranged Attack Roll:* +9, range 150/600 ft. 17 (2d10 + 6) Piercing damage plus 7 (2d6) Cold damage, and the target's Speed decreases by 10 feet until the end of its next turn.

## Bonus Actions

**War Cry (Recharge 5-6)**
The giant or one creature of its choice that can see or hear it gains 16 (2d10 + 5) Temporary Hit Points and has Advantage on attack rolls until the start of the giant's next turn.
