---
smType: creature
name: Dust Mephit
size: Small
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '12'
initiative: +2 (12)
hp: '17'
hitDice: 5d6
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 30 ft.
abilities:
  - key: str
    score: 5
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 9
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Primordial (Auran
  - value: Terran)
damageVulnerabilitiesList:
  - value: Fire
damageImmunitiesList:
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Death Burst
    entryType: save
    text: 'The mephit explodes when it dies. *Dexterity Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Bludgeoning damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 10
      targeting:
        shape: emanation
        size: 5 ft.
        origin: self
      onFail:
        effects:
          other: 5 (2d4) Bludgeoning damage.
        damage:
          - dice: 2d4
            bonus: 0
            type: Bludgeoning
            average: 5
        legacyEffects: 5 (2d4) Bludgeoning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Slashing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d4
          bonus: 2
          type: Slashing
          average: 4
      reach: 5 ft.
  - category: action
    name: Blinding Breath
    entryType: save
    text: '*Dexterity Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  The target has the Blinded condition until the end of the mephit''s next turn.'
    save:
      ability: dex
      dc: 10
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          conditions:
            - condition: Blinded
              duration:
                type: until
                trigger: the end of the mephit's next turn
spellcastingEntries:
  - category: action
    name: Sleep (1/Day)
    entryType: spellcasting
    text: The mephit casts the *Sleep* spell, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 10). - **At Will:** - **1/Day Each:** *Sleep*
    limitedUse:
      count: 1
      reset: day
    spellcasting:
      ability: cha
      saveDC: 10
      spellLists:
        - frequency: at-will
          spells:
            - '- 1/Day Each: Sleep'
        - frequency: 1/day
          spells:
            - Sleep
---

# Dust Mephit
*Small, Elemental, Neutral Evil*

**AC** 12
**HP** 17 (5d6)
**Initiative** +2 (12)
**Speed** 30 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 12
**Languages** Primordial (Auran, Terran)
CR 1/2, PB +2, XP 100

## Traits

**Death Burst**
The mephit explodes when it dies. *Dexterity Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Bludgeoning damage. *Success:*  Half damage.

## Actions

**Claw**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Slashing damage.

**Blinding Breath (Recharge 6)**
*Dexterity Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  The target has the Blinded condition until the end of the mephit's next turn.

**Sleep (1/Day)**
The mephit casts the *Sleep* spell, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 10). - **At Will:** - **1/Day Each:** *Sleep*
