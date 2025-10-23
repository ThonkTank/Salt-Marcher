---
smType: creature
name: Mummy
size: Small
type: Undead
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: "11"
initiative: "-1 (9)"
hp: "58"
hitDice: 9d8 + 18
speeds:
  - type: walk
    value: "20"
abilities:
  - ability: str
    score: 16
  - ability: dex
    score: 8
  - ability: con
    score: 15
  - ability: int
    score: 6
  - ability: wis
    score: 12
  - ability: cha
    score: 12
pb: "+2"
cr: "3"
xp: "700"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Common plus two other languages
passivesList:
  - skill: Perception
    value: "11"
damageVulnerabilitiesList:
  - value: Fire
damageImmunitiesList:
  - value: Necrotic
  - value: Poison
  - value: Charmed
  - value: Exhaustion
  - value: Frightened
  - value: Paralyzed
  - value: Poisoned
entries:
  - category: action
    name: Multiattack
    text: The mummy makes two Rotting Fist attacks and uses Dreadful Glare.
  - category: action
    name: Rotting Fist
    text: "*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, its Hit Point maximum doesn't return to normal when finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack."
  - category: action
    name: Dreadful Glare
    text: "*Wisdom Saving Throw*: DC 11, one creature the mummy can see within 60 feet. *Failure:*  The target has the Frightened condition until the end of the mummy's next turn. *Success:*  The target is immune to this mummy's Dreadful Glare for 24 hours."

---

# Mummy
*Small, Undead, Lawful Evil*

**AC** 11
**HP** 58 (9d8 + 18)
**Initiative** -1 (9)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 16 | 8 | 15 | 6 | 12 | 12 |

**Senses** darkvision 60 ft.; Passive Perception 11
**Languages** Common plus two other languages
CR 3, PB +2, XP 700

## Actions

**Multiattack**
The mummy makes two Rotting Fist attacks and uses Dreadful Glare.

**Rotting Fist**
*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, its Hit Point maximum doesn't return to normal when finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.

**Dreadful Glare**
*Wisdom Saving Throw*: DC 11, one creature the mummy can see within 60 feet. *Failure:*  The target has the Frightened condition until the end of the mummy's next turn. *Success:*  The target is immune to this mummy's Dreadful Glare for 24 hours.
