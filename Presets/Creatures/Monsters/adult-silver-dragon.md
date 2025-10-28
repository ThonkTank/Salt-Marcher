---
smType: creature
name: Adult Silver Dragon
size: Huge
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '19'
initiative: +4 (14)
hp: '216'
hitDice: 16d12 + 112
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 27
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 5
  - key: con
    score: 25
    saveProf: false
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 13
    saveProf: true
    saveMod: 6
  - key: cha
    score: 22
    saveProf: false
pb: '+5'
skills:
  - skill: History
    value: '8'
  - skill: Perception
    value: '11'
  - skill: Stealth
    value: '5'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '21'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Cold
cr: '16'
xp: '15000'
entries:
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    entryType: special
    text: If the dragon fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of (A) Paralyzing Breath or (B) Spellcasting to cast *Ice Knife*.
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
    text: '*Melee Attack Roll:* +13, reach 10 ft. 17 (2d8 + 8) Slashing damage plus 4 (1d8) Cold damage.'
    attack:
      type: melee
      bonus: 13
      damage:
        - dice: 2d8
          bonus: 8
          type: Slashing
          average: 17
        - dice: 1d8
          bonus: 0
          type: Cold
          average: 4
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Cold Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 20, each creature in a 60-foot Cone. *Failure:*  54 (12d8) Cold damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 20
      targeting:
        shape: cone
        size: 60 ft.
      onFail:
        effects:
          other: 54 (12d8) Cold damage.
        damage:
          - dice: 12d8
            bonus: 0
            type: Cold
            average: 54
        legacyEffects: 54 (12d8) Cold damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Paralyzing Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 20, each creature in a 60-foot Cone. *First Failure* The target has the Incapacitated condition until the end of its next turn, when it repeats the save. *Second Failure* The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    save:
      ability: con
      dc: 20
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Cold Gale
    entryType: save
    text: '*Dexterity Saving Throw*: DC 19, each creature in a 60-foot-long, 10-foot-wide Line. *Failure:*  14 (4d6) Cold damage, and the target is pushed up to 30 feet straight away from the dragon. *Success:*  Half damage only. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: dex
      dc: 19
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
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 19, +11 to hit with spell attacks): - **At Will:** *Detect Magic*, *Hold Monster*, *Ice Knife*, *Shapechange* - **1e/Day Each:** *Ice Storm*, *Zone of Truth*'
    spellcasting:
      ability: cha
      saveDC: 19
      attackBonus: 11
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
            - Ice Storm
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

# Adult Silver Dragon
*Huge, Dragon, Lawful Good*

**AC** 19
**HP** 216 (16d12 + 112)
**Initiative** +4 (14)
**Speed** 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 21
**Languages** Common, Draconic
CR 16, PB +5, XP 15000

## Traits

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of (A) Paralyzing Breath or (B) Spellcasting to cast *Ice Knife*.

**Rend**
*Melee Attack Roll:* +13, reach 10 ft. 17 (2d8 + 8) Slashing damage plus 4 (1d8) Cold damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 20, each creature in a 60-foot Cone. *Failure:*  54 (12d8) Cold damage. *Success:*  Half damage.

**Paralyzing Breath**
*Constitution Saving Throw*: DC 20, each creature in a 60-foot Cone. *First Failure* The target has the Incapacitated condition until the end of its next turn, when it repeats the save. *Second Failure* The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 19, +11 to hit with spell attacks): - **At Will:** *Detect Magic*, *Hold Monster*, *Ice Knife*, *Shapechange* - **1e/Day Each:** *Ice Storm*, *Zone of Truth*

## Legendary Actions

**Chill**
The dragon uses Spellcasting to cast *Hold Monster*. The dragon can't take this action again until the start of its next turn.

**Cold Gale**
*Dexterity Saving Throw*: DC 19, each creature in a 60-foot-long, 10-foot-wide Line. *Failure:*  14 (4d6) Cold damage, and the target is pushed up to 30 feet straight away from the dragon. *Success:*  Half damage only. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
