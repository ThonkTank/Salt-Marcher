---
smType: creature
name: Bugbear Warrior
size: Medium
type: Fey
typeTags:
  - value: Goblinoid
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '14'
initiative: +2 (12)
hp: '33'
hitDice: 6d8 + 6
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 8
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 9
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '6'
  - skill: Survival
    value: '2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common
  - value: Goblin
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Abduct
    entryType: special
    text: The bugbear needn't spend extra movement to move a creature it is grappling.
  - category: action
    name: Grab
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 10 ft. 9 (2d6 + 2) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12).'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d6
          bonus: 2
          type: Bludgeoning
          average: 9
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 12
            restrictions:
              size: Medium or smaller
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12).
  - category: action
    name: Light Hammer
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +4 (with Advantage if the target is Grappled by the bugbear), reach 10 ft. or range 20/60 ft. 9 (3d4 + 2) Bludgeoning damage.'
---

# Bugbear Warrior
*Medium, Fey, Chaotic Evil*

**AC** 14
**HP** 33 (6d8 + 6)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Common, Goblin
CR 1, PB +2, XP 200

## Traits

**Abduct**
The bugbear needn't spend extra movement to move a creature it is grappling.

## Actions

**Grab**
*Melee Attack Roll:* +4, reach 10 ft. 9 (2d6 + 2) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12).

**Light Hammer**
*Melee or Ranged Attack Roll:* +4 (with Advantage if the target is Grappled by the bugbear), reach 10 ft. or range 20/60 ft. 9 (3d4 + 2) Bludgeoning damage.
