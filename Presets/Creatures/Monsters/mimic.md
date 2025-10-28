---
smType: creature
name: Mimic
size: Medium
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '12'
initiative: +3 (13)
hp: '58'
hitDice: 9d8 + 18
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
damageImmunitiesList:
  - value: Acid; Prone
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Adhesive (Object Form Only)
    entryType: special
    text: The mimic adheres to anything that touches it. A Huge or smaller creature adhered to the mimic has the Grappled condition (escape DC 13). Ability checks made to escape this grapple have Disadvantage.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5 (with Advantage if the target is Grappled by the mimic), reach 5 ft. 7 (1d8 + 3) Piercing damage—or 12 (2d8 + 3) Piercing damage if the target is Grappled by the mimic—plus 4 (1d8) Acid damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Piercing
          average: 7
        - dice: 2d8
          bonus: 3
          type: Piercing
          average: 12
        - dice: 1d8
          bonus: 0
          type: Acid
          average: 4
      reach: 5 ft.
  - category: action
    name: Pseudopod
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Bludgeoning damage plus 4 (1d8) Acid damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13). Ability checks made to escape this grapple have Disadvantage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Bludgeoning
          average: 7
        - dice: 1d8
          bonus: 0
          type: Acid
          average: 4
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 13
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13). Ability checks made to escape this grapple have Disadvantage.
  - category: bonus
    name: Shape-Shift
    entryType: special
    text: The mimic shape-shifts to resemble a Medium or Small object while retaining its game statistics, or it returns to its true blob form. Any equipment it is wearing or carrying isn't transformed.
---

# Mimic
*Medium, Monstrosity, Neutral Neutral*

**AC** 12
**HP** 58 (9d8 + 18)
**Initiative** +3 (13)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 11
CR 2, PB +2, XP 450

## Traits

**Adhesive (Object Form Only)**
The mimic adheres to anything that touches it. A Huge or smaller creature adhered to the mimic has the Grappled condition (escape DC 13). Ability checks made to escape this grapple have Disadvantage.

## Actions

**Bite**
*Melee Attack Roll:* +5 (with Advantage if the target is Grappled by the mimic), reach 5 ft. 7 (1d8 + 3) Piercing damage—or 12 (2d8 + 3) Piercing damage if the target is Grappled by the mimic—plus 4 (1d8) Acid damage.

**Pseudopod**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Bludgeoning damage plus 4 (1d8) Acid damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13). Ability checks made to escape this grapple have Disadvantage.

## Bonus Actions

**Shape-Shift**
The mimic shape-shifts to resemble a Medium or Small object while retaining its game statistics, or it returns to its true blob form. Any equipment it is wearing or carrying isn't transformed.
