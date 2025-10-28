---
smType: creature
name: Lamia
size: Large
type: Fiend
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '13'
initiative: +1 (11)
hp: '97'
hitDice: 13d10 + 26
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 15
    saveProf: false
  - key: cha
    score: 16
    saveProf: false
pb: '+2'
skills:
  - skill: Deception
    value: '7'
  - skill: Insight
    value: '4'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Abyssal
  - value: Common
cr: '4'
xp: '1100'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The lamia makes two Claw attacks. It can replace one attack with a use of Corrupting Touch.
    multiattack:
      attacks:
        - name: Claw
          count: 2
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Corrupting Touch
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage plus 7 (2d6) Psychic damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Slashing
          average: 7
        - dice: 2d6
          bonus: 0
          type: Psychic
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Corrupting Touch
    entryType: save
    text: '*Wisdom Saving Throw*: DC 13, one creature the lamia can see within 5 feet. *Failure:*  13 (3d8) Psychic damage, and the target is cursed for 1 hour. Until the curse ends, the target has the Charmed and Poisoned conditions.'
    save:
      ability: wis
      dc: 13
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Cursed
              additionalText: the target has the Charmed and Poisoned conditions
              duration:
                type: until
                trigger: the curse ends
        damage:
          - dice: 3d8
            bonus: 0
            type: Psychic
            average: 13
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Leap
    entryType: special
    text: The lamia jumps up to 30 feet by spending 10 feet of movement.
    trigger.activation: bonus
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The lamia casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13): - **At Will:** *Disguise Self*, *Minor Illusion* - **1e/Day Each:** *Geas*, *Major Image*, *Scrying*'
    spellcasting:
      ability: cha
      saveDC: 13
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Disguise Self
            - Minor Illusion
        - frequency: 1/day
          spells:
            - Geas
            - Major Image
            - Scrying
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Lamia
*Large, Fiend, Chaotic Evil*

**AC** 13
**HP** 97 (13d10 + 26)
**Initiative** +1 (11)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 12
**Languages** Abyssal, Common
CR 4, PB +2, XP 1100

## Actions

**Multiattack**
The lamia makes two Claw attacks. It can replace one attack with a use of Corrupting Touch.

**Claw**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage plus 7 (2d6) Psychic damage.

**Corrupting Touch**
*Wisdom Saving Throw*: DC 13, one creature the lamia can see within 5 feet. *Failure:*  13 (3d8) Psychic damage, and the target is cursed for 1 hour. Until the curse ends, the target has the Charmed and Poisoned conditions.

**Spellcasting**
The lamia casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13): - **At Will:** *Disguise Self*, *Minor Illusion* - **1e/Day Each:** *Geas*, *Major Image*, *Scrying*

## Bonus Actions

**Leap**
The lamia jumps up to 30 feet by spending 10 feet of movement.
