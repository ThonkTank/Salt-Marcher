---
smType: creature
name: Oni
size: Large
type: Fiend
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '17'
initiative: +0 (10)
hp: '119'
hitDice: 14d10 + 42
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 30 ft.
    hover: true
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 11
    saveProf: true
    saveMod: 3
  - key: con
    score: 16
    saveProf: true
    saveMod: 6
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 4
  - key: cha
    score: 15
    saveProf: true
    saveMod: 5
pb: '+3'
skills:
  - skill: Arcana
    value: '5'
  - skill: Deception
    value: '8'
  - skill: Perception
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Common
  - value: Giant
damageResistancesList:
  - value: Cold
cr: '7'
xp: '2900'
entries:
  - category: trait
    name: Regeneration
    entryType: special
    text: The oni regains 10 Hit Points at the start of each of its turns if it has at least 1 Hit Point.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The oni makes two Claw or Nightmare Ray attacks. It can replace one attack with a use of Spellcasting.
    multiattack:
      attacks:
        - name: Ray
          count: 1
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            text: Spellcasting
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 10 ft. 10 (1d12 + 4) Slashing damage plus 9 (2d8) Necrotic damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d12
          bonus: 4
          type: Slashing
          average: 10
        - dice: 2d8
          bonus: 0
          type: Necrotic
          average: 9
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Nightmare Ray
    entryType: attack
    text: '*Ranged Attack Roll:* +5, range 60 ft. 9 (2d6 + 2) Psychic damage, and the target has the Frightened condition until the start of the oni''s next turn.'
    attack:
      type: ranged
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 2
          type: Psychic
          average: 9
      range: 60 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Shape-Shift
    entryType: special
    text: The oni shape-shifts into a Small or Medium Humanoid or a Large Giant, or it returns to its true form. Other than its size, its game statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The oni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13): - **At Will:** - **1e/Day Each:** *Charm Person*, *Darkness*, *Gaseous Form*, *Sleep*'
    spellcasting:
      ability: cha
      saveDC: 13
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - '- 1e/Day Each: Charm Person'
            - Darkness
            - Gaseous Form
            - Sleep
        - frequency: 1/day
          spells:
            - Charm Person
            - Darkness
            - Gaseous Form
            - Sleep
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Invisibility
    entryType: spellcasting
    text: The oni casts *Invisibility* on itself, requiring no spell components and using the same spellcasting ability as Spellcasting.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Oni
*Large, Fiend, Lawful Evil*

**AC** 17
**HP** 119 (14d10 + 42)
**Initiative** +0 (10)
**Speed** 30 ft., fly 30 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Common, Giant
CR 7, PB +3, XP 2900

## Traits

**Regeneration**
The oni regains 10 Hit Points at the start of each of its turns if it has at least 1 Hit Point.

## Actions

**Multiattack**
The oni makes two Claw or Nightmare Ray attacks. It can replace one attack with a use of Spellcasting.

**Claw**
*Melee Attack Roll:* +7, reach 10 ft. 10 (1d12 + 4) Slashing damage plus 9 (2d8) Necrotic damage.

**Nightmare Ray**
*Ranged Attack Roll:* +5, range 60 ft. 9 (2d6 + 2) Psychic damage, and the target has the Frightened condition until the start of the oni's next turn.

**Shape-Shift**
The oni shape-shifts into a Small or Medium Humanoid or a Large Giant, or it returns to its true form. Other than its size, its game statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed.

**Spellcasting**
The oni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13): - **At Will:** - **1e/Day Each:** *Charm Person*, *Darkness*, *Gaseous Form*, *Sleep*

## Bonus Actions

**Invisibility**
The oni casts *Invisibility* on itself, requiring no spell components and using the same spellcasting ability as Spellcasting.
