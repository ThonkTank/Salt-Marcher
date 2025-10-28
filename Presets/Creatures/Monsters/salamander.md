---
smType: creature
name: Salamander
size: Large
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '15'
initiative: +2 (12)
hp: '90'
hitDice: 12d10 + 24
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 12
    saveProf: false
pb: '+3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Primordial (Ignan)
damageVulnerabilitiesList:
  - value: Cold
damageImmunitiesList:
  - value: Fire
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Fire Aura
    entryType: special
    text: At the end of each of the salamander's turns, each creature of the salamander's choice in a 5-foot Emanation originating from the salamander takes 7 (2d6) Fire damage.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The salamander makes two Flame Spear attacks. It can replace one attack with a use of Constrict.
    multiattack:
      attacks:
        - name: Spear
          count: 1
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Constrict
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Flame Spear
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +7, reach 5 ft. or range 20/60 ft. 13 (2d8 + 4) Piercing damage plus 7 (2d6) Fire damage. HitomThe spear magically returns to the salamander''s hand immediately after a ranged attack.'
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Constrict
    entryType: save
    text: '*Strength Saving Throw*: DC 15, one Large or smaller creature the salamander can see within 10 feet. *Failure:*  11 (2d6 + 4) Bludgeoning damage plus 7 (2d6) Fire damage. The target has the Grappled condition (escape DC 14), and it has the Restrained condition until the grapple ends.'
    save:
      ability: str
      dc: 15
      targeting:
        type: single
        range: 10 ft.
        restrictions:
          size:
            - Large
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
          - dice: 2d6
            bonus: 4
            type: Bludgeoning
            average: 11
          - dice: 2d6
            bonus: 0
            type: Fire
            average: 7
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Salamander
*Large, Elemental, Neutral Evil*

**AC** 15
**HP** 90 (12d10 + 24)
**Initiative** +2 (12)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Primordial (Ignan)
CR 5, PB +3, XP 1800

## Traits

**Fire Aura**
At the end of each of the salamander's turns, each creature of the salamander's choice in a 5-foot Emanation originating from the salamander takes 7 (2d6) Fire damage.

## Actions

**Multiattack**
The salamander makes two Flame Spear attacks. It can replace one attack with a use of Constrict.

**Flame Spear**
*Melee or Ranged Attack Roll:* +7, reach 5 ft. or range 20/60 ft. 13 (2d8 + 4) Piercing damage plus 7 (2d6) Fire damage. HitomThe spear magically returns to the salamander's hand immediately after a ranged attack.

**Constrict**
*Strength Saving Throw*: DC 15, one Large or smaller creature the salamander can see within 10 feet. *Failure:*  11 (2d6 + 4) Bludgeoning damage plus 7 (2d6) Fire damage. The target has the Grappled condition (escape DC 14), and it has the Restrained condition until the grapple ends.
