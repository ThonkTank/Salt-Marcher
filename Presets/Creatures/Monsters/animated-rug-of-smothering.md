---
smType: creature
name: Animated Rug of Smothering
size: Large
type: Construct
alignmentOverride: Unaligned
ac: '12'
initiative: +4 (14)
hp: '27'
hitDice: 5d10
speeds:
  walk:
    distance: 10 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 3
    saveProf: false
  - key: cha
    score: 1
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '60'
passivesList:
  - skill: Perception
    value: '6'
damageImmunitiesList:
  - value: Poison
  - value: Psychic; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Deafened
  - value: Frightened
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
cr: '2'
xp: '450'
entries:
  - category: action
    name: Smother
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Bludgeoning damage. If the target is a Medium or smaller creature, the rug can give it the Grappled condition (escape DC 13) instead of dealing damage. Until the grapple ends, the target has the Blinded and Restrained conditions, is suffocating, and takes 10 (2d6 + 3) Bludgeoning damage at the start of each of its turns. The rug can smother only one creature at a time. While grappling the target, the rug can''t take this action, the rug halves the damage it takes (round down), and the target takes the same amount of damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Bludgeoning
          average: 10
        - dice: 2d6
          bonus: 3
          type: Bludgeoning
          average: 10
      reach: 5 ft.
      onHit:
        other: If the target is a Medium or smaller creature, the rug can give it the Grappled condition (escape DC 13) instead of dealing damage. Until the grapple ends, the target has the Blinded and Restrained conditions, is suffocating, and takes 10 (2d6 + 3) Bludgeoning damage at the start of each of its turns. The rug can smother only one creature at a time. While grappling the target, the rug can't take this action, the rug halves the damage it takes (round down), and the target takes the same amount of damage.
      additionalEffects: If the target is a Medium or smaller creature, the rug can give it the Grappled condition (escape DC 13) instead of dealing damage. Until the grapple ends, the target has the Blinded and Restrained conditions, is suffocating, and takes 10 (2d6 + 3) Bludgeoning damage at the start of each of its turns. The rug can smother only one creature at a time. While grappling the target, the rug can't take this action, the rug halves the damage it takes (round down), and the target takes the same amount of damage.
---

# Animated Rug of Smothering
*Large, Construct, Unaligned*

**AC** 12
**HP** 27 (5d10)
**Initiative** +4 (14)
**Speed** 10 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 6
CR 2, PB +2, XP 450

## Actions

**Smother**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Bludgeoning damage. If the target is a Medium or smaller creature, the rug can give it the Grappled condition (escape DC 13) instead of dealing damage. Until the grapple ends, the target has the Blinded and Restrained conditions, is suffocating, and takes 10 (2d6 + 3) Bludgeoning damage at the start of each of its turns. The rug can smother only one creature at a time. While grappling the target, the rug can't take this action, the rug halves the damage it takes (round down), and the target takes the same amount of damage.
