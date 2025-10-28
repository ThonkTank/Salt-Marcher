---
smType: creature
name: Blue Dragon Wyrmling
size: Medium
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '17'
initiative: +2 (12)
hp: '65'
hitDice: 10d8 + 20
speeds:
  walk:
    distance: 30 ft.
  burrow:
    distance: 15 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 2
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 2
  - key: cha
    score: 15
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '2'
sensesList:
  - type: blindsight
    range: '10'
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Draconic
damageImmunitiesList:
  - value: Lightning
cr: '3'
xp: '700'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes two Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Slashing damage plus 3 (1d6) Lightning damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d10
          bonus: 3
          type: Slashing
          average: 8
        - dice: 1d6
          bonus: 0
          type: Lightning
          average: 3
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Lightning Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 12, each creature in a 30-foot-long, 5-foot-wide Line. *Failure:*  21 (6d6) Lightning damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 12
      targeting:
        shape: line
        size: 30 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 21 (6d6) Lightning damage.
        damage:
          - dice: 6d6
            bonus: 0
            type: Lightning
            average: 21
        legacyEffects: 21 (6d6) Lightning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Blue Dragon Wyrmling
*Medium, Dragon, Lawful Evil*

**AC** 17
**HP** 65 (10d8 + 20)
**Initiative** +2 (12)
**Speed** 30 ft., fly 60 ft., burrow 15 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 14
**Languages** Draconic
CR 3, PB +2, XP 700

## Actions

**Multiattack**
The dragon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Slashing damage plus 3 (1d6) Lightning damage.

**Lightning Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 12, each creature in a 30-foot-long, 5-foot-wide Line. *Failure:*  21 (6d6) Lightning damage. *Success:*  Half damage.
