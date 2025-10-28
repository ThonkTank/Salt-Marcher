---
smType: creature
name: Horned Devil
size: Large
type: Fiend
typeTags:
  - value: Devil
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '18'
initiative: +7 (17)
hp: '199'
hitDice: 19d10 + 95
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 22
    saveProf: true
    saveMod: 10
  - key: dex
    score: 17
    saveProf: true
    saveMod: 7
  - key: con
    score: 21
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 16
    saveProf: true
    saveMod: 7
  - key: cha
    score: 18
    saveProf: true
    saveMod: 8
pb: '+4'
sensesList:
  - type: darkvision 150 ft. (unimpeded by magical darkness)
passivesList:
  - skill: Perception
    value: '13'
languagesList:
  - value: Infernal
  - value: telepathy 120 ft.
damageImmunitiesList:
  - value: Fire
  - value: Poison; Poisoned
cr: '11'
xp: '7200'
entries:
  - category: trait
    name: Diabolical Restoration
    entryType: special
    text: If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The devil has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The devil makes three attacks, using Searing Fork or Hurl Flame in any combination. It can replace one attack with a use of Infernal Tail.
    multiattack:
      attacks:
        - name: three
          count: 1
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Infernal Tail
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Searing Fork
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 10 ft. 15 (2d8 + 6) Piercing damage plus 9 (2d8) Fire damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 2d8
          bonus: 6
          type: Piercing
          average: 15
        - dice: 2d8
          bonus: 0
          type: Fire
          average: 9
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Hurl Flame
    entryType: attack
    text: '*Ranged Attack Roll:* +8, range 150 ft. 26 (5d8 + 4) Fire damage. If the target is a flammable object that isn''t being worn or carried, it starts burning.'
    attack:
      type: ranged
      bonus: 8
      damage:
        - dice: 5d8
          bonus: 4
          type: Fire
          average: 26
      range: 150 ft.
      onHit:
        other: If the target is a flammable object that isn't being worn or carried, it starts burning.
      additionalEffects: If the target is a flammable object that isn't being worn or carried, it starts burning.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Infernal Tail
    entryType: save
    text: '*Dexterity Saving Throw*: DC 17, one creature the devil can see within 10 feet. *Failure:*  10 (1d8 + 6) Necrotic damage, and the target receives an infernal wound if it doesn''t have one. While wounded, the target loses 10 (3d6) Hit Points at the start of each of its turns. The wound closes after 1 minute, after a spell restores Hit Points to the target, or after the target or a creature within 5 feet of it takes an action to stanch the wound, doing so by succeeding on a DC 17 Wisdom (Medicine) check.'
    save:
      ability: dex
      dc: 17
      targeting:
        type: single
        range: 10 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          other: 10 (1d8 + 6) Necrotic damage, and the target receives an infernal wound if it doesn't have one. While wounded, the target loses 10 (3d6) Hit Points at the start of each of its turns. The wound closes after 1 minute, after a spell restores Hit Points to the target, or after the target or a creature within 5 feet of it takes an action to stanch the wound, doing so by succeeding on a DC 17 Wisdom (Medicine) check.
        damage:
          - dice: 1d8
            bonus: 6
            type: Necrotic
            average: 10
        legacyEffects: 10 (1d8 + 6) Necrotic damage, and the target receives an infernal wound if it doesn't have one. While wounded, the target loses 10 (3d6) Hit Points at the start of each of its turns. The wound closes after 1 minute, after a spell restores Hit Points to the target, or after the target or a creature within 5 feet of it takes an action to stanch the wound, doing so by succeeding on a DC 17 Wisdom (Medicine) check.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Horned Devil
*Large, Fiend, Lawful Evil*

**AC** 18
**HP** 199 (19d10 + 95)
**Initiative** +7 (17)
**Speed** 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 150 ft. (unimpeded by magical darkness); Passive Perception 13
**Languages** Infernal, telepathy 120 ft.
CR 11, PB +4, XP 7200

## Traits

**Diabolical Restoration**
If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.

**Magic Resistance**
The devil has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The devil makes three attacks, using Searing Fork or Hurl Flame in any combination. It can replace one attack with a use of Infernal Tail.

**Searing Fork**
*Melee Attack Roll:* +10, reach 10 ft. 15 (2d8 + 6) Piercing damage plus 9 (2d8) Fire damage.

**Hurl Flame**
*Ranged Attack Roll:* +8, range 150 ft. 26 (5d8 + 4) Fire damage. If the target is a flammable object that isn't being worn or carried, it starts burning.

**Infernal Tail**
*Dexterity Saving Throw*: DC 17, one creature the devil can see within 10 feet. *Failure:*  10 (1d8 + 6) Necrotic damage, and the target receives an infernal wound if it doesn't have one. While wounded, the target loses 10 (3d6) Hit Points at the start of each of its turns. The wound closes after 1 minute, after a spell restores Hit Points to the target, or after the target or a creature within 5 feet of it takes an action to stanch the wound, doing so by succeeding on a DC 17 Wisdom (Medicine) check.
