---
smType: creature
name: Death Dog
size: Medium
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "12"
initiative: +2 (12)
hp: "39"
hitDice: 6d8 + 12
speeds:
  - type: walk
    value: "40"
abilities:
  - ability: str
    score: 15
  - ability: dex
    score: 14
  - ability: con
    score: 14
  - ability: int
    score: 3
  - ability: wis
    score: 13
  - ability: cha
    score: 6
pb: "+2"
cr: "1"
xp: "200"
sensesList:
  - type: darkvision
    range: "120"
passivesList:
  - skill: Perception
    value: "15"
damageImmunitiesList:
  - value: Blinded
  - value: Charmed
  - value: Deafened
  - value: Frightened
  - value: Stunned
  - value: Unconscious
entries:
  - category: action
    name: Multiattack
    text: The death dog makes two Bite attacks.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Piercing damage. If the target is a creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *First Failure* The target has the Poisoned condition. While Poisoned, the target's Hit Point maximum doesn't return to normal when finishing a Long Rest, and it repeats the save every 24 hours that elapse, ending the effect on itself on a success. Subsequent Failures: The Poisoned target's Hit Point maximum decreases by 5 (1d10)."

---

# Death Dog
*Medium, Monstrosity, Neutral Evil*

**AC** 12
**HP** 39 (6d8 + 12)
**Initiative** +2 (12)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 15 | 14 | 14 | 3 | 13 | 6 |

**Senses** darkvision 120 ft.; Passive Perception 15
CR 1, PB +2, XP 200

## Actions

**Multiattack**
The death dog makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Piercing damage. If the target is a creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *First Failure* The target has the Poisoned condition. While Poisoned, the target's Hit Point maximum doesn't return to normal when finishing a Long Rest, and it repeats the save every 24 hours that elapse, ending the effect on itself on a success. Subsequent Failures: The Poisoned target's Hit Point maximum decreases by 5 (1d10).
