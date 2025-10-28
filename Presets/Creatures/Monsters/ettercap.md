---
smType: creature
name: Ettercap
size: Medium
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '13'
initiative: +2 (12)
hp: '44'
hitDice: 8d8 + 8
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
    score: 15
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
  - skill: Stealth
    value: '4'
  - skill: Survival
    value: '3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Spider Climb
    entryType: special
    text: The ettercap can climb difficult surfaces, including along ceilings, without needing to make an ability check.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Web Walker
    entryType: special
    text: The ettercap ignores movement restrictions caused by webs, and the ettercap knows the location of any other creature in contact with the same web.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The ettercap makes one Bite attack and one Claw attack.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Claw
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 2 (1d4) Poison damage, and the target has the Poisoned condition until the start of the ettercap''s next turn.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
        - dice: 1d4
          bonus: 0
          type: Poison
          average: 2
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 7 (2d4 + 2) Slashing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d4
          bonus: 2
          type: Slashing
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Web Strand (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 12, one Large or smaller creature the ettercap can see within 30 feet. *Failure:*  The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Bludgeoning, Poison, and Psychic damage).'
    recharge: 5-6
    save:
      ability: dex
      dc: 12
      targeting:
        type: single
        range: 30 ft.
        restrictions:
          size:
            - Large
            - smaller
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Restrained
              duration:
                type: until
                trigger: the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Bludgeoning
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Reel
    entryType: special
    text: The ettercap pulls one creature within 30 feet of itself that is Restrained by its Web Strand up to 25 feet straight toward itself.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Ettercap
*Medium, Monstrosity, Neutral Evil*

**AC** 13
**HP** 44 (8d8 + 8)
**Initiative** +2 (12)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 2, PB +2, XP 450

## Traits

**Spider Climb**
The ettercap can climb difficult surfaces, including along ceilings, without needing to make an ability check.

**Web Walker**
The ettercap ignores movement restrictions caused by webs, and the ettercap knows the location of any other creature in contact with the same web.

## Actions

**Multiattack**
The ettercap makes one Bite attack and one Claw attack.

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 2 (1d4) Poison damage, and the target has the Poisoned condition until the start of the ettercap's next turn.

**Claw**
*Melee Attack Roll:* +4, reach 5 ft. 7 (2d4 + 2) Slashing damage.

**Web Strand (Recharge 5-6)**
*Dexterity Saving Throw*: DC 12, one Large or smaller creature the ettercap can see within 30 feet. *Failure:*  The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Bludgeoning, Poison, and Psychic damage).

## Bonus Actions

**Reel**
The ettercap pulls one creature within 30 feet of itself that is Restrained by its Web Strand up to 25 feet straight toward itself.
