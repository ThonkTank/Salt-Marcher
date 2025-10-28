---
smType: creature
name: Assassin
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '16'
initiative: +10 (20)
hp: '97'
hitDice: 15d8 + 30
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 11
    saveProf: false
  - key: dex
    score: 18
    saveProf: true
    saveMod: 7
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 16
    saveProf: true
    saveMod: 6
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+3'
skills:
  - skill: Acrobatics
    value: '7'
  - skill: Perception
    value: '6'
  - skill: Stealth
    value: '10'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Common
  - value: Thieves' cant
damageResistancesList:
  - value: Poison
cr: '8'
xp: '3900'
entries:
  - category: trait
    name: Evasion
    entryType: special
    text: If the assassin is subjected to an effect that allows it to make a Dexterity saving throw to take only half damage, the assassin instead takes no damage if it succeeds on the save and only half damage if it fails. It can't use this trait if it has the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: special
    text: The assassin makes three attacks, using Shortsword or Light Crossbow in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Shortsword
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 7 (1d6 + 4) Piercing damage plus 17 (5d6) Poison damage, and the target has the Poisoned condition until the start of the assassin''s next turn.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d6
          bonus: 4
          type: Piercing
          average: 7
        - dice: 5d6
          bonus: 0
          type: Poison
          average: 17
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Light Crossbow
    entryType: attack
    text: '*Ranged Attack Roll:* +7, range 80/320 ft. 8 (1d8 + 4) Piercing damage plus 21 (6d6) Poison damage.'
    attack:
      type: ranged
      bonus: 7
      damage:
        - dice: 1d8
          bonus: 4
          type: Piercing
          average: 8
        - dice: 6d6
          bonus: 0
          type: Poison
          average: 21
      range: 80/320 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Cunning Action
    entryType: special
    text: The assassin takes the Dash, Disengage, or Hide action.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Assassin
*Small, Humanoid, Neutral Neutral*

**AC** 16
**HP** 97 (15d8 + 30)
**Initiative** +10 (20)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common, Thieves' cant
CR 8, PB +3, XP 3900

## Traits

**Evasion**
If the assassin is subjected to an effect that allows it to make a Dexterity saving throw to take only half damage, the assassin instead takes no damage if it succeeds on the save and only half damage if it fails. It can't use this trait if it has the Incapacitated condition.

## Actions

**Multiattack**
The assassin makes three attacks, using Shortsword or Light Crossbow in any combination.

**Shortsword**
*Melee Attack Roll:* +7, reach 5 ft. 7 (1d6 + 4) Piercing damage plus 17 (5d6) Poison damage, and the target has the Poisoned condition until the start of the assassin's next turn.

**Light Crossbow**
*Ranged Attack Roll:* +7, range 80/320 ft. 8 (1d8 + 4) Piercing damage plus 21 (6d6) Poison damage.

## Bonus Actions

**Cunning Action**
The assassin takes the Dash, Disengage, or Hide action.
