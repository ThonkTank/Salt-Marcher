---
smType: creature
name: Ice Devil
size: Large
type: Fiend
typeTags:
  - value: Devil
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '18'
initiative: +7 (17)
hp: '228'
hitDice: 24d10 + 96
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 21
    saveProf: false
  - key: dex
    score: 14
    saveProf: true
    saveMod: 7
  - key: con
    score: 18
    saveProf: true
    saveMod: 9
  - key: int
    score: 18
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 7
  - key: cha
    score: 18
    saveProf: true
    saveMod: 9
pb: '+5'
skills:
  - skill: Insight
    value: '7'
  - skill: Perception
    value: '7'
  - skill: Persuasion
    value: '9'
sensesList:
  - type: blindsight
    range: '120'
passivesList:
  - skill: Perception
    value: '17'
languagesList:
  - value: Infernal
  - value: telepathy 120 ft.
damageImmunitiesList:
  - value: Cold
  - value: Fire
  - value: Poison; Poisoned
cr: '14'
xp: '11500'
entries:
  - category: trait
    name: Diabolical Restoration
    entryType: special
    text: If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The devil has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The devil makes three Ice Spear attacks. It can replace one attack with a Tail attack.
    multiattack:
      attacks:
        - name: Spear
          count: 1
      substitutions:
        - replace: attack
          with:
            type: attack
            name: a Tail attack
  - category: action
    name: Ice Spear
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +10, reach 5 ft. or range 30/120 ft. 14 (2d8 + 5) Piercing damage plus 10 (3d6) Cold damage. Until the end of its next turn, the target can''t take a Bonus Action or Reaction, its Speed decreases by 10 feet, and it can move or take one action on its turn, not both. HitomThe spear magically returns to the devil''s hand immediately after a ranged attack.'
  - category: action
    name: Tail
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 10 ft. 15 (3d6 + 5) Bludgeoning damage plus 18 (4d8) Cold damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 3d6
          bonus: 5
          type: Bludgeoning
          average: 15
        - dice: 4d8
          bonus: 0
          type: Cold
          average: 18
      reach: 10 ft.
spellcastingEntries:
  - category: action
    name: Ice Wall
    entryType: spellcasting
    text: The devil casts *Wall of Ice* (level 8 version), requiring no spell components and using Intelligence as the spellcasting ability (spell save DC 17). - **At Will:**
    spellcasting:
      ability: int
      saveDC: 17
      spellLists: []
---

# Ice Devil
*Large, Fiend, Lawful Evil*

**AC** 18
**HP** 228 (24d10 + 96)
**Initiative** +7 (17)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 120 ft.; Passive Perception 17
**Languages** Infernal, telepathy 120 ft.
CR 14, PB +5, XP 11500

## Traits

**Diabolical Restoration**
If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.

**Magic Resistance**
The devil has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The devil makes three Ice Spear attacks. It can replace one attack with a Tail attack.

**Ice Spear**
*Melee or Ranged Attack Roll:* +10, reach 5 ft. or range 30/120 ft. 14 (2d8 + 5) Piercing damage plus 10 (3d6) Cold damage. Until the end of its next turn, the target can't take a Bonus Action or Reaction, its Speed decreases by 10 feet, and it can move or take one action on its turn, not both. HitomThe spear magically returns to the devil's hand immediately after a ranged attack.

**Tail**
*Melee Attack Roll:* +10, reach 10 ft. 15 (3d6 + 5) Bludgeoning damage plus 18 (4d8) Cold damage.

**Ice Wall (Recharge 6)**
The devil casts *Wall of Ice* (level 8 version), requiring no spell components and using Intelligence as the spellcasting ability (spell save DC 17). - **At Will:**
