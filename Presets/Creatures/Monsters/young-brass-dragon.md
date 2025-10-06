---
smType: creature
name: "Young Brass Dragon"
size: "Large"
type: "Dragon"
type_tags: ["Metallic"]
alignment: "Chaotic Good"
ac: "17"
initiative: "+3"
hp: "110"
hit_dice: "13d10 + 39"
speed_walk: "40 ft."
speed_fly: "80 ft."
speed_burrow: "20 ft."
speeds_json: "{\"walk\":{\"distance\":\"40 ft.\"},\"burrow\":{\"distance\":\"20 ft.\"},\"fly\":{\"distance\":\"80 ft.\"}}"
str: "19"
dex: "10"
con: "17"
int: "12"
wis: "11"
cha: "15"
pb: "+3"
saves_prof: ["DEX", "WIS"]
skills_prof: ["Perception", "Persuasion", "Stealth"]
senses: ["blindsight 30 ft.", "darkvision 120 ft."]
passives: ["Passive Perception 16"]
languages: ["Common", "Draconic"]
damage_immunities: ["Fire"]
cr: "6"
xp: "2300"
entries_structured_json: "[{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The dragon makes three Rend attacks. It can replace two attacks with a use of Sleep Breath.\"},{\"category\":\"action\",\"name\":\"Rend\",\"text\":\"*Melee Attack Roll:* +7, reach 10 ft. 15 (2d10 + 4) Slashing damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+7\",\"range\":\"10 ft\",\"damage\":\"15 (2d10 + 4) Slashing\"},{\"category\":\"action\",\"name\":\"Fire Breath\",\"recharge\":\"Recharge 5-6\",\"text\":\"*Dexterity Saving Throw*: DC 14, each creature in a 40-foot-long, 5-foot-wide Line. *Failure:*  38 (11d6) Fire damage. *Success:*  Half damage.\",\"target\":\"each creature in a 40-foot-long, 5-foot-wide Line\",\"damage\":\"38 (11d6) Fire\",\"save_ability\":\"DEX\",\"save_dc\":14,\"save_effect\":\"Half damage\"},{\"category\":\"action\",\"name\":\"Sleep Breath\",\"text\":\"*Constitution Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. *Second Failure* The target has the Unconscious condition for 1 minute. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.\",\"target\":\"each creature in a 30-foot Cone\",\"save_ability\":\"CON\",\"save_dc\":14}]"
---

# Young Brass Dragon
*Large, Dragon, Chaotic Good*

**AC** 17
**HP** 110 (13d10 + 39)
**Speed** 40 ft., fly 80 ft., burrow 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 19 | 10 | 17 | 12 | 11 | 15 |

CR 6, XP 2300

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace two attacks with a use of Sleep Breath.

**Rend**
*Melee Attack Roll:* +7, reach 10 ft. 15 (2d10 + 4) Slashing damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 14, each creature in a 40-foot-long, 5-foot-wide Line. *Failure:*  38 (11d6) Fire damage. *Success:*  Half damage.

**Sleep Breath**
*Constitution Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. *Second Failure* The target has the Unconscious condition for 1 minute. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.
