---
smType: creature
name: Incubus
size: Medium
type: Fiend
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '15'
initiative: +3 (13)
hp: '66'
hitDice: 12d8 + 12
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
    name: Succubus Form
    entryType: special
    text: When the incubus finishes a Long Rest, it can shape-shift into a Succubus, using that stat block instead of this one. Any equipment it's wearing or carrying isn't transformed.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The incubus makes two Restless Touch attacks.
    multiattack:
      attacks:
        - name: Touch
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Restless Touch
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 15 (3d6 + 5) Psychic damage, and the target is cursed for 24 hours or until the incubus dies. Until the curse ends, the target gains no benefit from finishing Short Rests.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 3d6
          bonus: 5
          type: Psychic
          average: 15
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Nightmare
    entryType: save
    text: '*Wisdom Saving Throw*: DC 15, one creature the incubus can see within 60 feet. *Failure:*  If the target has 20 Hit Points or fewer, it has the Unconscious condition for 1 hour, until it takes damage, or until a creature within 5 feet of it takes an action to wake it. Otherwise, the target takes 18 (4d8) Psychic damage.'
    save:
      ability: wis
      dc: 15
      targeting:
        type: single
        range: 60 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Unconscious
              duration:
                type: until
                trigger: it takes damage
        damage:
          - dice: 4d8
            bonus: 0
            type: Psychic
            average: 18
    trigger.activation: bonus
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The incubus casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15): - **At Will:** *Disguise Self*, *Etherealness* - **1e/Day Each:** *Dream*, *Hypnotic Pattern*'
    spellcasting:
      ability: cha
      saveDC: 15
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Disguise Self
            - Etherealness
        - frequency: 1/day
          spells:
            - Dream
            - Hypnotic Pattern
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Incubus
*Medium, Fiend, Neutral Evil*

**AC** 15
**HP** 66 (12d8 + 12)
**Initiative** +3 (13)
**Speed** 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
**Languages** Abyssal, Common, Infernal, telepathy 60 ft.
CR 4, PB +2, XP 1100

## Traits

**Succubus Form**
When the incubus finishes a Long Rest, it can shape-shift into a Succubus, using that stat block instead of this one. Any equipment it's wearing or carrying isn't transformed.

## Actions

**Multiattack**
The incubus makes two Restless Touch attacks.

**Restless Touch**
*Melee Attack Roll:* +7, reach 5 ft. 15 (3d6 + 5) Psychic damage, and the target is cursed for 24 hours or until the incubus dies. Until the curse ends, the target gains no benefit from finishing Short Rests.

**Spellcasting**
The incubus casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15): - **At Will:** *Disguise Self*, *Etherealness* - **1e/Day Each:** *Dream*, *Hypnotic Pattern*

## Bonus Actions

**Nightmare (Recharge 6)**
*Wisdom Saving Throw*: DC 15, one creature the incubus can see within 60 feet. *Failure:*  If the target has 20 Hit Points or fewer, it has the Unconscious condition for 1 hour, until it takes damage, or until a creature within 5 feet of it takes an action to wake it. Otherwise, the target takes 18 (4d8) Psychic damage.
