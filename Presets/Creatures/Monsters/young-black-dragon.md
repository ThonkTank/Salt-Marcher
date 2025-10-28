---
smType: creature
name: Young Black Dragon
size: Large
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '18'
initiative: +5 (15)
hp: '127'
hitDice: 15d10 + 45
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 14
    saveProf: true
    saveMod: 5
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 3
  - key: cha
    score: 15
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '6'
  - skill: Stealth
    value: '5'
sensesList:
  - type: blindsight
    range: '30'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Acid
cr: '7'
xp: '2900'
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
    text: The dragon makes three Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 10 ft. 9 (2d4 + 4) Slashing damage plus 3 (1d6) Acid damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d4
          bonus: 4
          type: Slashing
          average: 9
        - dice: 1d6
          bonus: 0
          type: Acid
          average: 3
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Acid Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 14, each creature in a 30-foot-long, 5-foot-wide Line. *Failure:*  49 (14d6) Acid damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 14
      targeting:
        shape: line
        size: 30 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 49 (14d6) Acid damage.
        damage:
          - dice: 14d6
            bonus: 0
            type: Acid
            average: 49
        legacyEffects: 49 (14d6) Acid damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Young Black Dragon
*Large, Dragon, Chaotic Evil*

**AC** 18
**HP** 127 (15d10 + 45)
**Initiative** +5 (15)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., darkvision 120 ft.; Passive Perception 16
**Languages** Common, Draconic
CR 7, PB +3, XP 2900

## Traits

**Amphibious**
The dragon can breathe air and water.

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +7, reach 10 ft. 9 (2d4 + 4) Slashing damage plus 3 (1d6) Acid damage.

**Acid Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 14, each creature in a 30-foot-long, 5-foot-wide Line. *Failure:*  49 (14d6) Acid damage. *Success:*  Half damage.
