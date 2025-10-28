---
smType: creature
name: Fire Giant
size: Huge
type: Giant
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '18'
initiative: +3 (13)
hp: '162'
hitDice: 13d12 + 78
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 25
    saveProf: false
  - key: dex
    score: 9
    saveProf: true
    saveMod: 3
  - key: con
    score: 23
    saveProf: true
    saveMod: 10
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 13
    saveProf: true
    saveMod: 5
pb: '+4'
skills:
  - skill: Athletics
    value: '11'
  - skill: Perception
    value: '6'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Giant
damageImmunitiesList:
  - value: Fire
cr: '9'
xp: '5000'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The giant makes two attacks, using Flame Sword or Hammer Throw in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Flame Sword
    entryType: attack
    text: '*Melee Attack Roll:* +11, reach 10 ft. 21 (4d6 + 7) Slashing damage plus 10 (3d6) Fire damage.'
    attack:
      type: melee
      bonus: 11
      damage:
        - dice: 4d6
          bonus: 7
          type: Slashing
          average: 21
        - dice: 3d6
          bonus: 0
          type: Fire
          average: 10
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Hammer Throw
    entryType: attack
    text: '*Ranged Attack Roll:* +11, range 60/240 ft. 23 (3d10 + 7) Bludgeoning damage plus 4 (1d8) Fire damage, and the target is pushed up to 15 feet straight away from the giant and has Disadvantage on the next attack roll it makes before the end of its next turn.'
    attack:
      type: ranged
      bonus: 11
      damage:
        - dice: 3d10
          bonus: 7
          type: Bludgeoning
          average: 23
        - dice: 1d8
          bonus: 0
          type: Fire
          average: 4
      range: 60/240 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Fire Giant
*Huge, Giant, Lawful Evil*

**AC** 18
**HP** 162 (13d12 + 78)
**Initiative** +3 (13)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Giant
CR 9, PB +4, XP 5000

## Actions

**Multiattack**
The giant makes two attacks, using Flame Sword or Hammer Throw in any combination.

**Flame Sword**
*Melee Attack Roll:* +11, reach 10 ft. 21 (4d6 + 7) Slashing damage plus 10 (3d6) Fire damage.

**Hammer Throw**
*Ranged Attack Roll:* +11, range 60/240 ft. 23 (3d10 + 7) Bludgeoning damage plus 4 (1d8) Fire damage, and the target is pushed up to 15 feet straight away from the giant and has Disadvantage on the next attack roll it makes before the end of its next turn.
