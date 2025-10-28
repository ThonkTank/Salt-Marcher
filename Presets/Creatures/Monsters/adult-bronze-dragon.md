---
smType: creature
name: Adult Bronze Dragon
size: Huge
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '18'
initiative: +4 (14)
hp: '212'
hitDice: 17d12 + 102
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 25
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 5
  - key: con
    score: 23
    saveProf: false
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 7
  - key: cha
    score: 20
    saveProf: false
pb: '+5'
skills:
  - skill: Insight
    value: '7'
  - skill: Perception
    value: '12'
  - skill: Stealth
    value: '5'
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
  - value: Lightning
cr: '15'
xp: '13000'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of (A) Repulsion Breath or (B) Spellcasting to cast *Guiding Bolt* (level 2 version).
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Guiding Bolt
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +12, reach 10 ft. 16 (2d8 + 7) Slashing damage plus 5 (1d10) Lightning damage.'
    attack:
      type: melee
      bonus: 12
      damage:
        - dice: 2d8
          bonus: 7
          type: Slashing
          average: 16
        - dice: 1d10
          bonus: 0
          type: Lightning
          average: 5
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Lightning Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 19, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  55 (10d10) Lightning damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 19
      targeting:
        shape: line
        size: 90 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 55 (10d10) Lightning damage.
        damage:
          - dice: 10d10
            bonus: 0
            type: Lightning
            average: 55
        legacyEffects: 55 (10d10) Lightning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Repulsion Breath
    entryType: save
    text: '*Strength Saving Throw*: DC 19, each creature in a 30-foot Cone. *Failure:*  The target is pushed up to 60 feet straight away from the dragon and has the Prone condition.'
    save:
      ability: str
      dc: 19
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          conditions:
            - condition: Prone
          movement:
            type: push
            distance: 60 feet
            direction: straight away from the dragon
    trigger.activation: action
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
  - category: legendary
    name: Thunderclap
    entryType: save
    text: '*Constitution Saving Throw*: DC 17, each creature in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 90 feet. *Failure:*  10 (3d6) Thunder damage, and the target has the Deafened condition until the end of its next turn.'
    save:
      ability: con
      dc: 17
      targeting:
        shape: sphere
        size: 20 ft.
      onFail:
        effects:
          conditions:
            - condition: Deafened
              duration:
                type: until
                trigger: the end of its next turn
        damage:
          - dice: 3d6
            bonus: 0
            type: Thunder
            average: 10
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17, +10 to hit with spell attacks): - **At Will:** *Detect Magic*, *Guiding Bolt*, *Shapechange*, *Speak with Animals*, *Thaumaturgy* - **1e/Day Each:** *Detect Thoughts*, *Water Breathing*'
    spellcasting:
      ability: cha
      saveDC: 17
      attackBonus: 10
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Guiding Bolt
            - Shapechange
            - Speak with Animals
            - Thaumaturgy
        - frequency: 1/day
          spells:
            - Detect Thoughts
            - Water Breathing
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Guiding Light
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Guiding Bolt* (level 2 version).
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Adult Bronze Dragon
*Huge, Dragon, Lawful Good*

**AC** 18
**HP** 212 (17d12 + 102)
**Initiative** +4 (14)
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
The dragon makes three Rend attacks. It can replace one attack with a use of (A) Repulsion Breath or (B) Spellcasting to cast *Guiding Bolt* (level 2 version).

**Rend**
*Melee Attack Roll:* +12, reach 10 ft. 16 (2d8 + 7) Slashing damage plus 5 (1d10) Lightning damage.

**Lightning Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 19, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  55 (10d10) Lightning damage. *Success:*  Half damage.

**Repulsion Breath**
*Strength Saving Throw*: DC 19, each creature in a 30-foot Cone. *Failure:*  The target is pushed up to 60 feet straight away from the dragon and has the Prone condition.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17, +10 to hit with spell attacks): - **At Will:** *Detect Magic*, *Guiding Bolt*, *Shapechange*, *Speak with Animals*, *Thaumaturgy* - **1e/Day Each:** *Detect Thoughts*, *Water Breathing*

## Legendary Actions

**Guiding Light**
The dragon uses Spellcasting to cast *Guiding Bolt* (level 2 version).

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.

**Thunderclap**
*Constitution Saving Throw*: DC 17, each creature in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 90 feet. *Failure:*  10 (3d6) Thunder damage, and the target has the Deafened condition until the end of its next turn.
