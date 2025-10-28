---
smType: creature
name: Medusa
size: Medium
type: Monstrosity
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '15'
initiative: +6 (16)
hp: '127'
hitDice: 17d8 + 51
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 13
    saveProf: true
    saveMod: 4
  - key: cha
    score: 15
    saveProf: false
pb: '+3'
skills:
  - skill: Deception
    value: '5'
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '6'
sensesList:
  - type: darkvision
    range: '150'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Common plus one other language
cr: '6'
xp: '2300'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The medusa makes two Claw attacks and one Snake Hair attack, or it makes three Poison Ray attacks.
    multiattack:
      attacks:
        - name: Claw
          count: 2
        - name: Hair
          count: 1
        - name: Ray
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 3
          type: Slashing
          average: 10
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Snake Hair
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 5 (1d4 + 3) Piercing damage plus 14 (4d6) Poison damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d4
          bonus: 3
          type: Piercing
          average: 5
        - dice: 4d6
          bonus: 0
          type: Poison
          average: 14
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Poison Ray
    entryType: attack
    text: '*Ranged Attack Roll:* +5, range 150 ft. 11 (2d8 + 2) Poison damage.'
    attack:
      type: ranged
      bonus: 5
      damage:
        - dice: 2d8
          bonus: 2
          type: Poison
          average: 11
      range: 150 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Petrifying Gaze (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 13, each creature in a 30-foot Cone. If the medusa sees its reflection in the Cone, the medusa must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.'
    recharge: 5-6
    save:
      ability: con
      dc: 13
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Medusa
*Medium, Monstrosity, Lawful Evil*

**AC** 15
**HP** 127 (17d8 + 51)
**Initiative** +6 (16)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 150 ft.; Passive Perception 14
**Languages** Common plus one other language
CR 6, PB +3, XP 2300

## Actions

**Multiattack**
The medusa makes two Claw attacks and one Snake Hair attack, or it makes three Poison Ray attacks.

**Claw**
*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Slashing damage.

**Snake Hair**
*Melee Attack Roll:* +6, reach 5 ft. 5 (1d4 + 3) Piercing damage plus 14 (4d6) Poison damage.

**Poison Ray**
*Ranged Attack Roll:* +5, range 150 ft. 11 (2d8 + 2) Poison damage.

## Bonus Actions

**Petrifying Gaze (Recharge 5-6)**
*Constitution Saving Throw*: DC 13, each creature in a 30-foot Cone. If the medusa sees its reflection in the Cone, the medusa must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.
