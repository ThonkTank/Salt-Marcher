---
smType: creature
name: Purple Worm
size: Gargantuan
type: Monstrosity
alignmentOverride: Unaligned
ac: '18'
initiative: +3 (13)
hp: '247'
hitDice: 15d20 + 90
speeds:
  walk:
    distance: 50 ft.
  burrow:
    distance: 50 ft.
abilities:
  - key: str
    score: 28
    saveProf: false
  - key: dex
    score: 7
    saveProf: false
  - key: con
    score: 22
    saveProf: true
    saveMod: 11
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 8
    saveProf: true
    saveMod: 4
  - key: cha
    score: 4
    saveProf: false
pb: '+5'
sensesList:
  - type: blindsight
    range: '30'
  - type: tremorsense
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
cr: '15'
xp: '13000'
entries:
  - category: trait
    name: Tunneler
    entryType: special
    text: The worm can burrow through solid rock at half its Burrow Speed and leaves a 10-foot-diameter tunnel in its wake.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The worm makes one Bite attack and one Tail Stinger attack.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Stinger
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 10 ft. 22 (3d8 + 9) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 19), and it has the Restrained condition until the grapple ends.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 3d8
          bonus: 9
          type: Piercing
          average: 22
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 19
            restrictions:
              size: Large or smaller
            duration:
              type: until
              trigger: the grapple ends
          - condition: Restrained
            escape:
              type: dc
              dc: 19
            restrictions:
              size: Large or smaller
            duration:
              type: until
              trigger: the grapple ends
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 19), and it has the Restrained condition until the grapple ends.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Tail Stinger
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 10 ft. 16 (2d6 + 9) Piercing damage plus 35 (10d6) Poison damage.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 2d6
          bonus: 9
          type: Piercing
          average: 16
        - dice: 10d6
          bonus: 0
          type: Poison
          average: 35
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Swallow
    entryType: save
    text: '*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the worm (it can have up to three creatures swallowed at a time). *Failure:*  The target is swallowed by the worm, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, has Cover|XPHB|Total Cover against attacks and other effects outside the worm, and takes 17 (5d6) Acid damage at the start of each of the worm''s turns. If the worm takes 30 damage or more on a single turn from a creature inside it, the worm must succeed on a DC 21 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the worm and has the Prone condition. If the worm dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 20 feet of movement, exiting Prone.'
    save:
      ability: str
      dc: 19
      targeting:
        type: single
        count: 3
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
            - condition: Restrained
        damage:
          - dice: 5d6
            bonus: 0
            type: Acid
            average: 17
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Purple Worm
*Gargantuan, Monstrosity, Unaligned*

**AC** 18
**HP** 247 (15d20 + 90)
**Initiative** +3 (13)
**Speed** 50 ft., burrow 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., tremorsense 60 ft.; Passive Perception 9
CR 15, PB +5, XP 13000

## Traits

**Tunneler**
The worm can burrow through solid rock at half its Burrow Speed and leaves a 10-foot-diameter tunnel in its wake.

## Actions

**Multiattack**
The worm makes one Bite attack and one Tail Stinger attack.

**Bite**
*Melee Attack Roll:* +14, reach 10 ft. 22 (3d8 + 9) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 19), and it has the Restrained condition until the grapple ends.

**Tail Stinger**
*Melee Attack Roll:* +14, reach 10 ft. 16 (2d6 + 9) Piercing damage plus 35 (10d6) Poison damage.

## Bonus Actions

**Swallow**
*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the worm (it can have up to three creatures swallowed at a time). *Failure:*  The target is swallowed by the worm, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, has Cover|XPHB|Total Cover against attacks and other effects outside the worm, and takes 17 (5d6) Acid damage at the start of each of the worm's turns. If the worm takes 30 damage or more on a single turn from a creature inside it, the worm must succeed on a DC 21 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the worm and has the Prone condition. If the worm dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 20 feet of movement, exiting Prone.
