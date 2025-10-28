---
smType: creature
name: "Glimmerfen Stalker"
size: "Medium"
type: "Plant"
alignment: "Neutral Evil"
ac: "15 (natural armor)"
hp: "88 (16d8 + 16)"
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"},\"climb\":{\"distance\":\"20 ft.\"},\"extras\":[{\"label\":\"swampstride\",\"distance\":\"40 ft.\",\"note\":\"difficult terrain\"}]}"
abilities_json: "[{\"ability\":\"str\",\"score\":16},{\"ability\":\"dex\",\"score\":14},{\"ability\":\"con\",\"score\":12},{\"ability\":\"int\",\"score\":7},{\"ability\":\"wis\",\"score\":15},{\"ability\":\"cha\",\"score\":8}]"
saves_json: "[{\"ability\":\"wis\",\"bonus\":5}]"
skills_json: "[{\"name\":\"Stealth\",\"bonus\":6},{\"name\":\"Survival\",\"bonus\":5}]"
senses: ["darkvision 60 ft.", "passive Perception 15"]
languages: ["Understands Sylvan, can't speak"]
damage_immunities: ["poison"]
condition_immunities: ["poisoned"]
entries_structured_json: "[{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The stalker makes two vine lash attacks.\"},{\"category\":\"action\",\"name\":\"Vine Lash\",\"to_hit\":\"+6\",\"range\":\"10 ft.\",\"damage\":\"10 (2d6 + 3) bludgeoning\",\"text\":\"On a hit, the target is grappled (escape DC 14).\"}]"
spellcasting_json: "{\"ability\":\"wis\",\"groups\":[{\"type\":\"per-day\",\"uses\":\"3/day\",\"spells\":[{\"name\":\"Entangle\"},{\"name\":\"Spike Growth\"}]}],\"computed\":{\"abilityMod\":2,\"proficiencyBonus\":null,\"saveDc\":null,\"attackBonus\":null}}"
---

# Glimmerfen Stalker
*Medium Plant, Neutral Evil*

AC 15 (natural armor)    Initiative -
HP 88 (16d8 + 16)
Speed 30 ft., climb 20 ft., swampstride 40 ft. difficult terrain

| Ability | Score |
| ------: | :---- |
| STR | 16 |
| DEX | 14 |
| CON | 12 |
| INT | 7 |
| WIS | 15 |
| CHA | 8 |

Saves Wis +5
Skills Stealth +6, Survival +5
Senses darkvision 60 ft., passive Perception 15
Immunities poison
Condition Immunities poisoned
Languages Understands Sylvan, can't speak

## Actions

- **Multiattack**
  The stalker makes two vine lash attacks.
- **Vine Lash**
  - to hit +6, 10 ft., 10 (2d6 + 3) bludgeoning
  On a hit, the target is grappled (escape DC 14).

## Spellcasting

### 3/day

- Entangle
- Spike Growth
