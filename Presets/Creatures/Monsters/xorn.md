---
smType: creature
name: Xorn
size: Medium
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '19'
initiative: +0 (10)
hp: '84'
hitDice: 8d8 + 48
speeds:
  walk:
    distance: 20 ft.
  burrow:
    distance: 20 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 22
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '6'
  - skill: Stealth
    value: '6'
sensesList:
  - type: darkvision
    range: '60'
  - type: tremorsense
    range: '60'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Primordial (Terran)
damageImmunitiesList:
  - value: Poison; Paralyzed
conditionImmunitiesList:
  - value: Petrified
  - value: Poisoned
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Earth Glide
    entryType: special
    text: The xorn can burrow through nonmagical, unworked earth and stone. While doing so, the xorn doesn't disturb the material it moves through.
  - category: trait
    name: Treasure Sense
    entryType: special
    text: The xorn can pinpoint the location of precious metals and stones within 60 feet of itself.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The xorn makes one Bite attack and three Claw attacks.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Claw
          count: 3
      substitutions: []
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 17 (4d6 + 3) Piercing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 4d6
          bonus: 3
          type: Piercing
          average: 17
      reach: 5 ft.
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 8 (1d10 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d10
          bonus: 3
          type: Slashing
          average: 8
      reach: 5 ft.
  - category: bonus
    name: Charge
    entryType: special
    text: The xorn moves up to its Speed or Burrow Speed straight toward an enemy it can sense.
---

# Xorn
*Medium, Elemental, Neutral Neutral*

**AC** 19
**HP** 84 (8d8 + 48)
**Initiative** +0 (10)
**Speed** 20 ft., burrow 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft., tremorsense 60 ft.; Passive Perception 16
**Languages** Primordial (Terran)
CR 5, PB +3, XP 1800

## Traits

**Earth Glide**
The xorn can burrow through nonmagical, unworked earth and stone. While doing so, the xorn doesn't disturb the material it moves through.

**Treasure Sense**
The xorn can pinpoint the location of precious metals and stones within 60 feet of itself.

## Actions

**Multiattack**
The xorn makes one Bite attack and three Claw attacks.

**Bite**
*Melee Attack Roll:* +6, reach 5 ft. 17 (4d6 + 3) Piercing damage.

**Claw**
*Melee Attack Roll:* +6, reach 5 ft. 8 (1d10 + 3) Slashing damage.

## Bonus Actions

**Charge**
The xorn moves up to its Speed or Burrow Speed straight toward an enemy it can sense.
