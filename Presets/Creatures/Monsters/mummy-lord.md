---
smType: creature
name: Mummy Lord
size: Small
type: Undead
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '17'
initiative: +4 (14)
hp: '187'
hitDice: 25d8 + 75
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 11
    saveProf: true
    saveMod: 5
  - key: wis
    score: 19
    saveProf: true
    saveMod: 9
  - key: cha
    score: 16
    saveProf: false
pb: '+5'
skills:
  - skill: History
    value: '5'
  - skill: Perception
    value: '9'
  - skill: Religion
    value: '5'
sensesList:
  - type: truesight
    range: '60'
passivesList:
  - skill: Perception
    value: '19'
languagesList:
  - value: Common plus three other languages
damageVulnerabilitiesList:
  - value: Fire
damageImmunitiesList:
  - value: Necrotic
  - value: Poison; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Frightened
  - value: Paralyzed
  - value: Poisoned
cr: '15'
xp: '13000'
entries:
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    entryType: special
    text: If the mummy fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The mummy has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Undead Restoration
    entryType: special
    text: If destroyed, the mummy gains a new body in 24 hours if its heart is intact, reviving with all its Hit Points. The new body appears in an unoccupied space within the mummy's lair. The heart is a Tiny object that has AC 17, HP 10, and Immunity to all damage except Fire.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The mummy makes one Rotting Fist or Channel Negative Energy attack, and it uses Dreadful Glare.
    multiattack:
      attacks:
        - name: Energy
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rotting Fist
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 5 ft. 15 (2d10 + 4) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target can''t regain Hit Points, it gains no benefit from finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 2d10
          bonus: 4
          type: Bludgeoning
          average: 15
        - dice: 3d6
          bonus: 0
          type: Necrotic
          average: 10
      reach: 5 ft.
      onHit:
        other: If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, it gains no benefit from finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.
      additionalEffects: If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, it gains no benefit from finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Channel Negative Energy
    entryType: attack
    text: '*Ranged Attack Roll:* +9, range 60 ft. 25 (6d6 + 4) Necrotic damage.'
    attack:
      type: ranged
      bonus: 9
      damage:
        - dice: 6d6
          bonus: 4
          type: Necrotic
          average: 25
      range: 60 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Dreadful Glare
    entryType: save
    text: '*Wisdom Saving Throw*: DC 17, one creature the mummy can see within 60 feet. *Failure:*  25 (6d6 + 4) Psychic damage, and the target has the Paralyzed condition until the end of the mummy''s next turn.'
    save:
      ability: wis
      dc: 17
      targeting:
        type: single
        range: 60 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Paralyzed
              duration:
                type: until
                trigger: the end of the mummy's next turn
        damage:
          - dice: 6d6
            bonus: 4
            type: Psychic
            average: 25
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Glare
    entryType: special
    text: The mummy uses Dreadful Glare. The mummy can't take this action again until the start of its next turn.
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
  - category: legendary
    name: Necrotic Strike
    entryType: multiattack
    text: The mummy makes one Rotting Fist or Channel Negative Energy attack.
    multiattack:
      attacks:
        - name: Energy
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
    text: 'The mummy casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 17, +9 to hit with spell attacks): - **At Will:** *Dispel Magic*, *Thaumaturgy* - **1e/Day Each:** *Animate Dead*, *Harm*, *Insect Plague*'
    spellcasting:
      ability: wis
      saveDC: 17
      attackBonus: 9
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Dispel Magic
            - Thaumaturgy
        - frequency: 1/day
          spells:
            - Animate Dead
            - Harm
            - Insect Plague
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Dread Command
    entryType: spellcasting
    text: The mummy casts *Command* (level 2 version), using the same spellcasting ability as Spellcasting. The mummy can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Mummy Lord
*Small, Undead, Lawful Evil*

**AC** 17
**HP** 187 (25d8 + 75)
**Initiative** +4 (14)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 60 ft.; Passive Perception 19
**Languages** Common plus three other languages
CR 15, PB +5, XP 13000

## Traits

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the mummy fails a saving throw, it can choose to succeed instead.

**Magic Resistance**
The mummy has Advantage on saving throws against spells and other magical effects.

**Undead Restoration**
If destroyed, the mummy gains a new body in 24 hours if its heart is intact, reviving with all its Hit Points. The new body appears in an unoccupied space within the mummy's lair. The heart is a Tiny object that has AC 17, HP 10, and Immunity to all damage except Fire.

## Actions

**Multiattack**
The mummy makes one Rotting Fist or Channel Negative Energy attack, and it uses Dreadful Glare.

**Rotting Fist**
*Melee Attack Roll:* +9, reach 5 ft. 15 (2d10 + 4) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, it gains no benefit from finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.

**Channel Negative Energy**
*Ranged Attack Roll:* +9, range 60 ft. 25 (6d6 + 4) Necrotic damage.

**Dreadful Glare**
*Wisdom Saving Throw*: DC 17, one creature the mummy can see within 60 feet. *Failure:*  25 (6d6 + 4) Psychic damage, and the target has the Paralyzed condition until the end of the mummy's next turn.

**Spellcasting**
The mummy casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 17, +9 to hit with spell attacks): - **At Will:** *Dispel Magic*, *Thaumaturgy* - **1e/Day Each:** *Animate Dead*, *Harm*, *Insect Plague*

## Legendary Actions

**Glare**
The mummy uses Dreadful Glare. The mummy can't take this action again until the start of its next turn.

**Necrotic Strike**
The mummy makes one Rotting Fist or Channel Negative Energy attack.

**Dread Command**
The mummy casts *Command* (level 2 version), using the same spellcasting ability as Spellcasting. The mummy can't take this action again until the start of its next turn.
