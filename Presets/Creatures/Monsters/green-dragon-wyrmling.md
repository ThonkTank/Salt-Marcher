---
smType: creature
name: Green Dragon Wyrmling
size: Medium
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '17'
initiative: +3 (13)
hp: '38'
hitDice: 7d8 + 7
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
    score: 12
    saveProf: true
    saveMod: 3
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 14
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
    value: '3'
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
  - value: Poison; Poisoned
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes two Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 2
      substitutions: []
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage plus 3 (1d6) Poison damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d10
          bonus: 2
          type: Slashing
          average: 7
        - dice: 1d6
          bonus: 0
          type: Poison
          average: 3
      reach: 5 ft.
  - category: action
    name: Poison Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 11, each creature in a 15-foot Cone. *Failure:*  21 (6d6) Poison damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 11
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          other: 21 (6d6) Poison damage.
        damage:
          - dice: 6d6
            bonus: 0
            type: Poison
            average: 21
        legacyEffects: 21 (6d6) Poison damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
---

# Green Dragon Wyrmling
*Medium, Dragon, Lawful Evil*

**AC** 17
**HP** 38 (7d8 + 7)
**Initiative** +3 (13)
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
*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage plus 3 (1d6) Poison damage.

**Poison Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 11, each creature in a 15-foot Cone. *Failure:*  21 (6d6) Poison damage. *Success:*  Half damage.
