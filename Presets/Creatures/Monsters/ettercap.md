---
smType: creature
name: "Ettercap"
size: "Medium"
type: "Monstrosity"
alignment: "Neutral Evil"
ac: "13"
initiative: "+2"
hp: "44"
hit_dice: "8d8 + 8"
speed_walk: "30 ft."
speed_climb: "30 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"},\"climb\":{\"distance\":\"30 ft.\"}}"
str: "14"
dex: "15"
con: "13"
int: "7"
wis: "12"
cha: "8"
pb: "+2"
skills_prof: ["Perception", "Stealth", "Survival"]
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 13"]
cr: "2"
xp: "450"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Spider Climb\",\"text\":\"The ettercap can climb difficult surfaces, including along ceilings, without needing to make an ability check.\"},{\"category\":\"trait\",\"name\":\"Web Walker\",\"text\":\"The ettercap ignores movement restrictions caused by webs, and the ettercap knows the location of any other creature in contact with the same web.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The ettercap makes one Bite attack and one Claw attack.\"},{\"category\":\"action\",\"name\":\"Bite\",\"text\":\"*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 2 (1d4) Poison damage, and the target has the Poisoned condition until the start of the ettercap's next turn.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+4\",\"range\":\"5 ft\",\"damage\":\"5 (1d6 + 2) Piercing\"},{\"category\":\"action\",\"name\":\"Claw\",\"text\":\"*Melee Attack Roll:* +4, reach 5 ft. 7 (2d4 + 2) Slashing damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+4\",\"range\":\"5 ft\",\"damage\":\"7 (2d4 + 2) Slashing\"},{\"category\":\"action\",\"name\":\"Web Strand\",\"recharge\":\"Recharge 5-6\",\"text\":\"*Dexterity Saving Throw*: DC 12, one Large or smaller creature the ettercap can see within 30 feet. *Failure:*  The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Bludgeoning, Poison, and Psychic damage).\",\"save_ability\":\"DEX\",\"save_dc\":12},{\"category\":\"bonus\",\"name\":\"Reel\",\"text\":\"The ettercap pulls one creature within 30 feet of itself that is Restrained by its Web Strand up to 25 feet straight toward itself.\",\"target\":\"one creature\"}]"
---

# Ettercap
*Medium, Monstrosity, Neutral Evil*

**AC** 13
**HP** 44 (8d8 + 8)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 14 | 15 | 13 | 7 | 12 | 8 |

CR 2, XP 450

## Traits

**Spider Climb**
The ettercap can climb difficult surfaces, including along ceilings, without needing to make an ability check.

**Web Walker**
The ettercap ignores movement restrictions caused by webs, and the ettercap knows the location of any other creature in contact with the same web.

## Actions

**Multiattack**
The ettercap makes one Bite attack and one Claw attack.

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 2 (1d4) Poison damage, and the target has the Poisoned condition until the start of the ettercap's next turn.

**Claw**
*Melee Attack Roll:* +4, reach 5 ft. 7 (2d4 + 2) Slashing damage.

**Web Strand (Recharge 5-6)**
*Dexterity Saving Throw*: DC 12, one Large or smaller creature the ettercap can see within 30 feet. *Failure:*  The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Bludgeoning, Poison, and Psychic damage).

## Bonus Actions

**Reel**
The ettercap pulls one creature within 30 feet of itself that is Restrained by its Web Strand up to 25 feet straight toward itself.
