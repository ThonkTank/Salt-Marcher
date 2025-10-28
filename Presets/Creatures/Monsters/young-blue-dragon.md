---
smType: creature
name: Young Blue Dragon
size: Large
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '18'
initiative: +4 (14)
hp: '152'
hitDice: 16d10 + 64
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 20 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 21
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 4
  - key: con
    score: 19
    saveProf: false
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 13
    saveProf: true
    saveMod: 5
  - key: cha
    score: 17
    saveProf: false
pb: '+4'
skills:
  - skill: Perception
    value: '9'
  - skill: Stealth
    value: '4'
sensesList:
  - type: blindsight
    range: '30'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '19'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Lightning
cr: '9'
xp: '5000'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions: []
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 10 ft. 12 (2d6 + 5) Slashing damage plus 5 (1d10) Lightning damage.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 2d6
          bonus: 5
          type: Slashing
          average: 12
        - dice: 1d10
          bonus: 0
          type: Lightning
          average: 5
      reach: 10 ft.
  - category: action
    name: Lightning Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 16, each creature in a 60-foot-long, 5-foot-wide Line. *Failure:*  55 (10d10) Lightning damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 16
      targeting:
        shape: line
        size: 60 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 55 (10d10) Lightning damage.
        damage:
          - dice: 10d10
            bonus: 0
            type: Lightning
            average: 55
        legacyEffects: 55 (10d10) Lightning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
---

# Young Blue Dragon
*Large, Dragon, Lawful Evil*

**AC** 18
**HP** 152 (16d10 + 64)
**Initiative** +4 (14)
**Speed** 40 ft., fly 80 ft., burrow 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., darkvision 120 ft.; Passive Perception 19
**Languages** Common, Draconic
CR 9, PB +4, XP 5000

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +9, reach 10 ft. 12 (2d6 + 5) Slashing damage plus 5 (1d10) Lightning damage.

**Lightning Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 16, each creature in a 60-foot-long, 5-foot-wide Line. *Failure:*  55 (10d10) Lightning damage. *Success:*  Half damage.
