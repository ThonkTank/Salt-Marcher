---
smType: creature
name: Invisible Stalker
size: Large
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '14'
initiative: +7 (17)
hp: '97'
hitDice: 13d10 + 26
speeds:
  walk:
    distance: 50 ft.
  fly:
    distance: 50 ft.
    hover: true
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 19
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 15
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '8'
  - skill: Stealth
    value: '10'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '18'
languagesList:
  - value: Common
  - value: Primordial (Auran)
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
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
cr: '6'
xp: '2300'
entries:
  - category: trait
    name: Air Form
    entryType: special
    text: The stalker can enter an enemy's space and stop there. It can move through a space as narrow as 1 inch without expending extra movement to do so.
  - category: trait
    name: Invisibility
    entryType: special
    text: The stalker has the Invisible condition.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The stalker makes three Wind Swipe attacks. It can replace one attack with a use of Vortex.
    multiattack:
      attacks:
        - name: Swipe
          count: 1
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Vortex
  - category: action
    name: Wind Swipe
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 11 (2d6 + 4) Force damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d6
          bonus: 4
          type: Force
          average: 11
      reach: 5 ft.
  - category: action
    name: Vortex
    entryType: save
    text: '*Constitution Saving Throw*: DC 14, one Large or smaller creature in the stalker''s space. *Failure:*  7 (1d8 + 3) Thunder damage, and the target has the Grappled condition (escape DC 13). Until the grapple ends, the target can''t cast spells with a Verbal component and takes 7 (2d6) Thunder damage at the start of each of the stalker''s turns.'
    save:
      ability: con
      dc: 14
      targeting:
        type: single
        restrictions:
          size:
            - Large
            - smaller
      onFail:
        effects:
          conditions:
            - condition: Grappled
              escape:
                type: dc
                dc: 13
              duration:
                type: until
                trigger: the grapple ends
        damage:
          - dice: 1d8
            bonus: 3
            type: Thunder
            average: 7
          - dice: 2d6
            bonus: 0
            type: Thunder
            average: 7
---

# Invisible Stalker
*Large, Elemental, Neutral Neutral*

**AC** 14
**HP** 97 (13d10 + 26)
**Initiative** +7 (17)
**Speed** 50 ft., fly 50 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 18
**Languages** Common, Primordial (Auran)
CR 6, PB +3, XP 2300

## Traits

**Air Form**
The stalker can enter an enemy's space and stop there. It can move through a space as narrow as 1 inch without expending extra movement to do so.

**Invisibility**
The stalker has the Invisible condition.

## Actions

**Multiattack**
The stalker makes three Wind Swipe attacks. It can replace one attack with a use of Vortex.

**Wind Swipe**
*Melee Attack Roll:* +7, reach 5 ft. 11 (2d6 + 4) Force damage.

**Vortex**
*Constitution Saving Throw*: DC 14, one Large or smaller creature in the stalker's space. *Failure:*  7 (1d8 + 3) Thunder damage, and the target has the Grappled condition (escape DC 13). Until the grapple ends, the target can't cast spells with a Verbal component and takes 7 (2d6) Thunder damage at the start of each of the stalker's turns.
