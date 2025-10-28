---
smType: creature
name: Chain Devil
size: Medium
type: Fiend
typeTags:
  - value: Devil
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '15'
initiative: +5 (15)
hp: '85'
hitDice: 10d8 + 40
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 18
    saveProf: true
    saveMod: 7
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 4
  - key: cha
    score: 14
    saveProf: false
pb: '+3'
sensesList:
  - type: darkvision 120 ft. (unimpeded by magical darkness)
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Infernal
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Bludgeoning
  - value: Cold
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Fire
  - value: Poison; Poisoned
cr: '8'
xp: '3900'
entries:
  - category: trait
    name: Diabolical Restoration
    entryType: special
    text: If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The devil has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The devil makes two Chain attacks and uses Conjure Infernal Chain.
    multiattack:
      attacks:
        - name: Chain
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Chain
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Slashing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two chains, and it has the Restrained condition until the grapple ends.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d6
          bonus: 4
          type: Slashing
          average: 11
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 14
            restrictions:
              size: Large or smaller
            duration:
              type: until
              trigger: the grapple ends
          - condition: Restrained
            escape:
              type: dc
              dc: 14
            restrictions:
              size: Large or smaller
            duration:
              type: until
              trigger: the grapple ends
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two chains, and it has the Restrained condition until the grapple ends.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Conjure Infernal Chain
    entryType: save
    text: 'The devil conjures a fiery chain to bind a creature. *Dexterity Saving Throw*: DC 15, one creature the devil can see within 60 feet. *Failure:*  9 (2d4 + 4) Fire damage, and the target has the Restrained condition until the end of the devil''s next turn, at which point the chain disappears. If the target is Large or smaller, the devil moves the target up to 30 feet straight toward itself. *Success:*  The chain disappears.'
    save:
      ability: dex
      dc: 15
      targeting:
        type: single
        range: 60 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Restrained
              restrictions:
                size: Large or smaller
              duration:
                type: until
                trigger: the end of the devil's next turn
        damage:
          - dice: 2d4
            bonus: 4
            type: Fire
            average: 9
      onSuccess: The chain disappears.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Chain Devil
*Medium, Fiend, Lawful Evil*

**AC** 15
**HP** 85 (10d8 + 40)
**Initiative** +5 (15)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft. (unimpeded by magical darkness); Passive Perception 11
**Languages** Infernal, telepathy 120 ft.
CR 8, PB +3, XP 3900

## Traits

**Diabolical Restoration**
If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.

**Magic Resistance**
The devil has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The devil makes two Chain attacks and uses Conjure Infernal Chain.

**Chain**
*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Slashing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two chains, and it has the Restrained condition until the grapple ends.

**Conjure Infernal Chain**
The devil conjures a fiery chain to bind a creature. *Dexterity Saving Throw*: DC 15, one creature the devil can see within 60 feet. *Failure:*  9 (2d4 + 4) Fire damage, and the target has the Restrained condition until the end of the devil's next turn, at which point the chain disappears. If the target is Large or smaller, the devil moves the target up to 30 feet straight toward itself. *Success:*  The chain disappears.
