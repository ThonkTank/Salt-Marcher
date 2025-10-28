---
smType: creature
name: Merfolk Skirmisher
size: Medium
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '11'
initiative: +1 (11)
hp: '11'
hitDice: 2d8 + 2
speeds:
  walk:
    distance: 10 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 12
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Common
  - value: Primordial (Aquan)
cr: 1/8
xp: '25'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The merfolk can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Ocean Spear
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +2, reach 5 ft. or range 20/60 ft. 3 (1d6) Piercing damage plus 2 (1d4) Cold damage. If the target is a creature, its Speed decreases by 10 feet until the end of its next turn. HitomThe spear magically returns to the merfolk''s hand immediately after a ranged attack.'
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Merfolk Skirmisher
*Medium, Elemental, Neutral Neutral*

**AC** 11
**HP** 11 (2d8 + 2)
**Initiative** +1 (11)
**Speed** 10 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common, Primordial (Aquan)
CR 1/8, PB +2, XP 25

## Traits

**Amphibious**
The merfolk can breathe air and water.

## Actions

**Ocean Spear**
*Melee or Ranged Attack Roll:* +2, reach 5 ft. or range 20/60 ft. 3 (1d6) Piercing damage plus 2 (1d4) Cold damage. If the target is a creature, its Speed decreases by 10 feet until the end of its next turn. HitomThe spear magically returns to the merfolk's hand immediately after a ranged attack.
