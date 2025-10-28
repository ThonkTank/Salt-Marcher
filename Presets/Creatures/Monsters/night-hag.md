---
smType: creature
name: Night Hag
size: Medium
type: Fiend
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '17'
initiative: +5 (15)
hp: '112'
hitDice: 15d8 + 45
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
    score: 16
    saveProf: false
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 16
    saveProf: false
pb: '+3'
skills:
  - skill: Deception
    value: '6'
  - skill: Insight
    value: '5'
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Abyssal
  - value: Common
  - value: Infernal
  - value: Primordial
damageResistancesList:
  - value: Cold
  - value: Fire
conditionImmunitiesList:
  - value: Charmed
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The hag has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Soul Bag
    entryType: special
    text: The hag has a soul bag. While holding or carrying the bag, the hag can use its Nightmare Haunting action. The bag has AC 15, HP 20, and Resistance to all damage. The bag turns to dust if reduced to 0 Hit Points. If the bag is destroyed, any souls the bag is holding are released. The hag can create a new bag after 7 days.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The hag makes two Claw attacks.
    multiattack:
      attacks:
        - name: Claw
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 4
          type: Slashing
          average: 13
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Shape-Shift
    entryType: special
    text: The hag shape-shifts into a Small or Medium Humanoid, or it returns to its true form. Other than its size, its game statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed.
    trigger.activation: bonus
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The hag casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 14): - **At Will:** *Detect Magic*, *Etherealness*, *Magic Missile* - **2e/Day Each:** *Phantasmal Killer*, *Plane Shift*'
    spellcasting:
      ability: int
      saveDC: 14
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Etherealness
            - Magic Missile
        - frequency: 2/day
          spells:
            - Phantasmal Killer
            - Plane Shift
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Nightmare Haunting (1/Day; Requires Soul Bag)
    entryType: spellcasting
    text: While on the Ethereal Plane, the hag casts *Dream*, using the same spellcasting ability as Spellcasting. Only the hag can serve as the spell's messenger, and the target must be a creature the hag can see on the Material Plane. The spell fails and is wasted if the target is under the effect of the *Protection from Evil and Good* spell or within a *Magic Circle* spell. If the target takes damage from the *Dream* spell, the target's Hit Point maximum decreases by an amount equal to that damage. If the spell kills the target, its soul is trapped in the hag's soul bag, and the target can't be raised from the dead until its soul is released. - **At Will:** - **1/Day Each:** *Dream*, *Protection from Evil and Good*, *Magic Circle*
    limitedUse:
      count: 1
      reset: day
    spellcasting:
      ability: int
      spellLists:
        - frequency: at-will
          spells:
            - '- 1/Day Each: Dream'
            - Protection from Evil and Good
            - Magic Circle
        - frequency: 1/day
          spells:
            - Dream
            - Protection from Evil and Good
            - Magic Circle
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Night Hag
*Medium, Fiend, Neutral Evil*

**AC** 17
**HP** 112 (15d8 + 45)
**Initiative** +5 (15)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 15
**Languages** Abyssal, Common, Infernal, Primordial
CR 5, PB +3, XP 1800

## Traits

**Magic Resistance**
The hag has Advantage on saving throws against spells and other magical effects.

**Soul Bag**
The hag has a soul bag. While holding or carrying the bag, the hag can use its Nightmare Haunting action. The bag has AC 15, HP 20, and Resistance to all damage. The bag turns to dust if reduced to 0 Hit Points. If the bag is destroyed, any souls the bag is holding are released. The hag can create a new bag after 7 days.

## Actions

**Multiattack**
The hag makes two Claw attacks.

**Claw**
*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Slashing damage.

**Spellcasting**
The hag casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 14): - **At Will:** *Detect Magic*, *Etherealness*, *Magic Missile* - **2e/Day Each:** *Phantasmal Killer*, *Plane Shift*

**Nightmare Haunting (1/Day; Requires Soul Bag)**
While on the Ethereal Plane, the hag casts *Dream*, using the same spellcasting ability as Spellcasting. Only the hag can serve as the spell's messenger, and the target must be a creature the hag can see on the Material Plane. The spell fails and is wasted if the target is under the effect of the *Protection from Evil and Good* spell or within a *Magic Circle* spell. If the target takes damage from the *Dream* spell, the target's Hit Point maximum decreases by an amount equal to that damage. If the spell kills the target, its soul is trapped in the hag's soul bag, and the target can't be raised from the dead until its soul is released. - **At Will:** - **1/Day Each:** *Dream*, *Protection from Evil and Good*, *Magic Circle*

## Bonus Actions

**Shape-Shift**
The hag shape-shifts into a Small or Medium Humanoid, or it returns to its true form. Other than its size, its game statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed.
