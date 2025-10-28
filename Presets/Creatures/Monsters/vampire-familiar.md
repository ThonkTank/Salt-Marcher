---
smType: creature
name: Vampire Familiar
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '15'
initiative: +5 (15)
hp: '65'
hitDice: 10d8 + 20
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 16
    saveProf: true
    saveMod: 5
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 10
    saveProf: true
    saveMod: 2
  - key: cha
    score: 14
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Persuasion
    value: '4'
  - skill: Stealth
    value: '7'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Common plus one other language
damageResistancesList:
  - value: Necrotic
damageImmunitiesList:
  - value: Charmed ((except from its vampire master))
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Vampiric Connection
    entryType: special
    text: While the familiar and its vampire master are on the same plane of existence, the vampire can communicate with the familiar telepathically, and the vampire can perceive through the familiar's senses.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The familiar makes two Umbral Dagger attacks.
    multiattack:
      attacks:
        - name: Dagger
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Umbral Dagger
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +5, reach 5 ft. or range 20/60 ft. 5 (1d4 + 3) Piercing damage plus 7 (3d4) Necrotic damage. If the target is reduced to 0 Hit Points by this attack, the target becomes Stable but has the Poisoned condition for 1 hour. While it has the Poisoned condition, the target has the Paralyzed condition.'
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Deathless Agility
    entryType: special
    text: The familiar takes the Dash or Disengage action.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Vampire Familiar
*Small, Humanoid, Neutral Evil*

**AC** 15
**HP** 65 (10d8 + 20)
**Initiative** +5 (15)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Common plus one other language
CR 3, PB +2, XP 700

## Traits

**Vampiric Connection**
While the familiar and its vampire master are on the same plane of existence, the vampire can communicate with the familiar telepathically, and the vampire can perceive through the familiar's senses.

## Actions

**Multiattack**
The familiar makes two Umbral Dagger attacks.

**Umbral Dagger**
*Melee or Ranged Attack Roll:* +5, reach 5 ft. or range 20/60 ft. 5 (1d4 + 3) Piercing damage plus 7 (3d4) Necrotic damage. If the target is reduced to 0 Hit Points by this attack, the target becomes Stable but has the Poisoned condition for 1 hour. While it has the Poisoned condition, the target has the Paralyzed condition.

## Bonus Actions

**Deathless Agility**
The familiar takes the Dash or Disengage action.
