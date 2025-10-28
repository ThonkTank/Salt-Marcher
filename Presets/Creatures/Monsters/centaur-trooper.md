---
smType: creature
name: Centaur Trooper
size: Large
type: Fey
alignmentLawChaos: Neutral
alignmentGoodEvil: Good
ac: '16'
initiative: +2 (12)
hp: '45'
hitDice: 6d10 + 12
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 9
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
skills:
  - skill: Athletics
    value: '6'
  - skill: Perception
    value: '3'
passivesList:
  - skill: Perception
    value: '13'
languagesList:
  - value: Elvish
  - value: Sylvan
cr: '2'
xp: '450'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The centaur makes two attacks, using Pike or Longbow in any combination.
  - category: action
    name: Pike
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 9 (1d10 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d10
          bonus: 4
          type: Piercing
          average: 9
      reach: 10 ft.
  - category: action
    name: Longbow
    entryType: attack
    text: '*Ranged Attack Roll:* +4, range 150/600 ft. 6 (1d8 + 2) Piercing damage.'
    attack:
      type: ranged
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Piercing
          average: 6
      range: 150/600 ft.
  - category: bonus
    name: Trampling Charge (Recharge 5-6)
    entryType: save
    text: 'The centaur moves up to its Speed without provoking Opportunity Attacks and can move through the spaces of Medium or smaller creatures. Each creature whose space the centaur enters is targeted once by the following effect. *Strength Saving Throw*: DC 14. *Failure:*  7 (1d6 + 4) Bludgeoning damage, and the target has the Prone condition.'
    recharge: 5-6
    save:
      ability: str
      dc: 14
      onFail:
        effects:
          conditions:
            - condition: Prone
        damage:
          - dice: 1d6
            bonus: 4
            type: Bludgeoning
            average: 7
---

# Centaur Trooper
*Large, Fey, Neutral Good*

**AC** 16
**HP** 45 (6d10 + 12)
**Initiative** +2 (12)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Elvish, Sylvan
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The centaur makes two attacks, using Pike or Longbow in any combination.

**Pike**
*Melee Attack Roll:* +6, reach 10 ft. 9 (1d10 + 4) Piercing damage.

**Longbow**
*Ranged Attack Roll:* +4, range 150/600 ft. 6 (1d8 + 2) Piercing damage.

## Bonus Actions

**Trampling Charge (Recharge 5-6)**
The centaur moves up to its Speed without provoking Opportunity Attacks and can move through the spaces of Medium or smaller creatures. Each creature whose space the centaur enters is targeted once by the following effect. *Strength Saving Throw*: DC 14. *Failure:*  7 (1d6 + 4) Bludgeoning damage, and the target has the Prone condition.
