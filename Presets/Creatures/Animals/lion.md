---
smType: creature
name: Lion
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '22'
hitDice: 4d10
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 3
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
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The lion has Advantage on an attack roll against a creature if at least one of the lion's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Running Leap
    entryType: special
    text: With a 10-foot running start, the lion can Long Jump up to 25 feet.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The lion makes two Rend attacks. It can replace one attack with a use of Roar.
    multiattack:
      attacks:
        - name: Rend
          count: 2
        - name: Rend
          count: 2
        - name: one
          count: 1
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Roar
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Slashing
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Roar
    entryType: save
    text: '*Wisdom Saving Throw*: DC 11, one creature within 15 feet. *Failure:*  The target has the Frightened condition until the start of the lion''s next turn.'
    save:
      ability: wis
      dc: 11
      targeting:
        type: single
        range: 15 ft.
      area: one creature within 15 feet
      onFail:
        effects:
          conditions:
            - condition: Frightened
              duration:
                type: until
                trigger: the start of the lion's next turn
          other: The target has the Frightened condition until the start of the lion's next turn.
        legacyEffects: The target has the Frightened condition until the start of the lion's next turn.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Lion
*Large, Beast, Unaligned*

**AC** 12
**HP** 22 (4d10)
**Initiative** +2 (12)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 1, PB +2, XP 200

## Traits

**Pack Tactics**
The lion has Advantage on an attack roll against a creature if at least one of the lion's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

**Running Leap**
With a 10-foot running start, the lion can Long Jump up to 25 feet.

## Actions

**Multiattack**
The lion makes two Rend attacks. It can replace one attack with a use of Roar.

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage.

**Roar**
*Wisdom Saving Throw*: DC 11, one creature within 15 feet. *Failure:*  The target has the Frightened condition until the start of the lion's next turn.
