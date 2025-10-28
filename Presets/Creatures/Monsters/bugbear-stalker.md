---
smType: creature
name: Bugbear Stalker
size: Medium
type: Fey
typeTags:
  - value: Goblinoid
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '15'
initiative: +2 (12)
hp: '65'
hitDice: 10d8 + 20
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 14
    saveProf: true
    saveMod: 4
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 3
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '6'
  - skill: Survival
    value: '3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Common
  - value: Goblin
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Abduct
    entryType: special
    text: The bugbear needn't spend extra movement to move a creature it is grappling.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The bugbear makes two Javelin or Morningstar attacks.
    multiattack:
      attacks:
        - name: Morningstar
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Javelin
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +5, reach 10 ft. or range 30/120 ft. 13 (3d6 + 3) Piercing damage.'
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Morningstar
    entryType: attack
    text: '*Melee Attack Roll:* +5 (with Advantage if the target is Grappled by the bugbear), reach 10 ft. 12 (2d8 + 3) Piercing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d8
          bonus: 3
          type: Piercing
          average: 12
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Quick Grapple
    entryType: save
    text: '*Dexterity Saving Throw*: DC 13, one Medium or smaller creature the bugbear can see within 10 feet. *Failure:*  The target has the Grappled condition (escape DC 13).'
    save:
      ability: dex
      dc: 13
      targeting:
        type: single
        range: 10 ft.
        restrictions:
          size:
            - Medium
            - smaller
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Grappled
              escape:
                type: dc
                dc: 13
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Bugbear Stalker
*Medium, Fey, Chaotic Evil*

**AC** 15
**HP** 65 (10d8 + 20)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 11
**Languages** Common, Goblin
CR 3, PB +2, XP 700

## Traits

**Abduct**
The bugbear needn't spend extra movement to move a creature it is grappling.

## Actions

**Multiattack**
The bugbear makes two Javelin or Morningstar attacks.

**Javelin**
*Melee or Ranged Attack Roll:* +5, reach 10 ft. or range 30/120 ft. 13 (3d6 + 3) Piercing damage.

**Morningstar**
*Melee Attack Roll:* +5 (with Advantage if the target is Grappled by the bugbear), reach 10 ft. 12 (2d8 + 3) Piercing damage.

## Bonus Actions

**Quick Grapple**
*Dexterity Saving Throw*: DC 13, one Medium or smaller creature the bugbear can see within 10 feet. *Failure:*  The target has the Grappled condition (escape DC 13).
