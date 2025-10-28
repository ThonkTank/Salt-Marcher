---
smType: creature
name: Tough Boss
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '16'
initiative: +2 (12)
hp: '82'
hitDice: 11d8 + 33
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 17
    saveProf: true
    saveMod: 5
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 16
    saveProf: true
    saveMod: 5
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 11
    saveProf: true
    saveMod: 2
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common plus one other language
cr: '4'
xp: '1100'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The tough has Advantage on an attack roll against a creature if at least one of the tough's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: special
    text: The tough makes two attacks, using Warhammer or Heavy Crossbow in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Warhammer
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 12 (2d8 + 3) Bludgeoning damage. If the target is a Large or smaller creature, the tough pushes the target up to 10 feet straight away from itself.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d8
          bonus: 3
          type: Bludgeoning
          average: 12
      reach: 5 ft.
      onHit:
        other: If the target is a Large or smaller creature, the tough pushes the target up to 10 feet straight away from itself.
      additionalEffects: If the target is a Large or smaller creature, the tough pushes the target up to 10 feet straight away from itself.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Heavy Crossbow
    entryType: attack
    text: '*Ranged Attack Roll:* +4, range 100/400 ft. 13 (2d10 + 2) Piercing damage.'
    attack:
      type: ranged
      bonus: 4
      damage:
        - dice: 2d10
          bonus: 2
          type: Piercing
          average: 13
      range: 100/400 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Tough Boss
*Small, Humanoid, Neutral Neutral*

**AC** 16
**HP** 82 (11d8 + 33)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus one other language
CR 4, PB +2, XP 1100

## Traits

**Pack Tactics**
The tough has Advantage on an attack roll against a creature if at least one of the tough's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Multiattack**
The tough makes two attacks, using Warhammer or Heavy Crossbow in any combination.

**Warhammer**
*Melee Attack Roll:* +5, reach 5 ft. 12 (2d8 + 3) Bludgeoning damage. If the target is a Large or smaller creature, the tough pushes the target up to 10 feet straight away from itself.

**Heavy Crossbow**
*Ranged Attack Roll:* +4, range 100/400 ft. 13 (2d10 + 2) Piercing damage.
