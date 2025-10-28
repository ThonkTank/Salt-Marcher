---
smType: creature
name: Troll
size: Large
type: Giant
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '15'
initiative: +1 (11)
hp: '94'
hitDice: 9d10 + 45
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 20
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 9
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Giant
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Loathsome Limbs (4/Day)
    entryType: special
    text: If the troll ends any turn Bloodied and took 15+ Slashing damage during that turn, one of the troll's limbs is severed, falls into the troll's space, and becomes a Troll Limb. The limb acts immediately after the troll's turn. The troll has 1 Exhaustion level for each missing limb, and it grows replacement limbs the next time it regains Hit Points.
    limitedUse:
      count: 4
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Regeneration
    entryType: special
    text: The troll regains 15 Hit Points at the start of each of its turns. If the troll takes Acid or Fire damage, this trait doesn't function on the troll's next turn. The troll dies only if it starts its turn with 0 Hit Points and doesn't regenerate.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The troll makes three Rend attacks.
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
    text: '*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d6
          bonus: 4
          type: Slashing
          average: 11
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Charge
    entryType: special
    text: The troll moves up to half its Speed straight toward an enemy it can see.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Troll
*Large, Giant, Chaotic Evil*

**AC** 15
**HP** 94 (9d10 + 45)
**Initiative** +1 (11)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
**Languages** Giant
CR 5, PB +3, XP 1800

## Traits

**Loathsome Limbs (4/Day)**
If the troll ends any turn Bloodied and took 15+ Slashing damage during that turn, one of the troll's limbs is severed, falls into the troll's space, and becomes a Troll Limb. The limb acts immediately after the troll's turn. The troll has 1 Exhaustion level for each missing limb, and it grows replacement limbs the next time it regains Hit Points.

**Regeneration**
The troll regains 15 Hit Points at the start of each of its turns. If the troll takes Acid or Fire damage, this trait doesn't function on the troll's next turn. The troll dies only if it starts its turn with 0 Hit Points and doesn't regenerate.

## Actions

**Multiattack**
The troll makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Slashing damage.

## Bonus Actions

**Charge**
The troll moves up to half its Speed straight toward an enemy it can see.
