// This is a typescript file meant to be run through deno: https://deno.com/
// It now reads from the reorganized rulebook directories to recreate the
// combined SRD markdown document.

const orderedContentPaths = [
    '../Admin-Legal/00_Legal.md',
    '../Gameplay/01_PlayingTheGame.md',
    '../CharacterFeatures/02_CharacterCreation.md',
    '../CharacterFeatures/03_Classes',
    '../CharacterFeatures/04_CharacterOrigins.md',
    '../CharacterFeatures/05_Feats.md',
    '../CharacterFeatures/06_Equipment.md',
    '../Spells/07_Spells.md',
    '../Gameplay/08_RulesGlossary.md',
    '../Gameplay/09_GameplayToolbox.md',
    '../Items/10_MagicItems.md',
    '../Statblocks/11_Monsters.md',
    '../Statblocks/12_MonstersA-Z.md',
    '../Statblocks/13_Animals.md',
];

function resolve(path: string): URL {
    return new URL(path, import.meta.url);
}

function collectPaths(path: string): string[] {
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const url = resolve(normalizedPath);
    const info = Deno.statSync(url);

    if (info.isDirectory) {
        const entries = [...Deno.readDirSync(url)];
        const files = entries
            .filter((entry) => entry.isFile)
            .map((entry) => `${normalizedPath}/${entry.name}`)
            .sort();
        const subdirectories = entries
            .filter((entry) => entry.isDirectory)
            .map((entry) => `${normalizedPath}/${entry.name}`)
            .sort();

        return files.concat(subdirectories.flatMap((subdir) => collectPaths(subdir)));
    }

    return [normalizedPath];
}

const allContent = orderedContentPaths
    .flatMap((entry) => collectPaths(entry))
    .map((filePath) => Deno.readTextFileSync(resolve(filePath)));

const outputUrl = resolve('../Admin-Legal/DND-SRD-5.2-CC.md');
Deno.writeTextFileSync(outputUrl, allContent.join('\n'));
