---
smType: creature
name: Wight
size: Medium
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '14'
initiative: +4 (14)
hp: '82'
hitDice: 11d8 + 33
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 15
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
languagesList:
  - value: Common plus one other language
damageResistancesList:
  - value: Necrotic
damageImmunitiesList:
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Sunlight Sensitivity
    entryType: special
    text: While in sunlight, the wight has Disadvantage on ability checks and attack rolls.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The wight makes two attacks, using Necrotic Sword or Necrotic Bow in any combination. It can replace one attack with a use of Life Drain.
    multiattack:
      attacks:
        - name: two
          count: 1
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Life Drain
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Necrotic Sword
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage plus 4 (1d8) Necrotic damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Slashing
          average: 6
        - dice: 1d8
          bonus: 0
          type: Necrotic
          average: 4
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Necrotic Bow
    entryType: attack
    text: '*Ranged Attack Roll:* +4, range 150/600 ft. 6 (1d8 + 2) Piercing damage plus 4 (1d8) Necrotic damage.'
    attack:
      type: ranged
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Piercing
          average: 6
        - dice: 1d8
          bonus: 0
          type: Necrotic
          average: 4
      range: 150/600 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Life Drain
    entryType: save
    text: '*Constitution Saving Throw*: DC 13, one creature within 5 feet. *Failure:*  6 (1d8 + 2) Necrotic damage, and the target''s Hit Point maximum decreases by an amount equal to the damage taken. A Humanoid slain by this attack rises 24 hours later as a Zombie under the wight''s control, unless the Humanoid is restored to life or its body is destroyed. The wight can have no more than twelve zombies under its control at a time.'
    save:
      ability: con
      dc: 13
      targeting:
        type: single
        range: 5 ft.
      onFail:
        effects:
          other: 6 (1d8 + 2) Necrotic damage, and the target's Hit Point maximum decreases by an amount equal to the damage taken. A Humanoid slain by this attack rises 24 hours later as a Zombie under the wight's control, unless the Humanoid is restored to life or its body is destroyed. The wight can have no more than twelve zombies under its control at a time.
        damage:
          - dice: 1d8
            bonus: 2
            type: Necrotic
            average: 6
        legacyEffects: 6 (1d8 + 2) Necrotic damage, and the target's Hit Point maximum decreases by an amount equal to the damage taken. A Humanoid slain by this attack rises 24 hours later as a Zombie under the wight's control, unless the Humanoid is restored to life or its body is destroyed. The wight can have no more than twelve zombies under its control at a time.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Wight
*Medium, Undead, Neutral Evil*

**AC** 14
**HP** 82 (11d8 + 33)
**Initiative** +4 (14)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
**Languages** Common plus one other language
CR 3, PB +2, XP 700

## Traits

**Sunlight Sensitivity**
While in sunlight, the wight has Disadvantage on ability checks and attack rolls.

## Actions

**Multiattack**
The wight makes two attacks, using Necrotic Sword or Necrotic Bow in any combination. It can replace one attack with a use of Life Drain.

**Necrotic Sword**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage plus 4 (1d8) Necrotic damage.

**Necrotic Bow**
*Ranged Attack Roll:* +4, range 150/600 ft. 6 (1d8 + 2) Piercing damage plus 4 (1d8) Necrotic damage.

**Life Drain**
*Constitution Saving Throw*: DC 13, one creature within 5 feet. *Failure:*  6 (1d8 + 2) Necrotic damage, and the target's Hit Point maximum decreases by an amount equal to the damage taken. A Humanoid slain by this attack rises 24 hours later as a Zombie under the wight's control, unless the Humanoid is restored to life or its body is destroyed. The wight can have no more than twelve zombies under its control at a time.
