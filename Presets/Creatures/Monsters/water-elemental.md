---
smType: creature
name: Water Elemental
size: Large
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '14'
initiative: +2 (12)
hp: '114'
hitDice: 12d10 + 48
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 90 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Primordial (Aquan)
damageResistancesList:
  - value: Acid
  - value: Fire
damageImmunitiesList:
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Prone
  - value: Restrained
  - value: Unconscious
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Freeze
    entryType: special
    text: If the elemental takes Cold damage, its Speed decreases by 20 feet until the end of its next turn.
  - category: trait
    name: Water Form
    entryType: special
    text: The elemental can enter an enemy's space and stop there. It can move through a space as narrow as 1 inch without expending extra movement to do so.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The elemental makes two Slam attacks.
    multiattack:
      attacks:
        - name: Slam
          count: 2
      substitutions: []
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 4
          type: Bludgeoning
          average: 13
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Medium or smaller
      additionalEffects: If the target is a Medium or smaller creature, it has the Prone condition.
  - category: action
    name: Whelm (Recharge 4-6)
    entryType: save
    text: '*Strength Saving Throw*: DC 15, each creature in the elemental''s space. *Failure:*  22 (4d8 + 4) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14). Until the grapple ends, the target has the Restrained condition, is suffocating unless it can breathe water, and takes 9 (2d8) Bludgeoning damage at the start of each of the elemental''s turns. The elemental can grapple one Large creature or up to two Medium or smaller creatures at a time with Whelm. As an action, a creature within 5 feet of the elemental can pull a creature out of it by succeeding on a DC 14 Strength (Athletics) check. *Success:*  Half damage only.'
    recharge: 4-6
    save:
      ability: str
      dc: 15
      targeting:
        type: single
        restrictions:
          creatureTypes:
            - creature
      onFail:
        effects:
          conditions:
            - condition: Grappled
              escape:
                type: dc
                dc: 14
              restrictions:
                size: Large or smaller
              duration:
                type: until
                trigger: the grapple ends
            - condition: Restrained
              escape:
                type: dc
                dc: 14
              restrictions:
                size: Large or smaller
              duration:
                type: until
                trigger: the grapple ends
        damage:
          - dice: 4d8
            bonus: 4
            type: Bludgeoning
            average: 22
          - dice: 2d8
            bonus: 0
            type: Bludgeoning
            average: 9
      onSuccess:
        damage: half
        legacyText: Half damage only.
---

# Water Elemental
*Large, Elemental, Neutral Neutral*

**AC** 14
**HP** 114 (12d10 + 48)
**Initiative** +2 (12)
**Speed** 30 ft., swim 90 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Primordial (Aquan)
CR 5, PB +3, XP 1800

## Traits

**Freeze**
If the elemental takes Cold damage, its Speed decreases by 20 feet until the end of its next turn.

**Water Form**
The elemental can enter an enemy's space and stop there. It can move through a space as narrow as 1 inch without expending extra movement to do so.

## Actions

**Multiattack**
The elemental makes two Slam attacks.

**Slam**
*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Prone condition.

**Whelm (Recharge 4-6)**
*Strength Saving Throw*: DC 15, each creature in the elemental's space. *Failure:*  22 (4d8 + 4) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14). Until the grapple ends, the target has the Restrained condition, is suffocating unless it can breathe water, and takes 9 (2d8) Bludgeoning damage at the start of each of the elemental's turns. The elemental can grapple one Large creature or up to two Medium or smaller creatures at a time with Whelm. As an action, a creature within 5 feet of the elemental can pull a creature out of it by succeeding on a DC 14 Strength (Athletics) check. *Success:*  Half damage only.
