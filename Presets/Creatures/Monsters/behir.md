---
smType: creature
name: Behir
size: Huge
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '17'
initiative: +3 (13)
hp: '168'
hitDice: 16d12 + 64
speeds:
  walk:
    distance: 50 ft.
  climb:
    distance: 50 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 12
    saveProf: false
pb: '+4'
skills:
  - skill: Perception
    value: '6'
  - skill: Stealth
    value: '7'
sensesList:
  - type: darkvision
    range: '90'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Draconic
damageImmunitiesList:
  - value: Lightning
cr: '11'
xp: '7200'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The behir makes one Bite attack and uses Constrict.
    multiattack:
      attacks:
        - name: Bite
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 10 ft. 19 (2d12 + 6) Piercing damage plus 11 (2d10) Lightning damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 2d12
          bonus: 6
          type: Piercing
          average: 19
        - dice: 2d10
          bonus: 0
          type: Lightning
          average: 11
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Constrict
    entryType: save
    text: '*Strength Saving Throw*: DC 18, one Large or smaller creature the behir can see within 5 feet. *Failure:*  28 (5d8 + 6) Bludgeoning damage. The target has the Grappled condition (escape DC 16), and it has the Restrained condition until the grapple ends.'
    save:
      ability: str
      dc: 18
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          size:
            - Large
            - smaller
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Grappled
              escape:
                type: dc
                dc: 16
              duration:
                type: until
                trigger: the grapple ends
            - condition: Restrained
              escape:
                type: dc
                dc: 16
              duration:
                type: until
                trigger: the grapple ends
        damage:
          - dice: 5d8
            bonus: 6
            type: Bludgeoning
            average: 28
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Lightning Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 16, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  66 (12d10) Lightning damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 16
      targeting:
        shape: line
        size: 90 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 66 (12d10) Lightning damage.
        damage:
          - dice: 12d10
            bonus: 0
            type: Lightning
            average: 66
        legacyEffects: 66 (12d10) Lightning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Swallow
    entryType: save
    text: '*Dexterity Saving Throw*: DC 18, one Large or smaller creature Grappled by the behir (the behir can have only one creature swallowed at a time). *Failure:*  The behir swallows the target, which is no longer Grappled. While swallowed, a creature has the Blinded and Restrained conditions, has Cover|XPHB|Total Cover against attacks and other effects outside the behir, and takes 21 (6d6) Acid damage at the start of each of the behir''s turns. If the behir takes 30 damage or more on a single turn from the swallowed creature, the behir must succeed on a DC 14 Constitution saving throw at the end of that turn or regurgitate the creature, which falls in a space within 10 feet of the behir and has the Prone condition. If the behir dies, a swallowed creature is no longer Restrained and can escape from the corpse by using 15 feet of movement, exiting Prone.'
    save:
      ability: dex
      dc: 18
      targeting:
        type: single
        restrictions:
          size:
            - Large
            - smaller
          other:
            - grappled by source
      onFail:
        effects:
          conditions:
            - condition: Prone
              restrictions:
                while: While swallowed, a creature has the Blinded and Restrained conditions, has Cover|XPHB|Total Cover against attacks and other effects outside the behir, and takes 21 (6d6) Acid damage at the start of each of the behir's turns. If the behir takes 30 damage or more on a single turn from the swallowed creature, the behir must succeed on a DC 14 Constitution saving throw at the end of that turn or regurgitate the creature, which falls in a space within 10 feet of the behir and has the Prone condition
        damage:
          - dice: 6d6
            bonus: 0
            type: Acid
            average: 21
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Behir
*Huge, Monstrosity, Neutral Evil*

**AC** 17
**HP** 168 (16d12 + 64)
**Initiative** +3 (13)
**Speed** 50 ft., climb 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 90 ft.; Passive Perception 16
**Languages** Draconic
CR 11, PB +4, XP 7200

## Actions

**Multiattack**
The behir makes one Bite attack and uses Constrict.

**Bite**
*Melee Attack Roll:* +10, reach 10 ft. 19 (2d12 + 6) Piercing damage plus 11 (2d10) Lightning damage.

**Constrict**
*Strength Saving Throw*: DC 18, one Large or smaller creature the behir can see within 5 feet. *Failure:*  28 (5d8 + 6) Bludgeoning damage. The target has the Grappled condition (escape DC 16), and it has the Restrained condition until the grapple ends.

**Lightning Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 16, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  66 (12d10) Lightning damage. *Success:*  Half damage.

## Bonus Actions

**Swallow**
*Dexterity Saving Throw*: DC 18, one Large or smaller creature Grappled by the behir (the behir can have only one creature swallowed at a time). *Failure:*  The behir swallows the target, which is no longer Grappled. While swallowed, a creature has the Blinded and Restrained conditions, has Cover|XPHB|Total Cover against attacks and other effects outside the behir, and takes 21 (6d6) Acid damage at the start of each of the behir's turns. If the behir takes 30 damage or more on a single turn from the swallowed creature, the behir must succeed on a DC 14 Constitution saving throw at the end of that turn or regurgitate the creature, which falls in a space within 10 feet of the behir and has the Prone condition. If the behir dies, a swallowed creature is no longer Restrained and can escape from the corpse by using 15 feet of movement, exiting Prone.
