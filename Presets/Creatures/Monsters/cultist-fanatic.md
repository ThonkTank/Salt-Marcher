---
smType: creature
name: Cultist Fanatic
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '13'
initiative: +2 (12)
hp: '44'
hitDice: 8d8 + 8
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 11
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 14
    saveProf: true
    saveMod: 4
  - key: cha
    score: 13
    saveProf: false
pb: '+2'
skills:
  - skill: Deception
    value: '3'
  - skill: Persuasion
    value: '3'
  - skill: Religion
    value: '2'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Common
cr: '2'
xp: '450'
entries:
  - category: action
    name: Pact Blade
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage plus 7 (2d6) Necrotic damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Slashing
          average: 6
        - dice: 2d6
          bonus: 0
          type: Necrotic
          average: 7
      reach: 5 ft.
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The cultist casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 12, +4 to hit with spell attacks): - **At Will:** *Light*, *Thaumaturgy* - **1/Day Each:** *Hold Person* - **2/Day Each:** *Command*'
    spellcasting:
      ability: wis
      saveDC: 12
      attackBonus: 4
      spellLists:
        - frequency: at-will
          spells:
            - Light
            - Thaumaturgy
        - frequency: 1/day
          spells:
            - Hold Person
        - frequency: 2/day
          spells:
            - Command
  - category: bonus
    name: Spiritual Weapon (2/Day)
    entryType: spellcasting
    text: The cultist casts the *Spiritual Weapon* spell, using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 2
      reset: day
    spellcasting:
      ability: int
      spellLists: []
---

# Cultist Fanatic
*Small, Humanoid, Neutral Neutral*

**AC** 13
**HP** 44 (8d8 + 8)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common
CR 2, PB +2, XP 450

## Actions

**Pact Blade**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage plus 7 (2d6) Necrotic damage.

**Spellcasting**
The cultist casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 12, +4 to hit with spell attacks): - **At Will:** *Light*, *Thaumaturgy* - **1/Day Each:** *Hold Person* - **2/Day Each:** *Command*

## Bonus Actions

**Spiritual Weapon (2/Day)**
The cultist casts the *Spiritual Weapon* spell, using the same spellcasting ability as Spellcasting.
