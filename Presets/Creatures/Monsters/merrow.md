---
smType: creature
name: Merrow
size: Large
type: Monstrosity
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '13'
initiative: +2 (12)
hp: '45'
hitDice: 6d10 + 12
speeds:
  walk:
    distance: 10 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 8
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 9
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Abyssal
  - value: Primordial (Aquan)
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The merrow can breathe air and water.
  - category: action
    name: Multiattack
    entryType: special
    text: The merrow makes two attacks, using Bite, Claw, or Harpoon in any combination.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 6 (1d4 + 4) Piercing damage, and the target has the Poisoned condition until the end of the merrow''s next turn.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d4
          bonus: 4
          type: Piercing
          average: 6
      reach: 5 ft.
  - category: action
    name: Claw
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
  - category: action
    name: Harpoon
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +6, reach 5 ft. or range 20/60 ft. 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature, the merrow pulls the target up to 15 feet straight toward itself.'
---

# Merrow
*Large, Monstrosity, Chaotic Evil*

**AC** 13
**HP** 45 (6d10 + 12)
**Initiative** +2 (12)
**Speed** 10 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Abyssal, Primordial (Aquan)
CR 2, PB +2, XP 450

## Traits

**Amphibious**
The merrow can breathe air and water.

## Actions

**Multiattack**
The merrow makes two attacks, using Bite, Claw, or Harpoon in any combination.

**Bite**
*Melee Attack Roll:* +6, reach 5 ft. 6 (1d4 + 4) Piercing damage, and the target has the Poisoned condition until the end of the merrow's next turn.

**Claw**
*Melee Attack Roll:* +6, reach 5 ft. 9 (2d4 + 4) Slashing damage.

**Harpoon**
*Melee or Ranged Attack Roll:* +6, reach 5 ft. or range 20/60 ft. 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature, the merrow pulls the target up to 15 feet straight toward itself.
