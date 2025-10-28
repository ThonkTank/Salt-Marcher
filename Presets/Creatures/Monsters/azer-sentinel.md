---
smType: creature
name: Azer Sentinel
size: Medium
type: Elemental
alignmentLawChaos: Lawful
alignmentGoodEvil: Neutral
ac: '17'
initiative: +1 (11)
hp: '39'
hitDice: 6d8 + 12
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 15
    saveProf: true
    saveMod: 4
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Primordial (Ignan)
damageImmunitiesList:
  - value: Fire
  - value: Poison; Poisoned
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Fire Aura
    entryType: special
    text: At the end of each of the azer's turns, each creature of the azer's choice in a 5-foot Emanation originating from the azer takes 5 (1d10) Fire damage unless the azer has the Incapacitated condition.
  - category: trait
    name: Illumination
    entryType: special
    text: The azer sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.
  - category: action
    name: Burning Hammer
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Bludgeoning damage plus 3 (1d6) Fire damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d10
          bonus: 3
          type: Bludgeoning
          average: 8
        - dice: 1d6
          bonus: 0
          type: Fire
          average: 3
      reach: 5 ft.
---

# Azer Sentinel
*Medium, Elemental, Lawful Neutral*

**AC** 17
**HP** 39 (6d8 + 12)
**Initiative** +1 (11)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Primordial (Ignan)
CR 2, PB +2, XP 450

## Traits

**Fire Aura**
At the end of each of the azer's turns, each creature of the azer's choice in a 5-foot Emanation originating from the azer takes 5 (1d10) Fire damage unless the azer has the Incapacitated condition.

**Illumination**
The azer sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.

## Actions

**Burning Hammer**
*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Bludgeoning damage plus 3 (1d6) Fire damage.
