---
smType: creature
name: Sea Hag
size: Medium
type: Fey
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '14'
initiative: +1 (11)
hp: '52'
hitDice: 7d8 + 21
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 13
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Common
  - value: Giant
  - value: Primordial (Aquan)
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The hag can breathe air and water.
  - category: trait
    name: Vile Appearance
    entryType: save
    text: '*Wisdom Saving Throw*: DC 11, any Beast or Humanoid that starts its turn within 30 feet of the hag and can see the hag''s true form. *Failure:*  The target has the Frightened condition until the start of its next turn. *Success:*  The target is immune to this hag''s Vile Appearance for 24 hours.'
    save:
      ability: wis
      dc: 11
      targeting:
        type: special
      onFail:
        effects:
          conditions:
            - condition: Frightened
              duration:
                type: until
                trigger: the start of its next turn
      onSuccess: The target is immune to this hag's Vile Appearance for 24 hours.
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Slashing
          average: 10
      reach: 5 ft.
  - category: action
    name: Death Glare (Recharge 5-6)
    entryType: save
    text: '*Wisdom Saving Throw*: DC 11, one Frightened creature the hag can see within 30 feet. *Failure:*  If the target has 20 Hit Points or fewer, it drops to 0 Hit Points. Otherwise, the target takes 13 (3d8) Psychic damage.'
    recharge: 5-6
    save:
      ability: wis
      dc: 11
      targeting:
        type: single
        range: 30 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          other: If the target has 20 Hit Points or fewer, it drops to 0 Hit Points. Otherwise, the target takes 13 (3d8) Psychic damage.
        damage:
          - dice: 3d8
            bonus: 0
            type: Psychic
            average: 13
        legacyEffects: If the target has 20 Hit Points or fewer, it drops to 0 Hit Points. Otherwise, the target takes 13 (3d8) Psychic damage.
spellcastingEntries:
  - category: action
    name: Illusory Appearance
    entryType: spellcasting
    text: The hag casts *Disguise Self*, using Constitution as the spellcasting ability (spell save DC 13). The spell's duration is 24 hours. - **At Will:** *Disguise Self*
    spellcasting:
      ability: int
      saveDC: 13
      spellLists:
        - frequency: at-will
          spells:
            - Disguise Self
---

# Sea Hag
*Medium, Fey, Chaotic Evil*

**AC** 14
**HP** 52 (7d8 + 21)
**Initiative** +1 (11)
**Speed** 30 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 11
**Languages** Common, Giant, Primordial (Aquan)
CR 2, PB +2, XP 450

## Traits

**Amphibious**
The hag can breathe air and water.

**Vile Appearance**
*Wisdom Saving Throw*: DC 11, any Beast or Humanoid that starts its turn within 30 feet of the hag and can see the hag's true form. *Failure:*  The target has the Frightened condition until the start of its next turn. *Success:*  The target is immune to this hag's Vile Appearance for 24 hours.

## Actions

**Claw**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage.

**Death Glare (Recharge 5-6)**
*Wisdom Saving Throw*: DC 11, one Frightened creature the hag can see within 30 feet. *Failure:*  If the target has 20 Hit Points or fewer, it drops to 0 Hit Points. Otherwise, the target takes 13 (3d8) Psychic damage.

**Illusory Appearance**
The hag casts *Disguise Self*, using Constitution as the spellcasting ability (spell save DC 13). The spell's duration is 24 hours. - **At Will:** *Disguise Self*
