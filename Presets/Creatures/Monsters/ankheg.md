---
smType: creature
name: Ankheg
size: Large
type: Monstrosity
alignmentOverride: Unaligned
ac: '14'
initiative: +0 (10)
hp: '45'
hitDice: 6d10 + 12
speeds:
  walk:
    distance: 30 ft.
  burrow:
    distance: 10 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
  - type: tremorsense
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Tunneler
    entryType: special
    text: The ankheg can burrow through solid rock at half its Burrow Speed and leaves a 10-foot-diameter tunnel in its wake.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5 (with Advantage if the target is Grappled by the ankheg), reach 5 ft. 10 (2d6 + 3) Slashing damage plus 3 (1d6) Acid damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13).'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Slashing
          average: 10
        - dice: 1d6
          bonus: 0
          type: Acid
          average: 3
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 13
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13).
  - category: action
    name: Acid Spray
    entryType: save
    text: '*Dexterity Saving Throw*: DC 12, each creature in a 30-foot-long, 5-foot-wide Line. *Failure:*  14 (4d6) Acid damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 12
      targeting:
        shape: line
        size: 30 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 14 (4d6) Acid damage.
        damage:
          - dice: 4d6
            bonus: 0
            type: Acid
            average: 14
        legacyEffects: 14 (4d6) Acid damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
---

# Ankheg
*Large, Monstrosity, Unaligned*

**AC** 14
**HP** 45 (6d10 + 12)
**Initiative** +0 (10)
**Speed** 30 ft., burrow 10 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft., tremorsense 60 ft.; Passive Perception 11
CR 2, PB +2, XP 450

## Traits

**Tunneler**
The ankheg can burrow through solid rock at half its Burrow Speed and leaves a 10-foot-diameter tunnel in its wake.

## Actions

**Bite**
*Melee Attack Roll:* +5 (with Advantage if the target is Grappled by the ankheg), reach 5 ft. 10 (2d6 + 3) Slashing damage plus 3 (1d6) Acid damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13).

**Acid Spray (Recharge 6)**
*Dexterity Saving Throw*: DC 12, each creature in a 30-foot-long, 5-foot-wide Line. *Failure:*  14 (4d6) Acid damage. *Success:*  Half damage.
