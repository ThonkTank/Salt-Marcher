---
smType: creature
name: Nalfeshnee
size: Large
type: Fiend
typeTags:
  - value: Demon
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '18'
initiative: +5 (15)
hp: '184'
hitDice: 16d10 + 96
speeds:
  walk:
    distance: 20 ft.
  fly:
    distance: 30 ft.
abilities:
  - key: str
    score: 21
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 22
    saveProf: true
    saveMod: 11
  - key: int
    score: 19
    saveProf: true
    saveMod: 9
  - key: wis
    score: 12
    saveProf: true
    saveMod: 6
  - key: cha
    score: 15
    saveProf: true
    saveMod: 7
pb: '+5'
sensesList:
  - type: truesight
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
  - value: Poison; Frightened
conditionImmunitiesList:
  - value: Poisoned
cr: '13'
xp: '10000'
entries:
  - category: trait
    name: Demonic Restoration
    entryType: special
    text: If the nalfeshnee dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The nalfeshnee has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The nalfeshnee makes three Rend attacks.
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
    text: '*Melee Attack Roll:* +10, reach 10 ft. 16 (2d10 + 5) Slashing damage plus 11 (2d10) Force damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 2d10
          bonus: 5
          type: Slashing
          average: 16
        - dice: 2d10
          bonus: 0
          type: Force
          average: 11
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Teleport
    entryType: special
    text: The nalfeshnee teleports up to 120 feet to an unoccupied space it can see.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Horror Nimbus (Recharge 5-6)
    entryType: save
    text: '*Wisdom Saving Throw*: DC 15, each creature in a 15-foot Emanation originating from the nalfeshnee. *Failure:*  28 (8d6) Psychic damage, and the target has the Frightened condition for 1 minute, until it takes damage, or until it ends its turn with the nalfeshnee out of line of sight. *Success:*  The target is immune to this nalfeshnee''s Horror Nimbus for 24 hours.'
    recharge: 5-6
    save:
      ability: wis
      dc: 15
      targeting:
        shape: emanation
        size: 15 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Frightened
              duration:
                type: until
                trigger: it takes damage
        damage:
          - dice: 8d6
            bonus: 0
            type: Psychic
            average: 28
      onSuccess: The target is immune to this nalfeshnee's Horror Nimbus for 24 hours.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Nalfeshnee
*Large, Fiend, Chaotic Evil*

**AC** 18
**HP** 184 (16d10 + 96)
**Initiative** +5 (15)
**Speed** 20 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 11
**Languages** Abyssal, telepathy 120 ft.
CR 13, PB +5, XP 10000

## Traits

**Demonic Restoration**
If the nalfeshnee dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.

**Magic Resistance**
The nalfeshnee has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The nalfeshnee makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +10, reach 10 ft. 16 (2d10 + 5) Slashing damage plus 11 (2d10) Force damage.

**Teleport**
The nalfeshnee teleports up to 120 feet to an unoccupied space it can see.

## Bonus Actions

**Horror Nimbus (Recharge 5-6)**
*Wisdom Saving Throw*: DC 15, each creature in a 15-foot Emanation originating from the nalfeshnee. *Failure:*  28 (8d6) Psychic damage, and the target has the Frightened condition for 1 minute, until it takes damage, or until it ends its turn with the nalfeshnee out of line of sight. *Success:*  The target is immune to this nalfeshnee's Horror Nimbus for 24 hours.
