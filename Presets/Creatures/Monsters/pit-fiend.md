---
smType: creature
name: Pit Fiend
size: Large
type: Fiend
typeTags:
  - value: Devil
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '21'
initiative: +14 (24)
hp: '337'
hitDice: 27d10 + 189
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 26
    saveProf: false
  - key: dex
    score: 14
    saveProf: true
    saveMod: 8
  - key: con
    score: 24
    saveProf: false
  - key: int
    score: 22
    saveProf: false
  - key: wis
    score: 18
    saveProf: true
    saveMod: 10
  - key: cha
    score: 24
    saveProf: false
pb: '+6'
skills:
  - skill: Perception
    value: '10'
  - skill: Persuasion
    value: '19'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '20'
languagesList:
  - value: Infernal
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Cold
damageImmunitiesList:
  - value: Fire
  - value: Poison; Poisoned
cr: '20'
xp: '25000'
entries:
  - category: trait
    name: Diabolical Restoration
    entryType: special
    text: If the pit fiend dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.
  - category: trait
    name: Fear Aura
    entryType: save
    text: 'The pit fiend emanates an aura in a 20-foot Emanation while it doesn''t have the Incapacitated condition. *Wisdom Saving Throw*: DC 21, any enemy that starts its turn in the aura. *Failure:*  The target has the Frightened condition until the start of its next turn. *Success:*  The target is immune to this pit fiend''s aura for 24 hours.'
    save:
      ability: wis
      dc: 21
      targeting:
        type: special
      onFail:
        effects:
          conditions:
            - condition: Frightened
              duration:
                type: until
                trigger: the start of its next turn
      onSuccess: The target is immune to this pit fiend's aura for 24 hours.
  - category: trait
    name: Legendary Resistance (4/Day)
    entryType: special
    text: If the pit fiend fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 4
      reset: day
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The pit fiend has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The pit fiend makes one Bite attack, two Devilish Claw attacks, and one Fiery Mace attack.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Claw
          count: 1
        - name: Mace
          count: 1
      substitutions: []
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 10 ft. 18 (3d6 + 8) Piercing damage. If the target is a creature, it must make the following saving throw. *Constitution Saving Throw*: DC 21. *Failure:*  The target has the Poisoned condition. While Poisoned, the target can''t regain Hit Points and takes 21 (6d6) Poison damage at the start of each of its turns, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 3d6
          bonus: 8
          type: Piercing
          average: 18
        - dice: 6d6
          bonus: 0
          type: Poison
          average: 21
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Poisoned
            saveToEnd:
              timing: end-of-turn
      additionalEffects: 'If the target is a creature, it must make the following saving throw. *Constitution Saving Throw*: DC 21. *Failure:*  The target has the Poisoned condition. While Poisoned, the target can''t regain Hit Points and takes 21 (6d6) Poison damage at the start of each of its turns, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
  - category: action
    name: Devilish Claw
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 10 ft. 26 (4d8 + 8) Necrotic damage.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 4d8
          bonus: 8
          type: Necrotic
          average: 26
      reach: 10 ft.
  - category: action
    name: Fiery Mace
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 10 ft. 22 (4d6 + 8) Force damage plus 21 (6d6) Fire damage.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 4d6
          bonus: 8
          type: Force
          average: 22
        - dice: 6d6
          bonus: 0
          type: Fire
          average: 21
      reach: 10 ft.
spellcastingEntries:
  - category: action
    name: Hellfire Spellcasting (Recharge 4-6)
    entryType: spellcasting
    text: The pit fiend casts *Fireball* (level 5 version) twice, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21). It can replace one *Fireball* with *Hold Monster* (level 7 version) or *Wall of Fire*. - **At Will:**
    recharge: 4-6
    spellcasting:
      ability: cha
      saveDC: 21
      excludeComponents:
        - M
      spellLists: []
---

# Pit Fiend
*Large, Fiend, Lawful Evil*

**AC** 21
**HP** 337 (27d10 + 189)
**Initiative** +14 (24)
**Speed** 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 20
**Languages** Infernal, telepathy 120 ft.
CR 20, PB +6, XP 25000

## Traits

**Diabolical Restoration**
If the pit fiend dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.

**Fear Aura**
The pit fiend emanates an aura in a 20-foot Emanation while it doesn't have the Incapacitated condition. *Wisdom Saving Throw*: DC 21, any enemy that starts its turn in the aura. *Failure:*  The target has the Frightened condition until the start of its next turn. *Success:*  The target is immune to this pit fiend's aura for 24 hours.

**Legendary Resistance (4/Day)**
If the pit fiend fails a saving throw, it can choose to succeed instead.

**Magic Resistance**
The pit fiend has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The pit fiend makes one Bite attack, two Devilish Claw attacks, and one Fiery Mace attack.

**Bite**
*Melee Attack Roll:* +14, reach 10 ft. 18 (3d6 + 8) Piercing damage. If the target is a creature, it must make the following saving throw. *Constitution Saving Throw*: DC 21. *Failure:*  The target has the Poisoned condition. While Poisoned, the target can't regain Hit Points and takes 21 (6d6) Poison damage at the start of each of its turns, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.

**Devilish Claw**
*Melee Attack Roll:* +14, reach 10 ft. 26 (4d8 + 8) Necrotic damage.

**Fiery Mace**
*Melee Attack Roll:* +14, reach 10 ft. 22 (4d6 + 8) Force damage plus 21 (6d6) Fire damage.

**Hellfire Spellcasting (Recharge 4-6)**
The pit fiend casts *Fireball* (level 5 version) twice, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21). It can replace one *Fireball* with *Hold Monster* (level 7 version) or *Wall of Fire*. - **At Will:**
