---
smType: creature
name: Tarrasque
size: Gargantuan
type: Monstrosity
alignmentOverride: Unaligned
ac: "25"
initiative: +18 (28)
hp: "697"
hitDice: 34d20 + 340
speeds:
  - type: walk
    value: "60"
  - type: burrow
    value: "40"
  - type: climb
    value: "60"
abilities:
  - ability: str
    score: 30
  - ability: dex
    score: 11
  - ability: con
    score: 30
  - ability: int
    score: 3
  - ability: wis
    score: 11
  - ability: cha
    score: 11
pb: "+9"
cr: "30"
xp: "155000"
sensesList:
  - type: blindsight
    range: "120"
passivesList:
  - skill: Perception
    value: "19"
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Fire
  - value: Poison
  - value: Charmed
  - value: Deafened
  - value: Frightened
  - value: Paralyzed
  - value: Poisoned
entries:
  - category: trait
    name: Legendary Resistance (6/Day)
    text: If the tarrasque fails a saving throw, it can choose to succeed instead.
  - category: trait
    name: Magic Resistance
    text: The tarrasque has Advantage on saving throws against spells and other magical effects.
  - category: trait
    name: Reflective Carapace
    text: If the tarrasque is targeted by a *Magic Missile* spell or a spell that requires a ranged attack roll, roll 1d6. On a 1-5, the tarrasque is unaffected. On a 6, the tarrasque is unaffected and reflects the spell, turning the caster into the target.
  - category: trait
    name: Siege Monster
    text: The tarrasque deals double damage to objects and structures.
  - category: action
    name: Multiattack
    text: The tarrasque makes one Bite attack and three other attacks, using Claw or Tail in any combination.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +19, reach 15 ft. 36 (4d12 + 10) Piercing damage, and the target has the Grappled condition (escape DC 20). Until the grapple ends, the target has the Restrained condition and can't teleport."
  - category: action
    name: Claw
    text: "*Melee Attack Roll:* +19, reach 15 ft. 28 (4d8 + 10) Slashing damage."
  - category: action
    name: Tail
    text: "*Melee Attack Roll:* +19, reach 30 ft. 23 (3d8 + 10) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition."
  - category: action
    name: Thunderous Bellow (Recharge 5-6)
    text: "*Constitution Saving Throw*: DC 27, each creature and each object that isn't being worn or carried in a 150-foot Cone. *Failure:*  78 (12d12) Thunder damage, and the target has the Deafened and Frightened conditions until the end of its next turn. *Success:*  Half damage only."
  - category: bonus
    name: Swallow
    text: "*Strength Saving Throw*: DC 27, one Large or smaller creature Grappled by the tarrasque (it can have up to six creatures swallowed at a time). *Failure:*  The target is swallowed, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions and can't teleport, it has Cover|XPHB|Total Cover against attacks and other effects outside the tarrasque, and it takes 56 (16d6) Acid damage at the start of each of the tarrasque's turns. If the tarrasque takes 60 damage or more on a single turn from a creature inside it, the tarrasque must succeed on a DC 20 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 10 feet of the tarrasque and has the Prone condition. If the tarrasque dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 20 feet of movement, exiting Prone."
  - category: legendary
    name: Onslaught
    text: The tarrasque moves up to half its Speed, and it makes one Claw or Tail attack.
  - category: legendary
    name: World-Shaking Movement
    text: The tarrasque moves up to its Speed. At the end of this movement, the tarrasque creates an instantaneous shock wave in a 60-foot Emanation originating from itself. Creatures in that area lose  Concentration and, if Medium or smaller, have the Prone condition. The tarrasque can't take this action again until the start of its next turn.

---

# Tarrasque
*Gargantuan, Monstrosity, Unaligned*

**AC** 25
**HP** 697 (34d20 + 340)
**Initiative** +18 (28)
**Speed** 60 ft., climb 60 ft., burrow 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 30 | 11 | 30 | 3 | 11 | 11 |

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
