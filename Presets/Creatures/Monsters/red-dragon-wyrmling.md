---
smType: creature
name: Red Dragon Wyrmling
size: Medium
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '17'
initiative: +2 (12)
hp: '75'
hitDice: 10d8 + 30
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 2
  - key: con
    score: 17
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
  - value: Fire
cr: '4'
xp: '1100'
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
    text: '*Melee Attack Roll:* +6, reach 5 ft. 9 (1d10 + 4) Slashing damage plus 3 (1d6) Fire damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d10
          bonus: 4
          type: Slashing
          average: 9
        - dice: 1d6
          bonus: 0
          type: Fire
          average: 3
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 13, each creature in a 15-foot Cone. *Failure:*  24 (7d6) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 13
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          other: 24 (7d6) Fire damage.
        damage:
          - dice: 7d6
            bonus: 0
            type: Fire
            average: 24
        legacyEffects: 24 (7d6) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Red Dragon Wyrmling
*Medium, Dragon, Chaotic Evil*

**AC** 17
**HP** 75 (10d8 + 30)
**Initiative** +2 (12)
**Speed** 30 ft., climb 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 14
**Languages** Draconic
CR 4, PB +2, XP 1100

## Actions

**Multiattack**
The dragon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +6, reach 5 ft. 9 (1d10 + 4) Slashing damage plus 3 (1d6) Fire damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 13, each creature in a 15-foot Cone. *Failure:*  24 (7d6) Fire damage. *Success:*  Half damage.
