---
smType: creature
name: Hezrou
size: Large
type: Fiend
typeTags:
  - value: Demon
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '18'
initiative: +6 (16)
hp: '157'
hitDice: 15d10 + 75
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 19
    saveProf: true
    saveMod: 7
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 20
    saveProf: true
    saveMod: 8
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 4
  - key: cha
    score: 13
    saveProf: false
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
cr: '8'
xp: '3900'
entries:
  - category: trait
    name: Demonic Restoration
    entryType: special
    text: If the hezrou dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The hezrou has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Stench
    entryType: save
    text: '*Constitution Saving Throw*: DC 16, any creature that starts its turn in a 10-foot Emanation originating from the hezrou. *Failure:*  The target has the Poisoned condition until the start of its next turn.'
    save:
      ability: con
      dc: 16
      targeting:
        shape: emanation
        size: 10 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Poisoned
              duration:
                type: until
                trigger: the start of its next turn
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The hezrou makes three Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 6 (1d4 + 4) Slashing damage plus 9 (2d8) Poison damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d4
          bonus: 4
          type: Slashing
          average: 6
        - dice: 2d8
          bonus: 0
          type: Poison
          average: 9
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Leap
    entryType: special
    text: The hezrou jumps up to 30 feet by spending 10 feet of movement.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Hezrou
*Large, Fiend, Chaotic Evil*

**AC** 18
**HP** 157 (15d10 + 75)
**Initiative** +6 (16)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 11
**Languages** Abyssal, telepathy 120 ft.
CR 8, PB +3, XP 3900

## Traits

**Demonic Restoration**
If the hezrou dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.

**Magic Resistance**
The hezrou has Advantage on saving throws against spells and other magical effects.

**Stench**
*Constitution Saving Throw*: DC 16, any creature that starts its turn in a 10-foot Emanation originating from the hezrou. *Failure:*  The target has the Poisoned condition until the start of its next turn.

## Actions

**Multiattack**
The hezrou makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +7, reach 5 ft. 6 (1d4 + 4) Slashing damage plus 9 (2d8) Poison damage.

## Bonus Actions

**Leap**
The hezrou jumps up to 30 feet by spending 10 feet of movement.
