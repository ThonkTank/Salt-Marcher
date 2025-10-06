---
smType: creature
name: "Adult White Dragon"
size: "Huge"
type: "Dragon"
type_tags: ["Chromatic"]
alignment: "Chaotic Evil"
ac: "18"
initiative: "+4"
hp: "200"
hit_dice: "16d12 + 96"
speed_walk: "40 ft."
speed_swim: "40 ft."
speed_fly: "80 ft."
speed_burrow: "30 ft."
speeds_json: "{\"walk\":{\"distance\":\"40 ft.\"},\"burrow\":{\"distance\":\"30 ft.\"},\"fly\":{\"distance\":\"80 ft.\"},\"swim\":{\"distance\":\"40 ft.\"}}"
str: "22"
dex: "10"
con: "22"
int: "8"
wis: "12"
cha: "12"
pb: "+5"
saves_prof: ["DEX", "WIS"]
skills_prof: ["Perception", "Stealth"]
senses: ["blindsight 60 ft.", "darkvision 120 ft."]
passives: ["Passive Perception 21"]
languages: ["Common", "Draconic"]
damage_immunities: ["Cold"]
cr: "13"
xp: "10000"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Ice Walk\",\"text\":\"The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.\"},{\"category\":\"trait\",\"name\":\"Legendary Resistance (3/Day, or 4/Day in Lair)\",\"text\":\"If the dragon fails a saving throw, it can choose to succeed instead.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The dragon makes three Rend attacks.\"},{\"category\":\"action\",\"name\":\"Rend\",\"text\":\"*Melee Attack Roll:* +11, reach 10 ft. 13 (2d6 + 6) Slashing damage plus 4 (1d8) Cold damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+11\",\"range\":\"10 ft\",\"damage\":\"13 (2d6 + 6) Slashing\"},{\"category\":\"action\",\"name\":\"Cold Breath\",\"recharge\":\"Recharge 5-6\",\"text\":\"*Constitution Saving Throw*: DC 19, each creature in a 60-foot Cone. *Failure:*  54 (12d8) Cold damage. *Success:*  Half damage.\",\"target\":\"each creature in a 60-foot Cone\",\"damage\":\"54 (12d8) Cold\",\"save_ability\":\"CON\",\"save_dc\":19,\"save_effect\":\"Half damage\"},{\"category\":\"legendary\",\"name\":\"Freezing Burst\",\"text\":\"*Constitution Saving Throw*: DC 14, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  7 (2d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.\",\"target\":\"each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet\",\"damage\":\"7 (2d6) Cold\",\"save_ability\":\"CON\",\"save_dc\":14},{\"category\":\"legendary\",\"name\":\"Pounce\",\"text\":\"The dragon moves up to half its Speed, and it makes one Rend attack.\"},{\"category\":\"legendary\",\"name\":\"Frightful Presence\",\"text\":\"The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14). The dragon can't take this action again until the start of its next turn.\"}]"
---

# Adult White Dragon
*Huge, Dragon, Chaotic Evil*

**AC** 18
**HP** 200 (16d12 + 96)
**Speed** 40 ft., swim 40 ft., fly 80 ft., burrow 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 22 | 10 | 22 | 8 | 12 | 12 |

CR 13, XP 10000

## Traits

**Ice Walk**
The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +11, reach 10 ft. 13 (2d6 + 6) Slashing damage plus 4 (1d8) Cold damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 19, each creature in a 60-foot Cone. *Failure:*  54 (12d8) Cold damage. *Success:*  Half damage.

## Legendary Actions

**Freezing Burst**
*Constitution Saving Throw*: DC 14, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  7 (2d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.

**Frightful Presence**
The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14). The dragon can't take this action again until the start of its next turn.
