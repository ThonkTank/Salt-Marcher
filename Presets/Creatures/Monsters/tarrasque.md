---
smType: creature
name: Tarrasque
size: Gargantuan
type: Monstrosity
typeTags:
  - value: Titan
alignmentOverride: Unaligned
ac: '25'
initiative: +18 (28)
hp: '697'
hitDice: 34d20 + 340
speeds:
  walk:
    distance: 60 ft.
  burrow:
    distance: 40 ft.
  climb:
    distance: 60 ft.
abilities:
  - key: str
    score: 30
    saveProf: false
  - key: dex
    score: 11
    saveProf: true
    saveMod: 9
  - key: con
    score: 30
    saveProf: false
  - key: int
    score: 3
    saveProf: true
    saveMod: 5
  - key: wis
    score: 11
    saveProf: true
    saveMod: 9
  - key: cha
    score: 11
    saveProf: true
    saveMod: 9
pb: '+9'
skills:
  - skill: Perception
    value: '9'
sensesList:
  - type: blindsight
    range: '120'
passivesList:
  - skill: Perception
    value: '19'
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Fire
  - value: Poison; Charmed
conditionImmunitiesList:
  - value: Deafened
  - value: Frightened
  - value: Paralyzed
  - value: Poisoned
cr: '30'
xp: '155000'
entries:
  - category: trait
    name: Legendary Resistance (6/Day)
    entryType: special
    text: If the tarrasque fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 6
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The tarrasque has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Reflective Carapace
    entryType: special
    text: If the tarrasque is targeted by a *Magic Missile* spell or a spell that requires a ranged attack roll, roll 1d6. On a 1-5, the tarrasque is unaffected. On a 6, the tarrasque is unaffected and reflects the spell, turning the caster into the target.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Siege Monster
    entryType: special
    text: The tarrasque deals double damage to objects and structures.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The tarrasque makes one Bite attack and three other attacks, using Claw or Tail in any combination.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: other
          count: 3
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +19, reach 15 ft. 36 (4d12 + 10) Piercing damage, and the target has the Grappled condition (escape DC 20). Until the grapple ends, the target has the Restrained condition and can''t teleport.'
    attack:
      type: melee
      bonus: 19
      damage:
        - dice: 4d12
          bonus: 10
          type: Piercing
          average: 36
      reach: 15 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +19, reach 15 ft. 28 (4d8 + 10) Slashing damage.'
    attack:
      type: melee
      bonus: 19
      damage:
        - dice: 4d8
          bonus: 10
          type: Slashing
          average: 28
      reach: 15 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Tail
    entryType: attack
    text: '*Melee Attack Roll:* +19, reach 30 ft. 23 (3d8 + 10) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 19
      damage:
        - dice: 3d8
          bonus: 10
          type: Bludgeoning
          average: 23
      reach: 30 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Huge or smaller
      additionalEffects: If the target is a Huge or smaller creature, it has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Thunderous Bellow (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 27, each creature and each object that isn''t being worn or carried in a 150-foot Cone. *Failure:*  78 (12d12) Thunder damage, and the target has the Deafened and Frightened conditions until the end of its next turn. *Success:*  Half damage only.'
    recharge: 5-6
    save:
      ability: con
      dc: 27
      targeting:
        shape: cone
        size: 150 ft.
      onFail:
        effects:
          other: 78 (12d12) Thunder damage, and the target has the Deafened and Frightened conditions until the end of its next turn.
        damage:
          - dice: 12d12
            bonus: 0
            type: Thunder
            average: 78
        legacyEffects: 78 (12d12) Thunder damage, and the target has the Deafened and Frightened conditions until the end of its next turn.
      onSuccess:
        damage: half
        legacyText: Half damage only.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Swallow
    entryType: save
    text: '*Strength Saving Throw*: DC 27, one Large or smaller creature Grappled by the tarrasque (it can have up to six creatures swallowed at a time). *Failure:*  The target is swallowed, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions and can''t teleport, it has Cover|XPHB|Total Cover against attacks and other effects outside the tarrasque, and it takes 56 (16d6) Acid damage at the start of each of the tarrasque''s turns. If the tarrasque takes 60 damage or more on a single turn from a creature inside it, the tarrasque must succeed on a DC 20 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 10 feet of the tarrasque and has the Prone condition. If the tarrasque dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 20 feet of movement, exiting Prone.'
    save:
      ability: str
      dc: 27
      targeting:
        type: single
        count: six
        restrictions:
          size:
            - Large
            - smaller
          other:
            - grappled by source
      onFail:
        effects:
          conditions:
            - condition: Prone
            - condition: Restrained
        damage:
          - dice: 16d6
            bonus: 0
            type: Acid
            average: 56
    trigger.activation: bonus
    trigger.targeting:
      type: single
  - category: legendary
    name: Onslaught
    entryType: multiattack
    text: The tarrasque moves up to half its Speed, and it makes one Claw or Tail attack.
    multiattack:
      attacks:
        - name: Tail
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: self
  - category: legendary
    name: World-Shaking Movement
    entryType: special
    text: The tarrasque moves up to its Speed. At the end of this movement, the tarrasque creates an instantaneous shock wave in a 60-foot Emanation originating from itself. Creatures in that area lose  Concentration and, if Medium or smaller, have the Prone condition. The tarrasque can't take this action again until the start of its next turn.
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Tarrasque
*Gargantuan, Monstrosity, Unaligned*

**AC** 25
**HP** 697 (34d20 + 340)
**Initiative** +18 (28)
**Speed** 60 ft., climb 60 ft., burrow 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 120 ft.; Passive Perception 19
CR 30, PB +9, XP 155000

## Traits

**Legendary Resistance (6/Day)**
If the tarrasque fails a saving throw, it can choose to succeed instead.

**Magic Resistance**
The tarrasque has Advantage on saving throws against spells and other magical effects.

**Reflective Carapace**
If the tarrasque is targeted by a *Magic Missile* spell or a spell that requires a ranged attack roll, roll 1d6. On a 1-5, the tarrasque is unaffected. On a 6, the tarrasque is unaffected and reflects the spell, turning the caster into the target.

**Siege Monster**
The tarrasque deals double damage to objects and structures.

## Actions

**Multiattack**
The tarrasque makes one Bite attack and three other attacks, using Claw or Tail in any combination.

**Bite**
*Melee Attack Roll:* +19, reach 15 ft. 36 (4d12 + 10) Piercing damage, and the target has the Grappled condition (escape DC 20). Until the grapple ends, the target has the Restrained condition and can't teleport.

**Claw**
*Melee Attack Roll:* +19, reach 15 ft. 28 (4d8 + 10) Slashing damage.

**Tail**
*Melee Attack Roll:* +19, reach 30 ft. 23 (3d8 + 10) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.

**Thunderous Bellow (Recharge 5-6)**
*Constitution Saving Throw*: DC 27, each creature and each object that isn't being worn or carried in a 150-foot Cone. *Failure:*  78 (12d12) Thunder damage, and the target has the Deafened and Frightened conditions until the end of its next turn. *Success:*  Half damage only.

## Bonus Actions

**Swallow**
*Strength Saving Throw*: DC 27, one Large or smaller creature Grappled by the tarrasque (it can have up to six creatures swallowed at a time). *Failure:*  The target is swallowed, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions and can't teleport, it has Cover|XPHB|Total Cover against attacks and other effects outside the tarrasque, and it takes 56 (16d6) Acid damage at the start of each of the tarrasque's turns. If the tarrasque takes 60 damage or more on a single turn from a creature inside it, the tarrasque must succeed on a DC 20 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 10 feet of the tarrasque and has the Prone condition. If the tarrasque dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 20 feet of movement, exiting Prone.

## Legendary Actions

**Onslaught**
The tarrasque moves up to half its Speed, and it makes one Claw or Tail attack.

**World-Shaking Movement**
The tarrasque moves up to its Speed. At the end of this movement, the tarrasque creates an instantaneous shock wave in a 60-foot Emanation originating from itself. Creatures in that area lose  Concentration and, if Medium or smaller, have the Prone condition. The tarrasque can't take this action again until the start of its next turn.
