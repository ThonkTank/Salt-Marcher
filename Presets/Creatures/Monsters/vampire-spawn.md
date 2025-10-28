---
smType: creature
name: Vampire Spawn
size: Small
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '16'
initiative: +3 (13)
hp: '90'
hitDice: 12d8 + 36
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 16
    saveProf: true
    saveMod: 6
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 10
    saveProf: true
    saveMod: 3
  - key: cha
    score: 12
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '3'
  - skill: Stealth
    value: '6'
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
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Spider Climb
    entryType: special
    text: The vampire can climb difficult surfaces, including along ceilings, without needing to make an ability check.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Vampire Weakness
    entryType: special
    text: 'The vampire has these weaknesses: - **Forbiddance**: The vampire can''t enter a residence without an invitation from an occupant. - **Running Water**: The vampire takes 20 Acid damage if it ends its turn in running water. - **Stake to the Heart**: The vampire is destroyed if a weapon that deals Piercing damage is driven into the vampire''s heart while the vampire has the Incapacitated condition. - **Sunlight**: The vampire takes 20 Radiant damage if it starts its turn in sunlight. While in sunlight, it has Disadvantage on attack rolls and ability checks.'
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The vampire makes two Claw attacks and uses Bite.
    multiattack:
      attacks:
        - name: Claw
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 8 (2d4 + 3) Slashing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from one of two claws.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d4
          bonus: 3
          type: Slashing
          average: 8
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 13
            restrictions:
              size: Medium or smaller
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from one of two claws.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: save
    text: '*Constitution Saving Throw*: DC 14, one creature within 5 feet that is willing or that has the Grappled, Incapacitated, or Restrained condition. *Failure:*  5 (1d4 + 3) Piercing damage plus 10 (3d6) Necrotic damage. The target''s Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount.'
    save:
      ability: con
      dc: 14
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          conditions:
            - willing
      onFail:
        effects:
          other: 5 (1d4 + 3) Piercing damage plus 10 (3d6) Necrotic damage. The target's Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount.
        damage:
          - dice: 1d4
            bonus: 3
            type: Piercing
            average: 5
          - dice: 3d6
            bonus: 0
            type: Necrotic
            average: 10
        legacyEffects: 5 (1d4 + 3) Piercing damage plus 10 (3d6) Necrotic damage. The target's Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Deathless Agility
    entryType: special
    text: The vampire takes the Dash or Disengage action.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Vampire Spawn
*Small, Undead, Neutral Evil*

**AC** 16
**HP** 90 (12d8 + 36)
**Initiative** +3 (13)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
**Languages** Common plus one other language
CR 5, PB +3, XP 1800

## Traits

**Spider Climb**
The vampire can climb difficult surfaces, including along ceilings, without needing to make an ability check.

**Vampire Weakness**
The vampire has these weaknesses: - **Forbiddance**: The vampire can't enter a residence without an invitation from an occupant. - **Running Water**: The vampire takes 20 Acid damage if it ends its turn in running water. - **Stake to the Heart**: The vampire is destroyed if a weapon that deals Piercing damage is driven into the vampire's heart while the vampire has the Incapacitated condition. - **Sunlight**: The vampire takes 20 Radiant damage if it starts its turn in sunlight. While in sunlight, it has Disadvantage on attack rolls and ability checks.

## Actions

**Multiattack**
The vampire makes two Claw attacks and uses Bite.

**Claw**
*Melee Attack Roll:* +6, reach 5 ft. 8 (2d4 + 3) Slashing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from one of two claws.

**Bite**
*Constitution Saving Throw*: DC 14, one creature within 5 feet that is willing or that has the Grappled, Incapacitated, or Restrained condition. *Failure:*  5 (1d4 + 3) Piercing damage plus 10 (3d6) Necrotic damage. The target's Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount.

## Bonus Actions

**Deathless Agility**
The vampire takes the Dash or Disengage action.
