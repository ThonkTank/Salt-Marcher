---
smType: creature
name: Ancient Silver Dragon
size: Gargantuan
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '22'
initiative: +4 (14)
hp: '468'
hitDice: 24d20 + 216
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 30
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 7
  - key: con
    score: 29
    saveProf: false
  - key: int
    score: 18
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 9
  - key: cha
    score: 26
    saveProf: false
pb: '+7'
skills:
  - skill: History
    value: '11'
  - skill: Perception
    value: '16'
  - skill: Stealth
    value: '7'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '26'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Cold
cr: '23'
xp: '50000'
entries:
  - category: trait
    name: Legendary Resistance (4/Day, or 5/Day in Lair)
    entryType: special
    text: If the dragon fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 4
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of (A) Paralyzing Breath or (B) Spellcasting to cast *Ice Knife* (level 2 version).
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Ice Knife
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +17, reach 15 ft. 19 (2d8 + 10) Slashing damage plus 9 (2d8) Cold damage.'
    attack:
      type: melee
      bonus: 17
      damage:
        - dice: 2d8
          bonus: 10
          type: Slashing
          average: 19
        - dice: 2d8
          bonus: 0
          type: Cold
          average: 9
      reach: 15 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Cold Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 24, each creature in a 90-foot Cone. *Failure:*  67 (15d8) Cold damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 24
      targeting:
        shape: cone
        size: 90 ft.
      onFail:
        effects:
          other: 67 (15d8) Cold damage.
        damage:
          - dice: 15d8
            bonus: 0
            type: Cold
            average: 67
        legacyEffects: 67 (15d8) Cold damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Paralyzing Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 24, each creature in a 90-foot Cone. *First Failure* The target has the Incapacitated condition until the end of its next turn, when it repeats the save. *Second Failure* The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    save:
      ability: con
      dc: 24
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Cold Gale
    entryType: save
    text: '*Dexterity Saving Throw*: DC 23, each creature in a 60-foot-long, 10-foot-wide Line. *Failure:*  14 (4d6) Cold damage, and the target is pushed up to 30 feet straight away from the dragon. *Success:*  Half damage only. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: dex
      dc: 23
      targeting:
        shape: line
        size: 60 ft.
        width: 10 ft.
      onFail:
        effects:
          movement:
            type: push
            distance: 30 feet
            direction: straight away from the dragon
        damage:
          - dice: 4d6
            bonus: 0
            type: Cold
            average: 14
      onSuccess:
        damage: half
        legacyText: Half damage only.
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
  - category: legendary
    name: Pounce
    entryType: multiattack
    text: The dragon moves up to half its Speed, and it makes one Rend attack.
    multiattack:
      attacks:
        - name: Rend
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: self
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23, +15 to hit with spell attacks): - **At Will:** *Detect Magic*, *Hold Monster*, *Ice Knife*, *Shapechange* - **1e/Day Each:** *Control Weather*, *Ice Storm*, *Teleport*, *Zone of Truth*'
    spellcasting:
      ability: cha
      saveDC: 23
      attackBonus: 15
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Hold Monster
            - Ice Knife
            - Shapechange
        - frequency: 1/day
          spells:
            - Control Weather
            - Ice Storm
            - Teleport
            - Zone of Truth
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Chill
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Hold Monster*. The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Ancient Silver Dragon
*Gargantuan, Dragon, Lawful Good*

**AC** 22
**HP** 468 (24d20 + 216)
**Initiative** +4 (14)
**Speed** 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 26
**Languages** Common, Draconic
CR 23, PB +7, XP 50000

## Traits

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of (A) Paralyzing Breath or (B) Spellcasting to cast *Ice Knife* (level 2 version).

**Rend**
*Melee Attack Roll:* +17, reach 15 ft. 19 (2d8 + 10) Slashing damage plus 9 (2d8) Cold damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 24, each creature in a 90-foot Cone. *Failure:*  67 (15d8) Cold damage. *Success:*  Half damage.

**Paralyzing Breath**
*Constitution Saving Throw*: DC 24, each creature in a 90-foot Cone. *First Failure* The target has the Incapacitated condition until the end of its next turn, when it repeats the save. *Second Failure* The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23, +15 to hit with spell attacks): - **At Will:** *Detect Magic*, *Hold Monster*, *Ice Knife*, *Shapechange* - **1e/Day Each:** *Control Weather*, *Ice Storm*, *Teleport*, *Zone of Truth*

## Legendary Actions

**Chill**
The dragon uses Spellcasting to cast *Hold Monster*. The dragon can't take this action again until the start of its next turn.

**Cold Gale**
*Dexterity Saving Throw*: DC 23, each creature in a 60-foot-long, 10-foot-wide Line. *Failure:*  14 (4d6) Cold damage, and the target is pushed up to 30 feet straight away from the dragon. *Success:*  Half damage only. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
