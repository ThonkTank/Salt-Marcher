---
smType: creature
name: Succubus
size: Medium
type: Fiend
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '15'
initiative: +3 (13)
hp: '71'
hitDice: 13d8 + 13
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 8
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 15
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 20
    saveProf: false
pb: '+2'
skills:
  - skill: Deception
    value: '9'
  - skill: Insight
    value: '5'
  - skill: Perception
    value: '5'
  - skill: Persuasion
    value: '9'
  - skill: Stealth
    value: '7'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Abyssal
  - value: Common
  - value: Infernal
  - value: telepathy 60 ft.
damageResistancesList:
  - value: Cold
  - value: Fire
  - value: Poison
  - value: Psychic
cr: '4'
xp: '1100'
entries:
  - category: trait
    name: Incubus Form
    entryType: special
    text: When the succubus finishes a Long Rest, it can shape-shift into an Incubus, using that stat block instead of this one.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The succubus makes one Fiendish Touch attack and uses Charm or Draining Kiss.
    multiattack:
      attacks:
        - name: Touch
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Fiendish Touch
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 16 (2d10 + 5) Psychic damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d10
          bonus: 5
          type: Psychic
          average: 16
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Draining Kiss
    entryType: save
    text: '*Constitution Saving Throw*: DC 15, one creature Charmed by the succubus within 5 feet. *Failure:*  13 (3d8) Psychic damage. *Success:*  Half damage. *Failure or Success*:  The target''s Hit Point maximum decreases by an amount equal to the damage taken.'
    save:
      ability: con
      dc: 15
      targeting:
        type: single
        range: 5 ft.
      onFail:
        effects:
          other: 13 (3d8) Psychic damage.
        damage:
          - dice: 3d8
            bonus: 0
            type: Psychic
            average: 13
        legacyEffects: 13 (3d8) Psychic damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Shape-Shift
    entryType: special
    text: The succubus shape-shifts to resemble a Medium or Small Humanoid or back into its true form. Its game statistics are the same in each form, except its Fly Speed is available only in its true form. Any equipment it's wearing or carrying isn't transformed.
    trigger.activation: bonus
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Charm
    entryType: spellcasting
    text: The succubus casts *Dominate Person* (level 8 version), requiring no spell components and using Charisma as the spellcasting ability (spell save DC 15).
    spellcasting:
      ability: cha
      saveDC: 15
      spellLists: []
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Succubus
*Medium, Fiend, Neutral Evil*

**AC** 15
**HP** 71 (13d8 + 13)
**Initiative** +3 (13)
**Speed** 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
**Languages** Abyssal, Common, Infernal, telepathy 60 ft.
CR 4, PB +2, XP 1100

## Traits

**Incubus Form**
When the succubus finishes a Long Rest, it can shape-shift into an Incubus, using that stat block instead of this one.

## Actions

**Multiattack**
The succubus makes one Fiendish Touch attack and uses Charm or Draining Kiss.

**Fiendish Touch**
*Melee Attack Roll:* +7, reach 5 ft. 16 (2d10 + 5) Psychic damage.

**Charm**
The succubus casts *Dominate Person* (level 8 version), requiring no spell components and using Charisma as the spellcasting ability (spell save DC 15).

**Draining Kiss**
*Constitution Saving Throw*: DC 15, one creature Charmed by the succubus within 5 feet. *Failure:*  13 (3d8) Psychic damage. *Success:*  Half damage. *Failure or Success*:  The target's Hit Point maximum decreases by an amount equal to the damage taken.

## Bonus Actions

**Shape-Shift**
The succubus shape-shifts to resemble a Medium or Small Humanoid or back into its true form. Its game statistics are the same in each form, except its Fly Speed is available only in its true form. Any equipment it's wearing or carrying isn't transformed.
