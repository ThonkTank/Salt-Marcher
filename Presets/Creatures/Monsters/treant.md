---
smType: creature
name: Treant
size: Huge
type: Plant
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '16'
initiative: +3 (13)
hp: '138'
hitDice: 12d12 + 60
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 21
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 16
    saveProf: false
  - key: cha
    score: 12
    saveProf: false
pb: '+4'
passivesList:
  - skill: Perception
    value: '13'
languagesList:
  - value: Common
  - value: Druidic
  - value: Elvish
  - value: Sylvan
damageVulnerabilitiesList:
  - value: Fire
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
cr: '9'
xp: '5000'
entries:
  - category: trait
    name: Siege Monster
    entryType: special
    text: The treant deals double damage to objects and structures.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The treant makes two Slam attacks.
    multiattack:
      attacks:
        - name: Slam
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 5 ft. 16 (3d6 + 6) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 3d6
          bonus: 6
          type: Bludgeoning
          average: 16
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Hail of Bark
    entryType: attack
    text: '*Ranged Attack Roll:* +10, range 180 ft. 28 (4d10 + 6) Piercing damage.'
    attack:
      type: ranged
      bonus: 10
      damage:
        - dice: 4d10
          bonus: 6
          type: Piercing
          average: 28
      range: 180 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Animate Trees (1/Day)
    entryType: special
    text: The treant magically animates up to two trees it can see within 60 feet of itself. Each tree uses the Treant stat block, except it has Intelligence and Charisma scores of 1, it can't speak, and it lacks this action. The tree takes its turn immediately after the treant on the same Initiative count, and it obeys the treant. A tree remains animate for 1 day or until it dies, the treant dies, or it is more than 120 feet from the treant. The tree then takes root if possible.
    limitedUse:
      count: 1
      reset: day
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Treant
*Huge, Plant, Chaotic Good*

**AC** 16
**HP** 138 (12d12 + 60)
**Initiative** +3 (13)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common, Druidic, Elvish, Sylvan
CR 9, PB +4, XP 5000

## Traits

**Siege Monster**
The treant deals double damage to objects and structures.

## Actions

**Multiattack**
The treant makes two Slam attacks.

**Slam**
*Melee Attack Roll:* +10, reach 5 ft. 16 (3d6 + 6) Bludgeoning damage.

**Hail of Bark**
*Ranged Attack Roll:* +10, range 180 ft. 28 (4d10 + 6) Piercing damage.

**Animate Trees (1/Day)**
The treant magically animates up to two trees it can see within 60 feet of itself. Each tree uses the Treant stat block, except it has Intelligence and Charisma scores of 1, it can't speak, and it lacks this action. The tree takes its turn immediately after the treant on the same Initiative count, and it obeys the treant. A tree remains animate for 1 day or until it dies, the treant dies, or it is more than 120 feet from the treant. The tree then takes root if possible.
