---
smType: creature
name: "Mummy"
size: "Small"
type: "Undead"
alignment: "Lawful Evil"
ac: "11"
initiative: "-1"
hp: "58"
hit_dice: "9d8 + 18"
speed_walk: "20 ft."
speeds_json: "{\"walk\":{\"distance\":\"20 ft.\"}}"
str: "16"
dex: "8"
con: "15"
int: "6"
wis: "12"
cha: "12"
pb: "+2"
saves_prof: ["WIS"]
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 11"]
languages: ["Common plus two other languages"]
damage_immunities: ["Necrotic", "Poison", "Charmed", "Exhaustion", "Frightened", "Paralyzed", "Poisoned"]
damage_vulnerabilities: ["Fire"]
cr: "3"
xp: "700"
entries_structured_json: "[{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The mummy makes two Rotting Fist attacks and uses Dreadful Glare.\"},{\"category\":\"action\",\"name\":\"Rotting Fist\",\"text\":\"*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, its Hit Point maximum doesn't return to normal when finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+5\",\"range\":\"5 ft\",\"damage\":\"8 (1d10 + 3) Bludgeoning\"},{\"category\":\"action\",\"name\":\"Dreadful Glare\",\"text\":\"*Wisdom Saving Throw*: DC 11, one creature the mummy can see within 60 feet. *Failure:*  The target has the Frightened condition until the end of the mummy's next turn. *Success:*  The target is immune to this mummy's Dreadful Glare for 24 hours.\",\"target\":\"one creature\",\"save_ability\":\"WIS\",\"save_dc\":11,\"save_effect\":\"The target is immune to this mummy's Dreadful Glare for 24 hours\"}]"
---

# Mummy
*Small, Undead, Lawful Evil*

**AC** 11
**HP** 58 (9d8 + 18)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 16 | 8 | 15 | 6 | 12 | 12 |

CR 3, XP 700

## Actions

**Multiattack**
The mummy makes two Rotting Fist attacks and uses Dreadful Glare.

**Rotting Fist**
*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, its Hit Point maximum doesn't return to normal when finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.

**Dreadful Glare**
*Wisdom Saving Throw*: DC 11, one creature the mummy can see within 60 feet. *Failure:*  The target has the Frightened condition until the end of the mummy's next turn. *Success:*  The target is immune to this mummy's Dreadful Glare for 24 hours.
