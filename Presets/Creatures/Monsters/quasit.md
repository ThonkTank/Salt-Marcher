---
smType: creature
name: Quasit
size: Small
type: Fiend
typeTags:
  - value: Demon
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '13'
initiative: +3 (13)
hp: '25'
hitDice: 10d4
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 5
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Abyssal
  - value: Common
damageResistancesList:
  - value: Cold
  - value: Fire
  - value: Lightning
damageImmunitiesList:
  - value: Poison; Poisoned
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The quasit has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Slashing damage, and the target has the Poisoned condition until the start of the quasit''s next turn.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d4
          bonus: 3
          type: Slashing
          average: 5
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Scare (1/Day)
    entryType: save
    text: '*Wisdom Saving Throw*: DC 10, one creature within 20 feet. *Failure:*  The target has the Frightened condition. At the end of each of its turns, the target repeats the save, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    limitedUse:
      count: 1
      reset: day
    save:
      ability: wis
      dc: 10
      targeting:
        type: single
        range: 20 ft.
      onFail:
        effects:
          conditions:
            - condition: Frightened
              saveToEnd:
                timing: end-of-turn
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Shape-Shift
    entryType: special
    text: The quasit shape-shifts to resemble a bat (Speed 10 ft., Fly 40 ft.), a centipede (40 ft., Climb 40 ft.), or a toad (40 ft., Swim 40 ft.), or it returns to its true form. Its game statistics are the same in each form, except for its Speed. Any equipment it is wearing or carrying isn't transformed.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Invisibility
    entryType: spellcasting
    text: The quasit casts *Invisibility* on itself, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** *Invisibility*
    spellcasting:
      ability: cha
      spellLists:
        - frequency: at-will
          spells:
            - Invisibility
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Quasit
*Small, Fiend, Chaotic Evil*

**AC** 13
**HP** 25 (10d4)
**Initiative** +3 (13)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 10
**Languages** Abyssal, Common
CR 1, PB +2, XP 200

## Traits

**Magic Resistance**
The quasit has Advantage on saving throws against spells and other magical effects.

## Actions

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Slashing damage, and the target has the Poisoned condition until the start of the quasit's next turn.

**Scare (1/Day)**
*Wisdom Saving Throw*: DC 10, one creature within 20 feet. *Failure:*  The target has the Frightened condition. At the end of each of its turns, the target repeats the save, ending the effect on itself on a success. After 1 minute, it succeeds automatically.

**Shape-Shift**
The quasit shape-shifts to resemble a bat (Speed 10 ft., Fly 40 ft.), a centipede (40 ft., Climb 40 ft.), or a toad (40 ft., Swim 40 ft.), or it returns to its true form. Its game statistics are the same in each form, except for its Speed. Any equipment it is wearing or carrying isn't transformed.

**Invisibility**
The quasit casts *Invisibility* on itself, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** *Invisibility*
