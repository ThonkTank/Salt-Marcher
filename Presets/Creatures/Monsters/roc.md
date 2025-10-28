---
smType: creature
name: Roc
size: Gargantuan
type: Monstrosity
alignmentOverride: Unaligned
ac: '15'
initiative: +8 (18)
hp: '248'
hitDice: 16d20 + 80
speeds:
  walk:
    distance: 20 ft.
  fly:
    distance: 120 ft.
abilities:
  - key: str
    score: 28
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 4
  - key: con
    score: 20
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 10
    saveProf: true
    saveMod: 4
  - key: cha
    score: 9
    saveProf: false
pb: '+4'
skills:
  - skill: Perception
    value: '8'
passivesList:
  - skill: Perception
    value: '18'
cr: '11'
xp: '7200'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The roc makes two Beak attacks. It can replace one attack with a Talons attack.
    multiattack:
      attacks:
        - name: Beak
          count: 2
      substitutions:
        - replace: attack
          with:
            type: attack
            name: a Talons attack
  - category: action
    name: Beak
    entryType: attack
    text: '*Melee Attack Roll:* +13, reach 10 ft. 28 (3d12 + 9) Piercing damage.'
    attack:
      type: melee
      bonus: 13
      damage:
        - dice: 3d12
          bonus: 9
          type: Piercing
          average: 28
      reach: 10 ft.
  - category: action
    name: Talons
    entryType: attack
    text: '*Melee Attack Roll:* +13, reach 5 ft. 23 (4d6 + 9) Slashing damage. If the target is a Huge or smaller creature, it has the Grappled condition (escape DC 19) from both talons, and it has the Restrained condition until the grapple ends.'
    attack:
      type: melee
      bonus: 13
      damage:
        - dice: 4d6
          bonus: 9
          type: Slashing
          average: 23
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 19
            restrictions:
              size: Huge or smaller
            duration:
              type: until
              trigger: the grapple ends
          - condition: Restrained
            escape:
              type: dc
              dc: 19
            restrictions:
              size: Huge or smaller
            duration:
              type: until
              trigger: the grapple ends
      additionalEffects: If the target is a Huge or smaller creature, it has the Grappled condition (escape DC 19) from both talons, and it has the Restrained condition until the grapple ends.
  - category: bonus
    name: Swoop (Recharge 5-6)
    entryType: special
    text: If the roc has a creature Grappled, the roc flies up to half its Fly Speed without provoking Opportunity Attacks and drops that creature.
    recharge: 5-6
---

# Roc
*Gargantuan, Monstrosity, Unaligned*

**AC** 15
**HP** 248 (16d20 + 80)
**Initiative** +8 (18)
**Speed** 20 ft., fly 120 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 11, PB +4, XP 7200

## Actions

**Multiattack**
The roc makes two Beak attacks. It can replace one attack with a Talons attack.

**Beak**
*Melee Attack Roll:* +13, reach 10 ft. 28 (3d12 + 9) Piercing damage.

**Talons**
*Melee Attack Roll:* +13, reach 5 ft. 23 (4d6 + 9) Slashing damage. If the target is a Huge or smaller creature, it has the Grappled condition (escape DC 19) from both talons, and it has the Restrained condition until the grapple ends.

## Bonus Actions

**Swoop (Recharge 5-6)**
If the roc has a creature Grappled, the roc flies up to half its Fly Speed without provoking Opportunity Attacks and drops that creature.
