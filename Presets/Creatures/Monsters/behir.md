---
smType: creature
name: "Behir"
size: "Huge"
type: "Monstrosity"
alignment: "Neutral Evil"
ac: "17"
initiative: "+3"
hp: "168"
hit_dice: "16d12 + 64"
speed_walk: "50 ft."
speed_climb: "50 ft."
speeds_json: "{\"walk\":{\"distance\":\"50 ft.\"},\"climb\":{\"distance\":\"50 ft.\"}}"
str: "23"
dex: "16"
con: "18"
int: "7"
wis: "14"
cha: "12"
pb: "+4"
skills_prof: ["Perception", "Stealth"]
senses: ["darkvision 90 ft."]
passives: ["Passive Perception 16"]
languages: ["Draconic"]
damage_immunities: ["Lightning"]
cr: "11"
xp: "7200"
entries_structured_json: "[{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The behir makes one Bite attack and uses Constrict.\"},{\"category\":\"action\",\"name\":\"Bite\",\"text\":\"*Melee Attack Roll:* +10, reach 10 ft. 19 (2d12 + 6) Piercing damage plus 11 (2d10) Lightning damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+10\",\"range\":\"10 ft\",\"damage\":\"19 (2d12 + 6) Piercing\"},{\"category\":\"action\",\"name\":\"Constrict\",\"text\":\"*Strength Saving Throw*: DC 18, one Large or smaller creature the behir can see within 5 feet. *Failure:*  28 (5d8 + 6) Bludgeoning damage. The target has the Grappled condition (escape DC 16), and it has the Restrained condition until the grapple ends.\",\"damage\":\"28 (5d8 + 6) Bludgeoning\",\"save_ability\":\"STR\",\"save_dc\":18},{\"category\":\"action\",\"name\":\"Lightning Breath\",\"recharge\":\"Recharge 5-6\",\"text\":\"*Dexterity Saving Throw*: DC 16, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  66 (12d10) Lightning damage. *Success:*  Half damage.\",\"target\":\"each creature in a 90-foot-long, 5-foot-wide Line\",\"damage\":\"66 (12d10) Lightning\",\"save_ability\":\"DEX\",\"save_dc\":16,\"save_effect\":\"Half damage\"},{\"category\":\"bonus\",\"name\":\"Swallow\",\"text\":\"*Dexterity Saving Throw*: DC 18, one Large or smaller creature Grappled by the behir (the behir can have only one creature swallowed at a time). *Failure:*  The behir swallows the target, which is no longer Grappled. While swallowed, a creature has the Blinded and Restrained conditions, has Cover|XPHB|Total Cover against attacks and other effects outside the behir, and takes 21 (6d6) Acid damage at the start of each of the behir's turns. If the behir takes 30 damage or more on a single turn from the swallowed creature, the behir must succeed on a DC 14 Constitution saving throw at the end of that turn or regurgitate the creature, which falls in a space within 10 feet of the behir and has the Prone condition. If the behir dies, a swallowed creature is no longer Restrained and can escape from the corpse by using 15 feet of movement, exiting Prone.\",\"target\":\"one creature\",\"damage\":\"21 (6d6) Acid\",\"save_ability\":\"DEX\",\"save_dc\":18}]"
---

# Behir
*Huge, Monstrosity, Neutral Evil*

**AC** 17
**HP** 168 (16d12 + 64)
**Speed** 50 ft., climb 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 23 | 16 | 18 | 7 | 14 | 12 |

CR 11, XP 7200

## Actions

**Multiattack**
The behir makes one Bite attack and uses Constrict.

**Bite**
*Melee Attack Roll:* +10, reach 10 ft. 19 (2d12 + 6) Piercing damage plus 11 (2d10) Lightning damage.

**Constrict**
*Strength Saving Throw*: DC 18, one Large or smaller creature the behir can see within 5 feet. *Failure:*  28 (5d8 + 6) Bludgeoning damage. The target has the Grappled condition (escape DC 16), and it has the Restrained condition until the grapple ends.

**Lightning Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 16, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  66 (12d10) Lightning damage. *Success:*  Half damage.

## Bonus Actions

**Swallow**
*Dexterity Saving Throw*: DC 18, one Large or smaller creature Grappled by the behir (the behir can have only one creature swallowed at a time). *Failure:*  The behir swallows the target, which is no longer Grappled. While swallowed, a creature has the Blinded and Restrained conditions, has Cover|XPHB|Total Cover against attacks and other effects outside the behir, and takes 21 (6d6) Acid damage at the start of each of the behir's turns. If the behir takes 30 damage or more on a single turn from the swallowed creature, the behir must succeed on a DC 14 Constitution saving throw at the end of that turn or regurgitate the creature, which falls in a space within 10 feet of the behir and has the Prone condition. If the behir dies, a swallowed creature is no longer Restrained and can escape from the corpse by using 15 feet of movement, exiting Prone.
