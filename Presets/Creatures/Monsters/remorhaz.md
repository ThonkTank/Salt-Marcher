---
smType: creature
name: Remorhaz
size: Huge
type: Monstrosity
alignmentOverride: Unaligned
ac: '17'
initiative: +5 (15)
hp: '195'
hitDice: 17d12 + 85
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 30 ft.
abilities:
  - key: str
    score: 24
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 21
    saveProf: false
  - key: int
    score: 4
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+4'
sensesList:
  - type: darkvision
    range: '60'
  - type: tremorsense
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
damageImmunitiesList:
  - value: Cold
  - value: Fire
cr: '11'
xp: '7200'
entries:
  - category: trait
    name: Heat Aura
    entryType: special
    text: At the end of each of the remorhaz's turns, each creature in a 5-foot Emanation originating from the remorhaz takes 16 (3d10) Fire damage.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +11, reach 10 ft. 18 (2d10 + 7) Piercing damage plus 14 (4d6) Fire damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17), and it has the Restrained condition until the grapple ends.'
    attack:
      type: melee
      bonus: 11
      damage:
        - dice: 2d10
          bonus: 7
          type: Piercing
          average: 18
        - dice: 4d6
          bonus: 0
          type: Fire
          average: 14
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 17
            restrictions:
              size: Large or smaller
            duration:
              type: until
              trigger: the grapple ends
          - condition: Restrained
            escape:
              type: dc
              dc: 17
            restrictions:
              size: Large or smaller
            duration:
              type: until
              trigger: the grapple ends
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17), and it has the Restrained condition until the grapple ends.
  - category: bonus
    name: Swallow
    entryType: save
    text: '*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the remorhaz (it can have up to two creatures swallowed at a time). *Failure:*  The target is swallowed by the remorhaz, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, it has Cover|XPHB|Total Cover against attacks and other effects outside the remorhaz, and it takes 10 (3d6) Acid damage plus 10 (3d6) Fire damage at the start of each of the remorhaz''s turns. If the remorhaz takes 30 damage or more on a single turn from a creature inside it, the remorhaz must succeed on a DC 15 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the remorhaz and has the Prone condition. If the remorhaz dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse by using 15 feet of movement, exiting Prone.'
    save:
      ability: str
      dc: 19
      targeting:
        type: single
        count: 2
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
          - dice: 3d6
            bonus: 0
            type: Acid
            average: 10
          - dice: 3d6
            bonus: 0
            type: Fire
            average: 10
---

# Remorhaz
*Huge, Monstrosity, Unaligned*

**AC** 17
**HP** 195 (17d12 + 85)
**Initiative** +5 (15)
**Speed** 40 ft., burrow 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft., tremorsense 60 ft.; Passive Perception 10
CR 11, PB +4, XP 7200

## Traits

**Heat Aura**
At the end of each of the remorhaz's turns, each creature in a 5-foot Emanation originating from the remorhaz takes 16 (3d10) Fire damage.

## Actions

**Bite**
*Melee Attack Roll:* +11, reach 10 ft. 18 (2d10 + 7) Piercing damage plus 14 (4d6) Fire damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17), and it has the Restrained condition until the grapple ends.

## Bonus Actions

**Swallow**
*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the remorhaz (it can have up to two creatures swallowed at a time). *Failure:*  The target is swallowed by the remorhaz, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, it has Cover|XPHB|Total Cover against attacks and other effects outside the remorhaz, and it takes 10 (3d6) Acid damage plus 10 (3d6) Fire damage at the start of each of the remorhaz's turns. If the remorhaz takes 30 damage or more on a single turn from a creature inside it, the remorhaz must succeed on a DC 15 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the remorhaz and has the Prone condition. If the remorhaz dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse by using 15 feet of movement, exiting Prone.
