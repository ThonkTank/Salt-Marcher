# Tag Vocabulary

Diese Liste dient als Ausgangspunkt für alle tagbasierten Systeme (Fraktionen, Orte, Dungeons, Loot, Audio).
Sie wird während Phase 0 kontinuierlich ergänzt.

## Kreaturen (`typeTags`)
| Tag        | Beschreibung              | Beispiele |
|------------|---------------------------|-----------|
| Angel      | Himmlische Wesen          | Planetar, Solar |
| Chromatic  | Chromatische Drachen      | Black, Blue, Red |
| Demon      | Dämonische Kreaturen      | Balor, Marilith |
| Devil      | Teuflische Kreaturen      | Pit Fiend, Erinyes |
| Dinosaur   | Urzeitliche Echsen        | Triceratops, T-Rex |
| Genie      | Elementare Genien         | Djinni, Efreeti |
| Goblinoid  | Goblinoide Humanoiden     | Goblin, Bugbear |
| Metallic   | Metallische Drachen       | Gold, Silver |
| Titan      | Gigantische Titanen       | Kraken, Tarrasque |
| Wizard     | Magisch geprägte Humanoide| Lich, Archmage |

> Datenbasis: `Presets/Creatures/**/` (`typeTags` Frontmatter)

## Items (`tags`)
| Tag      | Beschreibung                | Beispiele |
|----------|-----------------------------|-----------|
| Armor    | Schutzausrüstung            | Chain Mail, Plate |
| Potion   | Verbrauchbares Elixier      | Potion of Healing |
| Ring     | Schmuck mit Effekten        | Ring of Protection |
| Rod      | Magischer Stab              | Rod of the Pact Keeper |
| Scroll   | Schriftrolle                | Scroll of Fireball |
| Staff    | Zauberstab mit Ladungen     | Staff of Power |
| Wand     | Kurzer Zauberstab           | Wand of Magic Missiles |
| Weapon   | Waffen                      | Sword of Vengeance |
| Wondrous | Sonstige magische Gegenstände| Bag of Holding |

> Datenbasis: `Presets/Items/**/` (`tags` Frontmatter)

## Spells (`school`)
| Tag          | Beschreibung         |
|--------------|----------------------|
| Abjuration   | Schutz/Barrieren     |
| Conjuration  | Beschwörung/Teleport |
| Divination   | Erkenntnis           |
| Enchantment  | Geistesbeeinflussung |
| Evocation    | Energetische Effekte |
| Illusion     | Täuschung            |
| Necromancy   | Tod/Untote           |
| Transmutation| Verwandlung          |

> Datenbasis: `Presets/Spells/**/` (`school` Frontmatter)

## Equipment (`equipmentType`)
| Tag           | Beschreibung              | Beispiele |
|---------------|---------------------------|-----------|
| Armor         | Rüstungen                 | Leather Armor, Plate |
| Weapon        | Waffen                    | Longsword, Crossbow |
| Tool          | Werkzeuge                 | Thieves' Tools, Mason's Tools |
| Gear          | Ausrüstung                | Rope, Torch, Backpack |
| Mount         | Reittiere & Transportmittel | Horse, Wagon |
| Trade Goods   | Handelswaren              | Silk, Spices |

> Datenbasis: `Presets/Equipment/**/` (noch zu implementieren)

## Terrains (`biome`, `difficulty`)
### Biome Tags
| Tag        | Beschreibung              |
|------------|---------------------------|
| Forest     | Wald                      |
| Mountain   | Gebirge                   |
| Coastal    | Küstengebiet              |
| Desert     | Wüste                     |
| Arctic     | Arktis/Tundra             |
| Swamp      | Sumpf                     |
| Grassland  | Grasland                  |
| Hills      | Hügelland                 |
| Urban      | Städtisch                 |
| Underground| Untergrund                |

### Difficulty Tags
| Tag            | Beschreibung        | Speed Modifier |
|----------------|---------------------|----------------|
| Easy           | Leicht begehbar     | 1.0            |
| Difficult      | Schwieriges Gelände | 0.5-0.7        |
| Very Difficult | Sehr schwierig      | 0.3-0.5        |

> Datenbasis: `Presets/Terrains/**/` (noch zu implementieren)

## Regions (`biome`, `danger`, `climate`, `settlement`)
### Biome Tags (wie Terrains)
Siehe Terrains biome tags

### Danger Tags
| Tag        | Beschreibung           | Encounter Odds |
|------------|------------------------|----------------|
| Safe       | Sicher                 | 1/12+          |
| Moderate   | Moderat gefährlich     | 1/6-1/12       |
| Dangerous  | Gefährlich             | 1/3-1/6        |
| Deadly     | Tödlich                | 1/2 oder höher |

### Climate Tags
| Tag        | Beschreibung |
|------------|--------------|
| Arctic     | Arktisch     |
| Cold       | Kalt         |
| Temperate  | Gemäßigt     |
| Warm       | Warm         |
| Hot        | Heiß         |
| Desert     | Wüste        |

### Settlement Tags
| Tag         | Beschreibung       |
|-------------|--------------------|
| Civilized   | Zivilisiert        |
| Frontier    | Grenzgebiet        |
| Wilderness  | Wildnis            |
| Ruins       | Ruinen             |

> Datenbasis: `Presets/Regions/**/` (noch zu implementieren)

## Audio / Playlists

### Terrain Tags
| Tag         | Beschreibung              |
|-------------|---------------------------|
| Forest      | Wald                      |
| Mountain    | Gebirge                   |
| Desert      | Wüste                     |
| Swamp       | Sumpf                     |
| Coastal     | Küstengebiet              |
| Ocean       | Ozean/Meer                |
| Arctic      | Arktis/Tundra             |
| Cave        | Höhlen                    |
| Underground | Untergrund/Dungeon        |
| Urban       | Städtisch                 |
| Ruins       | Ruinen                    |
| Plains      | Ebenen/Grasland           |
| Hills       | Hügelland                 |
| Jungle      | Dschungel                 |
| Volcanic    | Vulkanisch                |

### Weather Tags
| Tag     | Beschreibung        |
|---------|---------------------|
| Clear   | Klarer Himmel       |
| Cloudy  | Bewölkt             |
| Rain    | Regen               |
| Storm   | Sturm/Gewitter      |
| Snow    | Schnee              |
| Fog     | Nebel               |
| Wind    | Windig              |
| Hot     | Heiß                |
| Cold    | Kalt                |

### Time of Day Tags
| Tag       | Beschreibung    |
|-----------|-----------------|
| Dawn      | Morgengrauen    |
| Morning   | Morgen          |
| Noon      | Mittag          |
| Afternoon | Nachmittag      |
| Dusk      | Abenddämmerung  |
| Evening   | Abend           |
| Night     | Nacht           |
| Midnight  | Mitternacht     |

### Faction Tags
| Tag       | Beschreibung           |
|-----------|------------------------|
| Friendly  | Freundlich             |
| Neutral   | Neutral                |
| Hostile   | Feindlich              |
| Undead    | Untote                 |
| Fey       | Feen/Fey               |
| Fiend     | Teufel/Dämonen         |
| Celestial | Himmlische Wesen       |
| Elemental | Elementare             |
| Dragon    | Drachen                |
| Giant     | Riesen                 |
| Humanoid  | Humanoide              |
| Beast     | Bestien/Tiere          |

### Situation Tags
| Tag         | Beschreibung       |
|-------------|--------------------|
| Exploration | Erkundung          |
| Combat      | Kampf              |
| Social      | Soziale Interaktion|
| Stealth     | Schleichen         |
| Chase       | Verfolgungsjagd    |
| Rest        | Rast/Pause         |
| Tension     | Spannung           |
| Mystery     | Geheimnis/Rätsel   |
| Horror      | Horror/Schrecken   |
| Celebration | Feier/Fest         |
| Travel      | Reise              |
| Dungeon     | Dungeon-Erkundung  |
| Boss        | Bosskampf          |
| Victory     | Sieg               |
| Defeat      | Niederlage         |

> Datenbasis: `Presets/Playlists/**/` (`terrain_tags`, `weather_tags`, `time_of_day_tags`, `faction_tags`, `situation_tags` Frontmatter)
> Details: [docs/audio-system.md](./audio-system.md)

## Noch zu definieren
- Fraktionen (Kultur, Agenda, Gefahrenstufe)
- Orte (Typ, Infrastruktur, Stimmung)
- Dungeons (Themen, Gefahren, Rätsel)
- Loot (Material, Herkunft, Nutzung)

## ToDo
- ✅ Tags für Items definiert und implementiert
- ✅ Tags für Equipment/Terrains/Regions definiert
- ✅ Tags für Audio/Playlists definiert und implementiert (Phase 6.1)
- ⏳ Equipment/Terrains/Regions CreateSpecs um Tag-Felder erweitern
- ⏳ Automatisierte Konsistenzprüfung erweitern (`devkit lint tags`)
- ⏳ Tag-Felder für neue Entitäten (Fraktionen, Orte, Dungeons, Loot) definieren
