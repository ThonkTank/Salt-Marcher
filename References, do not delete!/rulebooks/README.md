# Rulebook Library Overview

The `rulebooks/` directory now organizes the SRD source material into thematic collections so that specific rulesets can be found without scanning the full document.  Administrative records live alongside the tools needed to rebuild the combined SRD reference.

## Structure
```
rulebooks/
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

## Feature Areas
- **Administrative & Legal** – Houses the canonical SRD text, licensing requirements, and upstream project notes that govern redistribution.
- **Character Features** – Information needed when building or leveling characters, including class-specific breakdowns and equipment lists.
- **Gameplay Rules** – On-table rulings, glossary references, and encounter toolbox materials for quick adjudication.
- **Spells & Items** – Spell catalogues and magic item references for casters and treasure tables.
- **Statblocks** – Monsters, animals, and remaining cleanup tasks for bestiary content.
- **Tools** – Automation used to rebuild the concatenated SRD markdown from the themed sections.

## Data Flow
1. Source markdown files are curated in the themed folders so that related rules stay together.
2. The tooling in `Tools/` walks those folders in sequence and stitches the content together into `Admin-Legal/DND-SRD-5.2-CC.md`.
3. The legal and administrative folder keeps the regenerated output alongside the original SRD text and licensing terms for reference.

## Script Responsibilities
- **Tools/concat_all_files_into_one.ts** – Deno script that reads the themed folders in SRD order, recurses through class files, and writes the merged SRD markdown to `Admin-Legal/DND-SRD-5.2-CC.md` for distribution.
