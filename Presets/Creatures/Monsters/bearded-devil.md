---
smType: creature
name: Bearded Devil
size: Medium
type: Fiend
typeTags:
  - value: Devil
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '13'
initiative: +2 (12)
hp: '58'
hitDice: 9d8 + 18
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: true
    saveMod: 5
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 15
    saveProf: true
    saveMod: 4
  - key: int
    score: 9
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 14
    saveProf: true
    saveMod: 4
pb: '+2'
sensesList:
  - type: darkvision 120 ft. (unimpeded by magical darkness)
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Infernal
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Cold
damageImmunitiesList:
  - value: Fire
  - value: Poison; Frightened
conditionImmunitiesList:
  - value: Poisoned
cr: '3'
xp: '700'
entries:
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
    text: The devil makes one Beard attack and one Infernal Glaive attack.
    multiattack:
      attacks:
        - name: Beard
          count: 1
        - name: Glaive
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Beard
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage, and the target has the Poisoned condition until the start of the devil''s next turn. Until this poison ends, the target can''t regain Hit Points.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Piercing
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Infernal Glaive
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 10 ft. 8 (1d10 + 3) Slashing damage. If the target is a creature and doesn''t already have an infernal wound, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target receives an infernal wound. While wounded, the target loses 5 (1d10) Hit Points at the start of each of its turns. The wound closes after 1 minute, after a spell restores Hit Points to the target, or after the target or a creature within 5 feet of it takes an action to stanch the wound, doing so by succeeding on a DC 12 Wisdom (Medicine) check.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d10
          bonus: 3
          type: Slashing
          average: 8
      reach: 10 ft.
      onHit:
        other: 'If the target is a creature and doesn''t already have an infernal wound, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target receives an infernal wound. While wounded, the target loses 5 (1d10) Hit Points at the start of each of its turns. The wound closes after 1 minute, after a spell restores Hit Points to the target, or after the target or a creature within 5 feet of it takes an action to stanch the wound, doing so by succeeding on a DC 12 Wisdom (Medicine) check.'
      additionalEffects: 'If the target is a creature and doesn''t already have an infernal wound, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target receives an infernal wound. While wounded, the target loses 5 (1d10) Hit Points at the start of each of its turns. The wound closes after 1 minute, after a spell restores Hit Points to the target, or after the target or a creature within 5 feet of it takes an action to stanch the wound, doing so by succeeding on a DC 12 Wisdom (Medicine) check.'
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Bearded Devil
*Medium, Fiend, Lawful Evil*

**AC** 13
**HP** 58 (9d8 + 18)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft. (unimpeded by magical darkness); Passive Perception 10
**Languages** Infernal, telepathy 120 ft.
CR 3, PB +2, XP 700

## Traits

**Magic Resistance**
The devil has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The devil makes one Beard attack and one Infernal Glaive attack.

**Beard**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage, and the target has the Poisoned condition until the start of the devil's next turn. Until this poison ends, the target can't regain Hit Points.

**Infernal Glaive**
*Melee Attack Roll:* +5, reach 10 ft. 8 (1d10 + 3) Slashing damage. If the target is a creature and doesn't already have an infernal wound, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target receives an infernal wound. While wounded, the target loses 5 (1d10) Hit Points at the start of each of its turns. The wound closes after 1 minute, after a spell restores Hit Points to the target, or after the target or a creature within 5 feet of it takes an action to stanch the wound, doing so by succeeding on a DC 12 Wisdom (Medicine) check.
