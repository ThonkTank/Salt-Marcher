---
smType: creature
name: "Gibbering Mouther"
size: "Medium"
type: "Aberration"
alignment: "Chaotic Neutral"
ac: "9"
initiative: "-1"
hp: "52"
hit_dice: "7d8 + 21"
speed_walk: "20 ft."
speed_swim: "20 ft."
speeds_json: "{\"walk\":{\"distance\":\"20 ft.\"},\"swim\":{\"distance\":\"20 ft.\"}}"
str: "10"
dex: "8"
con: "16"
int: "3"
wis: "10"
cha: "6"
pb: "+2"
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 10"]
damage_immunities: ["Prone"]
cr: "2"
xp: "450"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Aberrant Ground\",\"text\":\"The ground in a 10-foot Emanation originating from the mouther is Difficult Terrain.\"},{\"category\":\"trait\",\"name\":\"Gibbering\",\"text\":\"The mouther babbles incoherently while it doesn't have the Incapacitated condition. *Wisdom Saving Throw*: DC 10, any creature that starts its turn within 20 feet of the mouther while it is babbling. *Failure:*  The target rolls 1d8 to determine what it does during the current turn: - **1-4**: The target does nothing. - **5-6**: The target takes no action or Bonus Action and uses all its movement to move in a random direction. - **7-8**: The target makes a melee attack against a randomly determined creature within its reach or does nothing if it can't make such an attack.\",\"save_ability\":\"WIS\",\"save_dc\":10},{\"category\":\"action\",\"name\":\"Bite\",\"text\":\"*Melee Attack Roll:* +2, reach 5 ft. 7 (2d6) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition. The target dies if it is reduced to 0 Hit Points by this attack. Its body is then absorbed into the mouther, leaving only equipment behind.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+2\",\"range\":\"5 ft\",\"damage\":\"7 (2d6) Piercing\"},{\"category\":\"action\",\"name\":\"Blinding Spittle\",\"recharge\":\"Recharge 5-6\",\"text\":\"*Dexterity Saving Throw*: DC 10, each creature in a 10-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point within 30 feet. *Failure:*  7 (2d6) Radiant damage, and the target has the Blinded condition until the end of the mouther's next turn.\",\"target\":\"each creature in a 10-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point within 30 feet\",\"damage\":\"7 (2d6) Radiant\",\"save_ability\":\"DEX\",\"save_dc\":10}]"
---

# Gibbering Mouther
*Medium, Aberration, Chaotic Neutral*

**AC** 9
**HP** 52 (7d8 + 21)
**Speed** 20 ft., swim 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 10 | 8 | 16 | 3 | 10 | 6 |

CR 2, XP 450

## Traits

**Aberrant Ground**
The ground in a 10-foot Emanation originating from the mouther is Difficult Terrain.

**Gibbering**
The mouther babbles incoherently while it doesn't have the Incapacitated condition. *Wisdom Saving Throw*: DC 10, any creature that starts its turn within 20 feet of the mouther while it is babbling. *Failure:*  The target rolls 1d8 to determine what it does during the current turn: - **1-4**: The target does nothing. - **5-6**: The target takes no action or Bonus Action and uses all its movement to move in a random direction. - **7-8**: The target makes a melee attack against a randomly determined creature within its reach or does nothing if it can't make such an attack.

## Actions

**Bite**
*Melee Attack Roll:* +2, reach 5 ft. 7 (2d6) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition. The target dies if it is reduced to 0 Hit Points by this attack. Its body is then absorbed into the mouther, leaving only equipment behind.

**Blinding Spittle (Recharge 5-6)**
*Dexterity Saving Throw*: DC 10, each creature in a 10-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point within 30 feet. *Failure:*  7 (2d6) Radiant damage, and the target has the Blinded condition until the end of the mouther's next turn.
