---
smType: creature
name: Black Dragon Wyrmling
size: Medium
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '17'
initiative: +4 (14)
hp: '33'
hitDice: 6d8 + 6
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 60 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 14
    saveProf: true
    saveMod: 4
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 2
  - key: cha
    score: 13
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '4'
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
  - value: Acid
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
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
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Slashing damage plus 2 (1d4) Acid damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Slashing
          average: 5
        - dice: 1d4
          bonus: 0
          type: Acid
          average: 2
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Acid Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 11, each creature in a 15-foot-long, 5-foot-wide Line. *Failure:*  22 (5d8) Acid damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 11
      targeting:
        shape: line
        size: 15 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 22 (5d8) Acid damage.
        damage:
          - dice: 5d8
            bonus: 0
            type: Acid
            average: 22
        legacyEffects: 22 (5d8) Acid damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Black Dragon Wyrmling
*Medium, Dragon, Chaotic Evil*

**AC** 17
**HP** 33 (6d8 + 6)
**Initiative** +4 (14)
**Speed** 30 ft., swim 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 14
**Languages** Draconic
CR 2, PB +2, XP 450

## Traits

**Amphibious**
The dragon can breathe air and water.

## Actions

**Multiattack**
The dragon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Slashing damage plus 2 (1d4) Acid damage.

**Acid Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 11, each creature in a 15-foot-long, 5-foot-wide Line. *Failure:*  22 (5d8) Acid damage. *Success:*  Half damage.
