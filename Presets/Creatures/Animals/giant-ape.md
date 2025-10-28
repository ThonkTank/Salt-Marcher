---
smType: creature
name: Giant Ape
size: Huge
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +5 (15)
hp: '168'
hitDice: 16d12 + 64
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+3'
skills:
  - skill: Athletics
    value: '9'
  - skill: Perception
    value: '4'
  - skill: Survival
    value: '4'
passivesList:
  - skill: Perception
    value: '14'
cr: '7'
xp: '2900'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The ape makes two Fist attacks.
    multiattack:
      attacks:
        - name: Fist
          count: 2
        - name: Fist
          count: 2
      substitutions: []
  - category: action
    name: Fist
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 10 ft. 22 (3d10 + 6) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 3d10
          bonus: 6
          type: Bludgeoning
          average: 22
      reach: 10 ft.
  - category: action
    name: Boulder Toss
    entryType: save
    text: 'The ape hurls a boulder at a point it can see within 90 feet. *Dexterity Saving Throw*: DC 17, each creature in a 5-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on that point. *Failure:*  24 (7d6) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition. *Success:*  Half damage only.'
    save:
      ability: dex
      dc: 17
      targeting:
        shape: sphere
        size: 5 ft.
        description: each creature in a 5-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on that point
      area: each creature in a 5-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on that point
      onFail:
        damage:
          - dice: 7d6
            bonus: 0
            type: Bludgeoning
            average: 24
        effects:
          conditions:
            - condition: Prone
              restrictions:
                size: Large or smaller
          other: 24 (7d6) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.
        legacyEffects: 24 (7d6) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.
      onSuccess:
        damage: half
        legacyText: Half damage only.
  - category: bonus
    name: Leap
    entryType: special
    text: The ape jumps up to 30 feet by spending 10 feet of movement.
---

# Giant Ape
*Huge, Beast, Unaligned*

**AC** 12
**HP** 168 (16d12 + 64)
**Initiative** +5 (15)
**Speed** 40 ft., climb 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 7, PB +3, XP 2900

## Actions

**Multiattack**
The ape makes two Fist attacks.

**Fist**
*Melee Attack Roll:* +9, reach 10 ft. 22 (3d10 + 6) Bludgeoning damage.

**Boulder Toss (Recharge 6)**
The ape hurls a boulder at a point it can see within 90 feet. *Dexterity Saving Throw*: DC 17, each creature in a 5-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on that point. *Failure:*  24 (7d6) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition. *Success:*  Half damage only.

## Bonus Actions

**Leap**
The ape jumps up to 30 feet by spending 10 feet of movement.
