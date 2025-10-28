---
smType: creature
name: Giant Spider
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '14'
initiative: +3 (13)
hp: '26'
hitDice: 4d10 + 4
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 4
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '7'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Spider Climb
    entryType: special
    text: The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check.
  - category: trait
    name: Web Walker
    entryType: special
    text: The spider ignores movement restrictions caused by webs, and it knows the location of any other creature in contact with the same web.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 7 (2d6) Poison damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Piercing
          average: 7
        - dice: 2d6
          bonus: 0
          type: Poison
          average: 7
      reach: 5 ft.
  - category: action
    name: Web (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 13, one creature the spider can see within 60 feet. *Failure:*  The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Poison and Psychic damage).'
    recharge: 5-6
    save:
      ability: dex
      dc: 13
      targeting:
        type: single
        range: 60 ft.
        restrictions:
          visibility: true
      area: one creature the spider can see within 60 feet
      onFail:
        effects:
          conditions:
            - condition: Restrained
              duration:
                type: until
                trigger: the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Poison and Psychic damage)
          other: The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Poison and Psychic damage).
        legacyEffects: The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Poison and Psychic damage).
---

# Giant Spider
*Large, Beast, Unaligned*

**AC** 14
**HP** 26 (4d10 + 4)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
CR 1, PB +2, XP 200

## Traits

**Spider Climb**
The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check.

**Web Walker**
The spider ignores movement restrictions caused by webs, and it knows the location of any other creature in contact with the same web.

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 7 (2d6) Poison damage.

**Web (Recharge 5-6)**
*Dexterity Saving Throw*: DC 13, one creature the spider can see within 60 feet. *Failure:*  The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Poison and Psychic damage).
