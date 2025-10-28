---
smType: creature
name: Adult Green Dragon
size: Huge
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '19'
initiative: +5 (15)
hp: '207'
hitDice: 18d12 + 90
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 12
    saveProf: true
    saveMod: 6
  - key: con
    score: 21
    saveProf: false
  - key: int
    score: 18
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 7
  - key: cha
    score: 18
    saveProf: false
pb: '+5'
skills:
  - skill: Deception
    value: '9'
  - skill: Perception
    value: '12'
  - skill: Persuasion
    value: '9'
  - skill: Stealth
    value: '6'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '22'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Poison; Poisoned
cr: '15'
xp: '13000'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    entryType: special
    text: If the dragon fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Mind Spike* (level 3 version).
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Mind Spike
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +11, reach 10 ft. 15 (2d8 + 6) Slashing damage plus 7 (2d6) Poison damage.'
    attack:
      type: melee
      bonus: 11
      damage:
        - dice: 2d8
          bonus: 6
          type: Slashing
          average: 15
        - dice: 2d6
          bonus: 0
          type: Poison
          average: 7
      reach: 10 ft.
  - category: action
    name: Poison Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  56 (16d6) Poison damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 18
      targeting:
        shape: cone
        size: 60 ft.
      onFail:
        effects:
          other: 56 (16d6) Poison damage.
        damage:
          - dice: 16d6
            bonus: 0
            type: Poison
            average: 56
        legacyEffects: 56 (16d6) Poison damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: legendary
    name: Noxious Miasma
    entryType: save
    text: '*Constitution Saving Throw*: DC 17, each creature in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 90 feet. *Failure:*  7 (2d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: con
      dc: 17
      targeting:
        shape: sphere
        size: 20 ft.
      onFail:
        effects:
          other: 7 (2d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn.
        damage:
          - dice: 2d6
            bonus: 0
            type: Poison
            average: 7
        legacyEffects: 7 (2d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn.
  - category: legendary
    name: Pounce
    entryType: multiattack
    text: The dragon moves up to half its Speed, and it makes one Rend attack.
    multiattack:
      attacks:
        - name: Rend
          count: 1
      substitutions: []
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Magic*, *Mind Spike* - **1/Day Each:** *Geas*'
    spellcasting:
      ability: cha
      saveDC: 17
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Mind Spike
        - frequency: 1/day
          spells:
            - Geas
  - category: legendary
    name: Mind Invasion
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Mind Spike* (level 3 version).
    spellcasting:
      ability: int
      spellLists: []
---

# Adult Green Dragon
*Huge, Dragon, Lawful Evil*

**AC** 19
**HP** 207 (18d12 + 90)
**Initiative** +5 (15)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 22
**Languages** Common, Draconic
CR 15, PB +5, XP 13000

## Traits

**Amphibious**
The dragon can breathe air and water.

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Mind Spike* (level 3 version).

**Rend**
*Melee Attack Roll:* +11, reach 10 ft. 15 (2d8 + 6) Slashing damage plus 7 (2d6) Poison damage.

**Poison Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  56 (16d6) Poison damage. *Success:*  Half damage.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Magic*, *Mind Spike* - **1/Day Each:** *Geas*

## Legendary Actions

**Mind Invasion**
The dragon uses Spellcasting to cast *Mind Spike* (level 3 version).

**Noxious Miasma**
*Constitution Saving Throw*: DC 17, each creature in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 90 feet. *Failure:*  7 (2d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
