---
smType: creature
name: Bone Devil
size: Large
type: Fiend
typeTags:
  - value: Devil
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '16'
initiative: +7 (17)
hp: '161'
hitDice: 17d10 + 68
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 40 ft.
abilities:
  - key: str
    score: 18
    saveProf: true
    saveMod: 8
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 13
    saveProf: true
    saveMod: 5
  - key: wis
    score: 14
    saveProf: true
    saveMod: 6
  - key: cha
    score: 16
    saveProf: true
    saveMod: 7
pb: '+4'
skills:
  - skill: Deception
    value: '7'
  - skill: Insight
    value: '6'
sensesList:
  - type: darkvision 120 ft. (unimpeded by magical darkness)
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Infernal
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Cold
damageImmunitiesList:
  - value: Fire
  - value: Poison; Poisoned
cr: '9'
xp: '5000'
entries:
  - category: trait
    name: Diabolical Restoration
    entryType: special
    text: If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The devil has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The devil makes two Claw attacks and one Infernal Sting attack.
    multiattack:
      attacks:
        - name: Claw
          count: 2
        - name: Sting
          count: 1
      substitutions: []
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 10 ft. 13 (2d8 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 2d8
          bonus: 4
          type: Slashing
          average: 13
      reach: 10 ft.
  - category: action
    name: Infernal Sting
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 10 ft. 15 (2d10 + 4) Piercing damage plus 18 (4d8) Poison damage, and the target has the Poisoned condition until the start of the devil''s next turn. While Poisoned, the target can''t regain Hit Points.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 2d10
          bonus: 4
          type: Piercing
          average: 15
        - dice: 4d8
          bonus: 0
          type: Poison
          average: 18
      reach: 10 ft.
---

# Bone Devil
*Large, Fiend, Lawful Evil*

**AC** 16
**HP** 161 (17d10 + 68)
**Initiative** +7 (17)
**Speed** 40 ft., fly 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft. (unimpeded by magical darkness); Passive Perception 12
**Languages** Infernal, telepathy 120 ft.
CR 9, PB +4, XP 5000

## Traits

**Diabolical Restoration**
If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.

**Magic Resistance**
The devil has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The devil makes two Claw attacks and one Infernal Sting attack.

**Claw**
*Melee Attack Roll:* +8, reach 10 ft. 13 (2d8 + 4) Slashing damage.

**Infernal Sting**
*Melee Attack Roll:* +8, reach 10 ft. 15 (2d10 + 4) Piercing damage plus 18 (4d8) Poison damage, and the target has the Poisoned condition until the start of the devil's next turn. While Poisoned, the target can't regain Hit Points.
