---
smType: creature
name: Young Green Dragon
size: Large
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '18'
initiative: +4 (14)
hp: '136'
hitDice: 16d10 + 48
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
    score: 12
    saveProf: true
    saveMod: 4
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 13
    saveProf: true
    saveMod: 4
  - key: cha
    score: 15
    saveProf: false
pb: '+3'
skills:
  - skill: Deception
    value: '5'
  - skill: Perception
    value: '7'
  - skill: Stealth
    value: '4'
sensesList:
  - type: blindsight
    range: '30'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '17'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Poison; Poisoned
cr: '8'
xp: '3900'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
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
    text: '*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Slashing damage plus 7 (2d6) Poison damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d6
          bonus: 4
          type: Slashing
          average: 11
        - dice: 2d6
          bonus: 0
          type: Poison
          average: 7
      reach: 10 ft.
  - category: action
    name: Poison Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  42 (12d6) Poison damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 14
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          other: 42 (12d6) Poison damage.
        damage:
          - dice: 12d6
            bonus: 0
            type: Poison
            average: 42
        legacyEffects: 42 (12d6) Poison damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
---

# Young Green Dragon
*Large, Dragon, Lawful Evil*

**AC** 18
**HP** 136 (16d10 + 48)
**Initiative** +4 (14)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., darkvision 120 ft.; Passive Perception 17
**Languages** Common, Draconic
CR 8, PB +3, XP 3900

## Traits

**Amphibious**
The dragon can breathe air and water.

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Slashing damage plus 7 (2d6) Poison damage.

**Poison Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  42 (12d6) Poison damage. *Success:*  Half damage.
