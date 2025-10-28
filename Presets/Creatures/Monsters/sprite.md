---
smType: creature
name: Sprite
size: Small
type: Fey
alignmentLawChaos: Neutral
alignmentGoodEvil: Good
ac: '15'
initiative: +4 (14)
hp: '10'
hitDice: 4d4
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 40 ft.
abilities:
  - key: str
    score: 3
    saveProf: false
  - key: dex
    score: 18
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
  - skill: Stealth
    value: '8'
passivesList:
  - skill: Perception
    value: '13'
languagesList:
  - value: Common
  - value: Elvish
  - value: Sylvan
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Needle Sword
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 6 (1d4 + 4) Piercing damage.'
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
    name: Enchanting Bow
    entryType: attack
    text: '*Ranged Attack Roll:* +6, range 40/160 ft. 1 Piercing damage, and the target has the Charmed condition until the start of the sprite''s next turn.'
    attack:
      type: ranged
      bonus: 6
      damage: []
      range: 40/160 ft.
  - category: action
    name: Heart Sight
    entryType: save
    text: '*Charisma Saving Throw*: DC 10, one creature within 5 feet the sprite can see (Celestials, Fiends, and Undead automatically fail the save). *Failure:*  The sprite knows the target''s emotions and alignment.'
    save:
      ability: cha
      dc: 10
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          knowledge: the target's emotions and alignment
spellcastingEntries:
  - category: action
    name: Invisibility
    entryType: spellcasting
    text: The sprite casts *Invisibility* on itself, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** *Invisibility*
    spellcasting:
      ability: cha
      spellLists:
        - frequency: at-will
          spells:
            - Invisibility
---

# Sprite
*Small, Fey, Neutral Good*

**AC** 15
**HP** 10 (4d4)
**Initiative** +4 (14)
**Speed** 10 ft., fly 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common, Elvish, Sylvan
CR 1/4, PB +2, XP 50

## Actions

**Needle Sword**
*Melee Attack Roll:* +6, reach 5 ft. 6 (1d4 + 4) Piercing damage.

**Enchanting Bow**
*Ranged Attack Roll:* +6, range 40/160 ft. 1 Piercing damage, and the target has the Charmed condition until the start of the sprite's next turn.

**Heart Sight**
*Charisma Saving Throw*: DC 10, one creature within 5 feet the sprite can see (Celestials, Fiends, and Undead automatically fail the save). *Failure:*  The sprite knows the target's emotions and alignment.

**Invisibility**
The sprite casts *Invisibility* on itself, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** *Invisibility*
