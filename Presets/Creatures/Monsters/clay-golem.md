---
smType: creature
name: Clay Golem
size: Large
type: Construct
alignmentOverride: Unaligned
ac: "14"
initiative: +3 (13)
hp: "123"
hitDice: 13d10 + 52
speeds:
  - type: walk
    value: "20"
abilities:
  - ability: str
    score: 20
  - ability: dex
    score: 9
  - ability: con
    score: 18
  - ability: int
    score: 3
  - ability: wis
    score: 8
  - ability: cha
    score: 1
pb: "+4"
cr: "9"
xp: "5000"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Common plus one other language
passivesList:
  - skill: Perception
    value: "9"
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Acid
  - value: Poison
  - value: Psychic
  - value: Charmed
  - value: Exhaustion
  - value: Frightened
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
entries:
  - category: trait
    name: Acid Absorption
    text: Whenever the golem is subjected to Acid damage, it takes no damage and instead regains a number of Hit Points equal to the Acid damage dealt.
  - category: trait
    name: Berserk
    text: Whenever the golem starts its turn Bloodied, roll 1d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object. Once the golem goes berserk, it continues to be berserk until it is destroyed or it is no longer Bloodied.
  - category: trait
    name: Immutable Form
    text: The golem can't shape-shift.
  - category: trait
    name: Magic Resistance
    text: The golem has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    text: The golem makes two Slam attacks, or it makes three Slam attacks if it used Hasten this turn.
  - category: action
    name: Slam
    text: "*Melee Attack Roll:* +9, reach 5 ft. 10 (1d10 + 5) Bludgeoning damage plus 6 (1d12) Acid damage, and the target's Hit Point maximum decreases by an amount equal to the Acid damage taken."
  - category: bonus
    name: Hasten (Recharge 5-6)
    text: The golem takes the Dash and Disengage actions.

---

# Clay Golem
*Large, Construct, Unaligned*

**AC** 14
**HP** 123 (13d10 + 52)
**Initiative** +3 (13)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 20 | 9 | 18 | 3 | 8 | 1 |

**Senses** darkvision 60 ft.; Passive Perception 9
**Languages** Common plus one other language
CR 9, PB +4, XP 5000

## Traits

**Acid Absorption**
Whenever the golem is subjected to Acid damage, it takes no damage and instead regains a number of Hit Points equal to the Acid damage dealt.

**Berserk**
Whenever the golem starts its turn Bloodied, roll 1d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object. Once the golem goes berserk, it continues to be berserk until it is destroyed or it is no longer Bloodied.

**Immutable Form**
The golem can't shape-shift.

**Magic Resistance**
The golem has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The golem makes two Slam attacks, or it makes three Slam attacks if it used Hasten this turn.

**Slam**
*Melee Attack Roll:* +9, reach 5 ft. 10 (1d10 + 5) Bludgeoning damage plus 6 (1d12) Acid damage, and the target's Hit Point maximum decreases by an amount equal to the Acid damage taken.

## Bonus Actions

**Hasten (Recharge 5-6)**
The golem takes the Dash and Disengage actions.
