---
smType: creature
name: Green Hag
size: Medium
type: Fey
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '17'
initiative: +1 (11)
hp: '82'
hitDice: 11d8 + 33
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 13
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 14
    saveProf: false
pb: '+2'
skills:
  - skill: Arcana
    value: '5'
  - skill: Deception
    value: '4'
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Common
  - value: Elvish
  - value: Sylvan
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The hag can breathe air and water.
  - category: trait
    name: Mimicry
    entryType: special
    text: The hag can mimic animal sounds and humanoid voices. A creature that hears the sounds can tell they are imitations only with a successful DC 14 Wisdom (Insight) check.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The hag makes two Claw attacks.
    multiattack:
      attacks:
        - name: Claw
          count: 2
      substitutions: []
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 8 (1d8 + 4) Slashing damage plus 3 (1d6) Poison damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d8
          bonus: 4
          type: Slashing
          average: 8
        - dice: 1d6
          bonus: 0
          type: Poison
          average: 3
      reach: 5 ft.
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The hag casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 12, +4 to hit with spell attacks): - **At Will:** *Dancing Lights*, *Disguise Self*, *Invisibility*, *Minor Illusion*, *Ray of Sickness*'
    spellcasting:
      ability: wis
      saveDC: 12
      attackBonus: 4
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Dancing Lights
            - Disguise Self
            - Invisibility
            - Minor Illusion
            - Ray of Sickness
---

# Green Hag
*Medium, Fey, Neutral Evil*

**AC** 17
**HP** 82 (11d8 + 33)
**Initiative** +1 (11)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Common, Elvish, Sylvan
CR 3, PB +2, XP 700

## Traits

**Amphibious**
The hag can breathe air and water.

**Mimicry**
The hag can mimic animal sounds and humanoid voices. A creature that hears the sounds can tell they are imitations only with a successful DC 14 Wisdom (Insight) check.

## Actions

**Multiattack**
The hag makes two Claw attacks.

**Claw**
*Melee Attack Roll:* +6, reach 5 ft. 8 (1d8 + 4) Slashing damage plus 3 (1d6) Poison damage.

**Spellcasting**
The hag casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 12, +4 to hit with spell attacks): - **At Will:** *Dancing Lights*, *Disguise Self*, *Invisibility*, *Minor Illusion*, *Ray of Sickness*
