---
smType: creature
name: "Gelatinous Cube"
size: "Large"
type: "Ooze"
alignment: "Unaligned"
ac: "6"
initiative: "-4"
hp: "63"
hit_dice: "6d10 + 30"
speed_walk: "15 ft."
speeds_json: "{\"walk\":{\"distance\":\"15 ft.\"}}"
str: "14"
dex: "3"
con: "20"
int: "1"
wis: "6"
cha: "1"
pb: "+2"
senses: ["blindsight 60 ft."]
passives: ["Passive Perception 8"]
damage_immunities: ["Acid", "Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened", "Prone"]
cr: "2"
xp: "450"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Ooze Cube\",\"text\":\"The cube fills its entire space and is transparent. Other creatures can enter that space, but a creature that does so is subjected to the cube's Engulf and has Disadvantage on the saving throw. Creatures inside the cube have Cover|XPHB|Total Cover, and the cube can hold one Large creature or up to four Medium or Small creatures inside itself at a time. As an action, a creature within 5 feet of the cube can pull a creature or an object out of the cube by succeeding on a DC 12 Strength (Athletics) check, and the puller takes 10 (3d6) Acid damage.\",\"damage\":\"10 (3d6) Acid\"},{\"category\":\"trait\",\"name\":\"Transparent\",\"text\":\"Even when the cube is in plain sight, a creature must succeed on a DC 15 Wisdom (Perception) check to notice the cube if the creature hasn't witnessed the cube move or otherwise act.\"},{\"category\":\"action\",\"name\":\"Pseudopod\",\"text\":\"*Melee Attack Roll:* +4, reach 5 ft. 12 (3d6 + 2) Acid damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+4\",\"range\":\"5 ft\",\"damage\":\"12 (3d6 + 2) Acid\"},{\"category\":\"action\",\"name\":\"Engulf\",\"text\":\"The cube moves up to its Speed without provoking Opportunity Attacks. The cube can move through the spaces of Large or smaller creatures if it has room inside itself to contain them (see the Ooze Cube [Area of Effect]|XPHB|Cube trait). *Dexterity Saving Throw*: DC 12, each creature whose space the cube enters for the first time during this move. *Failure:*  10 (3d6) Acid damage, and the target is engulfed. An engulfed target is suffocating, can't cast spells with a Verbal component, has the Restrained condition, and takes 10 (3d6) Acid damage at the start of each of the cube's turns. When the cube moves, the engulfed target moves with it. An engulfed target can try to escape by taking an action to make a DC 12 Strength (Athletics) check. On a successful check, the target escapes and enters the nearest unoccupied space. *Success:*  Half damage, and the target moves to an unoccupied space within 5 feet of the cube. If there is no unoccupied space, the target fails the save instead.\",\"damage\":\"10 (3d6) Acid\",\"save_ability\":\"DEX\",\"save_dc\":12,\"save_effect\":\"Half damage, and the target moves to an unoccupied space within 5 feet of the cube\"}]"
---

# Gelatinous Cube
*Large, Ooze, Unaligned*

**AC** 6
**HP** 63 (6d10 + 30)
**Speed** 15 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 14 | 3 | 20 | 1 | 6 | 1 |

CR 2, XP 450

## Traits

**Ooze Cube**
The cube fills its entire space and is transparent. Other creatures can enter that space, but a creature that does so is subjected to the cube's Engulf and has Disadvantage on the saving throw. Creatures inside the cube have Cover|XPHB|Total Cover, and the cube can hold one Large creature or up to four Medium or Small creatures inside itself at a time. As an action, a creature within 5 feet of the cube can pull a creature or an object out of the cube by succeeding on a DC 12 Strength (Athletics) check, and the puller takes 10 (3d6) Acid damage.

**Transparent**
Even when the cube is in plain sight, a creature must succeed on a DC 15 Wisdom (Perception) check to notice the cube if the creature hasn't witnessed the cube move or otherwise act.

## Actions

**Pseudopod**
*Melee Attack Roll:* +4, reach 5 ft. 12 (3d6 + 2) Acid damage.

**Engulf**
The cube moves up to its Speed without provoking Opportunity Attacks. The cube can move through the spaces of Large or smaller creatures if it has room inside itself to contain them (see the Ooze Cube [Area of Effect]|XPHB|Cube trait). *Dexterity Saving Throw*: DC 12, each creature whose space the cube enters for the first time during this move. *Failure:*  10 (3d6) Acid damage, and the target is engulfed. An engulfed target is suffocating, can't cast spells with a Verbal component, has the Restrained condition, and takes 10 (3d6) Acid damage at the start of each of the cube's turns. When the cube moves, the engulfed target moves with it. An engulfed target can try to escape by taking an action to make a DC 12 Strength (Athletics) check. On a successful check, the target escapes and enters the nearest unoccupied space. *Success:*  Half damage, and the target moves to an unoccupied space within 5 feet of the cube. If there is no unoccupied space, the target fails the save instead.
