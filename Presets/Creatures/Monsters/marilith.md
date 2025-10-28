---
smType: creature
name: Marilith
size: Large
type: Fiend
typeTags:
  - value: Demon
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '16'
initiative: +10 (20)
hp: '220'
hitDice: 21d10 + 105
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
abilities:
  - key: str
    score: 18
    saveProf: true
    saveMod: 9
  - key: dex
    score: 20
    saveProf: false
  - key: con
    score: 20
    saveProf: true
    saveMod: 10
  - key: int
    score: 18
    saveProf: false
  - key: wis
    score: 16
    saveProf: true
    saveMod: 8
  - key: cha
    score: 20
    saveProf: true
    saveMod: 10
pb: '+5'
skills:
  - skill: Perception
    value: '8'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '18'
languagesList:
  - value: Abyssal
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Cold
  - value: Fire
  - value: Lightning
damageImmunitiesList:
  - value: Poison; Poisoned
cr: '16'
xp: '15000'
entries:
  - category: trait
    name: Demonic Restoration
    entryType: special
    text: If the marilith dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The marilith has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Reactive
    entryType: special
    text: The marilith can take one Reaction on every turn of combat.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The marilith makes six Pact Blade attacks and uses Constrict.
    multiattack:
      attacks:
        - name: Blade
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Pact Blade
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 5 ft. 10 (1d10 + 5) Slashing damage plus 7 (2d6) Necrotic damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 1d10
          bonus: 5
          type: Slashing
          average: 10
        - dice: 2d6
          bonus: 0
          type: Necrotic
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Constrict
    entryType: save
    text: '*Strength Saving Throw*: DC 17, one Medium or smaller creature the marilith can see within 5 feet. *Failure:*  15 (2d10 + 4) Bludgeoning damage. The target has the Grappled condition (escape DC 14), and it has the Restrained condition until the grapple ends.'
    save:
      ability: str
      dc: 17
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          size:
            - Medium
            - smaller
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Grappled
              escape:
                type: dc
                dc: 14
              duration:
                type: until
                trigger: the grapple ends
            - condition: Restrained
              escape:
                type: dc
                dc: 14
              duration:
                type: until
                trigger: the grapple ends
        damage:
          - dice: 2d10
            bonus: 4
            type: Bludgeoning
            average: 15
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Teleport (Recharge 5-6)
    entryType: special
    text: The marilith teleports up to 120 feet to an unoccupied space it can see.
    recharge: 5-6
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Marilith
*Large, Fiend, Chaotic Evil*

**AC** 16
**HP** 220 (21d10 + 105)
**Initiative** +10 (20)
**Speed** 40 ft., climb 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 18
**Languages** Abyssal, telepathy 120 ft.
CR 16, PB +5, XP 15000

## Traits

**Demonic Restoration**
If the marilith dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.

**Magic Resistance**
The marilith has Advantage on saving throws against spells and other magical effects.

**Reactive**
The marilith can take one Reaction on every turn of combat.

## Actions

**Multiattack**
The marilith makes six Pact Blade attacks and uses Constrict.

**Pact Blade**
*Melee Attack Roll:* +10, reach 5 ft. 10 (1d10 + 5) Slashing damage plus 7 (2d6) Necrotic damage.

**Constrict**
*Strength Saving Throw*: DC 17, one Medium or smaller creature the marilith can see within 5 feet. *Failure:*  15 (2d10 + 4) Bludgeoning damage. The target has the Grappled condition (escape DC 14), and it has the Restrained condition until the grapple ends.

## Bonus Actions

**Teleport (Recharge 5-6)**
The marilith teleports up to 120 feet to an unoccupied space it can see.
