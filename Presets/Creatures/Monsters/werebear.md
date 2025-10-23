---
smType: creature
name: Werebear
size: Small
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Good
ac: "15"
initiative: +3 (13)
hp: "135"
hitDice: 18d8 + 54
speeds:
  - type: walk
    value: "30"
  - type: climb
    value: "30"
abilities:
  - ability: str
    score: 19
  - ability: dex
    score: 10
  - ability: con
    score: 17
  - ability: int
    score: 11
  - ability: wis
    score: 12
  - ability: cha
    score: 12
pb: "+3"
cr: "5"
xp: "1800"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Common (can't speak in bear form)
passivesList:
  - skill: Perception
    value: "17"
entries:
  - category: action
    name: Multiattack
    text: The werebear makes two attacks, using Handaxe or Rend in any combination. It can replace one attack with a Bite attack.
  - category: action
    name: Bite (Bear or Hybrid Form Only)
    text: "*Melee Attack Roll:* +7, reach 5 ft. 17 (2d12 + 4) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 14. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Werebear under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this werebear's curse for 24 hours."
  - category: action
    name: Handaxe (Humanoid or Hybrid Form Only)
    text: "*Melee or Ranged Attack Roll:* +7, reach 5 ft or range 20/60 ft. 14 (3d6 + 4) Slashing damage."
  - category: action
    name: Rend (Bear or Hybrid Form Only)
    text: "*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Slashing damage."
  - category: bonus
    name: Shape-Shift
    text: The werebear shape-shifts into a Large bear-humanoid hybrid form or a Large bear, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.

---

# Werebear
*Small, Monstrosity, Neutral Good*

**AC** 15
**HP** 135 (18d8 + 54)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 19 | 10 | 17 | 11 | 12 | 12 |

**Senses** darkvision 60 ft.; Passive Perception 17
**Languages** Common (can't speak in bear form)
CR 5, PB +3, XP 1800

## Actions

**Multiattack**
The werebear makes two attacks, using Handaxe or Rend in any combination. It can replace one attack with a Bite attack.

**Bite (Bear or Hybrid Form Only)**
*Melee Attack Roll:* +7, reach 5 ft. 17 (2d12 + 4) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 14. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Werebear under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this werebear's curse for 24 hours.

**Handaxe (Humanoid or Hybrid Form Only)**
*Melee or Ranged Attack Roll:* +7, reach 5 ft or range 20/60 ft. 14 (3d6 + 4) Slashing damage.

**Rend (Bear or Hybrid Form Only)**
*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Slashing damage.

## Bonus Actions

**Shape-Shift**
The werebear shape-shifts into a Large bear-humanoid hybrid form or a Large bear, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
