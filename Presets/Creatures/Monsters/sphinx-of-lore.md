---
smType: creature
name: Sphinx of Lore
size: Large
type: Celestial
alignmentLawChaos: Lawful
alignmentGoodEvil: Neutral
ac: '17'
initiative: +6 (16)
hp: '170'
hitDice: 20d10 + 60
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 18
    saveProf: false
  - key: wis
    score: 18
    saveProf: false
  - key: cha
    score: 18
    saveProf: false
pb: '+4'
skills:
  - skill: Arcana
    value: '12'
  - skill: History
    value: '12'
  - skill: Perception
    value: '8'
  - skill: Religion
    value: '12'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '18'
languagesList:
  - value: Celestial
  - value: Common
damageResistancesList:
  - value: Necrotic
  - value: Radiant
damageImmunitiesList:
  - value: Psychic; Charmed
conditionImmunitiesList:
  - value: Frightened
cr: '11'
xp: '7200'
entries:
  - category: trait
    name: Inscrutable
    entryType: special
    text: No magic can observe the sphinx remotely or detect its thoughts without its permission. Wisdom (Insight) checks made to ascertain its intentions or sincerity are made with Disadvantage.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    entryType: special
    text: If the sphinx fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The sphinx makes three Claw attacks.
    multiattack:
      attacks:
        - name: Claw
          count: 3
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 5 ft. 14 (3d6 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 3d6
          bonus: 4
          type: Slashing
          average: 14
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Mind-Rending Roar (Recharge 5-6)
    entryType: save
    text: '*Wisdom Saving Throw*: DC 16, each enemy in a 300-foot Emanation originating from the sphinx. *Failure:*  35 (10d6) Psychic damage, and the target has the Incapacitated condition until the start of the sphinx''s next turn.'
    recharge: 5-6
    save:
      ability: wis
      dc: 16
      targeting:
        shape: emanation
        size: 300 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Incapacitated
              duration:
                type: until
                trigger: the start of the sphinx's next turn
        damage:
          - dice: 10d6
            bonus: 0
            type: Psychic
            average: 35
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Arcane Prowl
    entryType: multiattack
    text: The sphinx can teleport up to 30 feet to an unoccupied space it can see, and it makes one Claw attack.
    multiattack:
      attacks:
        - name: Claw
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: self
  - category: legendary
    name: Weight of Years
    entryType: save
    text: '*Constitution Saving Throw*: DC 16, one creature the sphinx can see within 120 feet. *Failure:*  The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older. *Failure or Success*:  The sphinx can''t take this action again until the start of its next turn.'
    save:
      ability: con
      dc: 16
      targeting:
        type: single
        range: 120 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          other: The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older.
        legacyEffects: The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older.
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The sphinx casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 16): - **At Will:** *Detect Magic*, *Identify*, *Mage Hand*, *Minor Illusion*, *Prestidigitation* - **1e/Day Each:** *Dispel Magic*, *Legend Lore*, *Locate Object*, *Plane Shift*, *Remove Curse*, *Tongues*'
    spellcasting:
      ability: int
      saveDC: 16
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Identify
            - Mage Hand
            - Minor Illusion
            - Prestidigitation
        - frequency: 1/day
          spells:
            - Dispel Magic
            - Legend Lore
            - Locate Object
            - Plane Shift
            - Remove Curse
            - Tongues
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Sphinx of Lore
*Large, Celestial, Lawful Neutral*

**AC** 17
**HP** 170 (20d10 + 60)
**Initiative** +6 (16)
**Speed** 40 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 18
**Languages** Celestial, Common
CR 11, PB +4, XP 7200

## Traits

**Inscrutable**
No magic can observe the sphinx remotely or detect its thoughts without its permission. Wisdom (Insight) checks made to ascertain its intentions or sincerity are made with Disadvantage.

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the sphinx fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The sphinx makes three Claw attacks.

**Claw**
*Melee Attack Roll:* +8, reach 5 ft. 14 (3d6 + 4) Slashing damage.

**Mind-Rending Roar (Recharge 5-6)**
*Wisdom Saving Throw*: DC 16, each enemy in a 300-foot Emanation originating from the sphinx. *Failure:*  35 (10d6) Psychic damage, and the target has the Incapacitated condition until the start of the sphinx's next turn.

**Spellcasting**
The sphinx casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 16): - **At Will:** *Detect Magic*, *Identify*, *Mage Hand*, *Minor Illusion*, *Prestidigitation* - **1e/Day Each:** *Dispel Magic*, *Legend Lore*, *Locate Object*, *Plane Shift*, *Remove Curse*, *Tongues*

## Legendary Actions

**Arcane Prowl**
The sphinx can teleport up to 30 feet to an unoccupied space it can see, and it makes one Claw attack.

**Weight of Years**
*Constitution Saving Throw*: DC 16, one creature the sphinx can see within 120 feet. *Failure:*  The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older. *Failure or Success*:  The sphinx can't take this action again until the start of its next turn.
