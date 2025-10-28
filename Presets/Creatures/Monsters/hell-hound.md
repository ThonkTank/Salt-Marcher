---
smType: creature
name: Hell Hound
size: Medium
type: Fiend
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '15'
initiative: +1 (11)
hp: '58'
hitDice: 9d8 + 18
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Understands Infernal but can't speak
damageImmunitiesList:
  - value: Fire
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The hound has Advantage on an attack roll against a creature if at least one of the hound's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The hound makes two Bite attacks.
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
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 3 (1d6) Fire damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Piercing
          average: 7
        - dice: 1d6
          bonus: 0
          type: Fire
          average: 3
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 12, each creature in a 15-foot Cone. *Failure:*  17 (5d6) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 12
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          other: 17 (5d6) Fire damage.
        damage:
          - dice: 5d6
            bonus: 0
            type: Fire
            average: 17
        legacyEffects: 17 (5d6) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Hell Hound
*Medium, Fiend, Lawful Evil*

**AC** 15
**HP** 58 (9d8 + 18)
**Initiative** +1 (11)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
**Languages** Understands Infernal but can't speak
CR 3, PB +2, XP 700

## Traits

**Pack Tactics**
The hound has Advantage on an attack roll against a creature if at least one of the hound's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Multiattack**
The hound makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 3 (1d6) Fire damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 12, each creature in a 15-foot Cone. *Failure:*  17 (5d6) Fire damage. *Success:*  Half damage.
