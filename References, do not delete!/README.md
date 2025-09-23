# Reference Library Overview

This directory collects background material that informs the Salt-Marcher project.  The resources are now grouped by their primary focus so that it is easier to find the right document when researching rules or gameplay systems.

## Directory Structure
```
References, do not delete!/
├── README.md
├── mechanics/
│   └── hexagonal-grids/
│       └── Hexagonal Grids.pdf
└── rulebooks/
    ├── Admin-Legal/
    │   ├── 00_Legal.md
    │   ├── DND-SRD-5.2-CC.md
    │   ├── DND-SRD-5.2.1-Table-of-Contents.txt
    │   ├── DND-SRD-5.2.1.txt
    │   ├── License.md
    │   └── README.md
    ├── CharacterFeatures/
    │   ├── 02_CharacterCreation.md
    │   ├── 03_Classes/
    │   ├── 04_CharacterOrigins.md
    │   ├── 05_Feats.md
    │   └── 06_Equipment.md
    ├── Gameplay/
    │   ├── 01_PlayingTheGame.md
    │   ├── 08_RulesGlossary.md
    │   └── 09_GameplayToolbox.md
    ├── Items/
    │   └── 10_MagicItems.md
    ├── Spells/
    │   └── 07_Spells.md
    ├── Statblocks/
    │   ├── 11_Monsters.md
    │   ├── 12_MonstersA-Z.md
    │   ├── 13_Animals.md
    │   └── TODO.md
    └── Tools/
        └── concat_all_files_into_one.ts
```

## Folder Responsibilities
- **mechanics/** – References that describe mechanical systems used in world or encounter design.
- **rulebooks/Admin-Legal/** – Licensing, legal notices, and master copies of the SRD text that guide overall usage.
- **rulebooks/CharacterFeatures/** – Character build resources such as creation rules, classes, origins, feats, and core gear.
- **rulebooks/Gameplay/** – Rules that describe how to play, adjudicate, and reference core mechanics during sessions.
- **rulebooks/Items/** – Loot and equipment references for magic items beyond the core equipment lists.
- **rulebooks/Spells/** – Spell listings and descriptions.
- **rulebooks/Statblocks/** – Creature stat blocks and supporting notes that are still being cleaned up.
- **rulebooks/Tools/** – Utility scripts that help maintain or rebuild the SRD material from the reorganized sources.

## File Summaries
- **mechanics/hexagonal-grids/Hexagonal Grids.pdf** – Guide to building and reading hexagonal grid maps for encounters and travel.
- **rulebooks/Admin-Legal/00_Legal.md** – The legal chapter of the SRD outlining usage requirements.
- **rulebooks/Admin-Legal/DND-SRD-5.2.1.txt** – Complete 5.2.1 System Reference Document provided under the CC-BY-4.0 license.
- **rulebooks/Admin-Legal/DND-SRD-5.2.1-Table-of-Contents.txt** – Quick navigation index for the SRD chapters.
- **rulebooks/Admin-Legal/DND-SRD-5.2-CC.md** – Concatenated markdown build of the SRD produced from the themed sections.
- **rulebooks/Admin-Legal/README.md** – Notes from the upstream markdown conversion project, retained for historical context.
- **rulebooks/CharacterFeatures/03_Classes/** – Individual class breakdowns with numbered files for each class.
- **rulebooks/Spells/07_Spells.md** – Full spell list and spell descriptions from the SRD.
- **rulebooks/Statblocks/TODO.md** – Outstanding cleanup tasks for monster and animal stat blocks.
- **rulebooks/Tools/concat_all_files_into_one.ts** – Deno script that stitches the reorganized markdown sections back into a single SRD document in `Admin-Legal`.
