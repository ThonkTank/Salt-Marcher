---
smType: creature
name: Bulette
size: Large
type: Monstrosity
alignmentOverride: Unaligned
ac: '17'
initiative: +0 (10)
hp: '94'
hitDice: 9d10 + 45
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 40 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 21
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '6'
sensesList:
  - type: darkvision
    range: '60'
  - type: tremorsense
    range: '120'
passivesList:
  - skill: Perception
    value: '16'
cr: '5'
xp: '1800'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The bulette makes two Bite attacks.
    multiattack:
      attacks:
        - name: Bite
          count: 2
      substitutions: []
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 17 (2d12 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d12
          bonus: 4
          type: Piercing
          average: 17
      reach: 5 ft.
  - category: action
    name: Deadly Leap
    entryType: save
    text: 'The bulette spends 5 feet of movement to jump to a space within 15 feet that contains one or more Large or smaller creatures. *Dexterity Saving Throw*: DC 15, each creature in the bulette''s destination space. *Failure:*  19 (3d12) Bludgeoning damage, and the target has the Prone condition. *Success:*  Half damage, and the target is pushed 5 feet straight away from the bulette.'
    save:
      ability: dex
      dc: 15
      targeting:
        type: single
        restrictions:
          creatureTypes:
            - creature
      onFail:
        effects:
          conditions:
            - condition: Prone
        damage:
          - dice: 3d12
            bonus: 0
            type: Bludgeoning
            average: 19
      onSuccess:
        damage: half
        legacyText: Half damage, and the target is pushed 5 feet straight away from the bulette.
  - category: bonus
    name: Leap
    entryType: special
    text: The bulette jumps up to 30 feet by spending 10 feet of movement.
---

# Bulette
*Large, Monstrosity, Unaligned*

**AC** 17
**HP** 94 (9d10 + 45)
**Initiative** +0 (10)
**Speed** 40 ft., burrow 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft., tremorsense 120 ft.; Passive Perception 16
CR 5, PB +3, XP 1800

## Actions

**Multiattack**
The bulette makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +7, reach 5 ft. 17 (2d12 + 4) Piercing damage.

**Deadly Leap**
The bulette spends 5 feet of movement to jump to a space within 15 feet that contains one or more Large or smaller creatures. *Dexterity Saving Throw*: DC 15, each creature in the bulette's destination space. *Failure:*  19 (3d12) Bludgeoning damage, and the target has the Prone condition. *Success:*  Half damage, and the target is pushed 5 feet straight away from the bulette.

## Bonus Actions

**Leap**
The bulette jumps up to 30 feet by spending 10 feet of movement.
