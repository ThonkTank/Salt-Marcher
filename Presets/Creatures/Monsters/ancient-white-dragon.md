---
smType: creature
name: "Ancient White Dragon"
size: "Gargantuan"
type: "Dragon"
type_tags: ["Chromatic"]
alignment: "Chaotic Evil"
ac: "20"
initiative: "+4"
hp: "333"
hit_dice: "18d20 + 144"
speed_walk: "40 ft."
speed_swim: "40 ft."
speed_fly: "80 ft."
speed_burrow: "40 ft."
speeds_json: "{\"walk\":{\"distance\":\"40 ft.\"},\"burrow\":{\"distance\":\"40 ft.\"},\"fly\":{\"distance\":\"80 ft.\"},\"swim\":{\"distance\":\"40 ft.\"}}"
str: "26"
dex: "10"
con: "26"
int: "10"
wis: "13"
cha: "18"
pb: "+6"
saves_prof: ["DEX", "WIS"]
skills_prof: ["Perception", "Stealth"]
senses: ["blindsight 60 ft.", "darkvision 120 ft."]
passives: ["Passive Perception 23"]
languages: ["Common", "Draconic"]
damage_immunities: ["Cold"]
cr: "20"
xp: "25000"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Ice Walk\",\"text\":\"The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.\"},{\"category\":\"trait\",\"name\":\"Legendary Resistance (4/Day, or 5/Day in Lair)\",\"text\":\"If the dragon fails a saving throw, it can choose to succeed instead.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The dragon makes three Rend attacks.\"},{\"category\":\"action\",\"name\":\"Rend\",\"text\":\"*Melee Attack Roll:* +14, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 7 (2d6) Cold damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+14\",\"range\":\"15 ft\",\"damage\":\"17 (2d8 + 8) Slashing\"},{\"category\":\"action\",\"name\":\"Cold Breath\",\"recharge\":\"Recharge 5-6\",\"text\":\"*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  63 (14d8) Cold damage. *Success:*  Half damage.\",\"target\":\"each creature in a 90-foot Cone\",\"damage\":\"63 (14d8) Cold\",\"save_ability\":\"CON\",\"save_dc\":22,\"save_effect\":\"Half damage\"},{\"category\":\"legendary\",\"name\":\"Freezing Burst\",\"text\":\"*Constitution Saving Throw*: DC 20, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  14 (4d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.\",\"target\":\"each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet\",\"damage\":\"14 (4d6) Cold\",\"save_ability\":\"CON\",\"save_dc\":20},{\"category\":\"legendary\",\"name\":\"Pounce\",\"text\":\"The dragon moves up to half its Speed, and it makes one Rend attack.\"},{\"category\":\"legendary\",\"name\":\"Frightful Presence\",\"text\":\"The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18). The dragon can't take this action again until the start of its next turn.\"}]"
---

# Ancient White Dragon
*Gargantuan, Dragon, Chaotic Evil*

**AC** 20
**HP** 333 (18d20 + 144)
**Speed** 40 ft., swim 40 ft., fly 80 ft., burrow 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 26 | 10 | 26 | 10 | 13 | 18 |

CR 20, XP 25000

## Traits

**Ice Walk**
The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +14, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 7 (2d6) Cold damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  63 (14d8) Cold damage. *Success:*  Half damage.

## Legendary Actions

**Freezing Burst**
*Constitution Saving Throw*: DC 20, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  14 (4d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.

**Frightful Presence**
The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18). The dragon can't take this action again until the start of its next turn.
