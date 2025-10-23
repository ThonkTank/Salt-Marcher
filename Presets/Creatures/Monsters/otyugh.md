---
smType: creature
name: Otyugh
size: Large
type: Aberration
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: "14"
initiative: +0 (10)
hp: "104"
hitDice: 11d10 + 44
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 16
  - ability: dex
    score: 11
  - ability: con
    score: 19
  - ability: int
    score: 6
  - ability: wis
    score: 13
  - ability: cha
    score: 6
pb: "+3"
cr: "5"
xp: "1800"
sensesList:
  - type: darkvision
    range: "120"
languagesList:
  - value: Otyugh
  - value: telepathy 120 ft. (doesn't allow the receiving creature to respond telepathically)
passivesList:
  - skill: Perception
    value: "11"
entries:
  - category: action
    name: Multiattack
    text: The otyugh makes one Bite attack and two Tentacle attacks.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +6, reach 5 ft. 12 (2d8 + 3) Piercing damage, and the target has the Poisoned condition. Whenever the Poisoned target finishes a Long Rest, it is subjected to the following effect. *Constitution Saving Throw*: DC 15. *Failure:*  The target's Hit Point maximum decreases by 5 (1d10) and doesn't return to normal until the Poisoned condition ends on the target. *Success:*  The Poisoned condition ends."
  - category: action
    name: Tentacle
    text: "*Melee Attack Roll:* +6, reach 10 ft. 12 (2d8 + 3) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from one of two tentacles."
  - category: action
    name: Tentacle Slam
    text: "*Constitution Saving Throw*: DC 14, each creature Grappled by the otyugh. *Failure:*  16 (3d8 + 3) Bludgeoning damage, and the target has the Stunned condition until the start of the otyugh's next turn. *Success:*  Half damage only."

---

# Otyugh
*Large, Aberration, Neutral Neutral*

**AC** 14
**HP** 104 (11d10 + 44)
**Initiative** +0 (10)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 16 | 11 | 19 | 6 | 13 | 6 |

**Senses** darkvision 120 ft.; Passive Perception 11
**Languages** Otyugh, telepathy 120 ft. (doesn't allow the receiving creature to respond telepathically)
CR 5, PB +3, XP 1800

## Actions

**Multiattack**
The otyugh makes one Bite attack and two Tentacle attacks.

**Bite**
*Melee Attack Roll:* +6, reach 5 ft. 12 (2d8 + 3) Piercing damage, and the target has the Poisoned condition. Whenever the Poisoned target finishes a Long Rest, it is subjected to the following effect. *Constitution Saving Throw*: DC 15. *Failure:*  The target's Hit Point maximum decreases by 5 (1d10) and doesn't return to normal until the Poisoned condition ends on the target. *Success:*  The Poisoned condition ends.

**Tentacle**
*Melee Attack Roll:* +6, reach 10 ft. 12 (2d8 + 3) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from one of two tentacles.

**Tentacle Slam**
*Constitution Saving Throw*: DC 14, each creature Grappled by the otyugh. *Failure:*  16 (3d8 + 3) Bludgeoning damage, and the target has the Stunned condition until the start of the otyugh's next turn. *Success:*  Half damage only.
