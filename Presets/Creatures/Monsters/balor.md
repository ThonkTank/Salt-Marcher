---
smType: creature
name: Balor
size: Huge
type: Fiend
typeTags:
  - value: Demon
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '19'
initiative: +14 (24)
hp: '287'
hitDice: 23d12 + 138
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 26
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 22
    saveProf: true
    saveMod: 12
  - key: int
    score: 20
    saveProf: false
  - key: wis
    score: 16
    saveProf: true
    saveMod: 9
  - key: cha
    score: 22
    saveProf: false
pb: '+6'
skills:
  - skill: Perception
    value: '9'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '19'
languagesList:
  - value: Abyssal
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Cold
  - value: Lightning
damageImmunitiesList:
  - value: Fire
  - value: Poison; Charmed
conditionImmunitiesList:
  - value: Frightened
  - value: Poisoned
cr: '19'
xp: '22000'
entries:
  - category: trait
    name: Death Throes
    entryType: save
    text: 'The balor explodes when it dies. *Dexterity Saving Throw*: DC 20, each creature in a 30-foot Emanation originating from the balor. *Failure:*  31 (9d6) Fire damage plus 31 (9d6) Force damage. *Success:*  Half damage. *Failure or Success*:  If the balor dies outside the Abyss, it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.'
    save:
      ability: dex
      dc: 20
      targeting:
        shape: emanation
        size: 30 ft.
        origin: self
      onFail:
        effects:
          other: 31 (9d6) Fire damage plus 31 (9d6) Force damage.
        damage:
          - dice: 9d6
            bonus: 0
            type: Fire
            average: 31
          - dice: 9d6
            bonus: 0
            type: Force
            average: 31
        legacyEffects: 31 (9d6) Fire damage plus 31 (9d6) Force damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: trait
    name: Fire Aura
    entryType: special
    text: At the end of each of the balor's turns, each creature in a 5-foot Emanation originating from the balor takes 13 (3d8) Fire damage.
  - category: trait
    name: Legendary Resistance (3/Day)
    entryType: special
    text: If the balor fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The balor has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The balor makes one Flame Whip attack and one Lightning Blade attack.
    multiattack:
      attacks:
        - name: Whip
          count: 1
        - name: Blade
          count: 1
      substitutions: []
  - category: action
    name: Flame Whip
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 30 ft. 18 (3d6 + 8) Force damage plus 17 (5d6) Fire damage. If the target is a Huge or smaller creature, the balor pulls the target up to 25 feet straight toward itself, and the target has the Prone condition.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 3d6
          bonus: 8
          type: Force
          average: 18
        - dice: 5d6
          bonus: 0
          type: Fire
          average: 17
      reach: 30 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Huge or smaller
      additionalEffects: If the target is a Huge or smaller creature, the balor pulls the target up to 25 feet straight toward itself, and the target has the Prone condition.
  - category: action
    name: Lightning Blade
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 10 ft. 21 (3d8 + 8) Force damage plus 22 (4d10) Lightning damage, and the target can''t take Reactions until the start of the balor''s next turn.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 3d8
          bonus: 8
          type: Force
          average: 21
        - dice: 4d10
          bonus: 0
          type: Lightning
          average: 22
      reach: 10 ft.
  - category: bonus
    name: Teleport
    entryType: special
    text: The balor teleports itself or a willing demon within 10 feet of itself up to 60 feet to an unoccupied space the balor can see.
---

# Balor
*Huge, Fiend, Chaotic Evil*

**AC** 19
**HP** 287 (23d12 + 138)
**Initiative** +14 (24)
**Speed** 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 19
**Languages** Abyssal, telepathy 120 ft.
CR 19, PB +6, XP 22000

## Traits

**Death Throes**
The balor explodes when it dies. *Dexterity Saving Throw*: DC 20, each creature in a 30-foot Emanation originating from the balor. *Failure:*  31 (9d6) Fire damage plus 31 (9d6) Force damage. *Success:*  Half damage. *Failure or Success*:  If the balor dies outside the Abyss, it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.

**Fire Aura**
At the end of each of the balor's turns, each creature in a 5-foot Emanation originating from the balor takes 13 (3d8) Fire damage.

**Legendary Resistance (3/Day)**
If the balor fails a saving throw, it can choose to succeed instead.

**Magic Resistance**
The balor has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The balor makes one Flame Whip attack and one Lightning Blade attack.

**Flame Whip**
*Melee Attack Roll:* +14, reach 30 ft. 18 (3d6 + 8) Force damage plus 17 (5d6) Fire damage. If the target is a Huge or smaller creature, the balor pulls the target up to 25 feet straight toward itself, and the target has the Prone condition.

**Lightning Blade**
*Melee Attack Roll:* +14, reach 10 ft. 21 (3d8 + 8) Force damage plus 22 (4d10) Lightning damage, and the target can't take Reactions until the start of the balor's next turn.

## Bonus Actions

**Teleport**
The balor teleports itself or a willing demon within 10 feet of itself up to 60 feet to an unoccupied space the balor can see.
