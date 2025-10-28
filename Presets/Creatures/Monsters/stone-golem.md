---
smType: creature
name: Stone Golem
size: Large
type: Construct
alignmentOverride: Unaligned
ac: '18'
initiative: +3 (13)
hp: '220'
hitDice: 21d10 + 105
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 22
    saveProf: false
  - key: dex
    score: 9
    saveProf: false
  - key: con
    score: 20
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 1
    saveProf: false
pb: '+4'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Understands Common plus two other languages but can't speak
damageImmunitiesList:
  - value: Poison
  - value: Psychic; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Frightened
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
cr: '10'
xp: '5900'
entries:
  - category: trait
    name: Immutable Form
    entryType: special
    text: The golem can't shape-shift.
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The golem has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: special
    text: The golem makes two attacks, using Slam or Force Bolt in any combination.
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 5 ft. 15 (2d8 + 6) Bludgeoning damage plus 9 (2d8) Force damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 2d8
          bonus: 6
          type: Bludgeoning
          average: 15
        - dice: 2d8
          bonus: 0
          type: Force
          average: 9
      reach: 5 ft.
  - category: action
    name: Force Bolt
    entryType: attack
    text: '*Ranged Attack Roll:* +9, range 120 ft. 22 (4d10) Force damage.'
    attack:
      type: ranged
      bonus: 9
      damage:
        - dice: 4d10
          bonus: 0
          type: Force
          average: 22
      range: 120 ft.
spellcastingEntries:
  - category: bonus
    name: Slow (Recharge 5-6)
    entryType: spellcasting
    text: The golem casts the *Slow* spell, requiring no spell components and using Constitution as the spellcasting ability (spell save DC 17).
    recharge: 5-6
    spellcasting:
      ability: int
      saveDC: 17
      spellLists: []
---

# Stone Golem
*Large, Construct, Unaligned*

**AC** 18
**HP** 220 (21d10 + 105)
**Initiative** +3 (13)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 10
**Languages** Understands Common plus two other languages but can't speak
CR 10, PB +4, XP 5900

## Traits

**Immutable Form**
The golem can't shape-shift.

**Magic Resistance**
The golem has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The golem makes two attacks, using Slam or Force Bolt in any combination.

**Slam**
*Melee Attack Roll:* +10, reach 5 ft. 15 (2d8 + 6) Bludgeoning damage plus 9 (2d8) Force damage.

**Force Bolt**
*Ranged Attack Roll:* +9, range 120 ft. 22 (4d10) Force damage.

## Bonus Actions

**Slow (Recharge 5-6)**
The golem casts the *Slow* spell, requiring no spell components and using Constitution as the spellcasting ability (spell save DC 17).
