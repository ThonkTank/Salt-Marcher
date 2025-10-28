---
smType: creature
name: Shambling Mound
size: Large
type: Plant
alignmentOverride: Unaligned
ac: '15'
initiative: '-1 (9)'
hp: '110'
hitDice: 13d10 + 39
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 20 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+3'
skills:
  - skill: Stealth
    value: '3'
sensesList:
  - type: blindsight
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
damageResistancesList:
  - value: Cold
  - value: Fire
damageImmunitiesList:
  - value: Lightning; Deafened
  - value: Exhaustion
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Lightning Absorption
    entryType: special
    text: Whenever the shambling mound is subjected to Lightning damage, it regains a number of Hit Points equal to the Lightning damage dealt.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The shambling mound makes three Charged Tendril attacks. It can replace one attack with a use of Engulf.
    multiattack:
      attacks:
        - name: Tendril
          count: 1
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Engulf
  - category: action
    name: Charged Tendril
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 10 ft. 7 (1d6 + 4) Bludgeoning damage plus 5 (2d4) Lightning damage. If the target is a Medium or smaller creature, the shambling mound pulls the target 5 feet straight toward itself.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d6
          bonus: 4
          type: Bludgeoning
          average: 7
        - dice: 2d4
          bonus: 0
          type: Lightning
          average: 5
      reach: 10 ft.
      onHit:
        other: If the target is a Medium or smaller creature, the shambling mound pulls the target 5 feet straight toward itself.
      additionalEffects: If the target is a Medium or smaller creature, the shambling mound pulls the target 5 feet straight toward itself.
  - category: action
    name: Engulf
    entryType: save
    text: '*Strength Saving Throw*: DC 15, one Medium or smaller creature within 5 feet. *Failure:*  The target is pulled into the shambling mound''s space and has the Grappled condition (escape DC 14). Until the grapple ends, the target has the Blinded and Restrained conditions, and it takes 10 (3d6) Lightning damage at the start of each of its turns. When the shambling mound moves, the Grappled target moves with it, costing it no extra movement. The shambling mound can have only one creature Grappled by this action at a time.'
    save:
      ability: str
      dc: 15
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          size:
            - Medium
            - smaller
      onFail:
        effects:
          conditions:
            - condition: Grappled
              escape:
                type: dc
                dc: 14
              duration:
                type: until
                trigger: the grapple ends
        damage:
          - dice: 3d6
            bonus: 0
            type: Lightning
            average: 10
---

# Shambling Mound
*Large, Plant, Unaligned*

**AC** 15
**HP** 110 (13d10 + 39)
**Initiative** -1 (9)
**Speed** 30 ft., swim 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 10
CR 5, PB +3, XP 1800

## Traits

**Lightning Absorption**
Whenever the shambling mound is subjected to Lightning damage, it regains a number of Hit Points equal to the Lightning damage dealt.

## Actions

**Multiattack**
The shambling mound makes three Charged Tendril attacks. It can replace one attack with a use of Engulf.

**Charged Tendril**
*Melee Attack Roll:* +7, reach 10 ft. 7 (1d6 + 4) Bludgeoning damage plus 5 (2d4) Lightning damage. If the target is a Medium or smaller creature, the shambling mound pulls the target 5 feet straight toward itself.

**Engulf**
*Strength Saving Throw*: DC 15, one Medium or smaller creature within 5 feet. *Failure:*  The target is pulled into the shambling mound's space and has the Grappled condition (escape DC 14). Until the grapple ends, the target has the Blinded and Restrained conditions, and it takes 10 (3d6) Lightning damage at the start of each of its turns. When the shambling mound moves, the Grappled target moves with it, costing it no extra movement. The shambling mound can have only one creature Grappled by this action at a time.
