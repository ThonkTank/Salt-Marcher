---
smType: creature
name: Ghast
size: Medium
type: Undead
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '13'
initiative: +3 (13)
hp: '36'
hitDice: 8d8
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 10
    saveProf: true
    saveMod: 2
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common
damageResistancesList:
  - value: Necrotic
damageImmunitiesList:
  - value: Poison; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Stench
    entryType: save
    text: '*Constitution Saving Throw*: DC 10, any creature that starts its turn in a 5-foot Emanation originating from the ghast. *Failure:*  The target has the Poisoned condition until the start of its next turn. *Success:*  The target is immune to this ghast''s Stench for 24 hours.'
    save:
      ability: con
      dc: 10
      targeting:
        shape: emanation
        size: 5 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Poisoned
              duration:
                type: until
                trigger: the start of its next turn
      onSuccess: The target is immune to this ghast's Stench for 24 hours.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 9 (2d8) Necrotic damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Piercing
          average: 7
        - dice: 2d8
          bonus: 0
          type: Necrotic
          average: 9
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage. If the target is a non-Undead creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Slashing
          average: 10
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Paralyzed
            duration:
              type: until
              trigger: the end of its next turn
      additionalEffects: 'If the target is a non-Undead creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.'
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Ghast
*Medium, Undead, Chaotic Evil*

**AC** 13
**HP** 36 (8d8)
**Initiative** +3 (13)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Common
CR 2, PB +2, XP 450

## Traits

**Stench**
*Constitution Saving Throw*: DC 10, any creature that starts its turn in a 5-foot Emanation originating from the ghast. *Failure:*  The target has the Poisoned condition until the start of its next turn. *Success:*  The target is immune to this ghast's Stench for 24 hours.

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 9 (2d8) Necrotic damage.

**Claw**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage. If the target is a non-Undead creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.
