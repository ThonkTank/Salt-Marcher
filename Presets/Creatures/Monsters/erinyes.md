---
smType: creature
name: Erinyes
size: Medium
type: Fiend
typeTags:
  - value: Devil
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '18'
initiative: +7 (17)
hp: '178'
hitDice: 21d8 + 84
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 16
    saveProf: true
    saveMod: 7
  - key: con
    score: 18
    saveProf: true
    saveMod: 8
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 18
    saveProf: true
    saveMod: 8
pb: '+4'
skills:
  - skill: Perception
    value: '6'
  - skill: Persuasion
    value: '8'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Infernal
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Cold
damageImmunitiesList:
  - value: Fire
  - value: Poison; Poisoned
cr: '12'
xp: '8400'
entries:
  - category: trait
    name: Diabolical Restoration
    entryType: special
    text: If the erinyes dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The erinyes has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Rope
    entryType: special
    text: The erinyes has a magic rope. While bearing it, the erinyes can use the Entangling Rope action. The rope has AC 20, HP 90, and Immunity to Poison and Psychic damage. The rope turns to dust if reduced to 0 Hit Points, if it is 5+ feet away from the erinyes for 1 hour or more, or if the erinyes dies. If the rope is damaged or destroyed, the erinyes can fully restore it when finishing a Short Rest|XPHB|Short or Long Rest.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The erinyes makes three Withering Sword attacks and can use Entangling Rope.
    multiattack:
      attacks:
        - name: Sword
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Withering Sword
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 5 ft. 13 (2d8 + 4) Slashing damage plus 11 (2d10) Necrotic damage.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 2d8
          bonus: 4
          type: Slashing
          average: 13
        - dice: 2d10
          bonus: 0
          type: Necrotic
          average: 11
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Entangling Rope (Requires Magic Rope)
    entryType: save
    text: '*Strength Saving Throw*: DC 16, one creature the erinyes can see within 120 feet. *Failure:*  14 (4d6) Force damage, and the target has the Restrained condition until the rope is destroyed, the erinyes uses a Bonus Action to release the target, or the erinyes uses Entangling Rope again.'
    save:
      ability: str
      dc: 16
      targeting:
        type: single
        range: 120 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Restrained
              duration:
                type: until
                trigger: the rope is destroyed
        damage:
          - dice: 4d6
            bonus: 0
            type: Force
            average: 14
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Erinyes
*Medium, Fiend, Lawful Evil*

**AC** 18
**HP** 178 (21d8 + 84)
**Initiative** +7 (17)
**Speed** 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 16
**Languages** Infernal, telepathy 120 ft.
CR 12, PB +4, XP 8400

## Traits

**Diabolical Restoration**
If the erinyes dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.

**Magic Resistance**
The erinyes has Advantage on saving throws against spells and other magical effects.

**Magic Rope**
The erinyes has a magic rope. While bearing it, the erinyes can use the Entangling Rope action. The rope has AC 20, HP 90, and Immunity to Poison and Psychic damage. The rope turns to dust if reduced to 0 Hit Points, if it is 5+ feet away from the erinyes for 1 hour or more, or if the erinyes dies. If the rope is damaged or destroyed, the erinyes can fully restore it when finishing a Short Rest|XPHB|Short or Long Rest.

## Actions

**Multiattack**
The erinyes makes three Withering Sword attacks and can use Entangling Rope.

**Withering Sword**
*Melee Attack Roll:* +8, reach 5 ft. 13 (2d8 + 4) Slashing damage plus 11 (2d10) Necrotic damage.

**Entangling Rope (Requires Magic Rope)**
*Strength Saving Throw*: DC 16, one creature the erinyes can see within 120 feet. *Failure:*  14 (4d6) Force damage, and the target has the Restrained condition until the rope is destroyed, the erinyes uses a Bonus Action to release the target, or the erinyes uses Entangling Rope again.
