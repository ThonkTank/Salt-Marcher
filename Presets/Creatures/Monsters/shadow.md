---
smType: creature
name: Shadow
size: Medium
type: Undead
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '12'
initiative: +2 (12)
hp: '27'
hitDice: 5d8 + 5
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 6
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '6'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
damageVulnerabilitiesList:
  - value: Radiant
damageResistancesList:
  - value: Acid
  - value: Cold
  - value: Fire
  - value: Lightning
  - value: Thunder
damageImmunitiesList:
  - value: Necrotic
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Frightened
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Prone
  - value: Restrained
  - value: Unconscious
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Amorphous
    entryType: special
    text: The shadow can move through a space as narrow as 1 inch without expending extra movement to do so.
  - category: trait
    name: Sunlight Weakness
    entryType: special
    text: While in sunlight, the shadow has Disadvantage on D20 Test.
  - category: action
    name: Draining Swipe
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Necrotic damage, and the target''s Strength score decreases by 1d4. The target dies if this reduces that score to 0. If a Humanoid is slain by this attack, a Shadow rises from the corpse 1d4 hours later.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Necrotic
          average: 5
      reach: 5 ft.
  - category: bonus
    name: Shadow Stealth
    entryType: special
    text: While in Dim Light or darkness, the shadow takes the Hide action.
---

# Shadow
*Medium, Undead, Chaotic Evil*

**AC** 12
**HP** 27 (5d8 + 5)
**Initiative** +2 (12)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
CR 1/2, PB +2, XP 100

## Traits

**Amorphous**
The shadow can move through a space as narrow as 1 inch without expending extra movement to do so.

**Sunlight Weakness**
While in sunlight, the shadow has Disadvantage on D20 Test.

## Actions

**Draining Swipe**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Necrotic damage, and the target's Strength score decreases by 1d4. The target dies if this reduces that score to 0. If a Humanoid is slain by this attack, a Shadow rises from the corpse 1d4 hours later.

## Bonus Actions

**Shadow Stealth**
While in Dim Light or darkness, the shadow takes the Hide action.
