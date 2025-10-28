---
smType: creature
name: Young White Dragon
size: Large
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '17'
initiative: +3 (13)
hp: '123'
hitDice: 13d10 + 52
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 20 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 3
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 3
  - key: cha
    score: 12
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '6'
  - skill: Stealth
    value: '3'
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
  - value: Cold
cr: '6'
xp: '2300'
entries:
  - category: trait
    name: Ice Walk
    entryType: special
    text: The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.
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
    text: '*Melee Attack Roll:* +7, reach 10 ft. 9 (2d4 + 4) Slashing damage plus 2 (1d4) Cold damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d4
          bonus: 4
          type: Slashing
          average: 9
        - dice: 1d4
          bonus: 0
          type: Cold
          average: 2
      reach: 10 ft.
  - category: action
    name: Cold Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 15, each creature in a 30-foot Cone. *Failure:*  40 (9d8) Cold damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 15
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          other: 40 (9d8) Cold damage.
        damage:
          - dice: 9d8
            bonus: 0
            type: Cold
            average: 40
        legacyEffects: 40 (9d8) Cold damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
---

# Young White Dragon
*Large, Dragon, Chaotic Evil*

**AC** 17
**HP** 123 (13d10 + 52)
**Initiative** +3 (13)
**Speed** 40 ft., swim 40 ft., fly 80 ft., burrow 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., darkvision 120 ft.; Passive Perception 16
**Languages** Common, Draconic
CR 6, PB +3, XP 2300

## Traits

**Ice Walk**
The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +7, reach 10 ft. 9 (2d4 + 4) Slashing damage plus 2 (1d4) Cold damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 15, each creature in a 30-foot Cone. *Failure:*  40 (9d8) Cold damage. *Success:*  Half damage.
