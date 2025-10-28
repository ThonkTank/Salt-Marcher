---
smType: creature
name: Rakshasa
size: Medium
type: Fiend
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '17'
initiative: +8 (18)
hp: '221'
hitDice: 26d8 + 104
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 13
    saveProf: false
  - key: wis
    score: 16
    saveProf: false
  - key: cha
    score: 20
    saveProf: false
pb: '+5'
skills:
  - skill: Deception
    value: '10'
  - skill: Insight
    value: '8'
  - skill: Perception
    value: '8'
sensesList:
  - type: truesight
    range: '60'
passivesList:
  - skill: Perception
    value: '18'
languagesList:
  - value: Common
  - value: Infernal
damageVulnerabilitiesList:
  - value: Piercing
conditionImmunitiesList:
  - value: Charmed
  - value: Frightened
cr: '13'
xp: '10000'
entries:
  - category: trait
    name: Greater Magic Resistance
    entryType: special
    text: The rakshasa automatically succeeds on saving throws against spells and other magical effects, and the attack rolls of spells automatically miss it. Without the rakshasa's permission, no spell can observe the rakshasa remotely or detect its thoughts, creature type, or alignment.
  - category: trait
    name: Fiendish Restoration
    entryType: special
    text: If the rakshasa dies outside the Nine Hells, its body turns to ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The rakshasa makes three Cursed Touch attacks.
    multiattack:
      attacks:
        - name: Touch
          count: 1
      substitutions: []
  - category: action
    name: Cursed Touch
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 5 ft. 12 (2d6 + 5) Slashing damage plus 19 (3d12) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target gains no benefit from finishing a Short Rest|XPHB|Short or Long Rest.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 2d6
          bonus: 5
          type: Slashing
          average: 12
        - dice: 3d12
          bonus: 0
          type: Necrotic
          average: 19
      reach: 5 ft.
      onHit:
        other: If the target is a creature, it is cursed. While cursed, the target gains no benefit from finishing a Short Rest|XPHB|Short or Long Rest.
      additionalEffects: If the target is a creature, it is cursed. While cursed, the target gains no benefit from finishing a Short Rest|XPHB|Short or Long Rest.
  - category: action
    name: Baleful Command (Recharge 5-6)
    entryType: save
    text: '*Wisdom Saving Throw*: DC 18, each enemy in a 30-foot Emanation originating from the rakshasa. *Failure:*  28 (8d6) Psychic damage, and the target has the Frightened and Incapacitated conditions until the start of the rakshasa''s next turn.'
    recharge: 5-6
    save:
      ability: wis
      dc: 18
      targeting:
        shape: emanation
        size: 30 ft.
        origin: self
      onFail:
        effects:
          other: 28 (8d6) Psychic damage, and the target has the Frightened and Incapacitated conditions until the start of the rakshasa's next turn.
        damage:
          - dice: 8d6
            bonus: 0
            type: Psychic
            average: 28
        legacyEffects: 28 (8d6) Psychic damage, and the target has the Frightened and Incapacitated conditions until the start of the rakshasa's next turn.
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The rakshasa casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Detect Thoughts*, *Disguise Self*, *Mage Hand*, *Minor Illusion* - **1e/Day Each:** *Fly*, *Invisibility*, *Major Image*, *Plane Shift*'
    spellcasting:
      ability: cha
      saveDC: 18
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Detect Thoughts
            - Disguise Self
            - Mage Hand
            - Minor Illusion
        - frequency: 1/day
          spells:
            - Fly
            - Invisibility
            - Major Image
            - Plane Shift
---

# Rakshasa
*Medium, Fiend, Lawful Evil*

**AC** 17
**HP** 221 (26d8 + 104)
**Initiative** +8 (18)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 60 ft.; Passive Perception 18
**Languages** Common, Infernal
CR 13, PB +5, XP 10000

## Traits

**Greater Magic Resistance**
The rakshasa automatically succeeds on saving throws against spells and other magical effects, and the attack rolls of spells automatically miss it. Without the rakshasa's permission, no spell can observe the rakshasa remotely or detect its thoughts, creature type, or alignment.

**Fiendish Restoration**
If the rakshasa dies outside the Nine Hells, its body turns to ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.

## Actions

**Multiattack**
The rakshasa makes three Cursed Touch attacks.

**Cursed Touch**
*Melee Attack Roll:* +10, reach 5 ft. 12 (2d6 + 5) Slashing damage plus 19 (3d12) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target gains no benefit from finishing a Short Rest|XPHB|Short or Long Rest.

**Baleful Command (Recharge 5-6)**
*Wisdom Saving Throw*: DC 18, each enemy in a 30-foot Emanation originating from the rakshasa. *Failure:*  28 (8d6) Psychic damage, and the target has the Frightened and Incapacitated conditions until the start of the rakshasa's next turn.

**Spellcasting**
The rakshasa casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Detect Thoughts*, *Disguise Self*, *Mage Hand*, *Minor Illusion* - **1e/Day Each:** *Fly*, *Invisibility*, *Major Image*, *Plane Shift*
