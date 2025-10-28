---
smType: creature
name: White Dragon Wyrmling
size: Medium
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '16'
initiative: +2 (12)
hp: '32'
hitDice: 5d8 + 10
speeds:
  walk:
    distance: 30 ft.
  burrow:
    distance: 15 ft.
  fly:
    distance: 60 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 2
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 10
    saveProf: true
    saveMod: 2
  - key: cha
    score: 11
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
  - value: Cold
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Ice Walk
    entryType: special
    text: The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.
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
    text: '*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage plus 2 (1d4) Cold damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Slashing
          average: 6
        - dice: 1d4
          bonus: 0
          type: Cold
          average: 2
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Cold Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 12, each creature in a 15-foot Cone. *Failure:*  22 (5d8) Cold damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 12
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          other: 22 (5d8) Cold damage.
        damage:
          - dice: 5d8
            bonus: 0
            type: Cold
            average: 22
        legacyEffects: 22 (5d8) Cold damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# White Dragon Wyrmling
*Medium, Dragon, Chaotic Evil*

**AC** 16
**HP** 32 (5d8 + 10)
**Initiative** +2 (12)
**Speed** 30 ft., swim 30 ft., fly 60 ft., burrow 15 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 14
**Languages** Draconic
CR 2, PB +2, XP 450

## Traits

**Ice Walk**
The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.

## Actions

**Multiattack**
The dragon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage plus 2 (1d4) Cold damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 12, each creature in a 15-foot Cone. *Failure:*  22 (5d8) Cold damage. *Success:*  Half damage.
