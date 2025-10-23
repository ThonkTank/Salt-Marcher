---
smType: creature
name: Wererat
size: Small
type: Monstrosity
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: "13"
initiative: +3 (13)
hp: "60"
hitDice: 11d8 + 11
speeds:
  - type: walk
    value: "30"
  - type: climb
    value: "30"
abilities:
  - ability: str
    score: 10
  - ability: dex
    score: 16
  - ability: con
    score: 12
  - ability: int
    score: 11
  - ability: wis
    score: 10
  - ability: cha
    score: 8
pb: "+2"
cr: "2"
xp: "450"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Common (can't speak in rat form)
passivesList:
  - skill: Perception
    value: "14"
entries:
  - category: action
    name: Multiattack
    text: The wererat makes two attacks, using Scratch or Hand Crossbow in any combination. It can replace one attack with a Bite attack.
  - category: action
    name: Bite (Rat or Hybrid Form Only)
    text: "*Melee Attack Roll:* +5, reach 5 ft. 8 (2d4 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Wererat under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this wererat's curse for 24 hours."
  - category: action
    name: Scratch
    text: "*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Slashing damage."
  - category: action
    name: Hand Crossbow (Humanoid or Hybrid Form Only)
    text: "*Ranged Attack Roll:* +5, range 30/120 ft. 6 (1d6 + 3) Piercing damage."
  - category: bonus
    name: Shape-Shift
    text: The wererat shape-shifts into a Medium rat-humanoid hybrid or a Small rat, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.

---

# Wererat
*Small, Monstrosity, Lawful Evil*

**AC** 13
**HP** 60 (11d8 + 11)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 10 | 16 | 12 | 11 | 10 | 8 |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Common (can't speak in rat form)
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The wererat makes two attacks, using Scratch or Hand Crossbow in any combination. It can replace one attack with a Bite attack.

**Bite (Rat or Hybrid Form Only)**
*Melee Attack Roll:* +5, reach 5 ft. 8 (2d4 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Wererat under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this wererat's curse for 24 hours.

**Scratch**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Slashing damage.

**Hand Crossbow (Humanoid or Hybrid Form Only)**
*Ranged Attack Roll:* +5, range 30/120 ft. 6 (1d6 + 3) Piercing damage.

## Bonus Actions

**Shape-Shift**
The wererat shape-shifts into a Medium rat-humanoid hybrid or a Small rat, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
