---
smType: creature
name: Ancient Green Dragon
size: Gargantuan
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '21'
initiative: +5 (15)
hp: '402'
hitDice: 23d20 + 161
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 27
    saveProf: false
  - key: dex
    score: 12
    saveProf: true
    saveMod: 8
  - key: con
    score: 25
    saveProf: false
  - key: int
    score: 20
    saveProf: false
  - key: wis
    score: 17
    saveProf: true
    saveMod: 10
  - key: cha
    score: 22
    saveProf: false
pb: '+7'
skills:
  - skill: Deception
    value: '13'
  - skill: Perception
    value: '17'
  - skill: Persuasion
    value: '13'
  - skill: Stealth
    value: '8'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '27'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Poison; Poisoned
cr: '22'
xp: '41000'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
  - category: trait
    name: Legendary Resistance (4/Day, or 5/Day in Lair)
    entryType: special
    text: If the dragon fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 4
      reset: day
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Mind Spike* (level 5 version).
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
    text: '*Melee Attack Roll:* +15, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 10 (3d6) Poison damage.'
    attack:
      type: melee
      bonus: 15
      damage:
        - dice: 2d8
          bonus: 8
          type: Slashing
          average: 17
        - dice: 3d6
          bonus: 0
          type: Poison
          average: 10
      reach: 15 ft.
  - category: action
    name: Poison Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  77 (22d6) Poison damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 22
      targeting:
        shape: cone
        size: 90 ft.
      onFail:
        effects:
          other: 77 (22d6) Poison damage.
        damage:
          - dice: 22d6
            bonus: 0
            type: Poison
            average: 77
        legacyEffects: 77 (22d6) Poison damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: legendary
    name: Noxious Miasma
    entryType: save
    text: '*Constitution Saving Throw*: DC 21, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 90 feet. *Failure:*  17 (5d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: con
      dc: 21
      targeting:
        shape: sphere
        size: 30 ft.
      onFail:
        effects:
          other: 17 (5d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn.
        damage:
          - dice: 5d6
            bonus: 0
            type: Poison
            average: 17
        legacyEffects: 17 (5d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn.
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
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21): - **At Will:** *Detect Magic*, *Mind Spike* - **1e/Day Each:** *Geas*, *Modify Memory*'
    spellcasting:
      ability: cha
      saveDC: 21
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
            - Modify Memory
  - category: legendary
    name: Mind Invasion
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Mind Spike* (level 5 version).
    spellcasting:
      ability: int
      spellLists: []
---

# Ancient Green Dragon
*Gargantuan, Dragon, Lawful Evil*

**AC** 21
**HP** 402 (23d20 + 161)
**Initiative** +5 (15)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 27
**Languages** Common, Draconic
CR 22, PB +7, XP 41000

## Traits

**Amphibious**
The dragon can breathe air and water.

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Mind Spike* (level 5 version).

**Rend**
*Melee Attack Roll:* +15, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 10 (3d6) Poison damage.

**Poison Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  77 (22d6) Poison damage. *Success:*  Half damage.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21): - **At Will:** *Detect Magic*, *Mind Spike* - **1e/Day Each:** *Geas*, *Modify Memory*

## Legendary Actions

**Mind Invasion**
The dragon uses Spellcasting to cast *Mind Spike* (level 5 version).

**Noxious Miasma**
*Constitution Saving Throw*: DC 21, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 90 feet. *Failure:*  17 (5d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
