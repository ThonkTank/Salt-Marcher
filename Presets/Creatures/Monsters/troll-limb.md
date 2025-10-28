---
smType: creature
name: Troll Limb
size: Small
type: Giant
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '13'
initiative: +1 (11)
hp: '14'
hitDice: 4d6
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 9
    saveProf: false
  - key: cha
    score: 1
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Regeneration
    entryType: special
    text: The limb regains 5 Hit Points at the start of each of its turns. If the limb takes Acid or Fire damage, this trait doesn't function on the limb's next turn. The limb dies only if it starts its turn with 0 Hit Points and doesn't regenerate.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Troll Spawn
    entryType: special
    text: The limb uncannily has the same senses as a whole troll. If the limb isn't destroyed within 24 hours, roll 1d12. On a 12, the limb turns into a Troll. Otherwise, the limb withers away.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 9 (2d4 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d4
          bonus: 4
          type: Slashing
          average: 9
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Troll Limb
*Small, Giant, Chaotic Evil*

**AC** 13
**HP** 14 (4d6)
**Initiative** +1 (11)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 9
CR 1/2, PB +2, XP 100

## Traits

**Regeneration**
The limb regains 5 Hit Points at the start of each of its turns. If the limb takes Acid or Fire damage, this trait doesn't function on the limb's next turn. The limb dies only if it starts its turn with 0 Hit Points and doesn't regenerate.

**Troll Spawn**
The limb uncannily has the same senses as a whole troll. If the limb isn't destroyed within 24 hours, roll 1d12. On a 12, the limb turns into a Troll. Otherwise, the limb withers away.

## Actions

**Rend**
*Melee Attack Roll:* +6, reach 5 ft. 9 (2d4 + 4) Slashing damage.
