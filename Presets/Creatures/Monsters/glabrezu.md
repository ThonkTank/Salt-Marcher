---
smType: creature
name: Glabrezu
size: Large
type: Fiend
typeTags:
  - value: Demon
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '17'
initiative: +6 (16)
hp: '189'
hitDice: 18d10 + 90
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 20
    saveProf: true
    saveMod: 9
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 21
    saveProf: true
    saveMod: 9
  - key: int
    score: 19
    saveProf: false
  - key: wis
    score: 17
    saveProf: true
    saveMod: 7
  - key: cha
    score: 16
    saveProf: true
    saveMod: 7
pb: '+4'
skills:
  - skill: Deception
    value: '7'
  - skill: Perception
    value: '7'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '17'
languagesList:
  - value: Abyssal
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Cold
  - value: Fire
  - value: Lightning
damageImmunitiesList:
  - value: Poison; Poisoned
cr: '9'
xp: '5000'
entries:
  - category: trait
    name: Demonic Restoration
    entryType: special
    text: If the glabrezu dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The glabrezu has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The glabrezu makes two Pincer attacks and uses Pummel or Spellcasting.
    multiattack:
      attacks:
        - name: Pincer
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Pincer
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 10 ft. 16 (2d10 + 5) Slashing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 15) from one of two pincers.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 2d10
          bonus: 5
          type: Slashing
          average: 16
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 15
            restrictions:
              size: Medium or smaller
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 15) from one of two pincers.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Pummel
    entryType: save
    text: '*Dexterity Saving Throw*: DC 17, one creature Grappled by the glabrezu. *Failure:*  15 (3d6 + 5) Bludgeoning damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 17
      targeting:
        type: single
        restrictions:
          other:
            - grappled by source
      onFail:
        effects:
          other: 15 (3d6 + 5) Bludgeoning damage.
        damage:
          - dice: 3d6
            bonus: 5
            type: Bludgeoning
            average: 15
        legacyEffects: 15 (3d6 + 5) Bludgeoning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The glabrezu casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 16): - **At Will:** *Darkness*, *Detect Magic*, *Dispel Magic* - **1e/Day Each:** *Confusion*, *Fly*, *Power Word Stun*'
    spellcasting:
      ability: int
      saveDC: 16
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Darkness
            - Detect Magic
            - Dispel Magic
        - frequency: 1/day
          spells:
            - Confusion
            - Fly
            - Power Word Stun
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Glabrezu
*Large, Fiend, Chaotic Evil*

**AC** 17
**HP** 189 (18d10 + 90)
**Initiative** +6 (16)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 17
**Languages** Abyssal, telepathy 120 ft.
CR 9, PB +4, XP 5000

## Traits

**Demonic Restoration**
If the glabrezu dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.

**Magic Resistance**
The glabrezu has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The glabrezu makes two Pincer attacks and uses Pummel or Spellcasting.

**Pincer**
*Melee Attack Roll:* +9, reach 10 ft. 16 (2d10 + 5) Slashing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 15) from one of two pincers.

**Pummel**
*Dexterity Saving Throw*: DC 17, one creature Grappled by the glabrezu. *Failure:*  15 (3d6 + 5) Bludgeoning damage. *Success:*  Half damage.

**Spellcasting**
The glabrezu casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 16): - **At Will:** *Darkness*, *Detect Magic*, *Dispel Magic* - **1e/Day Each:** *Confusion*, *Fly*, *Power Word Stun*
