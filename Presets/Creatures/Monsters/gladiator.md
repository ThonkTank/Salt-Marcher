---
smType: creature
name: Gladiator
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '16'
initiative: +5 (15)
hp: '112'
hitDice: 15d8 + 45
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 18
    saveProf: true
    saveMod: 7
  - key: dex
    score: 15
    saveProf: true
    saveMod: 5
  - key: con
    score: 16
    saveProf: true
    saveMod: 6
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 4
  - key: cha
    score: 15
    saveProf: false
pb: '+3'
skills:
  - skill: Athletics
    value: '10'
  - skill: Performance
    value: '5'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Common
cr: '5'
xp: '1800'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The gladiator makes three Spear attacks. It can replace one attack with a use of Shield Bash.
    multiattack:
      attacks:
        - name: Spear
          count: 3
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Shield Bash
  - category: action
    name: Spear
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +7, reach 5 ft. or range 20/60 ft. 11 (2d6 + 4) Piercing damage.'
  - category: action
    name: Shield Bash
    entryType: save
    text: '*Strength Saving Throw*: DC 15, one creature within 5 feet that the gladiator can see. *Failure:*  9 (2d4 + 4) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Prone condition.'
    save:
      ability: str
      dc: 15
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Prone
              restrictions:
                size: Medium or smaller
        damage:
          - dice: 2d4
            bonus: 4
            type: Bludgeoning
            average: 9
---

# Gladiator
*Small, Humanoid, Neutral Neutral*

**AC** 16
**HP** 112 (15d8 + 45)
**Initiative** +5 (15)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common
CR 5, PB +3, XP 1800

## Actions

**Multiattack**
The gladiator makes three Spear attacks. It can replace one attack with a use of Shield Bash.

**Spear**
*Melee or Ranged Attack Roll:* +7, reach 5 ft. or range 20/60 ft. 11 (2d6 + 4) Piercing damage.

**Shield Bash**
*Strength Saving Throw*: DC 15, one creature within 5 feet that the gladiator can see. *Failure:*  9 (2d4 + 4) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Prone condition.
