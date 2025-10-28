---
smType: creature
name: Gorgon
size: Large
type: Construct
alignmentOverride: Unaligned
ac: '19'
initiative: +0 (10)
hp: '114'
hitDice: 12d10 + 48
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 20
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '7'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '17'
damageImmunitiesList:
  - value: Exhaustion
conditionImmunitiesList:
  - value: Petrified
cr: '5'
xp: '1800'
entries:
  - category: action
    name: Gore
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 5 ft. 18 (2d12 + 5) Piercing damage. If the target is a Large or smaller creature and the gorgon moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 2d12
          bonus: 5
          type: Piercing
          average: 18
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature and the gorgon moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.
  - category: action
    name: Petrifying Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 15, each creature in a 30-foot Cone. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.'
    recharge: 5-6
    save:
      ability: con
      dc: 15
  - category: bonus
    name: Trample
    entryType: save
    text: '*Dexterity Saving Throw*: DC 16, one creature within 5 feet that has the Prone condition. *Failure:*  16 (2d10 + 5) Bludgeoning damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 16
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          conditions:
            - Prone
      onFail:
        effects:
          other: 16 (2d10 + 5) Bludgeoning damage.
        damage:
          - dice: 2d10
            bonus: 5
            type: Bludgeoning
            average: 16
        legacyEffects: 16 (2d10 + 5) Bludgeoning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
---

# Gorgon
*Large, Construct, Unaligned*

**AC** 19
**HP** 114 (12d10 + 48)
**Initiative** +0 (10)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 17
CR 5, PB +3, XP 1800

## Actions

**Gore**
*Melee Attack Roll:* +8, reach 5 ft. 18 (2d12 + 5) Piercing damage. If the target is a Large or smaller creature and the gorgon moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.

**Petrifying Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 15, each creature in a 30-foot Cone. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.

## Bonus Actions

**Trample**
*Dexterity Saving Throw*: DC 16, one creature within 5 feet that has the Prone condition. *Failure:*  16 (2d10 + 5) Bludgeoning damage. *Success:*  Half damage.
