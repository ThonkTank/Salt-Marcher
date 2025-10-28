---
smType: creature
name: Guardian Naga
size: Large
type: Celestial
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '18'
initiative: +4 (14)
hp: '136'
hitDice: 16d10 + 48
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 18
    saveProf: true
    saveMod: 8
  - key: con
    score: 16
    saveProf: true
    saveMod: 7
  - key: int
    score: 16
    saveProf: true
    saveMod: 7
  - key: wis
    score: 19
    saveProf: true
    saveMod: 8
  - key: cha
    score: 18
    saveProf: true
    saveMod: 8
pb: '+4'
skills:
  - skill: Arcana
    value: '11'
  - skill: History
    value: '11'
  - skill: Religion
    value: '11'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Celestial
  - value: Common
damageImmunitiesList:
  - value: Poison; Charmed
conditionImmunitiesList:
  - value: Paralyzed
  - value: Poisoned
  - value: Restrained
cr: '10'
xp: '5900'
entries:
  - category: trait
    name: Celestial Restoration
    entryType: special
    text: If the naga dies, it returns to life in 1d6 days and regains all its Hit Points unless *Dispel Evil and Good* is cast on its remains.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The naga makes two Bite attacks. It can replace any attack with a use of Poisonous Spittle.
    multiattack:
      attacks:
        - name: Bite
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 10 ft. 17 (2d12 + 4) Piercing damage plus 22 (4d10) Poison damage.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 2d12
          bonus: 4
          type: Piercing
          average: 17
        - dice: 4d10
          bonus: 0
          type: Poison
          average: 22
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Poisonous Spittle
    entryType: save
    text: '*Constitution Saving Throw*: DC 16, one creature the naga can see within 60 feet. *Failure:*  31 (7d8) Poison damage, and the target has the Blinded condition until the start of the naga''s next turn. *Success:*  Half damage only.'
    save:
      ability: con
      dc: 16
      targeting:
        type: single
        range: 60 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Blinded
              duration:
                type: until
                trigger: the start of the naga's next turn
        damage:
          - dice: 7d8
            bonus: 0
            type: Poison
            average: 31
      onSuccess:
        damage: half
        legacyText: Half damage only.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The naga casts one of the following spells, requiring no Somatic or Material components and using Wisdom as the spellcasting ability (spell save DC 16): - **At Will:** *Thaumaturgy* - **1e/Day Each:** *Clairvoyance*, *Cure Wounds*, *Flame Strike*, *Geas*, *True Seeing*'
    spellcasting:
      ability: wis
      saveDC: 16
      spellLists:
        - frequency: at-will
          spells:
            - Thaumaturgy
        - frequency: 1/day
          spells:
            - Clairvoyance
            - Cure Wounds
            - Flame Strike
            - Geas
            - True Seeing
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Guardian Naga
*Large, Celestial, Lawful Good*

**AC** 18
**HP** 136 (16d10 + 48)
**Initiative** +4 (14)
**Speed** 40 ft., climb 40 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Celestial, Common
CR 10, PB +4, XP 5900

## Traits

**Celestial Restoration**
If the naga dies, it returns to life in 1d6 days and regains all its Hit Points unless *Dispel Evil and Good* is cast on its remains.

## Actions

**Multiattack**
The naga makes two Bite attacks. It can replace any attack with a use of Poisonous Spittle.

**Bite**
*Melee Attack Roll:* +8, reach 10 ft. 17 (2d12 + 4) Piercing damage plus 22 (4d10) Poison damage.

**Poisonous Spittle**
*Constitution Saving Throw*: DC 16, one creature the naga can see within 60 feet. *Failure:*  31 (7d8) Poison damage, and the target has the Blinded condition until the start of the naga's next turn. *Success:*  Half damage only.

**Spellcasting**
The naga casts one of the following spells, requiring no Somatic or Material components and using Wisdom as the spellcasting ability (spell save DC 16): - **At Will:** *Thaumaturgy* - **1e/Day Each:** *Clairvoyance*, *Cure Wounds*, *Flame Strike*, *Geas*, *True Seeing*
