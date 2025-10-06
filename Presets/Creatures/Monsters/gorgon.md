---
smType: creature
name: "Gorgon"
size: "Large"
type: "Construct"
alignment: "Unaligned"
ac: "19"
initiative: "+0"
hp: "114"
hit_dice: "12d10 + 48"
speed_walk: "40 ft."
speeds_json: "{\"walk\":{\"distance\":\"40 ft.\"}}"
str: "20"
dex: "11"
con: "18"
int: "2"
wis: "12"
cha: "7"
pb: "+3"
skills_prof: ["Perception"]
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 17"]
damage_immunities: ["Exhaustion", "Petrified"]
cr: "5"
xp: "1800"
entries_structured_json: "[{\"category\":\"action\",\"name\":\"Gore\",\"text\":\"*Melee Attack Roll:* +8, reach 5 ft. 18 (2d12 + 5) Piercing damage. If the target is a Large or smaller creature and the gorgon moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+8\",\"range\":\"5 ft\",\"damage\":\"18 (2d12 + 5) Piercing\"},{\"category\":\"action\",\"name\":\"Petrifying Breath\",\"recharge\":\"Recharge 5-6\",\"text\":\"*Constitution Saving Throw*: DC 15, each creature in a 30-foot Cone. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.\",\"target\":\"each creature in a 30-foot Cone\",\"save_ability\":\"CON\",\"save_dc\":15},{\"category\":\"bonus\",\"name\":\"Trample\",\"text\":\"*Dexterity Saving Throw*: DC 16, one creature within 5 feet that has the Prone condition. *Failure:*  16 (2d10 + 5) Bludgeoning damage. *Success:*  Half damage.\",\"target\":\"one creature\",\"damage\":\"16 (2d10 + 5) Bludgeoning\",\"save_ability\":\"DEX\",\"save_dc\":16,\"save_effect\":\"Half damage\"}]"
---

# Gorgon
*Large, Construct, Unaligned*

**AC** 19
**HP** 114 (12d10 + 48)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 20 | 11 | 18 | 2 | 12 | 7 |

CR 5, XP 1800

## Actions

**Gore**
*Melee Attack Roll:* +8, reach 5 ft. 18 (2d12 + 5) Piercing damage. If the target is a Large or smaller creature and the gorgon moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.

**Petrifying Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 15, each creature in a 30-foot Cone. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.

## Bonus Actions

**Trample**
*Dexterity Saving Throw*: DC 16, one creature within 5 feet that has the Prone condition. *Failure:*  16 (2d10 + 5) Bludgeoning damage. *Success:*  Half damage.
