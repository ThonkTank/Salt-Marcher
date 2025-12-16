// src/workmodes/library/core/index-files.ts
// Generiert Index-Dateien für besseren Graph View

import type { App} from "obsidian";
import { TFile, TFolder } from "obsidian";
import { ENTITY_REGISTRY } from "../../../../Presets/lib/entity-registry";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('library-index-files');

const SALTMARCHER_DIR = "SaltMarcher";

/**
 * Erstellt oder aktualisiert eine Index-Datei mit Links zu allen Einträgen
 */
async function createIndexFile(
    app: App,
    filePath: string,
    title: string,
    description: string,
    directory: string
): Promise<void> {
    const folder = app.vault.getAbstractFileByPath(directory);
    if (!(folder instanceof TFolder)) {
        logger.debug(`Directory ${directory} not found, skipping index generation`);
        return;
    }

    // Sammle alle .md Dateien im Verzeichnis (rekursiv)
    const files: TFile[] = [];
    const collectFiles = (folder: TFolder) => {
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === "md") {
                files.push(child);
            } else if (child instanceof TFolder) {
                collectFiles(child);
            }
        }
    };
    collectFiles(folder);

    // Sortiere alphabetisch nach Namen
    files.sort((a, b) => a.basename.localeCompare(b.basename));

    // Generiere Markdown
    const lines: string[] = [];
    lines.push(`# ${title}`);
    lines.push("");
    lines.push(description);
    lines.push("");
    lines.push(`**Total:** ${files.length} entries`);
    lines.push("");

    // Gruppiere nach Unterordnern wenn vorhanden
    const groups = new Map<string, TFile[]>();
    for (const file of files) {
        const relativePath = file.path.substring(directory.length + 1);
        const slashIndex = relativePath.indexOf("/");
        const group = slashIndex !== -1 ? relativePath.substring(0, slashIndex) : "Other";

        if (!groups.has(group)) {
            groups.set(group, []);
        }
        groups.get(group)!.push(file);
    }

    // Sortiere Gruppen
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [groupName, groupFiles] of sortedGroups) {
        if (sortedGroups.length > 1 && groupName !== "Other") {
            lines.push(`## ${groupName}`);
            lines.push("");
        }

        for (const file of groupFiles) {
            lines.push(`- [[${file.basename}]]`);
        }
        lines.push("");
    }

    const content = lines.join("\n");

    // Erstelle oder aktualisiere Datei
    const existingFile = app.vault.getAbstractFileByPath(filePath);
    if (existingFile instanceof TFile) {
        await app.vault.modify(existingFile, content);
    } else {
        await app.vault.create(filePath, content);
    }
}

/**
 * Generiert Creatures.md Index
 */
export async function generateCreaturesIndex(app: App): Promise<void> {
    await createIndexFile(
        app,
        `${SALTMARCHER_DIR}/Creatures.md`,
        "Creatures",
        "Index of all creatures in the library.",
        ENTITY_REGISTRY.creatures.directory
    );
}

/**
 * Generiert Equipment.md Index
 */
export async function generateEquipmentIndex(app: App): Promise<void> {
    await createIndexFile(
        app,
        `${SALTMARCHER_DIR}/Equipment.md`,
        "Equipment",
        "Index of all equipment in the library.",
        ENTITY_REGISTRY.equipment.directory
    );
}

/**
 * Generiert Spells.md Index
 */
export async function generateSpellsIndex(app: App): Promise<void> {
    await createIndexFile(
        app,
        `${SALTMARCHER_DIR}/Spells.md`,
        "Spells",
        "Index of all spells in the library.",
        ENTITY_REGISTRY.spells.directory
    );
}

/**
 * Generiert Items.md Index
 */
export async function generateItemsIndex(app: App): Promise<void> {
    await createIndexFile(
        app,
        `${SALTMARCHER_DIR}/Items.md`,
        "Items",
        "Index of all magic items in the library.",
        ENTITY_REGISTRY.items.directory
    );
}

/**
 * Generiert Calendars.md Index
 */
export async function generateCalendarsIndex(app: App): Promise<void> {
    await createIndexFile(
        app,
        `${SALTMARCHER_DIR}/Calendars.md`,
        "Calendars",
        "Index of all calendars in the library.",
        ENTITY_REGISTRY.calendars.directory
    );
}

/**
 * Generiert Library.md Hub-Datei
 */
export async function generateLibraryHub(app: App): Promise<void> {
    const lines: string[] = [];
    lines.push("# Library");
    lines.push("");
    lines.push("Central hub for all Salt Marcher library content.");
    lines.push("");
    lines.push("## Categories");
    lines.push("");
    lines.push("- [[Creatures]] - Monsters, animals, and NPCs");
    lines.push("- [[Equipment]] - Weapons, armor, tools, and adventuring gear");
    lines.push("- [[Spells]] - Spell compendium");
    lines.push("- [[Items]] - Magic items and artifacts");
    lines.push("- [[Calendars]] - Calendar systems and timekeeping");
    lines.push("");

    const content = lines.join("\n");
    const filePath = `${SALTMARCHER_DIR}/Library.md`;
    const existingFile = app.vault.getAbstractFileByPath(filePath);

    if (existingFile instanceof TFile) {
        await app.vault.modify(existingFile, content);
    } else {
        await app.vault.create(filePath, content);
    }
}

/**
 * Generiert alle Index-Dateien
 */
export async function generateAllIndexes(app: App): Promise<void> {
    logger.debug("Generating all library indexes...");

    // Stelle sicher dass SaltMarcher Verzeichnis existiert
    const saltmarcherFolder = app.vault.getAbstractFileByPath(SALTMARCHER_DIR);
    if (!saltmarcherFolder) {
        try {
            await app.vault.createFolder(SALTMARCHER_DIR);
        } catch (err) {
            // Ignore if folder was created concurrently
            if (!app.vault.getAbstractFileByPath(SALTMARCHER_DIR)) {
                throw err;
            }
        }
    }

    await Promise.all([
        generateCreaturesIndex(app),
        generateEquipmentIndex(app),
        generateSpellsIndex(app),
        generateItemsIndex(app),
        generateCalendarsIndex(app),
        generateLibraryHub(app)
    ]);

    logger.debug("All indexes generated successfully");
}
