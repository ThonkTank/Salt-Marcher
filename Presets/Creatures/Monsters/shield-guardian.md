---
smType: creature
name: Shield Guardian
size: Large
type: Construct
alignmentOverride: Unaligned
ac: '17'
initiative: '-1 (9)'
hp: '142'
hitDice: 15d10 + 60
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+3'
sensesList:
  - type: blindsight
    range: '10'
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Understands commands given in any language but can't speak
damageImmunitiesList:
  - value: Poison; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Frightened
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
cr: '7'
xp: '2900'
entries:
  - category: trait
    name: Bound
    entryType: special
    text: The guardian is magically bound to an amulet. While the guardian and its amulet are on the same plane of existence, the amulet's wearer can telepathically call the guardian to travel to it, and the guardian knows the distance and direction to the amulet. If the guardian is within 60 feet of the amulet's wearer, half of any damage the wearer takes (round up) is transferred to the guardian.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Regeneration
    entryType: special
    text: The guardian regains 10 Hit Points at the start of each of its turns if it has at least 1 Hit Point.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The guardian makes two Fist attacks.
    multiattack:
      attacks:
        - name: Fist
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Fist
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Bludgeoning damage plus 7 (2d6) Force damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d6
          bonus: 4
          type: Bludgeoning
          average: 11
        - dice: 2d6
          bonus: 0
          type: Force
          average: 7
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: trait
    name: Spell Storing
    entryType: spellcasting
    text: A spellcaster who wears the guardian's amulet can cause the guardian to store one spell of level 4 or lower. To do so, the wearer must cast the spell on the guardian while within 5 feet of it. The spell has no effect but is stored within the guardian. Any previously stored spell is lost when a new spell is stored. The guardian can cast the spell stored with any parameters set by the original caster, requiring no spell components and using the caster's spellcasting ability. The stored spell is then lost.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: passive
    trigger.targeting:
      type: single
---

# Shield Guardian
*Large, Construct, Unaligned*

**AC** 17
**HP** 142 (15d10 + 60)
**Initiative** -1 (9)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 10
**Languages** Understands commands given in any language but can't speak
CR 7, PB +3, XP 2900

## Traits

**Bound**
The guardian is magically bound to an amulet. While the guardian and its amulet are on the same plane of existence, the amulet's wearer can telepathically call the guardian to travel to it, and the guardian knows the distance and direction to the amulet. If the guardian is within 60 feet of the amulet's wearer, half of any damage the wearer takes (round up) is transferred to the guardian.

**Regeneration**
The guardian regains 10 Hit Points at the start of each of its turns if it has at least 1 Hit Point.

**Spell Storing**
A spellcaster who wears the guardian's amulet can cause the guardian to store one spell of level 4 or lower. To do so, the wearer must cast the spell on the guardian while within 5 feet of it. The spell has no effect but is stored within the guardian. Any previously stored spell is lost when a new spell is stored. The guardian can cast the spell stored with any parameters set by the original caster, requiring no spell components and using the caster's spellcasting ability. The stored spell is then lost.

## Actions

**Multiattack**
The guardian makes two Fist attacks.

**Fist**
*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Bludgeoning damage plus 7 (2d6) Force damage.
