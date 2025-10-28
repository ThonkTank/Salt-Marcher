---
smType: creature
name: Lemure
size: Medium
type: Fiend
typeTags:
  - value: Devil
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '9'
initiative: '-3 (7)'
hp: '9'
hitDice: 2d8
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 5
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision 120 ft. (unimpeded by magical darkness)
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Understands Infernal but can't speak
damageResistancesList:
  - value: Cold
damageImmunitiesList:
  - value: Fire
  - value: Poison; Charmed
conditionImmunitiesList:
  - value: Frightened
  - value: Poisoned
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Hellish Restoration
    entryType: special
    text: If the lemure dies in the Nine Hells, it revives with all its Hit Points in 1d10 days unless it is killed by a creature under the effects of a *Bless* spell or its remains are sprinkled with Holy Water.
  - category: action
    name: Vile Slime
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Poison damage.'
    attack:
      type: melee
      bonus: 2
      damage:
        - dice: 1d4
          bonus: 0
          type: Poison
          average: 2
      reach: 5 ft.
---

# Lemure
*Medium, Fiend, Lawful Evil*

**AC** 9
**HP** 9 (2d8)
**Initiative** -3 (7)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft. (unimpeded by magical darkness); Passive Perception 10
**Languages** Understands Infernal but can't speak
CR 0, PB +2, XP 0

## Traits

**Hellish Restoration**
If the lemure dies in the Nine Hells, it revives with all its Hit Points in 1d10 days unless it is killed by a creature under the effects of a *Bless* spell or its remains are sprinkled with Holy Water.

## Actions

**Vile Slime**
*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Poison damage.
