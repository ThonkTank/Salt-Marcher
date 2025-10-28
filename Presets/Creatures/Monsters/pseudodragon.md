---
smType: creature
name: Pseudodragon
size: Small
type: Dragon
alignmentLawChaos: Neutral
alignmentGoodEvil: Good
ac: '14'
initiative: +2 (12)
hp: '10'
hitDice: 3d4 + 3
speeds:
  walk:
    distance: 15 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 6
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '4'
sensesList:
  - type: blindsight
    range: '10'
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Understands Common and Draconic but can't speak
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The pseudodragon has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The pseudodragon makes two Bite attacks.
    multiattack:
      attacks:
        - name: Bite
          count: 2
      substitutions: []
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Piercing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d4
          bonus: 2
          type: Piercing
          average: 4
      reach: 5 ft.
  - category: action
    name: Sting
    entryType: save
    text: '*Constitution Saving Throw*: DC 12, one creature the pseudodragon can see within 5 feet. *Failure:*  5 (2d4) Poison damage, and the target has the Poisoned condition for 1 hour. *Failure by 5 or More:* While Poisoned, the target also has the Unconscious condition, which ends early if the target takes damage or a creature within 5 feet of it takes an action to wake it.'
    save:
      ability: con
      dc: 12
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Poisoned
              duration:
                type: hours
                count: 1
              restrictions:
                while: While Poisoned, the target also has the Unconscious condition
            - condition: Unconscious
              duration:
                type: hours
                count: 1
              restrictions:
                while: While Poisoned, the target also has the Unconscious condition
        damage:
          - dice: 2d4
            bonus: 0
            type: Poison
            average: 5
---

# Pseudodragon
*Small, Dragon, Neutral Good*

**AC** 14
**HP** 10 (3d4 + 3)
**Initiative** +2 (12)
**Speed** 15 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 15
**Languages** Understands Common and Draconic but can't speak
CR 1/4, PB +2, XP 50

## Traits

**Magic Resistance**
The pseudodragon has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The pseudodragon makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Piercing damage.

**Sting**
*Constitution Saving Throw*: DC 12, one creature the pseudodragon can see within 5 feet. *Failure:*  5 (2d4) Poison damage, and the target has the Poisoned condition for 1 hour. *Failure by 5 or More:* While Poisoned, the target also has the Unconscious condition, which ends early if the target takes damage or a creature within 5 feet of it takes an action to wake it.
