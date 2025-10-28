---
smType: creature
name: Vrock
size: Large
type: Fiend
typeTags:
  - value: Demon
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '15'
initiative: +2 (12)
hp: '152'
hitDice: 16d10 + 64
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 15
    saveProf: true
    saveMod: 5
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 8
    saveProf: false
  - key: wis
    score: 13
    saveProf: true
    saveMod: 4
  - key: cha
    score: 8
    saveProf: true
    saveMod: 2
pb: '+3'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Abyssal
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Cold
  - value: Fire
  - value: Lightning
damageImmunitiesList:
  - value: Poison; Poisoned
cr: '6'
xp: '2300'
entries:
  - category: trait
    name: Demonic Restoration
    entryType: special
    text: If the vrock dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The vrock has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The vrock makes two Shred attacks.
    multiattack:
      attacks:
        - name: Shred
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Shred
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Piercing damage plus 10 (3d6) Poison damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 3
          type: Piercing
          average: 10
        - dice: 3d6
          bonus: 0
          type: Poison
          average: 10
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Spores
    entryType: save
    text: '*Constitution Saving Throw*: DC 15, each creature in a 20-foot Emanation originating from the vrock. *Failure:*  The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. While Poisoned, the target takes 5 (1d10) Poison damage at the start of each of its turns. Emptying a flask of Holy Water on the target ends the effect early.'
    save:
      ability: con
      dc: 15
      targeting:
        shape: emanation
        size: 20 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Poisoned
              saveToEnd:
                timing: end-of-turn
        damage:
          - dice: 1d10
            bonus: 0
            type: Poison
            average: 5
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Stunning Screech (1/Day)
    entryType: save
    text: '*Constitution Saving Throw*: DC 15, each creature in a 20-foot Emanation originating from the vrock (demons succeed automatically). *Failure:*  10 (3d6) Thunder damage, and the target has the Stunned condition until the end of the vrock''s next turn.'
    limitedUse:
      count: 1
      reset: day
    save:
      ability: con
      dc: 15
      targeting:
        shape: emanation
        size: 20 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Stunned
              duration:
                type: until
                trigger: the end of the vrock's next turn
        damage:
          - dice: 3d6
            bonus: 0
            type: Thunder
            average: 10
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Vrock
*Large, Fiend, Chaotic Evil*

**AC** 15
**HP** 152 (16d10 + 64)
**Initiative** +2 (12)
**Speed** 40 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 11
**Languages** Abyssal, telepathy 120 ft.
CR 6, PB +3, XP 2300

## Traits

**Demonic Restoration**
If the vrock dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.

**Magic Resistance**
The vrock has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The vrock makes two Shred attacks.

**Shred**
*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Piercing damage plus 10 (3d6) Poison damage.

**Spores (Recharge 6)**
*Constitution Saving Throw*: DC 15, each creature in a 20-foot Emanation originating from the vrock. *Failure:*  The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. While Poisoned, the target takes 5 (1d10) Poison damage at the start of each of its turns. Emptying a flask of Holy Water on the target ends the effect early.

**Stunning Screech (1/Day)**
*Constitution Saving Throw*: DC 15, each creature in a 20-foot Emanation originating from the vrock (demons succeed automatically). *Failure:*  10 (3d6) Thunder damage, and the target has the Stunned condition until the end of the vrock's next turn.
