---
smType: creature
name: Roc
size: Gargantuan
type: Monstrosity
alignmentOverride: Unaligned
ac: "15"
initiative: +8 (18)
hp: "248"
hitDice: 16d20 + 80
speeds:
  - type: walk
    value: "20"
  - type: fly
    value: "120"
abilities:
  - ability: str
    score: 28
  - ability: dex
    score: 10
  - ability: con
    score: 20
  - ability: int
    score: 3
  - ability: wis
    score: 10
  - ability: cha
    score: 9
pb: "+4"
cr: "11"
xp: "7200"
passivesList:
  - skill: Perception
    value: "18"
entries:
  - category: action
    name: Multiattack
    text: The roc makes two Beak attacks. It can replace one attack with a Talons attack.
  - category: action
    name: Beak
    text: "*Melee Attack Roll:* +13, reach 10 ft. 28 (3d12 + 9) Piercing damage."
  - category: action
    name: Talons
    text: "*Melee Attack Roll:* +13, reach 5 ft. 23 (4d6 + 9) Slashing damage. If the target is a Huge or smaller creature, it has the Grappled condition (escape DC 19) from both talons, and it has the Restrained condition until the grapple ends."
  - category: bonus
    name: Swoop (Recharge 5-6)
    text: If the roc has a creature Grappled, the roc flies up to half its Fly Speed without provoking Opportunity Attacks and drops that creature.

---

# Roc
*Gargantuan, Monstrosity, Unaligned*

**AC** 15
**HP** 248 (16d20 + 80)
**Initiative** +8 (18)
**Speed** 20 ft., fly 120 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 28 | 10 | 20 | 3 | 10 | 9 |

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
